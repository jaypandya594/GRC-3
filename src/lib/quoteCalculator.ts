/**
 * iSecurify — Quote Calculator
 * Mirrors the backend pricing engine. Computes line items, subtotal, GST, total.
 * Rule: Internal time investment is NEVER added to the billed total.
 */
import type {
  AuditorFee,
  AddonService,
  DpoVcisoPackage,
  Framework,
  FrameworkPrice,
  GrcTool,
  QuoteBuilderSelection,
  QuoteLineItem,
  Tier,
} from '@/types'

export interface QuoteCalculation {
  lines: QuoteLineItem[]
  subtotalInr: number
  discountInr: number
  discountPct: number
  gstAmountInr: number
  totalInr: number
  totalUsd: number
  retainerAmountInr: number
  internalTimeCostInr: number
  gstRate: number
  usdInrRate: number
  billingCurrency: 'INR' | 'USD'
  totalServiceValueInr: number
  complimentaryValueInr: number
  billableSubtotalInr: number
}

export interface PricingContext {
  frameworks: Framework[]
  tiers: Tier[]
  frameworkPrices: FrameworkPrice[]
  auditorFees: AuditorFee[]
  addonServices: AddonService[]
  addonServicePrices: Array<{ addonServiceId: string; tierId: string; priceInr: number }>
  grcTools: GrcTool[]
  dpoVcisoPackages: DpoVcisoPackage[]
  usdInrRate: number
  gstRate?: number
}

/**
 * Check if a line item key is marked complimentary.
 */
function isComp(lineKey: string, compKeys: string[]): boolean {
  return compKeys.includes(lineKey)
}

/**
 * Resolve the framework price for a given framework × tier.
 * Tenant-specific price overrides global (tenantId null) price.
 */
export function resolveFrameworkPrice(
  frameworkId: string,
  tierId: string,
  prices: FrameworkPrice[],
  tenantId?: string | null,
): FrameworkPrice | null {
  // Try tenant-specific first
  if (tenantId) {
    const tenantPrice = prices.find(
      (p) => p.frameworkId === frameworkId && p.tierId === tierId && p.tenantId === tenantId,
    )
    if (tenantPrice) return tenantPrice
  }
  // Fall back to global
  return (
    prices.find(
      (p) =>
        p.frameworkId === frameworkId &&
        p.tierId === tierId &&
        (p.tenantId === null || p.tenantId === undefined),
    ) ?? null
  )
}

/**
 * Calculate the full quote from a builder selection.
 * Complimentary items are visible with their reference amount but contribute ₹0 to billable totals.
 */
export function calculateQuote(
  selection: QuoteBuilderSelection,
  ctx: PricingContext,
): QuoteCalculation {
  const gstRate = ctx.gstRate ?? 18
  const usdInrRate = ctx.usdInrRate || 83
  const compKeys = selection.complimentaryKeys || []
  const customScopes = selection.customScopes || {}
  const lines: QuoteLineItem[] = []
  let sortOrder = 0
  let subtotal = 0
  let totalServiceValue = 0
  let complimentaryValue = 0
  let retainerAmount = 0

  // 1. Consulting fees (multiple frameworks)
  for (const fwId of selection.selectedFrameworkIds) {
    if (selection.tierId) {
      const price = resolveFrameworkPrice(fwId, selection.tierId, ctx.frameworkPrices)
      const framework = ctx.frameworks.find((f) => f.id === fwId)
      const tier = ctx.tiers.find((t) => t.id === selection.tierId)
      if (price && framework && tier) {
        const key = `framework:${fwId}`
        const comp = isComp(key, compKeys)
        const amt = comp ? 0 : price.projectFeeInr
        totalServiceValue += price.projectFeeInr
        if (comp) complimentaryValue += price.projectFeeInr
        lines.push({
          lineType: 'consulting_fee',
          description: `${framework.name} — Consulting Fee (${tier.name})`,
          referenceId: framework.id,
          amountInr: price.projectFeeInr,
          isComplimentary: comp,
          customScope: customScopes[fwId] || null,
          sortOrder: sortOrder++,
        })
        subtotal += amt

        // Retainer (if toggled, apply per-framework)
        if (selection.includeRetainer) {
          const isFixed = selection.retainerMode === 'fixed' && selection.retainerCustomInr != null && selection.retainerCustomInr > 0
          const retainerFee = isFixed ? (selection.retainerCustomInr ?? 0) : price.retainerFeeInr
          if (retainerFee > 0) {
            const rKey = 'retainer'
            const rComp = isComp(rKey, compKeys)
            const rAmt = rComp ? 0 : retainerFee
            retainerAmount += retainerFee
            totalServiceValue += retainerFee
            if (rComp) complimentaryValue += retainerFee
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
            subtotal += rAmt
          }
        }
      }
    }
  }

  // 2. Auditor fees (multiple)
  for (const feeId of selection.selectedAuditorFeeIds) {
    const fee = ctx.auditorFees.find((a) => a.id === feeId)
    if (fee) {
      const key = `auditorFee:${feeId}`
      const comp = isComp(key, compKeys)
      const amt = comp ? 0 : fee.feeInr
      totalServiceValue += fee.feeInr
      if (comp) complimentaryValue += fee.feeInr
      lines.push({
        lineType: 'auditor_fee',
        description: `Auditor Fee — ${fee.standardName} (${fee.accreditationBody})`,
        referenceId: fee.id,
        amountInr: fee.feeInr,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
      subtotal += amt
    }
  }

  // 3. Add-on services (multiple) — use tier-specific price when available
  for (const addonId of selection.selectedAddonIds) {
    const addon = ctx.addonServices.find((a) => a.id === addonId)
    if (addon) {
      const tierPrice = selection.tierId
        ? ctx.addonServicePrices?.find((p) => p.addonServiceId === addonId && p.tierId === selection.tierId)
        : undefined
      const fee = tierPrice?.priceInr ?? addon.feeInr
      const key = `addon:${addonId}`
      const comp = isComp(key, compKeys)
      const amt = comp ? 0 : fee
      totalServiceValue += fee
      if (comp) complimentaryValue += fee
      lines.push({
        lineType: 'addon_service',
        description: addon.name,
        referenceId: addon.id,
        amountInr: fee,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
      subtotal += amt
    }
  }

  // 4. GRC Tool
  if (selection.grcToolEnabled) {
    let fee = 0
    let label = 'GRC Tool'
    if (selection.grcToolCustomFee !== null) {
      fee = selection.grcToolCustomFee
      label = 'GRC Tool (Custom)'
    } else if (selection.grcToolId) {
      const tool = ctx.grcTools.find((g) => g.id === selection.grcToolId)
      if (tool) {
        fee = tool.feeInrAnnual
        label = `GRC Tool — ${tool.planName} (Annual)`
      }
    }
    if (fee > 0) {
      const key = 'grcTool'
      const comp = isComp(key, compKeys)
      const amt = comp ? 0 : fee
      totalServiceValue += fee
      if (comp) complimentaryValue += fee
      lines.push({
        lineType: 'grc_tool',
        description: label,
        referenceId: selection.grcToolId,
        amountInr: fee,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
      subtotal += amt
    }
  }

  // 5. DPO/vCISO package
  if (selection.dpoVcisoPackageId) {
    const pkg = ctx.dpoVcisoPackages.find((p) => p.id === selection.dpoVcisoPackageId)
    if (pkg) {
      const key = 'dpoVciso'
      const comp = isComp(key, compKeys)
      const amt = comp ? 0 : pkg.feeInrAnnual
      totalServiceValue += pkg.feeInrAnnual
      if (comp) complimentaryValue += pkg.feeInrAnnual
      lines.push({
        lineType: 'dpo_vciso',
        description: `${pkg.serviceType} — ${pkg.name} (Annual)`,
        referenceId: pkg.id,
        amountInr: pkg.feeInrAnnual,
        isComplimentary: comp,
        sortOrder: sortOrder++,
      })
      subtotal += amt
    }
  }

  // 6. Discount (applied by Finance — negative line, never complimentary)
  const isUsd = selection.billingCurrency === 'USD'
  let discount = 0
  let effectiveDiscountPct = 0
  if (selection.discountMode === 'fixed' && selection.discountFixedInr > 0) {
    discount = Math.min(selection.discountFixedInr, subtotal)
    effectiveDiscountPct = subtotal > 0 ? Math.round((discount / subtotal) * 100 * 100) / 100 : 0
    lines.push({
      lineType: 'discount',
      description: `Discount (Fixed)${selection.discountReason ? ` — ${selection.discountReason}` : ''}`,
      amountInr: -discount,
      sortOrder: sortOrder++,
    })
  } else {
    const discountPct = Math.max(0, Math.min(100, selection.discountPct || 0))
    discount = Math.round(subtotal * (discountPct / 100))
    effectiveDiscountPct = discountPct
    if (discount > 0) {
      lines.push({
        lineType: 'discount',
        description: `Discount (${discountPct}%)${selection.discountReason ? ` — ${selection.discountReason}` : ''}`,
        amountInr: -discount,
        sortOrder: sortOrder++,
      })
    }
  }

  // 7. Internal time (advisory — NOT added to subtotal, shown separately)
  const internalTimeCost = selection.internalHours * selection.internalHourlyRate
  if (internalTimeCost > 0) {
    lines.push({
      lineType: 'internal_time',
      description: `Internal time cost (advisory – not billed) — ${selection.internalHours}h × ₹${selection.internalHourlyRate}/hr`,
      amountInr: internalTimeCost,
      sortOrder: sortOrder++,
    })
  }

  const billableSubtotal = subtotal
  const subtotalAfterDiscount = Math.max(0, subtotal - discount)
  const gstAmount = isUsd ? 0 : Math.round(subtotalAfterDiscount * (gstRate / 100))
  const total = subtotalAfterDiscount + gstAmount
  const totalUsd = Math.round((total / usdInrRate) * 100) / 100

  return {
    lines,
    subtotalInr: subtotal,
    discountInr: discount,
    discountPct: effectiveDiscountPct,
    gstAmountInr: gstAmount,
    totalInr: total,
    totalUsd,
    retainerAmountInr: retainerAmount,
    internalTimeCostInr: internalTimeCost,
    gstRate,
    usdInrRate,
    billingCurrency: selection.billingCurrency || 'INR',
    totalServiceValueInr: totalServiceValue,
    complimentaryValueInr: complimentaryValue,
    billableSubtotalInr: billableSubtotal,
  }
}

/**
 * Compute suggested internal hours from framework prices for the selected tier.
 * Returns the sum of defaultInternalHours across all selected frameworks.
 */
export function computeDefaultInternalHours(
  selectedFrameworkIds: string[],
  tierId: string | null,
  frameworkPrices: FrameworkPrice[],
): number {
  if (!tierId) return 0
  let total = 0
  for (const fwId of selectedFrameworkIds) {
    const price = resolveFrameworkPrice(fwId, tierId, frameworkPrices)
    if (price && (price as unknown as { defaultInternalHours?: number }).defaultInternalHours > 0) {
      total += (price as unknown as { defaultInternalHours: number }).defaultInternalHours
    }
  }
  return total
}

/**
 * Approval state machine transitions.
 * Maps current status → allowed actions → next status + allowed roles.
 */
export const APPROVAL_TRANSITIONS: Record<
  string,
  Record<string, { nextStatus: string; roles: string[] }>
> = {
  DRAFT: {
    submit: { nextStatus: 'PENDING_REVIEW', roles: ['sales_executive', 'sales_manager', 'tenant_admin', 'super_admin'] },
  },
  PENDING_REVIEW: {
    approve: { nextStatus: 'PENDING_FINANCE', roles: ['sales_manager', 'tenant_admin', 'super_admin'] },
    reject: { nextStatus: 'DRAFT', roles: ['sales_manager', 'tenant_admin', 'super_admin'] },
    recall: { nextStatus: 'DRAFT', roles: ['sales_executive', 'sales_manager', 'super_admin'] },
  },
  PENDING_FINANCE: {
    approve: { nextStatus: 'APPROVED', roles: ['finance', 'tenant_admin', 'super_admin'] },
    reject: { nextStatus: 'DRAFT', roles: ['finance', 'tenant_admin', 'super_admin'] },
    override: { nextStatus: 'APPROVED', roles: ['finance', 'super_admin'] },
  },
  APPROVED: {
    send: { nextStatus: 'SENT', roles: ['sales_manager', 'tenant_admin', 'super_admin'] },
    recall: { nextStatus: 'DRAFT', roles: ['sales_manager', 'tenant_admin', 'super_admin'] },
  },
  SENT: {
    recall: { nextStatus: 'APPROVED', roles: ['sales_manager', 'tenant_admin', 'super_admin'] },
  },
}

export function canPerformAction(
  currentStatus: string,
  action: string,
  userRole: string,
): boolean {
  const stateActions = APPROVAL_TRANSITIONS[currentStatus]
  if (!stateActions || !stateActions[action]) return false
  return stateActions[action].roles.includes(userRole)
}

export function getNextStatus(currentStatus: string, action: string): string | null {
  const stateActions = APPROVAL_TRANSITIONS[currentStatus]
  if (!stateActions || !stateActions[action]) return null
  return stateActions[action].nextStatus
}

/**
 * Quote status colors and labels for UI display.
 */
export const QUOTE_STATUS_META: Record<
  string,
  { label: string; color: string; bg: string; text: string }
> = {
  DRAFT: { label: 'Draft', color: 'slate', bg: 'bg-slate-100', text: 'text-slate-700' },
  PENDING_REVIEW: { label: 'Pending Review', color: 'amber', bg: 'bg-amber-100', text: 'text-amber-700' },
  PENDING_FINANCE: { label: 'Pending Finance', color: 'orange', bg: 'bg-orange-100', text: 'text-orange-700' },
  APPROVED: { label: 'Approved', color: 'purple', bg: 'bg-purple-100', text: 'text-purple-700' },
  SENT: { label: 'Sent', color: 'cyan', bg: 'bg-cyan-100', text: 'text-cyan-700' },
  VIEWED: { label: 'Viewed', color: 'blue', bg: 'bg-blue-100', text: 'text-blue-700' },
  EXPIRED: { label: 'Expired', color: 'red', bg: 'bg-red-100', text: 'text-red-700' },
  REJECTED: { label: 'Rejected', color: 'rose', bg: 'bg-rose-100', text: 'text-rose-700' },
}

export const DEAL_STAGE_META: Record<
  string,
  { label: string; bg: string; text: string }
> = {
  prospect: { label: 'Prospect', bg: 'bg-slate-100', text: 'text-slate-700' },
  qualified: { label: 'Qualified', bg: 'bg-sky-100', text: 'text-sky-700' },
  proposal_sent: { label: 'Proposal Sent', bg: 'bg-amber-100', text: 'text-amber-700' },
  negotiation: { label: 'Negotiation', bg: 'bg-orange-100', text: 'text-orange-700' },
  won: { label: 'Won', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  lost: { label: 'Lost', bg: 'bg-rose-100', text: 'text-rose-700' },
}

export const FRAMEWORK_CATEGORY_META: Record<string, { label: string; color: string }> = {
  IT_Security: { label: 'IT Security', color: 'purple' },
  Privacy: { label: 'Privacy', color: 'violet' },
  Quality: { label: 'Quality', color: 'blue' },
  Food_Safety: { label: 'Food Safety', color: 'orange' },
  Industry: { label: 'Industry', color: 'rose' },
}

export const DEFAULT_QUOTE_BUILDER_SELECTION: QuoteBuilderSelection = {
  clientId: null,
  billingCurrency: 'INR',
  selectedFrameworkIds: [],
  tierId: null,
  includeRetainer: false,
  retainerMode: 'percent',
  retainerCustomInr: null,
  selectedAuditorFeeIds: [],
  selectedAddonIds: [],
  grcToolEnabled: false,
  grcToolId: null,
  grcToolCustomFee: null,
  dpoVcisoPackageId: null,
  internalHours: 0,
  internalHourlyRate: 0,
  discountPct: 0,
  discountMode: 'percent',
  discountFixedInr: 0,
  discountReason: '',
  validUntilDays: 30,
  notes: '',
  complimentaryKeys: [],
  customScopes: {},
  internalHoursManuallySet: false,
}