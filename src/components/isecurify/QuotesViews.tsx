/**
 * iSecurify — Quotes List + Detail views
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useNavStore, useAuthStore } from '@/store'
import { TopBar } from '@/components/isecurify/Shell'
import { StatusBadge, DealStageBadge, SectionCard, EmptyState } from '@/components/isecurify/Atoms'
import { formatINR, formatUSD, formatDate, formatDateTime, formatRelativeTime } from '@/lib/currency'
import { canPerformAction, getNextStatus } from '@/lib/quoteCalculator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  Search,
  Plus,
  ArrowLeft,
  FileText,
  Loader2,
  Check,
  X,
  Send,
  RotateCcw,
  Download,
  Clock,
  TrendingUp,
  Upload,
  FileIcon,
  Trash2,
} from 'lucide-react'
import { useState, useRef } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import type { Quote, QuoteStatus } from '@/types'

const STATUS_FILTERS: Array<{ id: string; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'DRAFT', label: 'Draft' },
  { id: 'PENDING_REVIEW', label: 'Pending Review' },
  { id: 'PENDING_FINANCE', label: 'Pending Finance' },
  { id: 'APPROVED', label: 'Approved' },
  { id: 'SENT', label: 'Sent' },
  { id: 'REJECTED', label: 'Rejected' },
]

async function downloadQuotePdf(id: string): Promise<void> {
  try {
    // Primary: open PDF in new tab — works in sandbox/preview/iframe environments
    // The server sends Content-Disposition: attachment so browser will download it
    const win = window.open(`/api/quote-pdf/${id}`, '_blank')
    if (!win) {
      // Popup blocked — fall back to blob download
      const res = await fetch(`/api/quote-pdf/${id}`)
      if (!res.ok) throw new Error(`Server returned ${res.status}`)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.style.display = 'none'
      a.href = blobUrl
      a.download = `iSecurify-Quote-${id.slice(-8).toUpperCase()}.pdf`
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(blobUrl)
      }, 5000)
    }
  } catch (err) {
    console.error('[PDF Download] Error:', err)
    throw err
  }
}

export function QuotesListView() {
  const { navigate } = useNavStore()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Quote | null>(null)

  const { data: quotes, isLoading } = useQuery({
    queryKey: ['quotes', filter],
    queryFn: () => api.get<Quote[]>(`/quotes?status=${filter}`),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.del(`/quotes/${id}`),
    onSuccess: () => {
      toast.success('Quote deleted')
      setDeleteTarget(null)
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: () => toast.error('Failed to delete quote'),
  })

  const filtered = (quotes || []).filter((q) =>
    !search ||
    q.client?.companyName?.toLowerCase().includes(search.toLowerCase()) ||
    q.framework?.name?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <TopBar
        title="Quotes"
        subtitle="All compliance proposals"
        action={
          <button
            onClick={() => navigate('quote-builder')}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" /> New Quote
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by client or framework..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div className="flex gap-1 overflow-x-auto pb-1">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={cn(
                  'shrink-0 rounded-lg px-3 py-2 text-xs font-medium transition-colors',
                  filter === f.id
                    ? 'bg-brand-700 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={<FileText className="h-10 w-10" />}
              title="No quotes found"
              description="Create your first quote using the Quote Builder wizard."
              action={
                <button
                  onClick={() => navigate('quote-builder')}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  <Plus className="h-4 w-4" /> New Quote
                </button>
              }
            />
          </SectionCard>
        ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Client</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden md:table-cell">Framework</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600">Status</th>
                    <th className="text-right px-4 py-3 font-semibold text-slate-600">Total</th>
                    <th className="text-left px-4 py-3 font-semibold text-slate-600 hidden lg:table-cell">Created</th>
                    <th className="px-4 py-3 w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filtered.map((q) => (
                    <tr
                      key={q.id}
                      onClick={() => navigate('quotes', { id: q.id })}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">{q.client?.companyName || 'Unknown'}</p>
                        <p className="text-xs text-slate-500">v{q.version}</p>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell text-slate-600">{getFrameworkNamesFromLines(q)}</td>
                      <td className="px-4 py-3"><StatusBadge status={q.status} /></td>
                      <td className="px-4 py-3 text-right">
                        <p className="font-bold text-slate-900">{formatINR(q.totalInr)}</p>
                        <p className="text-xs text-slate-500">{formatUSD(q.totalUsd)}</p>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                        {formatRelativeTime(q.createdAt)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDownloadingId(q.id)
                              downloadQuotePdf(q.id)
                                .then(() => toast.success('PDF download started'))
                                .catch(() => toast.error('Download failed — try again'))
                                .finally(() => setDownloadingId(null))
                            }}
                            disabled={downloadingId === q.id}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-brand-700 hover:bg-brand-50 transition-colors disabled:opacity-50"
                            title="Download PDF"
                          >
                            {downloadingId === q.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeleteTarget(q)
                            }}
                            disabled={user?.role !== 'super_admin'}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Delete Quote"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quote?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the quote for <strong>{deleteTarget?.client?.companyName || 'this client'}</strong> ({deleteTarget?.framework?.name}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
              className="bg-rose-600 hover:bg-rose-700 text-white"
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

// ─── Quote Detail ──────────────────────────────────────────────
export function QuoteDetailView({ quoteId }: { quoteId: string }) {
  const { navigate } = useNavStore()
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [comment, setComment] = useState('')
  const [overrideDiscount, setOverrideDiscount] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const deleteMutation = useMutation({
    mutationFn: () => api.del(`/quotes/${quoteId}`),
    onSuccess: () => {
      toast.success('Quote deleted')
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
      navigate('quotes')
    },
    onError: () => toast.error('Failed to delete quote'),
  })

  const handleDownloadPdf = async () => {
    setDownloading(true)
    try {
      // Primary: open in new tab (works in all environments including sandbox/preview)
      const win = window.open(`/api/quote-pdf/${quoteId}`, '_blank')
      if (!win) {
        // Popup blocked — fall back to blob download
        const res = await fetch(`/api/quote-pdf/${quoteId}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const blob = await res.blob()
        const blobUrl = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = blobUrl
        a.download = `iSecurify-Quote-${quoteId.slice(-8).toUpperCase()}.pdf`
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          document.body.removeChild(a)
          URL.revokeObjectURL(blobUrl)
        }, 5000)
      }
      toast.success('PDF download started')
    } catch (err) {
      console.error('[PDF Download] Error:', err)
      toast.error('Failed to download PDF — please try again')
    } finally {
      setDownloading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('entity', 'quote')
      fd.append('entityId', quoteId)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('Upload failed')
      toast.success(`${file.name} uploaded successfully`)
      if (fileInputRef.current) fileInputRef.current.value = ''
    } catch {
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
    }
  }

  const { data: quote, isLoading } = useQuery({
    queryKey: ['quote', quoteId],
    queryFn: () => api.get<Quote>(`/quotes/${quoteId}`),
    enabled: !!quoteId,
  })

  const actionMutation = useMutation({
    mutationFn: (vars: { action: string; comment?: string; newDiscountPct?: number }) =>
      api.post(`/quotes/${quoteId}/action`, vars),
    onSuccess: () => {
      toast.success('Action completed')
      setComment('')
      setOverrideDiscount(null)
      qc.invalidateQueries({ queryKey: ['quote', quoteId] })
      qc.invalidateQueries({ queryKey: ['quotes'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  if (isLoading || !quote) {
    return (
      <>
        <TopBar title="Quote" />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      </>
    )
  }

  // Determine available actions based on actual user role (v2 spec)
  const role = user?.role ?? 'sales_executive'
  const availableActions: Array<{ action: string; label: string; icon: React.ReactNode; variant: 'primary' | 'danger' | 'neutral' }> = []
  const status = quote.status as QuoteStatus

  if (canPerformAction(status, 'submit', role)) {
    availableActions.push({ action: 'submit', label: 'Submit for Review', icon: <Send className="h-4 w-4" />, variant: 'primary' })
  }
  if (canPerformAction(status, 'approve', role)) {
    availableActions.push({ action: 'approve', label: 'Approve', icon: <Check className="h-4 w-4" />, variant: 'primary' })
  }
  if (canPerformAction(status, 'reject', role)) {
    availableActions.push({ action: 'reject', label: 'Reject', icon: <X className="h-4 w-4" />, variant: 'danger' })
  }
  if (canPerformAction(status, 'override', role)) {
    availableActions.push({ action: 'override', label: 'Override & Approve', icon: <TrendingUp className="h-4 w-4" />, variant: 'primary' })
  }
  if (canPerformAction(status, 'send', role)) {
    availableActions.push({ action: 'send', label: 'Send to Client', icon: <Send className="h-4 w-4" />, variant: 'primary' })
  }
  if (canPerformAction(status, 'recall', role)) {
    availableActions.push({ action: 'recall', label: 'Recall', icon: <RotateCcw className="h-4 w-4" />, variant: 'neutral' })
  }

  const lineItems = quote.lineItems || []
  const billedLines = lineItems.filter((l) => l.lineType !== 'internal_time')
  const internalLines = lineItems.filter((l) => l.lineType === 'internal_time')

  return (
    <>
      <TopBar
        title={`Quote — ${quote.client?.companyName || 'Unknown'}`}
        subtitle={buildQuoteSubtitle(quote)}
        action={
          <button
            onClick={() => navigate('quotes')}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        }
      />

      <div className="p-4 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: line items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Quote meta */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-base font-bold text-slate-900">{quote.client?.companyName}</h3>
                  <StatusBadge status={quote.status} />
                </div>
                <p className="text-xs text-slate-500">
                  {quote.client?.sector} • {quote.client?.companySize} • {quote.client?.country}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Quote ID</p>
                <p className="text-xs font-mono text-slate-700">{quote.id.slice(-8).toUpperCase()}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <Meta label="Framework(s)" value={getAllFrameworkNames(quote)} />
              <Meta label="Tier" value={quote.tier?.name || '—'} />
              <Meta label="Valid Until" value={formatDate(quote.validUntil)} />
              <Meta label="Created" value={formatDate(quote.createdAt)} />
            </div>
          </div>

          {/* Line items */}
          <SectionCard title="Line Items" description={`${billedLines.length} billed items`}>
            <div className="space-y-2">
              {billedLines.map((line) => (
                <div key={line.id} className="flex items-center justify-between gap-3 py-2 border-b border-slate-100 last:border-0">
                  <div className="flex items-start gap-3 min-w-0">
                    <LineTypeIcon type={line.lineType} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900">{line.description}</p>
                      <p className="text-xs text-slate-500 capitalize">{line.lineType.replace(/_/g, ' ')}</p>
                    </div>
                  </div>
                  <span className={cn(
                    'text-sm font-semibold tabular-nums shrink-0',
                    line.amountInr < 0 ? 'text-rose-600' : 'text-slate-900',
                  )}>
                    {line.amountInr < 0 ? '-' : ''}{formatINR(Math.abs(line.amountInr))}
                  </span>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">{formatINR(quote.subtotalInr)}</span>
              </div>
              {quote.discountInr > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-rose-600">Discount ({quote.discountPct}%) {quote.discountReason ? `(${quote.discountReason})` : ''}</span>
                  <span className="font-medium text-rose-600">-{formatINR(quote.discountInr)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">GST @ {quote.gstRateSnapshot}%</span>
                <span className="font-medium text-slate-900">{formatINR(quote.gstAmountInr)}</span>
              </div>
              <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
                <span className="text-sm font-bold text-slate-900">Grand Total</span>
                <div className="text-right">
                  <p className="text-xl font-bold text-brand-700">{formatINR(quote.totalInr)}</p>
                  <p className="text-xs text-slate-500">{formatUSD(quote.totalUsd)} @ ₹{quote.usdInrRateSnapshot}</p>
                </div>
              </div>
            </div>

            {/* Internal time (advisory) */}
            {internalLines.length > 0 && (
              <div className="mt-4 rounded-lg bg-slate-50 border border-slate-200 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">Advisory (not billed)</p>
                {internalLines.map((line) => (
                  <div key={line.id} className="flex justify-between text-xs text-slate-500 italic">
                    <span>{line.description}</span>
                    <span className="tabular-nums">{formatINR(line.amountInr)}</span>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {/* Approval timeline */}
          <SectionCard title="Approval Timeline" description="Audit trail of every state transition">
            {quote.approvals && quote.approvals.length > 0 ? (
              <div className="space-y-3">
                {quote.approvals.map((a, i) => (
                  <div key={a.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
                        {i + 1}
                      </span>
                      {i < (quote.approvals!.length - 1) && <span className="w-px flex-1 bg-slate-200 my-1" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-slate-900 capitalize">{a.action}</span>
                        <span className="text-xs text-slate-500">by {a.actor?.name || 'System'}</span>
                        <span className="text-xs text-slate-400">• {formatDateTime(a.createdAt)}</span>
                      </div>
                      {a.comment && <p className="text-xs text-slate-600 mt-0.5 italic">"{a.comment}"</p>}
                      {a.amountBefore !== undefined && a.amountAfter !== undefined && a.amountBefore !== a.amountAfter && (
                        <p className="text-xs text-amber-600 mt-0.5">
                          Amount: {formatINR(a.amountBefore)} → {formatINR(a.amountAfter)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4 text-center">No approval actions yet</p>
            )}
          </SectionCard>
        </div>

        {/* Right: actions */}
        <div className="space-y-6">
          {/* Actions */}
          <SectionCard title="Actions" description={`Current status: ${quote.status.replace(/_/g, ' ')}`}>
            <div className="space-y-2">
              {availableActions.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">
                  No actions available in current status
                </p>
              ) : (
                availableActions.map((act) => (
                  <button
                    key={act.action}
                    onClick={() => {
                      if (act.action === 'override' && overrideDiscount === null) {
                        setOverrideDiscount(quote.discountPct || 0)
                        toast.info('Set the discount percentage, then confirm override')
                        return
                      }
                      actionMutation.mutate({
                        action: act.action,
                        comment: comment || undefined,
                        newDiscountPct: act.action === 'override' ? overrideDiscount ?? undefined : undefined,
                      })
                    }}
                    disabled={actionMutation.isPending}
                    className={cn(
                      'w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50',
                      act.variant === 'primary' && 'bg-brand-700 text-white hover:bg-brand-800',
                      act.variant === 'danger' && 'bg-rose-600 text-white hover:bg-rose-700',
                      act.variant === 'neutral' && 'border border-slate-200 text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    {act.icon} {act.label}
                  </button>
                ))
              )}

              {/* Override discount input */}
              {overrideDiscount !== null && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                  <label className="text-xs font-medium text-amber-800">Override discount (%)</label>
                  <input
                    type="number"
                    value={overrideDiscount}
                    onChange={(e) => setOverrideDiscount(parseFloat(e.target.value) || 0)}
                    max="100"
                    step="0.5"
                    className="w-full rounded border border-amber-300 px-2 py-1.5 text-sm"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => actionMutation.mutate({
                        action: 'override',
                        comment: comment || undefined,
                        newDiscountPct: overrideDiscount,
                      })}
                      disabled={actionMutation.isPending}
                      className="flex-1 rounded bg-amber-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-amber-700"
                    >
                      Confirm Override
                    </button>
                    <button
                      onClick={() => setOverrideDiscount(null)}
                      className="rounded border border-slate-200 px-3 py-1.5 text-xs"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="mt-3">
              <label className="text-xs font-medium text-slate-600">Comment (optional)</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a note for the audit trail..."
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </SectionCard>

          {/* Payment terms */}
          <SectionCard title="Payment Terms">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Advance (40%)</span>
                <span className="font-medium text-slate-900">{formatINR(quote.totalInr * 0.4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Midway (40%)</span>
                <span className="font-medium text-slate-900">{formatINR(quote.totalInr * 0.4)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">On Completion (20%)</span>
                <span className="font-medium text-slate-900">{formatINR(quote.totalInr * 0.2)}</span>
              </div>
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
                <Clock className="inline h-3 w-3 mr-1" />
                Valid until {formatDate(quote.validUntil)}
              </div>
            </div>
          </SectionCard>

          {/* Download PDF */}
          <button
            onClick={handleDownloadPdf}
            disabled={downloading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50"
          >
            {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {downloading ? 'Generating...' : 'Download PDF'}
          </button>

          {/* Delete Quote — super_admin only per v2 spec */}
          {role === 'super_admin' && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Quote
          </button>
          )}

          {/* Delete Confirmation Dialog */}
          <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this Quote?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete this quote and all its line items. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deleteMutation.isPending}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => deleteMutation.mutate()}
                  disabled={deleteMutation.isPending}
                  className="bg-rose-600 hover:bg-rose-700 text-white"
                >
                  {deleteMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Upload Document */}
          <SectionCard title="Upload Document" description="Attach supporting files">
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="block w-full text-sm text-slate-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 disabled:opacity-50"
                />
                {uploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-lg">
                    <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
                  </div>
                )}
              </div>
              <p className="text-xs text-slate-400">Accepted: PDF, DOC, DOCX, XLS, XLSX</p>
            </div>
          </SectionCard>
        </div>
      </div>
    </>
  )
}

// ── Helpers ────────────────────────────────────────────────────
function getFrameworkNamesFromLines(quote: Quote): string {
  const consultingLines = (quote.lineItems || []).filter((l) => l.lineType === 'consulting_fee')
  if (consultingLines.length > 1) {
    return consultingLines
      .map((l) => l.description.replace(/ — Consulting Fee.*/, '').trim())
      .join(', ')
  }
  if (consultingLines.length === 1) {
    return consultingLines[0].description.replace(/ — Consulting Fee.*/, '').trim()
  }
  return quote.framework?.name || '—'
}

function getAllFrameworkNames(quote: Quote): string {
  const consultingLines = (quote.lineItems || []).filter((l) => l.lineType === 'consulting_fee')
  if (consultingLines.length > 0) {
    return consultingLines
      .map((l) => l.description.replace(/ — Consulting Fee.*/, '').trim())
      .join(', ')
  }
  return quote.framework?.name || '—'
}

function buildQuoteSubtitle(quote: Quote): string {
  const fwNames = getAllFrameworkNames(quote)
  // Truncate if too long
  const fwDisplay = fwNames.length > 50 ? fwNames.slice(0, 47) + '...' : fwNames
  return `${fwDisplay} • ${quote.tier?.name || '—'} • v${quote.version}`
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-slate-500">{label}</p>
      <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
    </div>
  )
}

function LineTypeIcon({ type }: { type: string }) {
  const icons: Record<string, React.ReactNode> = {
    consulting_fee: <FileText className="h-4 w-4 text-brand-600" />,
    auditor_fee: <Check className="h-4 w-4 text-violet-600" />,
    addon_service: <Plus className="h-4 w-4 text-amber-600" />,
    grc_tool: <TrendingUp className="h-4 w-4 text-cyan-600" />,
    dpo_vciso: <Clock className="h-4 w-4 text-rose-600" />,
    retainer: <RotateCcw className="h-4 w-4 text-slate-600" />,
    discount: <X className="h-4 w-4 text-rose-600" />,
  }
  return <span className="mt-0.5 shrink-0">{icons[type] || <FileText className="h-4 w-4 text-slate-400" />}</span>
}
