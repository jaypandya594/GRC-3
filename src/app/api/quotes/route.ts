/**
 * /api/quotes
 * GET  — list quotes with optional ?status= filter
 * POST — create a new quote from builder selection
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID, computeQuote } from '@/lib/server/pricingEngine'
import { getNextStatus } from '@/lib/quoteCalculator'
import { addDays } from 'date-fns'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')

    const where: Record<string, unknown> = { tenantId: TENANT_ID }
    if (status && status !== 'all') where.status = status

    const data = await db.quote.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/quotes] error:', err)
    return NextResponse.json({ error: 'Failed to list quotes' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { selection, submit } = body as {
      selection: {
        clientId: string
        selectedFrameworkIds: string[]
        tierId: string
        includeRetainer: boolean
        selectedAuditorFeeIds: string[]
        selectedAddonIds: string[]
        grcToolEnabled: boolean
        grcToolId: string | null
        grcToolCustomFee: number | null
        dpoVcisoPackageId: string | null
        internalHours: number
        internalHourlyRate: number
        discountPct: number
        discountReason: string
        validUntilDays: number
        notes: string
      }
      submit: boolean
    }

    const fwIds = selection.selectedFrameworkIds || []
    if (!selection?.clientId || fwIds.length === 0 || !selection?.tierId) {
      return NextResponse.json({ error: 'Client, at least one framework, and tier are required' }, { status: 400 })
    }

    // Use first framework as the primary on the Quote record
    const primaryFrameworkId = fwIds[0]

    // Compute quote using server-side engine
    const computed = await computeQuote(selection)
    const validUntil = selection.validUntilDays
      ? addDays(new Date(), selection.validUntilDays)
      : null
    const initialStatus = submit
      ? getNextStatus('DRAFT', 'submit') || 'DRAFT'
      : 'DRAFT'

    const quote = await db.quote.create({
      data: {
        tenantId: TENANT_ID,
        clientId: selection.clientId,
        frameworkId: primaryFrameworkId,
        tierId: selection.tierId,
        version: 1,
        status: initialStatus,
        subtotalInr: computed.subtotalInr,
        discountInr: computed.discountInr,
        discountPct: selection.discountPct || 0,
        discountReason: selection.discountReason || null,
        gstAmountInr: computed.gstAmountInr,
        totalInr: computed.totalInr,
        totalUsd: computed.totalUsd,
        usdInrRateSnapshot: computed.usdInrRate,
        gstRateSnapshot: computed.gstRate,
        includeRetainer: selection.includeRetainer,
        retainerAmountInr: computed.retainerAmountInr,
        internalHours: selection.internalHours || 0,
        internalHourlyRate: selection.internalHourlyRate || 0,
        validUntil,
        notes: selection.notes || null,
        createdById: CREATED_BY_ID,
        lineItems: {
          create: await buildLineItems(selection, computed),
        },
        approvals: submit
          ? {
              create: {
                actorId: CREATED_BY_ID,
                actorRole: 'sales_executive',
                action: 'submitted',
              },
            }
          : undefined,
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

    return NextResponse.json({ data: quote }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/quotes] error:', err)
    return NextResponse.json({ error: 'Failed to create quote' }, { status: 500 })
  }
}

async function buildLineItems(
  selection: {
    selectedFrameworkIds: string[]
    tierId: string
    includeRetainer: boolean
    selectedAuditorFeeIds: string[]
    selectedAddonIds: string[]
    grcToolEnabled: boolean
    grcToolId: string | null
    grcToolCustomFee: number | null
    dpoVcisoPackageId: string | null
    internalHours: number
    internalHourlyRate: number
    discountPct: number
    discountReason: string
  },
  computed: { subtotalInr: number; discountInr: number; discountPct: number },
) {
  const lines: Array<{
    lineType: string
    description: string
    referenceId: string | null
    amountInr: number
    sortOrder: number
  }> = []
  let sortOrder = 0

  // Consulting fees — one per selected framework
  const fwIds = selection.selectedFrameworkIds || []
  for (const fwId of fwIds) {
    const price = await db.frameworkPrice.findFirst({
      where: {
        frameworkId: fwId,
        tierId: selection.tierId,
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
    })
    const framework = await db.framework.findUnique({ where: { id: fwId } })
    const tier = await db.tier.findUnique({ where: { id: selection.tierId } })

    if (price && framework && tier) {
      lines.push({
        lineType: 'consulting_fee',
        description: `${framework.name} — Consulting Fee (${tier.name})`,
        referenceId: framework.id,
        amountInr: price.projectFeeInr,
        sortOrder: sortOrder++,
      })

      if (selection.includeRetainer && price.retainerFeeInr > 0) {
        lines.push({
          lineType: 'retainer',
          description: `Annual Retainer — ${framework.name} (${tier.retainerPct}% of project fee)`,
          referenceId: tier.id,
          amountInr: price.retainerFeeInr,
          sortOrder: sortOrder++,
        })
      }
    }
  }

  // Auditor fees
  for (const feeId of selection.selectedAuditorFeeIds) {
    const fee = await db.auditorFee.findUnique({ where: { id: feeId } })
    if (fee) {
      lines.push({
        lineType: 'auditor_fee',
        description: `Auditor Fee — ${fee.standardName} (${fee.accreditationBody})`,
        referenceId: fee.id,
        amountInr: fee.feeInr,
        sortOrder: sortOrder++,
      })
    }
  }

  // Add-on services
  for (const addonId of selection.selectedAddonIds) {
    const addon = await db.addonService.findUnique({ where: { id: addonId } })
    if (addon) {
      lines.push({
        lineType: 'addon_service',
        description: addon.name,
        referenceId: addon.id,
        amountInr: addon.feeInr,
        sortOrder: sortOrder++,
      })
    }
  }

  // GRC Tool
  if (selection.grcToolEnabled) {
    let fee = 0
    let label = 'GRC Tool'
    if (selection.grcToolCustomFee !== null) {
      fee = selection.grcToolCustomFee
      label = 'GRC Tool (Custom)'
    } else if (selection.grcToolId) {
      const tool = await db.grcTool.findUnique({ where: { id: selection.grcToolId } })
      if (tool) {
        fee = tool.feeInrAnnual
        label = `GRC Tool — ${tool.planName} (Annual)`
      }
    }
    if (fee > 0) {
      lines.push({
        lineType: 'grc_tool',
        description: label,
        referenceId: selection.grcToolId,
        amountInr: fee,
        sortOrder: sortOrder++,
      })
    }
  }

  // DPO/vCISO
  if (selection.dpoVcisoPackageId) {
    const pkg = await db.dpoVcisoPackage.findUnique({ where: { id: selection.dpoVcisoPackageId } })
    if (pkg) {
      lines.push({
        lineType: 'dpo_vciso',
        description: `${pkg.serviceType} — ${pkg.name} (Annual)`,
        referenceId: pkg.id,
        amountInr: pkg.feeInrAnnual,
        sortOrder: sortOrder++,
      })
    }
  }

  // Discount
  if (computed.discountInr > 0) {
    lines.push({
      lineType: 'discount',
      description: `Discount (${computed.discountPct}%)${selection.discountReason ? ` — ${selection.discountReason}` : ''}`,
      referenceId: null,
      amountInr: -computed.discountInr,
      sortOrder: sortOrder++,
    })
  }

  // Internal time
  const internalCost = (selection.internalHours || 0) * (selection.internalHourlyRate || 0)
  if (internalCost > 0) {
    lines.push({
      lineType: 'internal_time',
      description: `Internal time cost (advisory – not billed) — ${selection.internalHours}h × ₹${selection.internalHourlyRate}/hr`,
      referenceId: null,
      amountInr: internalCost,
      sortOrder: sortOrder++,
    })
  }

  return lines
}