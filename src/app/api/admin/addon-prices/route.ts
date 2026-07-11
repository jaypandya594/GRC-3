/**
 * /api/admin/addon-prices
 * GET  — list all addon service prices (include addon and tier names)
 * POST — create price
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.addonServicePrice.findMany({
      include: {
        addonService: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/addon-prices] error:', err)
    return NextResponse.json({ error: 'Failed to list addon prices' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { addonServiceId, tierId, priceInr } = body

    if (!addonServiceId || !tierId || priceInr === undefined) {
      return NextResponse.json({ error: 'addonServiceId, tierId, and priceInr are required' }, { status: 400 })
    }

    const data = await db.addonServicePrice.create({
      data: { addonServiceId, tierId, priceInr },
      include: {
        addonService: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/addon-prices] error:', err)
    return NextResponse.json({ error: 'Failed to create addon price' }, { status: 500 })
  }
}