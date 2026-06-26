/**
 * /api/admin/auditor-fees
 * GET  — list all auditor fees
 * POST — create auditor fee
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.auditorFee.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/auditor-fees] error:', err)
    return NextResponse.json({ error: 'Failed to list auditor fees' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { standardName, accreditationBody, feeInr, notes, isActive } = body

    if (!standardName || !accreditationBody || feeInr === undefined) {
      return NextResponse.json(
        { error: 'standardName, accreditationBody, and feeInr are required' },
        { status: 400 },
      )
    }

    const data = await db.auditorFee.create({
      data: {
        tenantId: TENANT_ID,
        standardName,
        accreditationBody,
        feeInr,
        notes: notes ?? null,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/auditor-fees] error:', err)
    return NextResponse.json({ error: 'Failed to create auditor fee' }, { status: 500 })
  }
}