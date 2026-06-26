/**
 * /api/admin/addon-services
 * GET  — list all addon services
 * POST — create addon service
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.addonService.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/addon-services] error:', err)
    return NextResponse.json({ error: 'Failed to list addon services' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, description, category, feeInr, sortOrder, isActive } = body

    if (!name || feeInr === undefined) {
      return NextResponse.json({ error: 'name and feeInr are required' }, { status: 400 })
    }

    const data = await db.addonService.create({
      data: {
        tenantId: TENANT_ID,
        name,
        description: description ?? null,
        category: category ?? 'advisory',
        feeInr,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/addon-services] error:', err)
    return NextResponse.json({ error: 'Failed to create addon service' }, { status: 500 })
  }
}