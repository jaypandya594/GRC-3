/**
 * /api/admin/frameworks
 * GET  — list all frameworks (including inactive), with optional ?category=&active= filters
 * POST — create framework
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const category = searchParams.get('category')
    const active = searchParams.get('active')

    const where: Record<string, unknown> = {
      OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
    }

    if (category) where.category = category
    if (active !== null && active !== '') where.isActive = active === 'true'

    const data = await db.framework.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/frameworks] error:', err)
    return NextResponse.json({ error: 'Failed to list frameworks' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, category, description, sortOrder, isActive } = body

    if (!name || !category) {
      return NextResponse.json({ error: 'name and category are required' }, { status: 400 })
    }

    const data = await db.framework.create({
      data: {
        tenantId: TENANT_ID,
        name,
        category,
        description: description ?? null,
        sortOrder: sortOrder ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/frameworks] error:', err)
    return NextResponse.json({ error: 'Failed to create framework' }, { status: 500 })
  }
}