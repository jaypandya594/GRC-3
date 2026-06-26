/**
 * /api/dashboard
 * GET — returns aggregate stats for the dashboard
 */
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { TENANT_ID } from '@/lib/server/pricingEngine'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const [totalQuotes, quotes, clients, recentQuotes, topFrameworks] = await Promise.all([
      // Total count
      db.quote.count({ where: { tenantId: TENANT_ID } }),

      // All quotes (for status breakdown + pipeline)
      db.quote.findMany({
        where: { tenantId: TENANT_ID },
        select: { status: true, totalInr: true, createdAt: true, frameworkId: true },
      }),

      // Client stats
      db.client.findMany({
        where: { tenantId: TENANT_ID },
        select: { id: true, dealStage: true },
      }),

      // Recent quotes with relations
      db.quote.findMany({
        where: { tenantId: TENANT_ID },
        orderBy: { createdAt: 'desc' },
        take: 10,
        include: {
          client: { select: { companyName: true } },
          framework: { select: { name: true } },
        },
      }),

      // Top frameworks by count + value
      db.quote.groupBy({
        by: ['frameworkId'],
        where: { tenantId: TENANT_ID },
        _count: { id: true },
        _sum: { totalInr: true },
        orderBy: { _count: { id: 'desc' } },
        take: 5,
      }),
    ])

    // Status breakdown
    const quotesByStatus: Record<string, number> = {}
    for (const q of quotes) {
      quotesByStatus[q.status] = (quotesByStatus[q.status] || 0) + 1
    }

    // Pipeline = non-terminal statuses
    const pipelineStatuses = ['DRAFT', 'PENDING_REVIEW', 'PENDING_FINANCE', 'APPROVED', 'SENT']
    const pipelineValueInr = quotes
      .filter((q) => pipelineStatuses.includes(q.status))
      .reduce((sum, q) => sum + q.totalInr, 0)

    const wonValueInr = quotes
      .filter((q) => q.status === 'APPROVED' || q.status === 'SENT')
      .reduce((sum, q) => sum + q.totalInr, 0)

    const activeClients = clients.filter((c) => c.dealStage !== 'lost').length
    const totalClients = clients.length
    const avgQuoteValueInr = totalQuotes > 0
      ? quotes.reduce((sum, q) => sum + q.totalInr, 0) / totalQuotes
      : 0

    // Top frameworks with names
    const fwIds = topFrameworks.map((fw) => fw.frameworkId)
    const frameworks = fwIds.length > 0
      ? await db.framework.findMany({ where: { id: { in: fwIds } }, select: { id: true, name: true } })
      : []
    const fwMap = new Map(frameworks.map((f) => [f.id, f.name]))
    const topFrameworkData = topFrameworks.map((fw) => ({
      name: fwMap.get(fw.frameworkId) || 'Unknown',
      count: fw._count.id,
      valueInr: fw._sum.totalInr || 0,
    }))

    // Monthly revenue (last 6 months of APPROVED quotes)
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    sixMonthsAgo.setDate(1)
    sixMonthsAgo.setHours(0, 0, 0, 0)

    const monthlyApproved = await db.quote.findMany({
      where: {
        tenantId: TENANT_ID,
        status: 'APPROVED',
        createdAt: { gte: sixMonthsAgo },
      },
      select: { createdAt: true, totalInr: true },
    })

    const monthlyRevenueMap: Record<string, number> = {}
    for (const q of monthlyApproved) {
      const d = new Date(q.createdAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyRevenueMap[key] = (monthlyRevenueMap[key] || 0) + q.totalInr
    }

    // Fill in all 6 months
    const monthlyRevenue: Array<{ month: string; valueInr: number }> = []
    const now = new Date()
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' })
      monthlyRevenue.push({ month: label, valueInr: monthlyRevenueMap[key] || 0 })
    }

    return NextResponse.json({
      data: {
        totalQuotes,
        quotesByStatus,
        pipelineValueInr,
        wonValueInr,
        activeClients,
        totalClients,
        avgQuoteValueInr,
        topFrameworks: topFrameworkData,
        recentQuotes,
        monthlyRevenue,
      },
    })
  } catch (err) {
    console.error('[GET /api/dashboard] error:', err)
    return NextResponse.json({ error: 'Failed to fetch dashboard stats' }, { status: 500 })
  }
}