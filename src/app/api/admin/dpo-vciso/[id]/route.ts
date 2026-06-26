/**
 * /api/admin/dpo-vciso/[id]
 * PUT    — update DPO/vCISO package
 * DELETE — soft-delete (isActive = false)
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const body = await req.json()
    const { serviceType, name, description, hoursPerMonth, feeInrMonthly, feeInrAnnual, scopeJson, isActive } = body

    const data = await db.dpoVcisoPackage.update({
      where: { id },
      data: {
        ...(serviceType !== undefined && { serviceType }),
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(hoursPerMonth !== undefined && { hoursPerMonth }),
        ...(feeInrMonthly !== undefined && { feeInrMonthly }),
        ...(feeInrAnnual !== undefined && { feeInrAnnual }),
        ...(scopeJson !== undefined && { scopeJson }),
        ...(isActive !== undefined && { isActive }),
      },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[PUT /api/admin/dpo-vciso/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to update DPO/vCISO package' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params

    const data = await db.dpoVcisoPackage.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error(`[DELETE /api/admin/dpo-vciso/${'{id}'}] error:`, err)
    return NextResponse.json({ error: 'Failed to delete DPO/vCISO package' }, { status: 500 })
  }
}