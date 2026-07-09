/**
 * /api/quote-pdf/[id]
 * GET — Generate a fully branded PDF for a quote with iSecurify branding
 * Supports INR and USD billing currencies, live FX for non-finalized quotes.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatDate, formatINRPdf, formatUSD, formatLineAmountPdf } from '@/lib/currency'

export const dynamic = 'force-dynamic'

// ── Brand Colors (RGB) ──
const B = {
  purple: [129, 38, 113] as const,
  purpleDark: [87, 26, 77] as const,
  purpleLight: [240, 200, 230] as const,
  teal: [27, 136, 125] as const,
  tealLight: [213, 241, 240] as const,
  orange: [196, 108, 29] as const,
  orangeLight: [255, 232, 210] as const,
  blue: [20, 111, 158] as const,
  dark: [43, 42, 41] as const,
  muted: [100, 116, 139] as const,
  lightGray: [248, 250, 252] as const,
  white: [255, 255, 255] as const,
  border: [203, 213, 225] as const,
}

const FINALIZED_STATUSES = new Set(['SENT', 'APPROVED', 'VIEWED'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params

    const quote = await db.quote.findUnique({
      where: { id },
      include: {
        client: true,
        framework: true,
        tier: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
        approvals: {
          include: { actor: { select: { name: true, email: true, role: true } } },
          orderBy: { createdAt: 'asc' },
        },
        createdBy: { select: { name: true, email: true, role: true } },
        approvedBy: { select: { name: true, email: true, role: true } },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // For non-finalized quotes, recompute with live FX rate
    let q = { ...quote }
    if (!FINALIZED_STATUSES.has(quote.status)) {
      const fx = await db.fxRate.findFirst()
      const liveRate = fx?.rate ?? 83
      const subtotalAfterDiscount = Math.max(0, q.subtotalInr - q.discountInr)
      const newGst = q.billingCurrency === 'USD' ? 0 : Math.round(subtotalAfterDiscount * (q.gstRateSnapshot / 100))
      const newTotal = subtotalAfterDiscount + newGst
      const newUsd = Math.round((newTotal / liveRate) * 100) / 100

      // Update the stored quote
      await db.quote.update({
        where: { id },
        data: {
          usdInrRateSnapshot: liveRate,
          gstAmountInr: newGst,
          totalInr: newTotal,
          totalUsd: newUsd,
        },
      })

      q.usdInrRateSnapshot = liveRate
      q.gstAmountInr = newGst
      q.totalInr = newTotal
      q.totalUsd = newUsd
    }

    const isUsd = q.billingCurrency === 'USD'
    const amtFmt = (n: number) => formatLineAmountPdf(n, q.billingCurrency, q.usdInrRateSnapshot)

    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()   // 210
    const pageH = doc.internal.pageSize.getHeight()   // 297
    const mL = 20  // left margin
    const mR = 20  // right margin
    const contentW = pageW - mL - mR  // 170
    let y = 0

    // ══════════════════════════════════════════════════════════
    // HEADER
    // ══════════════════════════════════════════════════════════

    // Full-width teal accent stripe at very top
    doc.setFillColor(...B.teal)
    doc.rect(0, 0, pageW, 3.5, 'F')

    // Thin orange line
    doc.setFillColor(...B.orange)
    doc.rect(0, 3.5, pageW, 1, 'F')

    // Purple header band (from y=4.5 to y=48)
    const headerTop = 4.5
    const headerH = 44
    doc.setFillColor(...B.purple)
    doc.rect(0, headerTop, pageW, headerH, 'F')

    // ── Logo: white rounded rectangle + icon ──
    const logoSize = 22
    const logoX = mL
    const logoY = headerTop + 12
    const pillPad = 3
    const pillSize = logoSize + pillPad * 2

    // Solid white opaque pill background for contrast
    doc.setFillColor(...B.white)
    doc.roundedRect(logoX, logoY - pillPad, pillSize, pillSize, 3, 3, 'F')

    // Add the icon logo on the white pill
    let hasLogo = false
    try {
      const fs = await import('fs')
      const path = await import('path')
      const logoPath = path.join(process.cwd(), 'public', 'logo-full.png')
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath)
        const logoB64 = logoData.toString('base64')
        doc.addImage(logoB64, 'PNG', logoX + pillPad, logoY, logoSize, logoSize)
        hasLogo = true
      }
    } catch { /* fallback to text logo */ }

    // ── Company name & subtitle ──
    const textStartX = hasLogo ? logoX + pillSize + 5 : mL + 2

    doc.setTextColor(...B.white)
    doc.setFontSize(20)
    doc.setFont('helvetica', 'bold')
    doc.text('iSecurify', textStartX, logoY + 5)

    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(220, 195, 215)
    doc.text('GRC Compliance Proposal', textStartX, logoY + 11)

    // Quote ID badge (white pill with purple text)
    const badgeW = 58
    const badgeH = 7
    const badgeY = logoY + 15
    doc.setFillColor(...B.white)
    doc.roundedRect(textStartX, badgeY, badgeW, badgeH, 1.5, 1.5, 'F')
    doc.setTextColor(...B.purple)
    doc.setFontSize(7.5)
    doc.setFont('helvetica', 'bold')
    doc.text(`QUOTE  ${id.slice(-8).toUpperCase()}`, textStartX + 4, badgeY + 5)

    // ── Right side: date, valid until, version ──
    const rX = pageW - mR
    doc.setTextColor(...B.white)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${formatDate(q.createdAt)}`, rX, headerTop + 14, { align: 'right' })
    doc.text(`Valid Until: ${formatDate(q.validUntil)}`, rX, headerTop + 21, { align: 'right' })
    doc.text(`Version: ${q.version}`, rX, headerTop + 28, { align: 'right' })

    // Currency badge
    doc.setFillColor(...B.teal)
    const currBadgeW = 22
    const currBadgeH = 6
    const currBadgeY = headerTop + 33
    doc.roundedRect(rX - currBadgeW, currBadgeY, currBadgeW, currBadgeH, 1.5, 1.5, 'F')
    doc.setTextColor(...B.white)
    doc.setFontSize(6.5)
    doc.setFont('helvetica', 'bold')
    doc.text(isUsd ? 'USD' : 'INR', rX - currBadgeW / 2, currBadgeY + 4.2, { align: 'center' })

    // Status badge
    const statusText = (q.status as string).replace(/_/g, ' ').toUpperCase()
    const statusColor = q.status === 'APPROVED' ? B.teal
      : q.status === 'REJECTED' ? [220, 38, 38] as const
      : q.status === 'SENT' ? B.blue
      : B.orange
    const sBadgeW = 40
    const sBadgeH = 8
    const sBadgeY = headerTop + 33
    doc.setFillColor(...statusColor)
    doc.roundedRect(rX - currBadgeW - sBadgeW - 4, sBadgeY, sBadgeW, sBadgeH, 2, 2, 'F')
    doc.setTextColor(...B.white)
    doc.setFontSize(7)
    doc.text(statusText, rX - currBadgeW - sBadgeW / 2 - 4, sBadgeY + 5.5, { align: 'center' })

    // ══════════════════════════════════════════════════════════
    // BODY CONTENT
    // ══════════════════════════════════════════════════════════
    y = headerTop + headerH + 10  // start below header

    // ── Client Details ──
    y = drawSectionTitle(doc, 'Client Details', mL, pageW, y, B.teal)

    doc.setFontSize(10)
    const clientRows: [string, string][] = [
      ['Company Name', q.client?.companyName || '—'],
      ['Sector', q.client?.sector || '—'],
      ['Company Size', q.client?.companySize || '—'],
      ['Country', q.client?.country || 'India'],
    ]

    for (const [label, value] of clientRows) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...B.dark)
      doc.text(`${label}:`, mL, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(value), mL + 42, y)
      y += 6
    }

    // Contacts
    let contacts: Array<{ name: string; email: string; phone?: string; role?: string }> = []
    if (q.client?.contactsJson) {
      try { contacts = JSON.parse(q.client.contactsJson) } catch { /* ignore */ }
    }
    for (const c of contacts) {
      doc.setFont('helvetica', 'bold')
      doc.setTextColor(...B.dark)
      doc.text('Contact:', mL, y)
      doc.setFont('helvetica', 'normal')
      const contactText = `${c.name}${c.role ? ` (${c.role})` : ''} — ${c.email}${c.phone ? ` — ${c.phone}` : ''}`
      doc.text(contactText, mL + 42, y)
      y += 6
    }
    y += 4

    // ── Compliance Services (Framework & Tier) ──
    y = drawSectionTitle(doc, 'Compliance Services', mL, pageW, y, B.teal)

    // Show all frameworks from consulting_fee line items
    const consultingLines = (q.lineItems || []).filter((l: { lineType: string }) => l.lineType === 'consulting_fee')

    doc.setFontSize(10)
    doc.setTextColor(...B.dark)

    if (consultingLines.length > 0) {
      for (const cl of consultingLines) {
        const fwName = cl.description.replace(/ — Consulting Fee.*/, '')
        doc.setFont('helvetica', 'bold')
        doc.text('•', mL + 2, y)
        doc.setFont('helvetica', 'normal')
        doc.text(fwName, mL + 7, y)
        y += 6
      }
    } else if (q.framework) {
      doc.text(q.framework.name, mL, y)
      y += 6
    }

    // Tier (with description) and FX Rate
    const tierFxY = y + 2
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...B.dark)
    doc.text('Tier:', mL, tierFxY)
    doc.setFont('helvetica', 'normal')
    const tierLabel = q.tier?.name || '—'
    const tierDesc = (q.tier as { description?: string | null } | undefined)?.description
    doc.text(tierDesc ? `${tierLabel} (${tierDesc})` : tierLabel, mL + 14, tierFxY)

    if (isUsd) {
      doc.setFont('helvetica', 'bold')
      doc.text('FX Rate:', mL + 100, tierFxY)
      doc.setFont('helvetica', 'normal')
      doc.text(`USD/INR ${q.usdInrRateSnapshot}`, mL + 120, tierFxY)
    }
    y = tierFxY + 10

    // ── Line Items Table ──
    y = drawSectionTitle(doc, 'Pricing Breakdown', mL, pageW, y, B.purple)

    const billedLines = (q.lineItems || []).filter((l: { lineType: string }) => l.lineType !== 'internal_time')
    const amountColLabel = isUsd ? 'Amount (USD)' : 'Amount (INR)'

    const tableBody = billedLines.map((item: { description: string; lineType: string; amountInr: number }, idx: number) => [
      String(idx + 1),
      item.description,
      item.lineType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      item.amountInr < 0 ? `-${amtFmt(Math.abs(item.amountInr))}` : amtFmt(item.amountInr),
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Description', 'Type', amountColLabel]],
      body: tableBody,
      margin: { left: mL, right: mR },
      headStyles: {
        fillColor: [...B.purple],
        textColor: [...B.white],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 8.5,
        textColor: [...B.dark],
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
        lineColor: [...B.border],
        lineWidth: 0.1,
      },
      alternateRowStyles: { fillColor: [...B.lightGray] },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 30 },
        3: { cellWidth: 48, halign: 'right' },
      },
    })

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 100
    y += 10

    // Page break check
    if (y > 235) { doc.addPage(); y = 20; }

    // ── Summary / Totals ──
    y = drawSectionTitle(doc, 'Summary', mL, pageW, y, B.teal)
    y += 2

    const rightCol = pageW - mR

    // Subtotal
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    doc.setTextColor(...B.dark)
    doc.text('Subtotal', mL, y)
    doc.text(amtFmt(q.subtotalInr), rightCol, y, { align: 'right' })
    y += 7

    // Discount
    if (q.discountInr > 0) {
      const isFixed = q.discountMode === 'fixed'
      const discLabel = isFixed ? 'Discount (Fixed)' : `Discount (${q.discountPct}%)`
      doc.setTextColor(220, 38, 38)
      doc.text(discLabel, mL, y)
      doc.text(`-${amtFmt(q.discountInr)}`, rightCol, y, { align: 'right' })
      y += 7
    }

    // GST (only for INR)
    if (!isUsd) {
      doc.setTextColor(...B.dark)
      doc.text(`GST @ ${q.gstRateSnapshot}%`, mL, y)
      doc.text(amtFmt(q.gstAmountInr), rightCol, y, { align: 'right' })
      y += 4
    }

    // Grand total highlight box
    y += 4
    const gtBoxH = 12
    doc.setFillColor(...B.purpleLight)
    doc.roundedRect(mL, y, contentW, gtBoxH, 2, 2, 'F')
    doc.setDrawColor(...B.purple)
    doc.setLineWidth(0.4)
    doc.roundedRect(mL, y, contentW, gtBoxH, 2, 2, 'S')

    const totalLabel = isUsd ? 'Grand Total (USD)' : 'Grand Total (INR)'
    doc.setTextColor(...B.purple)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.text(totalLabel, mL + 6, y + 8)
    doc.text(amtFmt(q.totalInr), rightCol - 6, y + 8, { align: 'right' })
    y += gtBoxH + 4

    // Show the other currency as reference
    if (isUsd) {
      doc.setTextColor(...B.muted)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`Equivalent INR: ${formatINRPdf(q.totalInr)} @ ${q.usdInrRateSnapshot}`, mL, y)
      y += 10
    }

    // Retainer note
    if (q.includeRetainer && q.retainerAmountInr > 0) {
      doc.setFillColor(...B.orangeLight)
      doc.roundedRect(mL, y, contentW, 9, 1.5, 1.5, 'F')
      doc.setTextColor(...B.orange)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`Includes Annual Retainer: ${amtFmt(q.retainerAmountInr)}`, mL + 4, y + 6)
      y += 14
    }

    // ── Approval & Authorization ──
    if (y > 215) { doc.addPage(); y = 20; }
    y = drawSectionTitle(doc, 'Approval & Authorization', mL, pageW, y, B.purple)
    y += 2

    y = drawInfoCard(doc, mL, y, contentW, 'Created By', [
      `${q.createdBy?.name || 'System'} (${q.createdBy?.role || 'N/A'})`,
      q.createdBy?.email || '',
    ], B.teal, B.tealLight)

    y += 3
    if (q.approvedBy) {
      y = drawInfoCard(doc, mL, y, contentW, 'Approved By', [
        `${q.approvedBy.name} (${q.approvedBy.role || 'N/A'})`,
        q.approvedBy.email || '',
      ], B.teal, B.tealLight)
    } else {
      y = drawInfoCard(doc, mL, y, contentW, 'Approved By', ['Pending Approval'], B.orange, B.orangeLight)
    }
    y += 8

    // ── Payment Terms ──
    if (y > 225) { doc.addPage(); y = 20; }
    y = drawSectionTitle(doc, 'Payment Terms', mL, pageW, y, B.teal)
    y += 2

    autoTable(doc, {
      startY: y,
      head: [['Milestone', 'Amount']],
      body: [
        ['Advance (40%)', amtFmt(q.totalInr * 0.4)],
        ['Midway (40%)', amtFmt(q.totalInr * 0.4)],
        ['On Completion (20%)', amtFmt(q.totalInr * 0.2)],
      ],
      margin: { left: mL, right: mR },
      headStyles: {
        fillColor: [...B.teal],
        textColor: [...B.white],
        fontStyle: 'bold',
        fontSize: 9,
        cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
      },
      bodyStyles: {
        fontSize: 9,
        textColor: [...B.dark],
        cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      },
      alternateRowStyles: { fillColor: [...B.tealLight] },
      columnStyles: {
        0: { cellWidth: 65, fontStyle: 'bold' },
        1: { cellWidth: contentW - 65, halign: 'right' },
      },
      theme: 'grid',
      styles: { lineWidth: 0.1, lineColor: [...B.border] },
    })

    y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 30)
    y += 10

    // ── Approval Timeline ──
    if (q.approvals && q.approvals.length > 0) {
      if (y > 215) { doc.addPage(); y = 20; }
      y = drawSectionTitle(doc, 'Approval Timeline', mL, pageW, y, B.purple)

      const timelineBody = q.approvals.map((a: { action: string; actor: { name: string; role: string }; comment: string | null; createdAt: string; amountBefore: number | null; amountAfter: number | null }) => [
        a.action.charAt(0).toUpperCase() + a.action.slice(1),
        a.actor?.name || 'System',
        a.comment || '—',
        a.amountBefore !== null && a.amountAfter !== null && a.amountBefore !== a.amountAfter
          ? `${amtFmt(a.amountBefore)} -> ${amtFmt(a.amountAfter)}`
          : '—',
        formatDate(a.createdAt),
      ])

      autoTable(doc, {
        startY: y,
        head: [['Action', 'By', 'Comment', 'Amount Change', 'Date']],
        body: timelineBody,
        margin: { left: mL, right: mR },
        headStyles: {
          fillColor: [...B.purple],
          textColor: [...B.white],
          fontStyle: 'bold',
          fontSize: 8,
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [...B.dark],
          cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
          overflow: 'linebreak',
        },
        alternateRowStyles: { fillColor: [...B.lightGray] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 26 },
          2: { cellWidth: 56 },
          3: { cellWidth: 34, halign: 'right' },
          4: { cellWidth: 28 },
        },
        theme: 'grid',
        styles: { lineWidth: 0.1, lineColor: [...B.border] },
      })

      y = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? (y + 30)
      y += 10
    }

    // ── Internal Time (Advisory — Not Billed) ──
    const internalLines = (q.lineItems || []).filter((l: { lineType: string }) => l.lineType === 'internal_time')
    if (internalLines.length > 0) {
      if (y > 235) { doc.addPage(); y = 20; }

      const boxH = 8 + internalLines.length * 5
      doc.setFillColor(...B.lightGray)
      doc.roundedRect(mL, y, contentW, boxH, 2, 2, 'F')
      doc.setTextColor(...B.muted)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('Internal Time Cost (Advisory — Not Billed)', mL + 5, y + 6)
      y += 10
      for (const line of internalLines) {
        doc.text(line.description, mL + 8, y)
        y += 5
      }
      y += 4
    }

    // ── Notes ──
    if (q.notes) {
      if (y > 240) { doc.addPage(); y = 20; }
      y += 4
      y = drawSectionTitle(doc, 'Notes', mL, pageW, y, B.orange)
      doc.setTextColor(...B.dark)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const splitNotes = doc.splitTextToSize(q.notes, contentW)
      doc.text(splitNotes, mL, y + 2)
    }

    // ══════════════════════════════════════════════════════════
    // FOOTER — On every page
    // ══════════════════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      const ph = doc.internal.pageSize.getHeight()

      // Teal accent bar at bottom
      doc.setFillColor(...B.teal)
      doc.rect(0, ph - 3, pageW, 3, 'F')

      // Divider line
      doc.setDrawColor(...B.border)
      doc.setLineWidth(0.3)
      doc.line(mL, ph - 16, pageW - mR, ph - 16)

      // Footer text
      doc.setTextColor(...B.muted)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Confidential — iSecurify GRC Pricing Platform', mL, ph - 8)
      doc.text(`Valid until ${formatDate(q.validUntil)}  |  Page ${i} of ${totalPages}`, pageW - mR, ph - 8, { align: 'right' })
    }

    const pdfBuffer = doc.output('arraybuffer')

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="iSecurify-Quote-${id.slice(-8).toUpperCase()}.pdf"`,
      },
    })
  } catch (err) {
    console.error('[GET /api/quote-pdf/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to generate PDF', details: String(err) }, { status: 500 })
  }
}

// ── Helper: Draw a section title with colored underline ──
function drawSectionTitle(
  doc: ReturnType<typeof import('jspdf').default>,
  title: string,
  margin: number,
  pageW: number,
  y: number,
  color: readonly number[],
): number {
  // Ensure we don't go off-page
  if (y > 270) {
    doc.addPage()
    y = 20
  }
  doc.setTextColor(...color)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, y)
  y += 2.5
  doc.setDrawColor(...color)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  return y + 7
}

// ── Helper: Draw an info card with colored left border ──
function drawInfoCard(
  doc: ReturnType<typeof import('jspdf').default>,
  x: number,
  y: number,
  w: number,
  label: string,
  lines: string[],
  accentColor: readonly number[],
  bgColor: readonly number[],
): number {
  const validLines = lines.filter(l => l)
  const h = 8 + validLines.length * 5

  // Background
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y, w, h, 1.5, 1.5, 'F')

  // Left accent bar
  doc.setFillColor(...accentColor)
  doc.rect(x, y, 2.5, h, 'F')

  // Label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...accentColor)
  doc.text(label + ':', x + 6, y + 5.5)

  // Value lines
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...B.dark)
  doc.setFontSize(9)
  let ly = y + 11
  for (const line of validLines) {
    doc.text(line, x + 6, ly)
    ly += 5
  }
  return y + h + 2
}