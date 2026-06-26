/**
 * iSecurify — Quote Builder 6-step wizard with live summary panel
 *
 * Steps:
 *  0. Client + Framework
 *  1. Tier (+ retainer toggle)
 *  2. Auditor fees
 *  3. Add-on services
 *  4. GRC Tool (optional) + DPO/vCISO
 *  5. Internal time + Discount + Review & Submit
 */
'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useQuoteBuilderStore, useNavStore } from '@/store'
import { calculateQuote, DEFAULT_QUOTE_BUILDER_SELECTION, FRAMEWORK_CATEGORY_META } from '@/lib/quoteCalculator'
import { formatINR, formatUSD, formatLineAmount } from '@/lib/currency'
import { TopBar } from '@/components/isecurify/Shell'
import { PricingCard, SectionCard, EmptyState } from '@/components/isecurify/Atoms'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Loader2,
  Save,
  Send,
  RotateCcw,
  Building2,
  Layers,
  ShieldCheck,
  Package,
  Wrench,
  Clock,
  Banknote,
  Pencil,
  X,
} from 'lucide-react'
import type {
  Framework,
  Tier,
  AuditorFee,
  AddonService,
  GrcTool,
  DpoVcisoPackage,
  Client,
  QuoteBuilderSelection,
} from '@/types'

interface PricingData {
  frameworks: Framework[]
  tiers: Tier[]
  frameworkPrices: Array<{ id: string; frameworkId: string; tierId: string; projectFeeInr: number; retainerFeeInr: number }>
  auditorFees: AuditorFee[]
  addonServices: AddonService[]
  grcTools: GrcTool[]
  dpoVcisoPackages: DpoVcisoPackage[]
  fxRate: number
}

const STEP_LABELS = ['Framework', 'Tier', 'Auditor', 'Add-ons', 'Tools & DPO', 'Review']

export function QuoteBuilderView() {
  const store = useQuoteBuilderStore()
  // Defensive: ensure selectedFrameworkIds is always an array (stale localStorage guard)
  const selection: QuoteBuilderSelection = {
    ...DEFAULT_QUOTE_BUILDER_SELECTION,
    ...store.selection,
    selectedFrameworkIds: Array.isArray(store.selection?.selectedFrameworkIds)
      ? store.selection.selectedFrameworkIds
      : [],
    selectedAuditorFeeIds: Array.isArray(store.selection?.selectedAuditorFeeIds)
      ? store.selection.selectedAuditorFeeIds
      : [],
    selectedAddonIds: Array.isArray(store.selection?.selectedAddonIds)
      ? store.selection.selectedAddonIds
      : [],
  }
  const { currentStep, setStep, nextStep, prevStep, update, reset, toggleFramework } = store
  const { navigate } = useNavStore()

  const { data: pricing, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => api.get<PricingData>('/pricing'),
  })

  const { data: clients } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<Client[]>('/clients'),
  })

  const calc = pricing
    ? calculateQuote(selection, {
        frameworks: pricing.frameworks,
        tiers: pricing.tiers,
        frameworkPrices: pricing.frameworkPrices,
        auditorFees: pricing.auditorFees,
        addonServices: pricing.addonServices,
        grcTools: pricing.grcTools,
        dpoVcisoPackages: pricing.dpoVcisoPackages,
        usdInrRate: pricing.fxRate,
      })
    : null

  const saveMutation = useMutation({
    mutationFn: (vars: { submit: boolean }) =>
      api.post('/quotes', { selection, submit: vars.submit }),
    onSuccess: (quote, vars) => {
      toast.success(vars.submit ? 'Quote submitted for review' : 'Draft saved')
      reset()
      navigate('quotes', { id: (quote as { id: string }).id })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const submit = () => saveMutation.mutate({ submit: true })
  const saveDraft = () => saveMutation.mutate({ submit: false })

  if (isLoading || !pricing) {
    return (
      <>
        <TopBar title="Quote Builder" subtitle="Loading pricing data..." />
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
        </div>
      </>
    )
  }

  const canSubmit = !!selection.clientId && selection.selectedFrameworkIds.length > 0 && !!selection.tierId

  return (
    <>
      <TopBar
        title="Quote Builder"
        subtitle="Build a compliance proposal in 6 steps"
        action={
          <button
            onClick={() => { reset(); toast.info('Quote builder reset') }}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
        }
      />

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
        {/* Left: wizard */}
        <div className="flex-1 p-4 md:p-8 space-y-6 lg:max-w-[calc(100%-22rem)] min-w-0">
          {/* Stepper */}
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STEP_LABELS.map((label, i) => {
              const done = i < currentStep
              const active = i === currentStep
              return (
                <button
                  key={label}
                  onClick={() => setStep(i)}
                  className="flex items-center gap-2 shrink-0"
                >
                  <span
                    className={cn(
                      'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors',
                      done ? 'bg-brand-600 text-white' : active ? 'bg-brand-100 text-brand-700 ring-2 ring-brand-600' : 'bg-slate-100 text-slate-400',
                    )}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className={cn('text-xs font-medium hidden sm:inline', active ? 'text-brand-700' : 'text-slate-500')}>
                    {label}
                  </span>
                  {i < STEP_LABELS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-300 mx-1" />}
                </button>
              )
            })}
          </div>

          {/* Step content */}
          {currentStep === 0 && (
            <StepFramework
              selection={selection}
              update={update}
              pricing={pricing}
              clients={clients || []}
            />
          )}
          {currentStep === 1 && (
            <StepTier selection={selection} update={update} pricing={pricing} />
          )}
          {currentStep === 2 && (
            <StepAuditor selection={selection} update={update} pricing={pricing} />
          )}
          {currentStep === 3 && (
            <StepAddons selection={selection} update={update} pricing={pricing} />
          )}
          {currentStep === 4 && (
            <StepTools selection={selection} update={update} pricing={pricing} />
          )}
          {currentStep === 5 && (
            <StepReview
              selection={selection}
              update={update}
              pricing={pricing}
              calc={calc}
              clients={clients || []}
            />
          )}

          {/* Navigation buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              onClick={prevStep}
              disabled={currentStep === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" /> Back
            </button>

            <div className="flex items-center gap-2">
              {currentStep === 5 ? (
                <>
                  <button
                    onClick={saveDraft}
                    disabled={!canSubmit || saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                  >
                    <Save className="h-4 w-4" /> Save Draft
                  </button>
                  <button
                    onClick={submit}
                    disabled={!canSubmit || saveMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-40"
                  >
                    {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    Submit for Approval
                  </button>
                </>
              ) : (
                <button
                  onClick={nextStep}
                  disabled={currentStep === 5}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
                >
                  Next <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right: live summary panel (sticky on desktop) */}
        <aside className="lg:w-[22rem] lg:border-l border-slate-200 bg-slate-50 p-4 md:p-6 lg:sticky lg:top-16 lg:self-start lg:max-h-[calc(100vh-4rem)] lg:overflow-y-auto">
          <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
            <Banknote className="h-4 w-4 text-brand-700" /> Live Quote Summary
          </h3>
          <SummaryPanel selection={selection} pricing={pricing} calc={calc} />
        </aside>
      </div>
    </>
  )
}

// ─── Summary Panel ─────────────────────────────────────────────
function SummaryPanel({ selection, pricing, calc }: {
  selection: QuoteBuilderSelection
  pricing: PricingData
  calc: ReturnType<typeof calculateQuote> | null
}) {
  if (!calc) return null
  const selectedFrameworks = pricing.frameworks.filter((f) => selection.selectedFrameworkIds.includes(f.id))
  const tier = pricing.tiers.find((t) => t.id === selection.tierId)

  return (
    <div className="space-y-3">
      {calc.lines.filter((l) => l.lineType !== 'internal_time').length === 0 && (
        <p className="text-xs text-slate-400 py-4 text-center">
          Select framework(s) and a tier to see pricing
        </p>
      )}
      {selectedFrameworks.length > 0 && (
        <p className="text-xs font-medium text-brand-700">
          {selectedFrameworks.length} framework{selectedFrameworks.length > 1 ? 's' : ''} selected
        </p>
      )}

      {calc.lines.map((line, i) => {
        const isInternal = line.lineType === 'internal_time'
        const isDiscount = line.lineType === 'discount'
        return (
          <div
            key={i}
            className={cn(
              'flex items-start justify-between gap-2 text-sm',
              isInternal && 'opacity-60',
            )}
          >
            <span className={cn('text-slate-600 flex-1', isInternal && 'italic text-xs', isDiscount && 'text-rose-600')}>
              {line.description}
            </span>
            <span className={cn(
              'font-medium tabular-nums shrink-0',
              isInternal ? 'text-slate-400 text-xs' : isDiscount ? 'text-rose-600' : 'text-slate-900',
            )}>
              {line.amountInr < 0 ? '-' : ''}{formatLineAmount(Math.abs(line.amountInr), calc.billingCurrency, calc.usdInrRate)}
            </span>
          </div>
        )
      })}

      <div className="border-t border-slate-200 pt-3 space-y-1.5">
        <div className="flex justify-between text-sm">
          <span className="text-slate-600">Subtotal</span>
          <span className="font-medium text-slate-900">{formatLineAmount(calc.subtotalInr, calc.billingCurrency, calc.usdInrRate)}</span>
        </div>
        {calc.discountInr > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-rose-600">Discount ({calc.discountPct}%)</span>
            <span className="font-medium text-rose-600">-{formatLineAmount(calc.discountInr, calc.billingCurrency, calc.usdInrRate)}</span>
          </div>
        )}
        {calc.gstAmountInr > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-slate-600">GST @ {calc.gstRate}%</span>
            <span className="font-medium text-slate-900">{formatINR(calc.gstAmountInr)}</span>
          </div>
        )}
        <div className="flex justify-between items-baseline pt-2 border-t border-slate-200">
          <span className="text-sm font-bold text-slate-900">Grand Total</span>
          <div className="text-right">
            {calc.billingCurrency === 'USD' ? (
              <>
                <p className="text-lg font-bold text-brand-700">{formatUSD(calc.totalUsd)}</p>
                <p className="text-xs text-slate-500">No GST</p>
              </>
            ) : (
              <>
                <p className="text-lg font-bold text-brand-700">{formatINR(calc.totalInr)}</p>
                <p className="text-xs text-slate-500">{formatUSD(calc.totalUsd)} @ Rs.{calc.usdInrRate}</p>
              </>
            )}
          </div>
        </div>
        {calc.internalTimeCostInr > 0 && (
          <p className="text-xs text-slate-400 italic pt-1">
            Advisory (not billed): {formatINR(calc.internalTimeCostInr)}
          </p>
        )}
      </div>
    </div>
  )
}

// ─── Step 0: Client + Framework ────────────────────────────────
function FxRateCard({ currentRate }: { currentRate: number }) {
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(currentRate))

  const updateFx = useMutation({
    mutationFn: (rate: number) => api.put('/admin/fx-rate', { rate }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pricing'] })
      toast.success('FX rate updated')
      setEditing(false)
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSave = () => {
    const val = parseFloat(draft)
    if (isNaN(val) || val <= 0) {
      toast.error('Enter a valid positive rate')
      return
    }
    updateFx.mutate(val)
  }

  const handleCancel = () => {
    setDraft(String(currentRate))
    setEditing(false)
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-slate-900">USD/INR Exchange Rate</h3>
          {!editing && (
            <p className="text-xs text-slate-500">This rate will be used to calculate USD equivalents</p>
          )}
        </div>
        {!editing ? (
          <div className="flex items-center gap-3">
            <span className="text-2xl font-bold text-brand-700 tabular-nums">{currentRate.toFixed(2)}</span>
            <button
              onClick={() => { setDraft(String(currentRate)); setEditing(true) }}
              className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
            >
              <Pencil className="h-3 w-3" /> Update Rate
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <input
              type="number"
              step={0.01}
              min={0.01}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
              className="w-28 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm tabular-nums focus:outline-none focus:ring-2 focus:ring-brand-600"
              autoFocus
            />
            <button
              onClick={handleSave}
              disabled={updateFx.isPending}
              className="inline-flex items-center gap-1 rounded-lg bg-brand-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-800 disabled:opacity-50 transition-colors"
            >
              {updateFx.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Save
            </button>
            <button
              onClick={handleCancel}
              disabled={updateFx.isPending}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function StepFramework({ selection, update, pricing, clients }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
  clients: Client[]
}) {
  const grouped = pricing.frameworks.reduce((acc, fw) => {
    (acc[fw.category] ||= []).push(fw)
    return acc
  }, {} as Record<string, Framework[]>)

  const toggle = (id: string) => {
    const ids = selection.selectedFrameworkIds
    update({
      selectedFrameworkIds: ids.includes(id)
        ? ids.filter((x) => x !== id)
        : [...ids, id],
    })
  }

  const clearAll = () => update({ selectedFrameworkIds: [] })
  const selectAll = () => update({ selectedFrameworkIds: pricing.frameworks.map((f) => f.id) })

  return (
    <div className="space-y-6">
      {/* FX Rate */}
      <FxRateCard currentRate={pricing.fxRate} />

      {/* Billing Currency */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900">Billing Currency</p>
            <p className="text-xs text-slate-500">USD quotes exclude GST</p>
          </div>
          <div className="flex rounded-lg border border-slate-200 overflow-hidden">
            <button
              onClick={() => update({ billingCurrency: 'INR' })}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold transition-colors',
                selection.billingCurrency === 'INR'
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              INR (₹)
            </button>
            <button
              onClick={() => update({ billingCurrency: 'USD' })}
              className={cn(
                'px-4 py-1.5 text-xs font-semibold transition-colors border-l border-slate-200',
                selection.billingCurrency === 'USD'
                  ? 'bg-brand-700 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50',
              )}
            >
              USD ($)
            </button>
          </div>
        </div>
      </div>

      {/* Client selection */}
      <SectionCard title="1. Select Client" description="Choose the prospect this quote is for">
        <select
          value={selection.clientId || ''}
          onChange={(e) => update({ clientId: e.target.value || null })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
        >
          <option value="">— Select a client —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName} ({c.sector || 'N/A'} • {c.companySize})
            </option>
          ))}
        </select>
      </SectionCard>

      {/* Framework selection — MULTI */}
      <SectionCard
        title="2. Select Framework(s)"
        description="Choose one or more compliance services — all selected frameworks use the same tier"
        action={
          <div className="flex items-center gap-3">
            {selection.selectedFrameworkIds.length > 0 && (
              <button onClick={clearAll} className="text-xs font-medium text-rose-600 hover:text-rose-700">
                Clear All
              </button>
            )}
            {selection.selectedFrameworkIds.length < pricing.frameworks.length && (
              <button onClick={selectAll} className="text-xs font-medium text-brand-700 hover:text-brand-800">
                Select All
              </button>
            )}
          </div>
        }
      >
        {selection.selectedFrameworkIds.length > 0 && (
          <div className="mb-4 rounded-lg bg-brand-50 border border-brand-200 px-3 py-2">
            <p className="text-xs font-medium text-brand-700">
              <Layers className="inline h-3.5 w-3.5 mr-1" />
              {selection.selectedFrameworkIds.length} framework{selection.selectedFrameworkIds.length > 1 ? 's' : ''} selected
            </p>
          </div>
        )}
        {Object.entries(grouped).map(([category, fws]) => {
          const meta = FRAMEWORK_CATEGORY_META[category] || { label: category, color: 'slate' }
          return (
            <div key={category} className="mb-6 last:mb-0">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">{meta.label}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {fws.map((fw) => (
                  <PricingCard
                    key={fw.id}
                    selected={selection.selectedFrameworkIds.includes(fw.id)}
                    onClick={() => toggle(fw.id)}
                    title={fw.name}
                    description={fw.description || undefined}
                    badge={meta.label}
                  />
                ))}
              </div>
            </div>
          )
        })}
      </SectionCard>
    </div>
  )
}

// ─── Step 1: Tier ──────────────────────────────────────────────
function StepTier({ selection, update, pricing }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
}) {
  const selectedFws = pricing.frameworks.filter((f) => selection.selectedFrameworkIds.includes(f.id))
  if (selectedFws.length === 0) {
    return (
      <SectionCard title="Select Tier">
        <EmptyState title="No framework(s) selected" description="Go back to Step 1 and select at least one framework." />
      </SectionCard>
    )
  }

  return (
    <SectionCard
      title="3. Select Tier"
      description={`${selectedFws.length === 1 ? selectedFws[0].name : `${selectedFws.length} frameworks`} — pricing varies by company size`}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {pricing.tiers.map((tier) => {
          // Calculate total consulting fee across all selected frameworks for this tier
          let totalFee = 0
          let totalRetainer = 0
          for (const fw of selectedFws) {
            const price = pricing.frameworkPrices.find(
              (p) => p.frameworkId === fw.id && p.tierId === tier.id,
            )
            if (price) {
              totalFee += price.projectFeeInr
              totalRetainer += price.retainerFeeInr
            }
          }
          return (
            <PricingCard
              key={tier.id}
              selected={selection.tierId === tier.id}
              onClick={() => update({ tierId: tier.id })}
              title={tier.name}
              subtitle={tier.description || `Retainer: ${tier.retainerPct}%`}
              fee={totalFee}
              feeLabel="total project fee"
              description={totalRetainer > 0 ? `+ ${formatINR(totalRetainer)} annual retainer` : undefined}
            />
          )
        })}
      </div>

      {selection.tierId && (
        <div className="rounded-lg border border-slate-200 p-4 bg-slate-50">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selection.includeRetainer}
              onChange={(e) => update({ includeRetainer: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <div>
              <p className="text-sm font-medium text-slate-900">Include Annual Retainer</p>
              <p className="text-xs text-slate-500">
                Adds retainer line items for each selected framework ({pricing.tiers.find((t) => t.id === selection.tierId)?.retainerPct}% of each project fee)
              </p>
            </div>
          </label>
        </div>
      )}
      {selection.includeRetainer && (
        <div className="mt-4 rounded-lg border border-slate-200 p-4 bg-slate-50 space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="radio"
              id="retainer-percent"
              name="retainerMode"
              checked={selection.retainerMode !== 'fixed'}
              onChange={() => update({ retainerMode: 'percent', retainerCustomInr: null })}
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <label htmlFor="retainer-percent" className="text-sm text-slate-700">
              Use default % (from tier pricing)
            </label>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="radio"
              id="retainer-fixed"
              name="retainerMode"
              checked={selection.retainerMode === 'fixed'}
              onChange={() => update({ retainerMode: 'fixed', retainerCustomInr: 0 })}
              className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
            />
            <label htmlFor="retainer-fixed" className="text-sm text-slate-700">
              Custom amount
            </label>
          </div>
          {selection.retainerMode === 'fixed' && (
            <div className="ml-7 flex items-center gap-2">
              <span className="text-sm text-slate-500">₹</span>
              <input
                type="number"
                value={selection.retainerCustomInr || ''}
                onChange={(e) => update({ retainerCustomInr: parseFloat(e.target.value) || 0 })}
                placeholder="Enter custom retainer amount"
                className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
              <span className="text-xs text-slate-400">per framework/year</span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  )
}

// ─── Step 2: Auditor Fees ──────────────────────────────────────
function StepAuditor({ selection, update, pricing }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
}) {
  // Group by standardName
  const grouped = pricing.auditorFees.reduce((acc, fee) => {
    (acc[fee.standardName] ||= []).push(fee)
    return acc
  }, {} as Record<string, AuditorFee[]>)

  const toggle = (id: string) => {
    const ids = selection.selectedAuditorFeeIds
    update({
      selectedAuditorFeeIds: ids.includes(id)
        ? ids.filter((x) => x !== id)
        : [...ids, id],
    })
  }

  const clearAll = () => update({ selectedAuditorFeeIds: [] })

  return (
    <SectionCard
      title="4. Select Auditor Fees"
      description="Pass-through certification body costs — select all that apply"
      action={
        selection.selectedAuditorFeeIds.length > 0 && (
          <button onClick={clearAll} className="text-xs font-medium text-rose-600 hover:text-rose-700">
            Clear All
          </button>
        )
      }
    >
      <div className="space-y-5">
        {Object.entries(grouped).map(([standard, fees]) => (
          <div key={standard}>
            <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{standard}</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {fees.map((fee) => (
                <PricingCard
                  key={fee.id}
                  selected={selection.selectedAuditorFeeIds.includes(fee.id)}
                  onClick={() => toggle(fee.id)}
                  title={fee.accreditationBody}
                  subtitle={fee.notes || undefined}
                  fee={fee.feeInr}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  )
}

// ─── Step 3: Add-ons ───────────────────────────────────────────
function StepAddons({ selection, update, pricing }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
}) {
  const toggle = (id: string) => {
    const ids = selection.selectedAddonIds
    update({
      selectedAddonIds: ids.includes(id)
        ? ids.filter((x) => x !== id)
        : [...ids, id],
    })
  }
  const clearAll = () => update({ selectedAddonIds: [] })

  return (
    <SectionCard
      title="5. Add-on Services"
      description="Optional bolt-on services — select all that apply"
      action={
        selection.selectedAddonIds.length > 0 && (
          <button onClick={clearAll} className="text-xs font-medium text-rose-600 hover:text-rose-700">
            Clear All
          </button>
        )
      }
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {pricing.addonServices.map((addon) => (
          <PricingCard
            key={addon.id}
            selected={selection.selectedAddonIds.includes(addon.id)}
            onClick={() => toggle(addon.id)}
            title={addon.name}
            subtitle={addon.category.replace(/_/g, ' ')}
            description={addon.description || undefined}
            fee={addon.feeInr}
          />
        ))}
      </div>
    </SectionCard>
  )
}

// ─── Step 4: GRC Tool + DPO/vCISO ──────────────────────────────
function StepTools({ selection, update, pricing }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
}) {
  return (
    <div className="space-y-6">
      {/* GRC Tool */}
      <SectionCard title="6. GRC Tool (Optional)" description="Annual subscription to the GRC management platform">
        <label className="flex items-center gap-3 mb-4 cursor-pointer">
          <input
            type="checkbox"
            checked={selection.grcToolEnabled}
            onChange={(e) => update({ grcToolEnabled: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-600"
          />
          <span className="text-sm font-medium text-slate-900">Include GRC Tool subscription</span>
        </label>

        {selection.grcToolEnabled && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {pricing.grcTools.map((tool) => (
                <PricingCard
                  key={tool.id}
                  selected={selection.grcToolId === tool.id && selection.grcToolCustomFee === null}
                  onClick={() => update({ grcToolId: tool.id, grcToolCustomFee: null })}
                  title={tool.planName}
                  subtitle={`Up to ${tool.maxUsers >= 999999 ? 'unlimited' : tool.maxUsers} users`}
                  fee={tool.feeInrAnnual}
                  feeLabel="/year"
                />
              ))}
            </div>
            <div className="rounded-lg border border-slate-200 p-4">
              <label className="flex items-center gap-3 cursor-pointer mb-2">
                <input
                  type="radio"
                  checked={selection.grcToolCustomFee !== null}
                  onChange={() => update({ grcToolCustomFee: 0 })}
                  className="h-4 w-4 border-slate-300 text-brand-600 focus:ring-brand-600"
                />
                <span className="text-sm font-medium text-slate-900">Custom amount</span>
              </label>
              {selection.grcToolCustomFee !== null && (
                <div className="flex items-center gap-2 ml-7">
                  <span className="text-sm text-slate-500">₹</span>
                  <input
                    type="number"
                    value={selection.grcToolCustomFee || ''}
                    onChange={(e) => update({ grcToolCustomFee: parseFloat(e.target.value) || 0 })}
                    placeholder="Enter custom annual fee"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      {/* DPO/vCISO */}
      <SectionCard title="7. DPO / vCISO Package (Optional)" description="Managed compliance service plans">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {pricing.dpoVcisoPackages.map((pkg) => (
            <PricingCard
              key={pkg.id}
              selected={selection.dpoVcisoPackageId === pkg.id}
              onClick={() => update({
                dpoVcisoPackageId: selection.dpoVcisoPackageId === pkg.id ? null : pkg.id,
              })}
              title={`${pkg.serviceType} — ${pkg.name}`}
              subtitle={`${pkg.hoursPerMonth} hours/month`}
              fee={pkg.feeInrAnnual}
              feeLabel="/year"
              description={pkg.description || undefined}
            />
          ))}
        </div>
        {selection.dpoVcisoPackageId && (
          <button
            onClick={() => update({ dpoVcisoPackageId: null })}
            className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-rose-600 hover:text-rose-700"
          >
            <X className="h-3 w-3" /> Remove DPO/vCISO package
          </button>
        )}
      </SectionCard>
    </div>
  )
}

// ─── Step 5: Internal time + Discount + Review ─────────────────
function StepReview({ selection, update, pricing, calc, clients }: {
  selection: QuoteBuilderSelection
  update: (p: Partial<QuoteBuilderSelection>) => void
  pricing: PricingData
  calc: ReturnType<typeof calculateQuote> | null
  clients: Client[]
}) {
  const selectedFws = pricing.frameworks.filter((f) => selection.selectedFrameworkIds.includes(f.id))
  const tier = pricing.tiers.find((t) => t.id === selection.tierId)
  const client = clients.find((c) => c.id === selection.clientId)

  return (
    <div className="space-y-6">
      {/* Internal time */}
      <SectionCard title="8. Internal Time (Advisory)" description="Not billed — shown separately for internal costing">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Estimated hours</label>
            <input
              type="number"
              value={selection.internalHours || ''}
              onChange={(e) => update({ internalHours: parseInt(e.target.value) || 0 })}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Hourly rate (₹)</label>
            <input
              type="number"
              value={selection.internalHourlyRate || ''}
              onChange={(e) => update({ internalHourlyRate: parseFloat(e.target.value) || 0 })}
              placeholder="0"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Total advisory cost</label>
            <div className="mt-1 rounded-lg bg-slate-50 border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700">
              {formatINR((selection.internalHours || 0) * (selection.internalHourlyRate || 0))}
              <span className="ml-1 text-xs font-normal text-slate-400">(not billed)</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Discount (Finance Override) */}
      <SectionCard title="9. Discount (Finance Override)" description="Applied by Finance before approval — reduces subtotal">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => update({ discountMode: 'percent' })}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selection.discountMode !== 'fixed'
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50',
              )}
            >
              Discount by %
            </button>
            <button
              onClick={() => update({ discountMode: 'fixed', discountPct: 0 })}
              className={cn(
                'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                selection.discountMode === 'fixed'
                  ? 'border-brand-600 bg-brand-50 text-brand-700'
                  : 'border-slate-200 text-slate-500 hover:bg-slate-50',
              )}
            >
              Discount by amount
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {selection.discountMode !== 'fixed' ? (
              <div>
                <label className="text-xs font-medium text-slate-600">Discount (%)</label>
                <input
                  type="number"
                  value={selection.discountPct || ''}
                  onChange={(e) => update({ discountPct: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  max="100"
                  step="0.5"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-medium text-slate-600">Discount Amount ({selection.billingCurrency === 'USD' ? 'USD' : 'INR'})</label>
                <input
                  type="number"
                  value={selection.discountFixedInr || ''}
                  onChange={(e) => update({ discountFixedInr: parseFloat(e.target.value) || 0 })}
                  placeholder="0"
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-slate-600">Reason</label>
              <input
                type="text"
                value={selection.discountReason}
                onChange={(e) => update({ discountReason: e.target.value })}
                placeholder="e.g., Strategic discount, bundle pricing"
                className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
              />
            </div>
          </div>
        </div>
      </SectionCard>

      {/* Quote options */}
      <SectionCard title="10. Quote Options">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-600">Validity (days)</label>
            <input
              type="number"
              value={selection.validUntilDays}
              onChange={(e) => update({ validUntilDays: parseInt(e.target.value) || 30 })}
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600">Notes (internal)</label>
            <input
              type="text"
              value={selection.notes}
              onChange={(e) => update({ notes: e.target.value })}
              placeholder="Optional internal notes"
              className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
            />
          </div>
        </div>
      </SectionCard>

      {/* Review summary */}
      <SectionCard title="Review & Submit" description="Confirm the quote details before submitting for approval">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <ReviewItem icon={<Building2 className="h-4 w-4" />} label="Client" value={client?.companyName || '—'} />
          <ReviewItem icon={<Layers className="h-4 w-4" />} label="Framework(s)" value={selectedFws.length === 0 ? '—' : selectedFws.length === 1 ? selectedFws[0].name : `${selectedFws.length} selected`} />
          <ReviewItem icon={<ShieldCheck className="h-4 w-4" />} label="Tier" value={tier?.name || '—'} />
          <ReviewItem icon={<Package className="h-4 w-4" />} label="Line items" value={`${calc?.lines.length || 0}`} />
          <ReviewItem icon={<Banknote className="h-4 w-4" />} label="Currency" value={selection.billingCurrency} />
        </div>

        {calc && (
          <div className="rounded-lg bg-brand-50 border border-brand-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                {calc.billingCurrency === 'USD' ? (
                  <p className="text-xs text-brand-700 font-medium">Grand Total (USD, no GST)</p>
                ) : (
                  <p className="text-xs text-brand-700 font-medium">Grand Total (incl. GST @ {calc.gstRate}%)</p>
                )}
                <p className="text-xs text-brand-600">Valid for {selection.validUntilDays} days</p>
              </div>
              <div className="text-right">
                {calc.billingCurrency === 'USD' ? (
                  <p className="text-2xl font-bold text-brand-800">{formatUSD(calc.totalUsd)}</p>
                ) : (
                  <>
                    <p className="text-2xl font-bold text-brand-800">{formatINR(calc.totalInr)}</p>
                    <p className="text-xs text-brand-600">{formatUSD(calc.totalUsd)}</p>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-800">
            <Clock className="inline h-3.5 w-3.5 mr-1" />
            Submitting will route this quote through the approval workflow: Sales Manager → Finance → Approved → Sent.
          </p>
        </div>
      </SectionCard>
    </div>
  )
}

function ReviewItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {icon} {label}
      </div>
      <p className="text-sm font-semibold text-slate-900 truncate">{value}</p>
    </div>
  )
}
