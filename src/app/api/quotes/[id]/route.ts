/**
 * /api/quotes/[id]
 * GET    — fetch a single quote with line items & approvals (live FX for non-finalized)
 * PUT    — update a quote (re-compute if selection changed)
 * DELETE — permanently delete a quote and its line items
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, GST_RATE, computeQuote } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

/** Statuses where the FX rate should stay frozen (client has seen the quote) */
const FINALIZED_STATUSES = new Set(['SENT', 'APPROVED', 'VIEWED'])

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const quote = await db.quote.findUnique({
      where: { id, tenantId: TENANT_ID },
      include: {
        client: true,
        framework: true,
        tier: true,
        createdBy: { select: { name: true, email: true } },
        lineItems: { orderBy: { sortOrder: 'asc' } },
        approvals: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true, email: true } } },
        },
      },
    })

    if (!quote) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // For non-finalized quotes, fetch live FX rate and recompute USD
    if (!FINALIZED_STATUSES.has(quote.status)) {
      const fx = await db.fxRate.findFirst()
      const liveRate = fx?.rate ?? 83
      if (liveRate !== quote.usdInrRateSnapshot) {
        const subtotalAfterDiscount = Math.max(0, quote.subtotalInr - quote.discountInr)
        const newGst = quote.billingCurrency === 'USD' ? 0 : Math.round(subtotalAfterDiscount * (quote.gstRateSnapshot / 100))
        const newTotal = subtotalAfterDiscount + newGst
        const newUsd = Math.round((newTotal / liveRate) * 100) / 100

        await db.quote.update({
          where: { id },
          data: {
            usdInrRateSnapshot: liveRate,
            gstAmountInr: newGst,
            totalInr: newTotal,
            totalUsd: newUsd,
          },
        })

        quote.usdInrRateSnapshot = liveRate
        quote.gstAmountInr = newGst
        quote.totalInr = newTotal
        quote.totalUsd = newUsd
      }
    }

    return NextResponse.json({ data: quote })
  } catch (err) {
    console.error('[GET /api/quotes/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to fetch quote' }, { status: 500 })
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await db.quote.findUnique({ where: { id, tenantId: TENANT_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    const body = await req.json()
    const { selection } = body as {
      selection?: {
        clientId: string
        frameworkId: string
        tierId: string
        billingCurrency?: string
        includeRetainer: boolean
        retainerMode?: string
        retainerCustomInr?: number | null
        selectedAuditorFeeIds: string[]
        selectedAddonIds: string[]
        grcToolEnabled: boolean
        grcToolId: string | null
        grcToolCustomFee: number | null
        dpoVcisoPackageId: string | null
        internalHours: number
        internalHourlyRate: number
        discountPct: number
        discountMode?: string
        discountFixedInr?: number
        discountReason: string
        validUntilDays: number
        notes: string
      }
    }

    if (!selection) {
      return NextResponse.json({ error: 'Selection is required' }, { status: 400 })
    }

    // Fetch live FX rate from database (same query used by admin FX panel)
    const fxRow = await db.fxRate.findFirst()
    const liveRate = fxRow?.rate ?? 83

    const computed = await computeQuote(selection, liveRate, GST_RATE)

    const updated = await db.quote.update({
      where: { id },
      data: {
        clientId: selection.clientId,
        frameworkId: selection.frameworkId,
        tierId: selection.tierId,
        billingCurrency: selection.billingCurrency || existing.billingCurrency || 'INR',
        subtotalInr: computed.subtotalInr,
        discountInr: computed.discountInr,
        discountPct: computed.discountPct || selection.discountPct || 0,
        discountMode: selection.discountMode || 'percent',
        discountFixedInr: selection.discountFixedInr || 0,
        discountReason: selection.discountReason || null,
        gstAmountInr: computed.gstAmountInr,
        totalInr: computed.totalInr,
        totalUsd: computed.totalUsd,
        usdInrRateSnapshot: computed.usdInrRate,
        gstRateSnapshot: computed.gstRate,
        includeRetainer: selection.includeRetainer,
        retainerMode: selection.retainerMode || 'percent',
        retainerCustomInr: selection.retainerCustomInr || 0,
        retainerAmountInr: computed.retainerAmountInr,
        internalHours: selection.internalHours || 0,
        internalHourlyRate: selection.internalHourlyRate || 0,
        notes: selection.notes || null,
        // Delete old line items — they'll be rebuilt
        lineItems: { deleteMany: {} },
      },
      include: {
        client: true,
        framework: true,
        tier: true,
        lineItems: { orderBy: { sortOrder: 'asc' } },
        approvals: {
          orderBy: { createdAt: 'asc' },
          include: { actor: { select: { name: true, email: true } } },
        },
      },
    })

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[PUT /api/quotes/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to update quote' }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const existing = await db.quote.findUnique({ where: { id, tenantId: TENANT_ID } })
    if (!existing) {
      return NextResponse.json({ error: 'Quote not found' }, { status: 404 })
    }

    // Delete related records first, then the quote
    await db.quoteApproval.deleteMany({ where: { quoteId: id } })
    await db.quoteLineItem.deleteMany({ where: { quoteId: id } })
    await db.sowDocument.deleteMany({ where: { quoteId: id } })
    await db.clientPortalToken.deleteMany({ where: { quoteId: id } })
    await db.quote.delete({ where: { id } })

    return NextResponse.json({ data: { success: true } })
  } catch (err) {
    console.error('[DELETE /api/quotes/[id]] error:', err)
    return NextResponse.json({ error: 'Failed to delete quote' }, { status: 500 })
  }
}