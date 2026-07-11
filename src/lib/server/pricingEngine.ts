/**
 * iSecurify — Server-side pricing engine & constants
 */
import type { QuoteBuilderSelection } from '@/types'

export const GST_RATE = 18
export const TENANT_ID = 'tenant-isecurify'
export const CREATED_BY_ID = 'user-admin'

export interface ComputeQuoteResult {
  subtotalInr: number
  discountInr: number
  discountPct: number
  gstAmountInr: number
  totalInr: number
  totalUsd: number
  retainerAmountInr: number
  usdInrRate: number
  gstRate: number
  totalServiceValueInr: number
  complimentaryValueInr: number
  billableSubtotalInr: number
}

/**
 * Server-side quote computation.
 * Accepts a QuoteBuilderSelection and pricing data, returns computed values.
 */
export async function computeQuote(
  selection: QuoteBuilderSelection,
  usdInrRate: number = 83,
  gstRate: number = GST_RATE,
): Promise<ComputeQuoteResult> {
  const { db } = await import('@/lib/db')

  const complimentarySet = new Set(selection.complimentaryKeys || [])
  const isComplimentary = (key: string) => complimentarySet.has(key)

  let subtotal = 0
  let totalServiceValue = 0
  let complimentaryValue = 0
  let retainerAmount = 0
  const isUsd = selection.billingCurrency === 'USD'

  // 1. Consulting fees (multiple frameworks)
  const fwIds = selection.selectedFrameworkIds || []
  for (const fwId of fwIds) {
    if (selection.tierId) {
      const price = await db.frameworkPrice.findFirst({
        where: {
          frameworkId: fwId,
          tierId: selection.tierId,
          OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
        },
      })
      if (price) {
        const comp = isComplimentary(`framework:${fwId}`)
        const amt = comp ? 0 : price.projectFeeInr
        totalServiceValue += price.projectFeeInr
        if (comp) complimentaryValue += price.projectFeeInr
        subtotal += amt

        // Retainer
        if (selection.includeRetainer) {
          const isFixed = selection.retainerMode === 'fixed' && selection.retainerCustomInr != null && selection.retainerCustomInr > 0
          const retainerFee: number = isFixed ? (selection.retainerCustomInr ?? 0) : price.retainerFeeInr
          if (retainerFee > 0) {
            const rComp = isComplimentary('retainer')
            const rAmt = rComp ? 0 : retainerFee
            retainerAmount += retainerFee
            totalServiceValue += retainerFee
            if (rComp) complimentaryValue += retainerFee
            subtotal += rAmt
          }
        }
      }
    }
  }

  // 2. Auditor fees
  for (const feeId of selection.selectedAuditorFeeIds) {
    const fee = await db.auditorFee.findUnique({ where: { id: feeId } })
    if (fee) {
      const comp = isComplimentary(`auditorFee:${feeId}`)
      const amt = comp ? 0 : fee.feeInr
      totalServiceValue += fee.feeInr
      if (comp) complimentaryValue += fee.feeInr
      subtotal += amt
    }
  }

  // 3. Add-on services — use tier-specific price when available
  for (const addonId of selection.selectedAddonIds) {
    const addon = await db.addonService.findUnique({ where: { id: addonId } })
    if (addon) {
      const tierPrice = selection.tierId
        ? await db.addonServicePrice.findFirst({ where: { addonServiceId: addonId, tierId: selection.tierId } })
        : null
      const fee = tierPrice?.priceInr ?? addon.feeInr
      const comp = isComplimentary(`addon:${addonId}`)
      const amt = comp ? 0 : fee
      totalServiceValue += fee
      if (comp) complimentaryValue += fee
      subtotal += amt
    }
  }

  // 4. GRC Tool
  if (selection.grcToolEnabled) {
    let fee = 0
    if (selection.grcToolCustomFee !== null) {
      fee = selection.grcToolCustomFee
    } else if (selection.grcToolId) {
      const tool = await db.grcTool.findUnique({ where: { id: selection.grcToolId } })
      if (tool) fee = tool.feeInrAnnual
    }
    if (fee > 0) {
      const comp = isComplimentary('grcTool')
      const amt = comp ? 0 : fee
      totalServiceValue += fee
      if (comp) complimentaryValue += fee
      subtotal += amt
    }
  }

  // 5. DPO/vCISO
  if (selection.dpoVcisoPackageId) {
    const pkg = await db.dpoVcisoPackage.findUnique({ where: { id: selection.dpoVcisoPackageId } })
    if (pkg) {
      const comp = isComplimentary('dpoVciso')
      const amt = comp ? 0 : pkg.feeInrAnnual
      totalServiceValue += pkg.feeInrAnnual
      if (comp) complimentaryValue += pkg.feeInrAnnual
      subtotal += amt
    }
  }

  // 6. Discount
  let discountInr = 0
  let discountPct = 0
  if (selection.discountMode === 'fixed' && selection.discountFixedInr > 0) {
    discountInr = Math.min(selection.discountFixedInr, subtotal)
    discountPct = subtotal > 0 ? Math.round((discountInr / subtotal) * 100 * 100) / 100 : 0
  } else {
    discountPct = Math.max(0, Math.min(100, selection.discountPct || 0))
    discountInr = Math.round(subtotal * (discountPct / 100))
  }

  const billableSubtotal = subtotal
  const subtotalAfterDiscount = Math.max(0, subtotal - discountInr)
  const gstAmount = isUsd ? 0 : Math.round(subtotalAfterDiscount * (gstRate / 100))
  const total = subtotalAfterDiscount + gstAmount
  const totalUsd = Math.round((total / usdInrRate) * 100) / 100

  return {
    subtotalInr: subtotal,
    discountInr,
    discountPct,
    gstAmountInr: gstAmount,
    totalInr: total,
    totalUsd,
    retainerAmountInr: retainerAmount,
    usdInrRate,
    gstRate,
    totalServiceValueInr: totalServiceValue,
    complimentaryValueInr: complimentaryValue,
    billableSubtotalInr: billableSubtotal,
  }
}