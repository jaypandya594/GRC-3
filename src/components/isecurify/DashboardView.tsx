/**
 * iSecurify — Interactive Dashboard view
 * Pipeline stats, revenue chart, top frameworks, recent quotes with drill-down.
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { formatINR, formatNumberIN, formatRelativeTime } from '@/lib/currency'
import { StatusBadge } from '@/components/isecurify/Atoms'
import { TopBar } from '@/components/isecurify/Shell'
import { useNavStore } from '@/store'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText,
  TrendingUp,
  Users,
  Wallet,
  ArrowUpRight,
  BarChart3,
  Plus,
  Loader2,
  Building2,
  Filter,
  Download,
  X,
} from 'lucide-react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts'
import type { DashboardStats } from '@/types'

const PIE_COLORS = ['#812671', '#1B887D', '#C46C1D', '#146F9E', '#A12E87', '#45B0AD', '#FF8938', '#5D90EE']

const TIME_RANGES = [
  { id: 3, label: '3M' },
  { id: 6, label: '6M' },
  { id: 12, label: '12M' },
]

export function DashboardView() {
  const { navigate } = useNavStore()
  const [timeRange, setTimeRange] = useState(6)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [frameworkFilter, setFrameworkFilter] = useState<string | null>(null)
  const [addClientOpen, setAddClientOpen] = useState(false)

  const { data: stats, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<DashboardStats>('/dashboard'),
  })

  const totalQuotes = stats?.totalQuotes ?? 0
  const quotesByStatus = stats?.quotesByStatus ?? {}
  const pipelineValue = stats?.pipelineValueInr ?? 0
  const wonValue = stats?.wonValueInr ?? 0
  const activeClients = stats?.activeClients ?? 0
  const totalClients = stats?.totalClients ?? 0
  const avgValue = stats?.avgQuoteValueInr ?? 0
  const topFrameworks = stats?.topFrameworks ?? []
  const monthlyRevenue = stats?.monthlyRevenue ?? []
  const recentQuotes = stats?.recentQuotes ?? []

  // Filtered recent quotes
  const filteredQuotes = recentQuotes.filter((q) => {
    if (statusFilter && q.status !== statusFilter) return false
    if (frameworkFilter && q.framework?.name !== frameworkFilter) return false
    return true
  })

  const statusPieData = Object.entries(quotesByStatus).map(([name, value]) => ({
    name: name.replace(/_/g, ' '),
    value,
    statusKey: name,
  }))

  const activeFilters = [statusFilter, frameworkFilter].filter(Boolean)

  const clearFilters = () => {
    setStatusFilter(null)
    setFrameworkFilter(null)
  }

  return (
    <>
      <TopBar
        title="Dashboard"
        subtitle="GRC pricing pipeline overview"
        action={
          <button
            onClick={() => navigate('quote-builder')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New Quote
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : (
          <>
            {/* Quick Actions */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('quote-builder')}
                className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 p-4 text-left hover:bg-brand-100 transition-colors"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-700 text-white">
                  <Plus className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-900">New Quote</p>
                  <p className="text-xs text-brand-700">Start a new compliance proposal</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setAddClientOpen(true)}
                className="flex items-center gap-3 rounded-xl border border-brand-teal-200 bg-brand-teal-50 p-4 text-left hover:bg-brand-teal-100 transition-colors"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal-600 text-white">
                  <Building2 className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-teal-900">Add Client</p>
                  <p className="text-xs text-brand-teal-700">Quickly add a new prospect</p>
                </div>
              </motion.button>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigate('quotes')}
                className="flex items-center gap-3 rounded-xl border border-brand-orange-200 bg-brand-orange-50 p-4 text-left hover:bg-brand-orange-100 transition-colors"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-orange-600 text-white">
                  <FileText className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-orange-900">View Pipeline</p>
                  <p className="text-xs text-brand-orange-700">Browse all quotes and status</p>
                </div>
              </motion.button>
            </div>

            {/* KPI cards — clickable */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}>
                <button
                  onClick={() => navigate('quotes')}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 md:p-5 hover:shadow-md hover:border-brand-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <FileText className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500">Total Quotes</p>
                  <p className="text-lg md:text-xl font-bold text-slate-900 mt-0.5">
                    <AnimatedCounter value={totalQuotes} />
                  </p>
                </button>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}>
                <button
                  onClick={() => navigate('quotes')}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 md:p-5 hover:shadow-md hover:border-amber-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                      <Wallet className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500">Pipeline Value</p>
                  <p className="text-lg md:text-xl font-bold text-slate-900 mt-0.5 truncate">
                    {formatINR(pipelineValue)}
                  </p>
                </button>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}>
                <button
                  onClick={() => navigate('clients')}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 md:p-5 hover:shadow-md hover:border-violet-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                      <Users className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500">Active Clients</p>
                  <p className="text-lg md:text-xl font-bold text-slate-900 mt-0.5">
                    {activeClients} / {totalClients}
                  </p>
                </button>
              </motion.div>

              <motion.div whileHover={{ y: -2 }} transition={{ type: 'spring', stiffness: 300 }}>
                <button
                  onClick={() => navigate('quotes')}
                  className="w-full text-left rounded-xl border border-slate-200 bg-white p-4 md:p-5 hover:shadow-md hover:border-emerald-200 transition-all"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                      <TrendingUp className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-slate-300" />
                  </div>
                  <p className="text-xs text-slate-500">Avg. Quote Value</p>
                  <p className="text-lg md:text-xl font-bold text-slate-900 mt-0.5 truncate">
                    {formatINR(avgValue)}
                  </p>
                </button>
              </motion.div>
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Monthly revenue with time range selector */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900">Approved Revenue Trend</h3>
                    <p className="text-xs text-slate-500">INR (Lakh format)</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                      {TIME_RANGES.map((tr) => (
                        <button
                          key={tr.id}
                          onClick={() => setTimeRange(tr.id)}
                          className={cn(
                            'px-3 py-1.5 text-xs font-medium transition-colors',
                            timeRange === tr.id
                              ? 'bg-brand-700 text-white'
                              : 'bg-white text-slate-600 hover:bg-slate-50',
                          )}
                        >
                          {tr.label}
                        </button>
                      ))}
                    </div>
                    <BarChart3 className="h-4 w-4 text-slate-400" />
                  </div>
                </div>
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={monthlyRevenue.slice(-timeRange)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#64748b' }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => v >= 10000000 ? `${(v / 10000000).toFixed(1)}Cr` : v >= 100000 ? `${(v / 100000).toFixed(1)}L` : `${v / 1000}k`}
                    />
                    <Tooltip
                      formatter={(v: number) => [formatINR(v), 'Revenue']}
                      contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }}
                    />
                    <Bar
                      dataKey="valueInr"
                      fill="#1B887D"
                      radius={[6, 6, 0, 0]}
                      cursor="pointer"
                      onClick={(data) => {
                        if (data && data.activePayload?.[0]?.payload) {
                          toast.info(`Revenue in ${data.activePayload[0].payload.month}: ${formatINR(data.activePayload[0].payload.valueInr)}`)
                        }
                      }}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Status distribution — clickable pie */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-slate-900">Quotes by Status</h3>
                  <Filter className="h-4 w-4 text-slate-400" />
                </div>
                <p className="text-xs text-slate-500 mb-4">Click a segment to filter</p>
                {statusPieData.length === 0 ? (
                  <div className="h-[260px] flex items-center justify-center text-sm text-slate-400">
                    No quotes yet
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={statusPieData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        innerRadius={40}
                        paddingAngle={2}
                        cursor="pointer"
                        onClick={(data) => {
                          if (data && data.statusKey) {
                            setStatusFilter((prev) => prev === data.statusKey ? null : data.statusKey)
                          }
                        }}
                      >
                        {statusPieData.map((entry, i) => (
                          <Cell
                            key={i}
                            fill={PIE_COLORS[i % PIE_COLORS.length]}
                            stroke={statusFilter === entry.statusKey ? '#812671' : 'transparent'}
                            strokeWidth={statusFilter === entry.statusKey ? 3 : 0}
                          />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #e2e8f0', fontSize: 12 }} />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}

                {/* Status filter chips */}
                {Object.entries(quotesByStatus).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {Object.entries(quotesByStatus).map(([key, count]) => (
                      <button
                        key={key}
                        onClick={() => setStatusFilter((prev) => prev === key ? null : key)}
                        className={cn(
                          'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                          statusFilter === key
                            ? 'bg-brand-700 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200',
                        )}
                      >
                        {key.replace(/_/g, ' ')} ({count})
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Top frameworks + recent quotes */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Top frameworks — clickable */}
              <div className="rounded-xl border border-slate-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Frameworks</h3>
                <div className="space-y-2">
                  {topFrameworks.length === 0 ? (
                    <p className="text-sm text-slate-400 py-6 text-center">No data yet</p>
                  ) : (
                    topFrameworks.map((fw, i) => (
                      <motion.button
                        key={fw.name}
                        whileHover={{ x: 4 }}
                        onClick={() => setFrameworkFilter((prev) => prev === fw.name ? null : fw.name)}
                        className={cn(
                          'w-full flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                          frameworkFilter === fw.name
                            ? 'bg-brand-50 ring-1 ring-brand-200'
                            : 'hover:bg-slate-50',
                        )}
                      >
                        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-xs font-bold text-brand-700 shrink-0">
                          {i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{fw.name}</p>
                          <p className="text-xs text-slate-500">{fw.count} quotes • {formatINR(fw.valueInr)}</p>
                        </div>
                        {frameworkFilter === fw.name && (
                          <X className="h-4 w-4 text-brand-600 shrink-0" />
                        )}
                      </motion.button>
                    ))
                  )}
                </div>
              </div>

              {/* Recent quotes with filters */}
              <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-900">Recent Quotes</h3>
                    {filteredQuotes.length !== recentQuotes.length && (
                      <span className="text-xs text-brand-700 font-medium">({filteredQuotes.length} shown)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {activeFilters.length > 0 && (
                      <button
                        onClick={clearFilters}
                        className="inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
                      >
                        <X className="h-3 w-3" /> Clear filters
                      </button>
                    )}
                    <button
                      onClick={() => navigate('quotes')}
                      className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:text-brand-800"
                    >
                      View all <ArrowUpRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Active filter bar */}
                <AnimatePresence>
                  {activeFilters.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden border-b border-slate-100"
                    >
                      <div className="px-5 py-2 bg-slate-50 flex flex-wrap items-center gap-2">
                        <Filter className="h-3.5 w-3.5 text-slate-500" />
                        {statusFilter && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-800 px-2.5 py-0.5 text-xs font-medium">
                            {statusFilter.replace(/_/g, ' ')}
                            <button onClick={() => setStatusFilter(null)}><X className="h-3 w-3" /></button>
                          </span>
                        )}
                        {frameworkFilter && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-800 px-2.5 py-0.5 text-xs font-medium">
                            {frameworkFilter}
                            <button onClick={() => setFrameworkFilter(null)}><X className="h-3 w-3" /></button>
                          </span>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto">
                  {filteredQuotes.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-slate-400 mb-2">
                        {activeFilters.length > 0 ? 'No quotes match the selected filters' : 'No quotes yet. Create your first quote!'}
                      </p>
                      {activeFilters.length > 0 && (
                        <button
                          onClick={clearFilters}
                          className="text-xs text-brand-700 font-medium hover:underline"
                        >
                          Clear all filters
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredQuotes.map((q) => (
                      <motion.button
                        key={q.id}
                        whileHover={{ backgroundColor: 'rgba(248,250,252,1)' }}
                        onClick={() => navigate('quotes', { id: q.id })}
                        className="w-full flex items-center justify-between gap-4 px-5 py-3 transition-colors text-left"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-slate-900 truncate">
                              {q.client?.companyName || 'Unknown client'}
                            </p>
                            <StatusBadge status={q.status} />
                          </div>
                          <p className="text-xs text-slate-500 mt-0.5">
                            {q.framework?.name} • {formatRelativeTime(q.createdAt)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-slate-900">{formatINR(q.totalInr)}</p>
                          <p className="text-[11px] text-slate-500">v{q.version}</p>
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Export CSV */}
            <div className="flex justify-end">
              <button
                onClick={exportCsv}
                disabled={recentQuotes.length === 0}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
              >
                <Download className="h-4 w-4" /> Export CSV
              </button>
            </div>
          </>
        )}
      </div>

      {/* Add Client Dialog */}
      {addClientOpen && <AddClientDialog onClose={() => setAddClientOpen(false)} />}
    </>
  )
}

// ─── Animated Counter ──────────────────────────────────────────
function AnimatedCounter({ value, duration = 1200 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0)
  const prevValue = useRef(0)

  useEffect(() => {
    const start = prevValue.current
    const end = value
    const startTime = performance.now()

    const animate = (currentTime: number) => {
      const elapsed = currentTime - startTime
      const progress = Math.min(elapsed / duration, 1)
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(start + (end - start) * eased))
      if (progress < 1) requestAnimationFrame(animate)
    }

    requestAnimationFrame(animate)
    prevValue.current = value
  }, [value, duration])

  return <>{formatNumberIN(display)}</>
}

// ─── Export CSV ────────────────────────────────────────────────
function exportCsv() {
  const rows = [
    ['Client', 'Framework', 'Tier', 'Status', 'Subtotal (INR)', 'Discount (INR)', 'GST (INR)', 'Total (INR)', 'USD', 'Created'],
  ]

  // We'll fetch fresh data for export
  fetch('/api/quotes?status=all')
    .then((r) => r.json())
    .then((res) => {
      const quotes = res.data || []
      for (const q of quotes) {
        rows.push([
          q.client?.companyName || '',
          q.framework?.name || '',
          q.tier?.name || '',
          q.status,
          String(q.subtotalInr),
          String(q.discountInr),
          String(q.gstAmountInr),
          String(q.totalInr),
          String(q.totalUsd),
          new Date(q.createdAt).toLocaleDateString('en-IN'),
        ])
      }
      const csv = rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `isecurify-quotes-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
    .catch(() => {
      // fallback: ignore
    })
}

// ─── Add Client Dialog ────────────────────────────────────────
function AddClientDialog({ onClose }: { onClose: () => void }) {
  const [companyName, setCompanyName] = useState('')
  const [sector, setSector] = useState('')
  const [companySize, setCompanySize] = useState('Mid-size')
  const qc = useQueryClient()

  const mutation = useMutation({
    mutationFn: (body: { companyName: string; sector: string; companySize: string }) =>
      api.post('/clients', body),
    onSuccess: () => {
      toast.success('Client added successfully')
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      onClose()
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!companyName.trim()) return
    mutation.mutate({ companyName: companyName.trim(), sector: sector.trim(), companySize })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-bold text-slate-900 mb-1">Quick Add Client</h3>
        <p className="text-xs text-slate-500 mb-5">Add a new prospect to the pipeline</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Company Name *</label>
            <input
              autoFocus
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g., Acme Technologies"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Sector</label>
            <input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g., IT Services"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Company Size</label>
            <div className="mt-1 flex gap-2">
              {['Startup', 'Mid-size', 'Enterprise'].map((size) => (
                <button
                  key={size}
                  type="button"
                  onClick={() => setCompanySize(size)}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors',
                    companySize === size
                      ? 'border-brand-600 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!companyName.trim() || mutation.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
            >
              {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Add Client
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  )
}