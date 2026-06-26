/**
 * /api/admin/grc-tools
 * GET  — list all GRC tools
 * POST — create GRC tool
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await db.grcTool.findMany({
      where: {
        OR: [{ tenantId: null }, { tenantId: TENANT_ID }],
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({ data })
  } catch (err) {
    console.error('[GET /api/admin/grc-tools] error:', err)
    return NextResponse.json({ error: 'Failed to list GRC tools' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { planName, description, feeInrAnnual, maxUsers, isActive } = body

    if (!planName || feeInrAnnual === undefined) {
      return NextResponse.json({ error: 'planName and feeInrAnnual are required' }, { status: 400 })
    }

    const data = await db.grcTool.create({
      data: {
        tenantId: TENANT_ID,
        planName,
        description: description ?? null,
        feeInrAnnual,
        maxUsers: maxUsers ?? 0,
        isActive: isActive ?? true,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    console.error('[POST /api/admin/grc-tools] error:', err)
    return NextResponse.json({ error: 'Failed to create GRC tool' }, { status: 500 })
  }
}