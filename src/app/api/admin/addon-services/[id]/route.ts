/**
 * /api/admin/addon-services/[id]
 * PUT    — update addon service
 * DELETE — soft-delete (isActive = false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { name, description, category, feeInr, sortOrder, isActive } = body

    const data = await db.addonService.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(category !== undefined && { category }),
        ...(feeInr !== undefined && { feeInr }),
        ...(sortOrder !== undefined && { sortOrder }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/addon-services/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update addon service' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const data = await db.addonService.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[DELETE /api/admin/addon-services/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete addon service' }, { status: 500 })
  }
}