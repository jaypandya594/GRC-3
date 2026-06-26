/**
 * GET /api/pricing — returns all master pricing data (for admin panel + quote builder)
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [
      frameworks,
      tiers,
      frameworkPrices,
      auditorFees,
      addonServices,
      grcTools,
      dpoVcisoPackages,
      fxRate,
    ] = await Promise.all([
      db.framework.findMany({
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      db.tier.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      db.frameworkPrice.findMany({
        include: {
          framework: { select: { name: true } },
          tier: { select: { name: true } },
        },
      }),
      db.auditorFee.findMany({
        orderBy: [{ standardName: 'asc' }, { feeInr: 'asc' }],
      }),
      db.addonService.findMany({
        orderBy: { sortOrder: 'asc' },
      }),
      db.grcTool.findMany({
        orderBy: { feeInrAnnual: 'asc' },
      }),
      db.dpoVcisoPackage.findMany({
        orderBy: [{ serviceType: 'asc' }, { feeInrMonthly: 'asc' }],
      }),
      db.fxRate.findFirst(),
    ])

    return NextResponse.json({
      data: {
        frameworks,
        tiers,
        frameworkPrices,
        auditorFees,
        addonServices,
        grcTools,
        dpoVcisoPackages,
        fxRate: fxRate?.rate ?? 83,
      },
    })
  } catch (err) {
    console.error('[GET /api/pricing] error:', err)
    return NextResponse.json(
      { error: 'Failed to load pricing data' },
      { status: 500 },
    )
  }
}