/**
 * /api/quotes
 * GET  — list quotes with optional ?status= filter
 * POST — create a new quote from builder selection
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID, GST_RATE, computeQuote } from '@/lib/server/pricingEngine'
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
        complimentaryKeys?: string[]
        customScopes?: Record<string, string>
      }
      submit: boolean
    }

    const fwIds = selection.selectedFrameworkIds || []
    if (!selection?.clientId || fwIds.length === 0 || !selection?.tierId) {
      return NextResponse.json({ error: 'Client, at least one framework, and tier are required' }, { status: 400 })
    }

    // Use first framework as the primary on the Quote record
    const primaryFrameworkId = fwIds[0]

    // Fetch live FX rate from database (same query used by admin FX panel)
    const fxRow = await db.fxRate.findFirst()
    const liveRate = fxRow?.rate ?? 83

    // Compute quote using server-side engine with the live configured rate
    const computed = await computeQuote(selection, liveRate, GST_RATE)
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
        billingCurrency: selection.billingCurrency || 'INR',
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
    complimentaryKeys?: string[]
    customScopes?: Record<string, string>
  },
  computed: { subtotalInr: number; discountInr: number; discountPct: number; discountMode?: string },
) {
  const compKeys = new Set(selection.complimentaryKeys || [])
  const customScopes = selection.customScopes || {}
  const lines: Array<{
    lineType: string
    description: string
    referenceId: string | null
    amountInr: number
    isComplimentary: boolean
    customScope?: string | null
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
      const comp = compKeys.has(`framework:${fwId}`)
      lines.push({
        lineType: 'consulting_fee',
        description: `${framework.name} — Consulting Fee (${tier.name})`,
        referenceId: framework.id,
        amountInr: price.projectFeeInr,
        isComplimentary: comp,
        customScope: customScopes[fwId] || null,
        sortOrder: sortOrder++,
      })

      if (selection.includeRetainer) {
        const isFixed = selection.retainerMode === 'fixed' && selection.retainerCustomInr != null && selection.retainerCustomInr > 0
        const retainerFee = isFixed ? selection.retainerCustomInr : price.retainerFeeInr
        if (retainerFee > 0) {
          const rComp = compKeys.has('retainer')
          lines.push({
            lineType: 'retainer',
            description: isFixed
              ? `Annual Retainer — ${framework.name} (Custom amount)`
              : `Annual Retainer — ${framework.name} (${tier.retainerPct}% of project fee)`,
            referenceId: tier.id,
            amountInr: retainerFee,
            isComplimentary: rComp,
            sortOrder: sortOrder++,
          })
        }
      }
    }
  }

  // Auditor fees
  for (const feeId of selection.selectedAuditorFeeIds) {
    const fee = await db.auditorFee.findUnique({ where: { id: feeId } })
    if (fee) {
      const comp = compKeys.has(`auditorFee:${feeId}`)
      lines.push({
        lineType: 'auditor_fee',
        description: `Auditor Fee — ${fee.standardName} (${fee.accreditationBody})`,
        referenceId: fee.id,
        amountInr: fee.feeInr,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
    }
  }

  // Add-on services — use tier-specific price when available
  for (const addonId of selection.selectedAddonIds) {
    const addon = await db.addonService.findUnique({ where: { id: addonId } })
    if (addon) {
      const tierPrice = await db.addonServicePrice.findFirst({
        where: { addonServiceId: addonId, tierId: selection.tierId },
      })
      const fee = tierPrice?.priceInr ?? addon.feeInr
      const comp = compKeys.has(`addon:${addonId}`)
      lines.push({
        lineType: 'addon_service',
        description: addon.name,
        referenceId: addon.id,
        amountInr: fee,
        isComplimentary: comp,
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
      const comp = compKeys.has('grcTool')
      lines.push({
        lineType: 'grc_tool',
        description: label,
        referenceId: selection.grcToolId,
        amountInr: fee,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
    }
  }

  // DPO/vCISO
  if (selection.dpoVcisoPackageId) {
    const pkg = await db.dpoVcisoPackage.findUnique({ where: { id: selection.dpoVcisoPackageId } })
    if (pkg) {
      const comp = compKeys.has('dpoVciso')
      lines.push({
        lineType: 'dpo_vciso',
        description: `${pkg.serviceType} — ${pkg.name} (Annual)`,
        referenceId: pkg.id,
        amountInr: pkg.feeInrAnnual,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
    }
  }

  // Discount
  if (computed.discountInr > 0) {
    const isFixed = selection.discountMode === 'fixed'
    const discLabel = isFixed
      ? `Discount (Fixed)${selection.discountReason ? ` — ${selection.discountReason}` : ''}`
      : `Discount (${computed.discountPct}%)${selection.discountReason ? ` — ${selection.discountReason}` : ''}`
    lines.push({
      lineType: 'discount',
      description: discLabel,
      referenceId: null,
      amountInr: -computed.discountInr,
      isComplimentary: false,
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
      isComplimentary: false,
      sortOrder: sortOrder++,
    })
  }

  return lines
}