/**
 * /api/clients
 * GET  — list all clients with quote count
 * POST — create a new client
 */
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID, CREATED_BY_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const clients = await db.client.findMany({
      where: { tenantId: TENANT_ID },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { quotes: true } },
      },
    })
    const mapped = clients.map((c) => ({
      ...c,
      contactsJson: c.contactsJson,
      contacts: c.contactsJson ? JSON.parse(c.contactsJson) : [],
      quoteCount: c._count.quotes,
    }))
    return NextResponse.json({ data: mapped })
  } catch (err) {
    console.error('[GET /api/clients] error:', err)
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { companyName, sector, companySize } = body as {
      companyName?: string
      sector?: string
      companySize?: string
    }

    if (!companyName || !companyName.trim()) {
      return NextResponse.json({ error: 'Company name is required' }, { status: 400 })
    }

    const client = await db.client.create({
      data: {
        tenantId: TENANT_ID,
        companyName: companyName.trim(),
        sector: sector || null,
        companySize: companySize || 'Mid-size',
        country: 'India',
        createdById: CREATED_BY_ID,
        dealStage: 'prospect',
      },
    })

    return NextResponse.json({ data: client }, { status: 201 })
  } catch (err: unknown) {
    console.error('[POST /api/clients] error:', err)
    const msg = err instanceof Error ? err.message : 'Failed to create client'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}