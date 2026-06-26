/**
 * /api/admin/tiers
 * GET  — list all tiers
 * POST — create tier
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.tier.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/tiers] error:', err)
    return NextResponse.json({ error: 'Failed to list tiers' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, retainerPct, sortOrder, isActive } = body

    if (!name) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 })
    }

    const data = await db.tier.create({
      data: {
        tenantId: TENANT_ID,
        name,
        retainerPct: retainerPct ?? 0,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/tiers] error:', err)
    return NextResponse.json({ error: 'Failed to create tier' }, { status: 500 })
  }
}