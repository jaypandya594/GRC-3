/**
 * /api/quote-pdf/[id]
 * GET — Generate a fully branded PDF for a quote with iSecurify branding
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { formatDate, formatINR, formatUSD } from '@/lib/currency'

export const dynamic = 'force-dynamic'

// ── Brand Colors (RGB) ──
const BRAND = {
  purple: [129, 38, 113] as const,      // #812671 — primary
  purpleDark: [87, 26, 77] as const,     // #571A4D
  purpleLight: [240, 200, 230] as const,  // #F0C8E6
  teal: [27, 136, 125] as const,         // #1B887D — secondary
  tealLight: [213, 241, 240] as const,   // #D5F1F0
  orange: [196, 108, 29] as const,       // #C46C1D — accent
  orangeLight: [255, 232, 210] as const,  // #FFE8D2
  blue: [20, 111, 158] as const,         // #146F9E
  dark: [43, 42, 41] as const,           // #2B2A29 — text
  muted: [100, 116, 139] as const,       // #64748B
  lightGray: [248, 250, 252] as const,   // #F8FAFC
  white: [255, 255, 255] as const,
  border: [203, 213, 225] as const,      // #CBD5E1
}

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

    const { default: jsPDF } = await import('jspdf')
    const { default: autoTable } = await import('jspdf-autotable')

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const pageH = doc.internal.pageSize.getHeight()
    const m = 20 // margin
    const colW = pageW - m * 2

    // ══════════════════════════════════════════════
    // HEADER — Branded gradient-style header
    // ══════════════════════════════════════════════
    // Main purple header bar
    doc.setFillColor(...BRAND.purple)
    doc.rect(0, 0, pageW, 44, 'F')

    // Teal accent stripe at top
    doc.setFillColor(...BRAND.teal)
    doc.rect(0, 0, pageW, 3, 'F')

    // Orange accent line
    doc.setFillColor(...BRAND.orange)
    doc.rect(0, 3, pageW, 0.8, 'F')

    // Try to add logo
    let logoAdded = false
    try {
      const fs = await import('fs')
      const path = await import('path')
      const logoPath = path.join(process.cwd(), 'public', 'logo-small.png')
      if (fs.existsSync(logoPath)) {
        const logoData = fs.readFileSync(logoPath)
        const logoB64 = logoData.toString('base64')
        doc.addImage(logoB64, 'PNG', m, 10, 40, 18.3)
        logoAdded = true
      }
    } catch { /* fallback to text */ }

    // Wide logo already includes "iSecurify" text, so just add subtitle
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(210, 180, 200) // light purple
    doc.text('GRC Compliance Proposal', logoAdded ? m + 45 : m, 24)

    // Quote ID badge
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(255, 255, 255)
    doc.roundedRect(logoAdded ? m + 45 : m, 31, 60, 7, 1, 1, 'F')
    doc.setTextColor(...BRAND.purple)
    doc.setFontSize(8)
    doc.setFont('helvetica', 'bold')
    doc.text(`QUOTE  ${id.slice(-8).toUpperCase()}`, (logoAdded ? m + 45 : m) + 4, 35.5)

    // Right side — meta info
    doc.setTextColor(...BRAND.white)
    doc.setFontSize(9)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date: ${formatDate(quote.createdAt)}`, pageW - m, 14, { align: 'right' })
    doc.text(`Valid Until: ${formatDate(quote.validUntil)}`, pageW - m, 20, { align: 'right' })
    doc.text(`Version: ${quote.version}`, pageW - m, 26, { align: 'right' })

    // Status badge on right
    const statusText = (quote.status as string).replace(/_/g, ' ').toUpperCase()
    const statusColor = quote.status === 'APPROVED' ? BRAND.teal
      : quote.status === 'REJECTED' ? [220, 38, 38] as const
      : quote.status === 'SENT' ? BRAND.blue
      : BRAND.orange
    doc.setFillColor(...statusColor)
    doc.roundedRect(pageW - m - 40, 30, 40, 8, 1.5, 1.5, 'F')
    doc.setTextColor(...BRAND.white)
    doc.setFontSize(7)
    doc.setFont('helvetica', 'bold')
    doc.text(statusText, pageW - m - 20, 34.8, { align: 'center' })

    // ══════════════════════════════════════════════
    // BODY CONTENT
    // ══════════════════════════════════════════════
    let y = 54

    // ── Client Details ──
    y = sectionTitle(doc, 'Client Details', m, pageW, y, BRAND.teal)

    doc.setTextColor(...BRAND.dark)
    doc.setFontSize(10)
    const clientInfo = [
      ['Company Name', quote.client?.companyName || '—'],
      ['Sector', quote.client?.sector || '—'],
      ['Company Size', quote.client?.companySize || '—'],
      ['Country', quote.client?.country || 'India'],
    ]
    for (const [label, value] of clientInfo) {
      doc.setFont('helvetica', 'bold')
      doc.text(`${label}:`, m, y)
      doc.setFont('helvetica', 'normal')
      doc.text(String(value), m + 42, y)
      y += 6
    }

    let contacts: Array<{ name: string; email: string; phone?: string; role?: string }> = []
    if (quote.client?.contactsJson) {
      try { contacts = JSON.parse(quote.client.contactsJson) } catch { /* ignore */ }
    }
    if (contacts.length > 0) {
      for (const c of contacts) {
        doc.setFont('helvetica', 'bold')
        doc.text('Contact:', m, y)
        doc.setFont('helvetica', 'normal')
        doc.text(`${c.name} (${c.role || 'N/A'}) — ${c.email}${c.phone ? ` — ${c.phone}` : ''}`, m + 42, y)
        y += 6
      }
    }
    y += 6

    // ── Framework & Tier ──
    y = sectionTitle(doc, 'Framework & Tier', m, pageW, y, BRAND.teal)
    doc.setTextColor(...BRAND.dark)
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Framework:', m, y)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.framework?.name || '—', m + 30, y)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.text('Tier:', m, y)
    doc.setFont('helvetica', 'normal')
    doc.text(quote.tier?.name || '—', m + 30, y)
    y += 6
    doc.setFont('helvetica', 'bold')
    doc.text('FX Rate:', m, y)
    doc.setFont('helvetica', 'normal')
    doc.text(`USD/INR ${quote.usdInrRateSnapshot}`, m + 30, y)
    y += 10

    // ── Line Items Table ──
    y = sectionTitle(doc, 'Line Items', m, pageW, y, BRAND.purple)

    const billedLines = (quote.lineItems || []).filter((l: { lineType: string }) => l.lineType !== 'internal_time')

    const tableBody = billedLines.map((item: { description: string; lineType: string; amountInr: number }, idx: number) => [
      String(idx + 1),
      item.description,
      item.lineType.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      item.amountInr < 0 ? `-${formatINR(Math.abs(item.amountInr))}` : formatINR(item.amountInr),
    ])

    autoTable(doc, {
      startY: y,
      head: [['#', 'Description', 'Type', 'Amount (INR)']],
      body: tableBody,
      margin: { left: m, right: m },
      headStyles: {
        fillColor: [...BRAND.purple],
        textColor: [...BRAND.white],
        fontStyle: 'bold',
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9, textColor: [...BRAND.dark] },
      alternateRowStyles: { fillColor: [...BRAND.lightGray] },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 'auto' },
        2: { cellWidth: 35 },
        3: { cellWidth: 35, halign: 'right' },
      },
    })

    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    if (y > 240) { doc.addPage(); y = 20; }

    // ── Summary / Totals ──
    y = sectionTitle(doc, 'Summary', m, pageW, y, BRAND.teal)
    y += 4

    const rightCol = pageW - m

    const addLine = (label: string, value: string, bold = false, color: readonly number[] = BRAND.dark) => {
      doc.setTextColor(...color)
      doc.setFont('helvetica', bold ? 'bold' : 'normal')
      doc.setFontSize(10)
      doc.text(label, m, y)
      doc.text(value, rightCol, y, { align: 'right' })
      y += 7
    }

    addLine('Subtotal', formatINR(quote.subtotalInr))
    if (quote.discountInr > 0) {
      const discLabel = quote.discountPct > 0 ? `Discount (${quote.discountPct}%)` : 'Discount'
      addLine(discLabel, `-${formatINR(quote.discountInr)}`, false, [220, 38, 38])
    }
    addLine(`GST @ ${quote.gstRateSnapshot}%`, formatINR(quote.gstAmountInr))

    // Grand total with brand highlight
    doc.setFillColor(...BRAND.purpleLight)
    doc.rect(m, y - 3, colW, 10, 'F')
    doc.setDrawColor(...BRAND.purple)
    doc.setLineWidth(0.3)
    doc.rect(m, y - 3, colW, 10, 'S')
    doc.setTextColor(...BRAND.purple)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('Grand Total (INR)', m + 4, y + 4)
    doc.text(formatINR(quote.totalInr), rightCol - 4, y + 4, { align: 'right' })
    y += 14

    doc.setTextColor(...BRAND.muted)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.text(`Grand Total (USD): ${formatUSD(quote.totalUsd)} @ ₹${quote.usdInrRateSnapshot}`, m, y)
    y += 10

    if (quote.includeRetainer && quote.retainerAmountInr > 0) {
      doc.setFillColor(...BRAND.orangeLight)
      doc.roundedRect(m, y - 3, colW, 8, 1, 1, 'F')
      doc.setTextColor(...BRAND.orange)
      doc.setFontSize(8)
      doc.setFont('helvetica', 'bold')
      doc.text(`Includes Annual Retainer: ${formatINR(quote.retainerAmountInr)}`, m + 4, y + 1.5)
      y += 12
    }

    // ── Approval & Authorization ──
    if (y > 220) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, 'Approval & Authorization', m, pageW, y, BRAND.purple)
    y += 2

    // Created By card
    y = infoCard(doc, m, y, colW, 'Created By', [
      `${quote.createdBy?.name || 'System'} (${quote.createdBy?.role || 'N/A'})`,
      quote.createdBy?.email || '',
    ], BRAND.teal, BRAND.tealLight)

    // Approved By card
    if (quote.approvedBy) {
      y = infoCard(doc, m, y + 4, colW, 'Approved By', [
        `${quote.approvedBy.name} (${quote.approvedBy.role || 'N/A'})`,
        quote.approvedBy.email || '',
      ], BRAND.teal, BRAND.tealLight)
    } else {
      y = infoCard(doc, m, y + 4, colW, 'Approved By', ['Pending Approval'], BRAND.orange, BRAND.orangeLight)
    }
    y += 8

    // ── Payment Terms ──
    if (y > 230) { doc.addPage(); y = 20; }
    y = sectionTitle(doc, 'Payment Terms', m, pageW, y, BRAND.teal)
    y += 2

    const terms = [
      ['Advance (40%)', formatINR(quote.totalInr * 0.4)],
      ['Midway (40%)', formatINR(quote.totalInr * 0.4)],
      ['On Completion (20%)', formatINR(quote.totalInr * 0.2)],
    ]

    // Payment schedule as a small styled table
    autoTable(doc, {
      startY: y,
      body: terms,
      margin: { left: m, right: m },
      headStyles: { fillColor: [...BRAND.teal], textColor: [...BRAND.white], fontStyle: 'bold', fontSize: 9 },
      head: [['Milestone', 'Amount']],
      bodyStyles: { fontSize: 9, textColor: [...BRAND.dark] },
      alternateRowStyles: { fillColor: [...BRAND.tealLight] },
      columnStyles: {
        0: { cellWidth: 60, fontStyle: 'bold' },
        1: { cellWidth: colW - 60, halign: 'right' },
      },
      theme: 'grid',
      styles: { lineWidth: 0.1, lineColor: [...BRAND.border] },
    })
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10

    // ── Approval Timeline ──
    if (quote.approvals && quote.approvals.length > 0) {
      if (y > 220) { doc.addPage(); y = 20; }
      y = sectionTitle(doc, 'Approval Timeline', m, pageW, y, BRAND.purple)

      const timelineBody = quote.approvals.map((a: { action: string; actor: { name: string; role: string }; comment: string | null; createdAt: string; amountBefore: number | null; amountAfter: number | null }) => [
        a.action.charAt(0).toUpperCase() + a.action.slice(1),
        a.actor?.name || 'System',
        a.comment || '—',
        a.amountBefore !== null && a.amountAfter !== null && a.amountBefore !== a.amountAfter
          ? `${formatINR(a.amountBefore)} → ${formatINR(a.amountAfter)}`
          : '—',
        formatDate(a.createdAt),
      ])

      autoTable(doc, {
        startY: y,
        head: [['Action', 'By', 'Comment', 'Amount Change', 'Date']],
        body: timelineBody,
        margin: { left: m, right: m },
        headStyles: { fillColor: [...BRAND.purple], textColor: [...BRAND.white], fontStyle: 'bold', fontSize: 8 },
        bodyStyles: { fontSize: 8, textColor: [...BRAND.dark] },
        alternateRowStyles: { fillColor: [...BRAND.lightGray] },
        columnStyles: {
          0: { cellWidth: 22 },
          1: { cellWidth: 28 },
          2: { cellWidth: 55 },
          3: { cellWidth: 35, halign: 'right' },
          4: { cellWidth: 25 },
        },
        theme: 'grid',
        styles: { lineWidth: 0.1, lineColor: [...BRAND.border] },
      })
    }

    // ── Internal Time (Advisory — Not Billed) ──
    const internalLines = (quote.lineItems || []).filter((l: { lineType: string }) => l.lineType === 'internal_time')
    if (internalLines.length > 0) {
      const lastY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable
      y = lastY ? lastY.finalY + 10 : y + 10
      if (y > 240) { doc.addPage(); y = 20; }

      doc.setFillColor(...BRAND.lightGray)
      doc.roundedRect(m, y - 5, colW, 6 + internalLines.length * 5, 2, 2, 'F')
      doc.setTextColor(...BRAND.muted)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'italic')
      doc.text('Internal Time Cost (Advisory — Not Billed)', m + 5, y)
      y += 5
      for (const line of internalLines) {
        doc.setFont('helvetica', 'italic')
        doc.setFontSize(8)
        doc.text(line.description, m + 8, y)
        y += 5
      }
    }

    // ── Notes ──
    if (quote.notes) {
      if (y > 240) { doc.addPage(); y = 20; }
      y += 6
      y = sectionTitle(doc, 'Notes', m, pageW, y, BRAND.orange)
      doc.setTextColor(...BRAND.dark)
      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      const splitNotes = doc.splitTextToSize(quote.notes, colW)
      doc.text(splitNotes, m, y + 2)
    }

    // ══════════════════════════════════════════════
    // FOOTER — On every page
    // ══════════════════════════════════════════════
    const totalPages = doc.getNumberOfPages()
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i)
      const ph = doc.internal.pageSize.getHeight()

      // Teal accent bar at bottom
      doc.setFillColor(...BRAND.teal)
      doc.rect(0, ph - 2.5, pageW, 2.5, 'F')

      // Divider line
      doc.setDrawColor(...BRAND.border)
      doc.setLineWidth(0.3)
      doc.line(m, ph - 15, pageW - m, ph - 15)

      // Footer text
      doc.setTextColor(...BRAND.muted)
      doc.setFontSize(7)
      doc.setFont('helvetica', 'normal')
      doc.text('Confidential — iSecurify GRC Pricing Platform', m, ph - 8)
      doc.text(`Valid until ${formatDate(quote.validUntil)}  |  Page ${i} of ${totalPages}`, pageW - m, ph - 8, { align: 'right' })
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

// ── Helper: Draw a section title with teal underline ──
function sectionTitle(
  doc: ReturnType<typeof import('jspdf').default>,
  title: string,
  margin: number,
  pageW: number,
  y: number,
  color: readonly number[],
): number {
  doc.setTextColor(...color)
  doc.setFontSize(12)
  doc.setFont('helvetica', 'bold')
  doc.text(title, margin, y)
  y += 2
  doc.setDrawColor(...color)
  doc.setLineWidth(0.6)
  doc.line(margin, y, pageW - margin, y)
  return y + 7
}

// ── Helper: Draw an info card with colored left border ──
function infoCard(
  doc: ReturnType<typeof import('jspdf').default>,
  x: number,
  y: number,
  w: number,
  label: string,
  lines: string[],
  accentColor: readonly number[],
  bgColor: readonly number[],
): number {
  const h = 6 + lines.filter(l => l).length * 5
  // Background
  doc.setFillColor(...bgColor)
  doc.roundedRect(x, y - 3, w, h, 1.5, 1.5, 'F')
  // Left accent bar
  doc.setFillColor(...accentColor)
  doc.rect(x, y - 3, 2.5, h, 'F')
  // Label
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...accentColor)
  doc.text(label + ':', x + 6, y + 1)
  // Value lines
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...BRAND.dark)
  doc.setFontSize(9)
  let ly = y + 6
  for (const line of lines) {
    if (line) {
      doc.text(line, x + 6, ly)
      ly += 5
    }
  }
  return y + h + 2
}