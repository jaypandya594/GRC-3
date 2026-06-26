/**
 * /api/admin/grc-tools/[id]
 * PUT    — update GRC tool
 * DELETE — soft-delete (isActive = false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { planName, description, feeInrAnnual, maxUsers, isActive } = body

    const data = await db.grcTool.update({
      where: { id },
      data: {
        ...(planName !== undefined && { planName }),
        ...(description !== undefined && { description }),
        ...(feeInrAnnual !== undefined && { feeInrAnnual }),
        ...(maxUsers !== undefined && { maxUsers }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/grc-tools/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update GRC tool' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const data = await db.grcTool.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[DELETE /api/admin/grc-tools/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete GRC tool' }, { status: 500 })
  }
}