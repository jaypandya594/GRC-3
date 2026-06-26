/**
 * iSecurify — shared UI atoms
 */
'use client'

import { cn } from '@/lib/utils'
import { QUOTE_STATUS_META, DEAL_STAGE_META } from '@/lib/quoteCalculator'
import { formatINR, formatUSD } from '@/lib/currency'
import { Check } from 'lucide-react'

export function StatusBadge({ status }: { status: string }) {
  const meta = QUOTE_STATUS_META[status] || QUOTE_STATUS_META.DRAFT
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        meta.bg,
        meta.text,
      )}
    >
      {meta.label}
    </span>
  )
}

export function DealStageBadge({ stage }: { stage: string }) {
  const meta = DEAL_STAGE_META[stage] || DEAL_STAGE_META.prospect
  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold',
        meta.bg,
        meta.text,
      )}
    >
      {meta.label}
    </span>
  )
}

export function CurrencyDisplay({ inr, usd, rate }: { inr: number; usd?: number; rate?: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-base font-bold text-slate-900">{formatINR(inr)}</span>
      {usd !== undefined && (
        <span className="text-xs text-slate-500">{formatUSD(usd)}</span>
      )}
      {usd === undefined && rate && inr > 0 && (
        <span className="text-xs text-slate-500">{formatUSD(Math.round((inr / rate) * 100) / 100)}</span>
      )}
    </div>
  )
}

export function PricingCard({
  selected,
  onClick,
  title,
  subtitle,
  description,
  fee,
  feeLabel,
  badge,
  disabled,
}: {
  selected?: boolean
  onClick?: () => void
  title: string
  subtitle?: string
  description?: string
  fee?: number
  feeLabel?: string
  badge?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'relative w-full text-left rounded-xl border p-4 transition-all',
        selected
          ? 'border-brand-600 bg-brand-50 ring-2 ring-brand-600/20'
          : 'border-slate-200 bg-white hover:border-brand-400 hover:shadow-sm',
        disabled && 'opacity-50 cursor-not-allowed hover:border-slate-200 hover:shadow-none',
      )}
    >
      {selected && (
        <span className="absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
          <Check className="h-3 w-3" />
        </span>
      )}
      {badge && (
        <span className="inline-block mb-2 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-600">
          {badge}
        </span>
      )}
      <h4 className={cn('text-sm font-semibold', selected ? 'text-brand-900' : 'text-slate-900')}>
        {title}
      </h4>
      {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
      {description && <p className="text-xs text-slate-600 mt-2 line-clamp-2">{description}</p>}
      {fee !== undefined && (
        <div className="mt-3 flex items-baseline gap-1">
          <span className="text-lg font-bold text-slate-900">{formatINR(fee)}</span>
          {feeLabel && <span className="text-xs text-slate-500">{feeLabel}</span>}
        </div>
      )}
    </button>
  )
}

export function SectionCard({
  title,
  description,
  children,
  className,
  action,
}: {
  title?: string
  description?: string
  children: React.ReactNode
  className?: string
  action?: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border border-slate-200 bg-white', className)}>
      {(title || action) && (
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            {title && <h3 className="text-sm font-semibold text-slate-900">{title}</h3>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="p-5">{children}</div>
    </div>
  )
}

export function EmptyState({ icon, title, description, action }: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      {icon && <div className="mb-4 text-slate-300">{icon}</div>}
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description && <p className="text-xs text-slate-500 mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
