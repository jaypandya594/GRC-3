/**
 * /api/quotes/[id]/action
 * POST — perform an approval action (submit, approve, reject, override, recall, send)
 *
 * The `override` action accepts `newDiscountPct` to re-compute the discount.
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID } from '@/lib/server/pricingEngine'
import { canPerformAction, getNextStatus } from '@/lib/quoteCalculator'

export const dynamic = 'force-dynamic'

export async function POST(
  req: NextRequest,
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

    const body = await req.json()
    const { action, comment, newDiscountPct } = body as {
      action: string
      comment?: string
      newDiscountPct?: number
    }

    // Demo: super_admin can do all
    const role = 'super_admin'

    if (!canPerformAction(quote.status, action, role)) {
      return NextResponse.json(
        { error: `Action "${action}" not allowed from status "${quote.status}"` },
        { status: 403 },
      )
    }

    const nextStatus = getNextStatus(quote.status, action)
    if (!nextStatus) {
      return NextResponse.json({ error: 'Invalid action or state transition' }, { status: 400 })
    }

    const amountBefore = quote.totalInr
    let amountAfter = quote.totalInr

    // Handle override: recompute discount from percentage
    if (action === 'override' && newDiscountPct !== undefined) {
      const discountPct = Math.max(0, Math.min(100, newDiscountPct || 0))
      const newDiscountInr = Math.round(quote.subtotalInr * (discountPct / 100))
      const subtotalAfterDiscount = Math.max(0, quote.subtotalInr - newDiscountInr)
      const newGst = Math.round(subtotalAfterDiscount * (quote.gstRateSnapshot / 100))
      const newTotal = subtotalAfterDiscount + newGst
      const newTotalUsd = Math.round((newTotal / quote.usdInrRateSnapshot) * 100) / 100

      // Update discount line item description
      const discountLine = quote.lineItems.find((l) => l.lineType === 'discount')
      if (discountLine) {
        await db.quoteLineItem.update({
          where: { id: discountLine.id },
          data: {
            description: `Discount (${discountPct}%)${quote.discountReason ? ` — ${quote.discountReason}` : ''}`,
            amountInr: -newDiscountInr,
          },
        })
      } else if (newDiscountInr > 0) {
        await db.quoteLineItem.create({
          data: {
            quoteId: id,
            lineType: 'discount',
            description: `Discount (${discountPct}%)${quote.discountReason ? ` — ${quote.discountReason}` : ''}`,
            amountInr: -newDiscountInr,
            sortOrder: 99,
          },
        })
      }

      await db.quote.update({
        where: { id },
        data: {
          discountInr: newDiscountInr,
          discountPct,
          gstAmountInr: newGst,
          totalInr: newTotal,
          totalUsd: newTotalUsd,
        },
      })

      amountAfter = newTotal
    }

    // Update status
    const updateData: Record<string, unknown> = {
      status: nextStatus,
    }

    if (action === 'approve' || action === 'override') {
      updateData.approvedById = CREATED_BY_ID
    }
    if (action === 'send') {
      updateData.sentAt = new Date()
    }

    await db.quote.update({ where: { id }, data: updateData })

    // Record approval
    await db.quoteApproval.create({
      data: {
        quoteId: id,
        actorId: CREATED_BY_ID,
        actorRole: role,
        action: action === 'override' ? 'overridden' : action === 'send' ? 'sent' : action,
        comment: comment || null,
        amountBefore,
        amountAfter,
      },
    })

    // Return updated quote
    const updated = await db.quote.findUnique({
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

    return NextResponse.json({ data: updated })
  } catch (err) {
    console.error('[POST /api/quotes/[id]/action] error:', err)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
}