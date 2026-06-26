/**
 * /api/admin/framework-prices/[id]
 * PUT    — update framework price
 * DELETE — hard delete
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { frameworkId, tierId, projectFeeInr, retainerFeeInr } = body

    const data = await db.frameworkPrice.update({
      where: { id },
      data: {
        ...(frameworkId !== undefined && { frameworkId }),
        ...(tierId !== undefined && { tierId }),
        ...(projectFeeInr !== undefined && { projectFeeInr }),
        ...(retainerFeeInr !== undefined && { retainerFeeInr }),
      },
      include: {
        framework: { select: { id: true, name: true } },
        tier: { select: { id: true, name: true } },
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/framework-prices/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update framework price' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    await db.frameworkPrice.delete({ where: { id } })

    return NextResponse.json({ data: { id } })
  } catch (err) {
    console.error(`[DELETE /api/admin/framework-prices/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete framework price' }, { status: 500 })
  }
}