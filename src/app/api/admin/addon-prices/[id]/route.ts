/**
 * /api/admin/addon-prices/[id]
 * PUT    — update addon price
 * DELETE — hard delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { priceInr } = body

    if (priceInr === undefined) {
      return NextResponse.json({ error: 'priceInr is required' }, { status: 400 })
    }

    const data = await db.addonServicePrice.update({
      where: { id },
      data: { priceInr },
      include: {
        addonService: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/addon-prices/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update addon price' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await db.addonServicePrice.delete({ where: { id } })

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error(`[DELETE /api/admin/addon-prices/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete addon price' }, { status: 500 })
  }
}