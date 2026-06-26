/**
 * /api/admin/auditor-fees/[id]
 * PUT    — update auditor fee
 * DELETE — soft-delete (isActive = false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { standardName, accreditationBody, feeInr, notes, isActive } = body

    const data = await db.auditorFee.update({
      where: { id },
      data: {
        ...(standardName !== undefined && { standardName }),
        ...(accreditationBody !== undefined && { accreditationBody }),
        ...(feeInr !== undefined && { feeInr }),
        ...(notes !== undefined && { notes }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/auditor-fees/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update auditor fee' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const data = await db.auditorFee.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[DELETE /api/admin/auditor-fees/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete auditor fee' }, { status: 500 })
  }
}