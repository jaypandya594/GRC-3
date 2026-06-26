/**
 * /api/admin/fx-rate
 * GET — current rate
 * PUT — update rate { rate }
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const fx = await db.fxRate.findFirst()
    return NextResponse.json({ data: { rate: fx?.rate ?? 83, updatedAt: fx?.updatedAt } })
  } catch (err) {
    console.error('[GET /api/admin/fx-rate] error:', err)
    return NextResponse.json({ error: 'Failed to load FX rate' }, { status: 500 })
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { rate } = await req.json()
    if (typeof rate !== 'number' || rate <= 0) {
      return NextResponse.json({ error: 'Invalid rate' }, { status: 400 })
    }

    const existing = await db.fxRate.findFirst()
    const data = await db.fxRate.upsert({
      where: { id: 1 },
      update: { rate, updatedById: CREATED_BY_ID },
      create: { id: 1, rate, updatedById: CREATED_BY_ID },
    })

    await db.auditLog.create({
      data: {
        tenantId: TENANT_ID,
        userId: CREATED_BY_ID,
        action: 'fx_rate.updated',
        entity: 'fx_rate',
        entityId: '1',
        oldValue: JSON.stringify({ rate: existing?.rate }),
        newValue: JSON.stringify({ rate }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[PUT /api/admin/fx-rate] error:', err)
    return NextResponse.json({ error: 'Failed to update FX rate' }, { status: 500 })
  }
}