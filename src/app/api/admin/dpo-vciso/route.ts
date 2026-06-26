/**
 * /api/admin/dpo-vciso
 * GET  — list all DPO/vCISO packages
 * POST — create DPO/vCISO package
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.dpoVcisoPackage.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/dpo-vciso] error:', err)
    return NextResponse.json({ error: 'Failed to list DPO/vCISO packages' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { serviceType, name, description, hoursPerMonth, feeInrMonthly, feeInrAnnual, scopeJson, isActive } = body

    if (!serviceType || !name) {
      return NextResponse.json({ error: 'serviceType and name are required' }, { status: 400 })
    }

    const data = await db.dpoVcisoPackage.create({
      data: {
        tenantId: TENANT_ID,
        serviceType,
        name,
        description: description ?? null,
        hoursPerMonth: hoursPerMonth ?? 0,
        feeInrMonthly: feeInrMonthly ?? 0,
        feeInrAnnual: feeInrAnnual ?? 0,
        scopeJson: scopeJson ?? null,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/dpo-vciso] error:', err)
    return NextResponse.json({ error: 'Failed to create DPO/vCISO package' }, { status: 500 })
  }
}