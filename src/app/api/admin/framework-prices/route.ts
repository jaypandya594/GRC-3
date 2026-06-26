/**
 * /api/admin/framework-prices
 * GET  — list all framework prices (include framework and tier names)
 * POST — create price
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.frameworkPrice.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      include: {
        framework: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/framework-prices] error:', err)
    return NextResponse.json({ error: 'Failed to list framework prices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { frameworkId, tierId, projectFeeInr, retainerFeeInr } = body

    if (!frameworkId || !tierId || projectFeeInr === undefined) {
      return NextResponse.json({ error: 'frameworkId, tierId, and projectFeeInr are required' }, { status: 400 })
    }

    const data = await db.frameworkPrice.create({
      data: {
        tenantId: TENANT_ID,
        frameworkId,
        tierId,
        projectFeeInr,
        retainerFeeInr: retainerFeeInr ?? 0,
      },
      include: {
        framework: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/framework-prices] error:', err)
    return NextResponse.json({ error: 'Failed to create framework price' }, { status: 500 })
  }
}