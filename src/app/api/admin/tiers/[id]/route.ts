/**
 * /api/admin/tiers/[id]
 * PUT    — update tier
 * DELETE — soft-delete (isActive = false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, retainerPct, sortOrder, isActive } = body

    const data = await db.tier.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(retainerPct !== undefined && { retainerPct }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/tiers/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const data = await db.tier.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[DELETE /api/admin/tiers/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete tier' }, { status: 500 })
  }
}