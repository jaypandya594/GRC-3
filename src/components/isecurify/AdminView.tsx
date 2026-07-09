/**
 * iSecurify — Admin Panel (full CRUD)
 * Sections: Frameworks, Tiers, Framework Prices, Auditor Fees,
 *           Add-on Services, GRC Tools, DPO/vCISO Packages, FX Rate
 */
'use client'

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { TopBar } from '@/components/isecurify/Shell'
import { SectionCard, EmptyState } from '@/components/isecurify/Atoms'
import { formatINR } from '@/lib/currency'
import { FRAMEWORK_CATEGORY_META } from '@/lib/quoteCalculator'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

import {
  Layers,
  ShieldCheck,
  Banknote,
  Package,
  Wrench,
  Clock,
  TrendingUp,
  Loader2,
  Pencil,
  Check,
  Plus,
  Trash2,
} from 'lucide-react'
import type {
  Framework,
  Tier,
  FrameworkPrice,
  AuditorFee,
  AddonService,
  GrcTool,
  DpoVcisoPackage,
  FrameworkCategory,
  AddonCategory,
  DpoVcisoType,
} from '@/types'

// ── Types ──────────────────────────────────────────────────────
type Section =
  | 'frameworks'
  | 'tiers'
  | 'prices'
  | 'auditors'
  | 'addons'
  | 'grc'
  | 'dpo'
  | 'fx'

const SECTIONS: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'frameworks', label: 'Frameworks', icon: <Layers className="h-4 w-4" /> },
  { id: 'tiers', label: 'Tiers', icon: <ShieldCheck className="h-4 w-4" /> },
  { id: 'prices', label: 'Framework Prices', icon: <Banknote className="h-4 w-4" /> },
  { id: 'auditors', label: 'Auditor Fees', icon: <Check className="h-4 w-4" /> },
  { id: 'addons', label: 'Add-on Services', icon: <Package className="h-4 w-4" /> },
  { id: 'grc', label: 'GRC Tools', icon: <Wrench className="h-4 w-4" /> },
  { id: 'dpo', label: 'DPO / vCISO', icon: <Clock className="h-4 w-4" /> },
  { id: 'fx', label: 'FX Rate', icon: <TrendingUp className="h-4 w-4" /> },
]

interface PricingData {
  frameworks: Framework[]
  tiers: Tier[]
  frameworkPrices: FrameworkPrice[]
  auditorFees: AuditorFee[]
  addonServices: AddonService[]
  grcTools: GrcTool[]
  dpoVcisoPackages: DpoVcisoPackage[]
  fxRate: number
}

// ── Shared components ──────────────────────────────────────────

function DeleteConfirm({ onConfirm, label }: { onConfirm: () => void; label: string }) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-rose-600">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The item will be deactivated.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-rose-600 hover:bg-rose-700"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function EditButton({ onClick }: { onClick: () => void }) {
  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-slate-400 hover:text-brand-700"
      onClick={onClick}
    >
      <Pencil className="h-3.5 w-3.5" />
    </Button>
  )
}

function FormField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <Label className="text-xs font-medium text-slate-700">{label}</Label>
      {children}
    </div>
  )
}

// ── Main view ──────────────────────────────────────────────────

export function AdminView() {
  const [section, setSection] = useState<Section>('frameworks')

  const { data, isLoading } = useQuery({
    queryKey: ['pricing'],
    queryFn: () => api.get<PricingData>('/pricing'),
  })

  return (
    <>
      <TopBar title="Admin Panel" subtitle="Master pricing data management" />

      <div className="flex flex-col lg:flex-row min-h-[calc(100vh-4rem)]">
        {/* Section tabs */}
        <nav className="lg:w-60 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white p-3 lg:p-4" aria-label="Admin sections">
          <div className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className={cn(
                  'shrink-0 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  section === s.id
                    ? 'bg-brand-50 text-brand-800'
                    : 'text-slate-600 hover:bg-slate-100',
                )}
              >
                {s.icon} {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Section content */}
        <main className="flex-1 p-4 md:p-8 min-w-0">
          {isLoading || !data ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
            </div>
          ) : (
            <>
              {section === 'frameworks' && <FrameworksSection frameworks={data.frameworks} />}
              {section === 'tiers' && <TiersSection tiers={data.tiers} />}
              {section === 'prices' && <PricesSection prices={data.frameworkPrices} frameworks={data.frameworks} tiers={data.tiers} />}
              {section === 'auditors' && <AuditorsSection fees={data.auditorFees} />}
              {section === 'addons' && <AddonsSection addons={data.addonServices} />}
              {section === 'grc' && <GrcSection tools={data.grcTools} />}
              {section === 'dpo' && <DpoSection packages={data.dpoVcisoPackages} />}
              {section === 'fx' && <FxSection rate={data.fxRate} />}
            </>
          )}
        </main>
      </div>
    </>
  )
}

// ─── 1. Frameworks ─────────────────────────────────────────────

const FRAMEWORK_CATEGORIES: FrameworkCategory[] = ['IT_Security', 'Privacy', 'Quality', 'Food_Safety', 'Industry']

function FrameworksSection({ frameworks }: { frameworks: Framework[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Framework | null>(null)

  const [form, setForm] = useState({ name: '', category: 'IT_Security' as FrameworkCategory, description: '', sortOrder: 0, isActive: true })

  const resetForm = useCallback((fw?: Framework) => {
    if (fw) {
      setForm({ name: fw.name, category: fw.category, description: fw.description ?? '', sortOrder: fw.sortOrder, isActive: fw.isActive })
    } else {
      setForm({ name: '', category: 'IT_Security', description: '', sortOrder: 0, isActive: true })
    }
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (fw: Framework) => { resetForm(fw); setEditing(fw); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<Framework>('/admin/frameworks', body),
    onSuccess: () => { toast.success('Framework added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<Framework>(`/admin/frameworks/${editing!.id}`, body),
    onSuccess: () => { toast.success('Framework updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/frameworks/${id}`),
    onSuccess: () => { toast.success('Framework deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  const grouped = frameworks.reduce((acc, fw) => {
    (acc[fw.category] ||= []).push(fw)
    return acc
  }, {} as Record<string, Framework[]>)

  return (
    <SectionCard
      title="Frameworks"
      description={`${frameworks.length} frameworks, grouped by category`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Framework</Button>}
    >
      {Object.keys(grouped).length === 0 ? (
        <EmptyState title="No frameworks" description="Add your first framework to get started" />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([category, fws]) => {
            const meta = FRAMEWORK_CATEGORY_META[category] || { label: category }
            return (
              <div key={category}>
                <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{meta.label}</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {fws.map((fw) => (
                    <div key={fw.id} className="group relative rounded-lg border border-slate-200 p-3 hover:border-brand-300 transition-colors">
                      <div className="absolute top-2 right-2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditButton onClick={() => openEdit(fw)} />
                        <DeleteConfirm label={fw.name} onConfirm={() => deleteMutation.mutate(fw.id)} />
                      </div>
                      <p className="text-sm font-medium text-slate-900">{fw.name}</p>
                      <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{fw.description}</p>
                      {!fw.isActive && <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">Inactive</span>}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Framework' : 'Add Framework'}</DialogTitle>
            <DialogDescription>{editing ? 'Update framework details' : 'Create a new certification framework'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. ISO 27001" />
            </FormField>
            <FormField label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as FrameworkCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FRAMEWORK_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{FRAMEWORK_CATEGORY_META[c]?.label ?? c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
            </FormField>
            <FormField label="Sort Order">
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 2. Tiers ──────────────────────────────────────────────────

function TiersSection({ tiers }: { tiers: Tier[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Tier | null>(null)
  const [form, setForm] = useState({ name: '', description: '', retainerPct: 0, sortOrder: 0, isActive: true })

  const resetForm = useCallback((t?: Tier) => {
    if (t) setForm({ name: t.name, description: t.description ?? '', retainerPct: t.retainerPct, sortOrder: t.sortOrder, isActive: t.isActive })
    else setForm({ name: '', description: '', retainerPct: 0, sortOrder: 0, isActive: true })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (t: Tier) => { resetForm(t); setEditing(t); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<Tier>('/admin/tiers', body),
    onSuccess: () => { toast.success('Tier added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<Tier>(`/admin/tiers/${editing!.id}`, body),
    onSuccess: () => { toast.success('Tier updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/tiers/${id}`),
    onSuccess: () => { toast.success('Tier deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  return (
    <SectionCard
      title="Tiers"
      description={`${tiers.length} company-size tiers with retainer percentages`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Tier</Button>}
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tiers.map((tier) => (
          <div key={tier.id} className="group relative rounded-lg border border-slate-200 p-4 hover:border-brand-300 transition-colors">
            <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <EditButton onClick={() => openEdit(tier)} />
              <DeleteConfirm label={tier.name} onConfirm={() => deleteMutation.mutate(tier.id)} />
            </div>
            <p className="text-sm font-bold text-slate-900">{tier.name}</p>
            {tier.description && <p className="text-xs text-slate-500 mt-0.5">{tier.description}</p>}
            <p className="text-2xl font-bold text-brand-700 mt-1">{tier.retainerPct}%</p>
            <p className="text-xs text-slate-500 mt-0.5">annual retainer</p>
            {!tier.isActive && <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-500">Inactive</span>}
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Tier' : 'Add Tier'}</DialogTitle>
            <DialogDescription>{editing ? 'Update tier details' : 'Create a new company-size tier'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mid-size" />
            </FormField>
            <FormField label="Description">
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder='e.g. "1–50 employees"' />
            </FormField>
            <FormField label="Retainer %">
              <Input type="number" step="0.1" value={form.retainerPct} onChange={(e) => setForm({ ...form, retainerPct: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Sort Order">
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 3. Framework Prices ──────────────────────────────────────

function PricesSection({ prices, frameworks, tiers }: { prices: FrameworkPrice[]; frameworks: Framework[]; tiers: Tier[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<FrameworkPrice | null>(null)
  const [form, setForm] = useState({ frameworkId: '', tierId: '', projectFeeInr: 0, retainerFeeInr: 0 })
  const [cellTarget, setCellTarget] = useState<{ frameworkId: string; tierId: string } | null>(null)

  const resetForm = useCallback((p?: FrameworkPrice, fwId?: string, tId?: string) => {
    if (p) setForm({ frameworkId: p.frameworkId, tierId: p.tierId, projectFeeInr: p.projectFeeInr, retainerFeeInr: p.retainerFeeInr })
    else setForm({ frameworkId: fwId || '', tierId: tId || '', projectFeeInr: 0, retainerFeeInr: 0 })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setCellTarget(null); setOpen(true) }
  const openEdit = (p: FrameworkPrice) => { resetForm(p); setEditing(p); setCellTarget({ frameworkId: p.frameworkId, tierId: p.tierId }); setOpen(true) }
  const openCell = (fwId: string, tId: string, price?: FrameworkPrice) => {
    if (price) {
      resetForm(price)
      setEditing(price)
    } else {
      resetForm(undefined, fwId, tId)
      setEditing(null)
    }
    setCellTarget({ frameworkId: fwId, tierId: tId })
    setOpen(true)
  }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<FrameworkPrice>('/admin/framework-prices', body),
    onSuccess: () => { toast.success('Price added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<FrameworkPrice>(`/admin/framework-prices/${editing!.id}`, body),
    onSuccess: () => { toast.success('Price updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/framework-prices/${id}`),
    onSuccess: () => { toast.success('Price deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.frameworkId || !form.tierId) { toast.error('Framework and Tier are required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  const activeFrameworks = frameworks.filter((f) => f.isActive).sort((a, b) => a.sortOrder - b.sortOrder)
  const activeTiers = tiers.filter((t) => t.isActive).sort((a, b) => a.sortOrder - b.sortOrder)

  // Build a lookup map for the grid
  const priceMap = new Map<string, FrameworkPrice>()
  prices.forEach((p) => priceMap.set(`${p.frameworkId}-${p.tierId}`, p))

  return (
    <SectionCard
      title="Framework Price Grid"
      description="Rows = frameworks, columns = tiers. Click edit on any price to modify."
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Price</Button>}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left px-3 py-2 font-semibold text-slate-600 sticky left-0 bg-white z-10">Framework</th>
              {activeTiers.map((t) => (
                <th key={t.id} className="text-right px-3 py-2 font-semibold text-slate-600 whitespace-nowrap">
                  {t.name}
                  <span className="block text-[10px] font-normal text-slate-400">({t.retainerPct}% ret.)</span>
                </th>
              ))}
              <th className="w-16" />
            </tr>
          </thead>
          <tbody>
            {activeFrameworks.map((fw) => (
              <tr key={fw.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-3 py-2 font-medium text-slate-900 sticky left-0 bg-white z-10">
                  {fw.name}
                  <span className="block text-[10px] text-slate-400">{FRAMEWORK_CATEGORY_META[fw.category]?.label}</span>
                </td>
                {activeTiers.map((t) => {
                  const price = priceMap.get(`${fw.id}-${t.id}`)
                  return (
                    <td
                      key={t.id}
                      className="text-right px-3 py-2 tabular-nums text-slate-700 cursor-pointer hover:bg-brand-50 transition-colors"
                      onClick={() => openCell(fw.id, t.id, price || undefined)}
                    >
                      {price ? formatINR(price.projectFeeInr) : (
                        <span className="text-slate-300 hover:text-brand-600 text-xs">+ Add</span>
                      )}
                    </td>
                  )
                })}
                <td className="px-2 py-2" />
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Price list below the grid for editing/deleting individual prices */}
      {prices.length > 0 && (
        <div className="mt-6 border-t border-slate-200 pt-4">
          <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-3">All Prices ({prices.length})</h4>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {prices.map((p) => {
              const fwName = p.framework?.name ?? p.frameworkId
              const tName = p.tier?.name ?? p.tierId
              return (
                <div key={p.id} className="group flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 hover:border-brand-300 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-sm font-medium text-slate-900 truncate">{fwName}</span>
                    <span className="text-xs text-slate-400">→</span>
                    <span className="text-xs font-medium text-slate-600">{tName}</span>
                    <span className="text-xs text-slate-500">Project: {formatINR(p.projectFeeInr)}</span>
                    <span className="text-xs text-slate-500">Retainer: {formatINR(p.retainerFeeInr)}</span>
                  </div>
                  <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                    <EditButton onClick={() => openEdit(p)} />
                    <DeleteConfirm label="price entry" onConfirm={() => deleteMutation.mutate(p.id)} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setCellTarget(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Framework Price' : 'Add Framework Price'}</DialogTitle>
            <DialogDescription>Set project and retainer fees for a framework × tier combination</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Framework">
              <Select value={form.frameworkId} onValueChange={(v) => setForm({ ...form, frameworkId: v })} disabled={!!cellTarget}>
                <SelectTrigger><SelectValue placeholder="Select framework" /></SelectTrigger>
                <SelectContent>
                  {activeFrameworks.map((fw) => (
                    <SelectItem key={fw.id} value={fw.id}>{fw.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Tier">
              <Select value={form.tierId} onValueChange={(v) => setForm({ ...form, tierId: v })} disabled={!!cellTarget}>
                <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                <SelectContent>
                  {activeTiers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Project Fee (INR)">
              <Input type="number" value={form.projectFeeInr} onChange={(e) => setForm({ ...form, projectFeeInr: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Retainer Fee (INR)">
              <Input type="number" value={form.retainerFeeInr} onChange={(e) => setForm({ ...form, retainerFeeInr: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 4. Auditor Fees ──────────────────────────────────────────

function AuditorsSection({ fees }: { fees: AuditorFee[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AuditorFee | null>(null)
  const [form, setForm] = useState({ standardName: '', accreditationBody: '', feeInr: 0, notes: '', isActive: true })

  const resetForm = useCallback((f?: AuditorFee) => {
    if (f) setForm({ standardName: f.standardName, accreditationBody: f.accreditationBody, feeInr: f.feeInr, notes: f.notes ?? '', isActive: f.isActive })
    else setForm({ standardName: '', accreditationBody: '', feeInr: 0, notes: '', isActive: true })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (f: AuditorFee) => { resetForm(f); setEditing(f); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<AuditorFee>('/admin/auditor-fees', body),
    onSuccess: () => { toast.success('Auditor fee added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<AuditorFee>(`/admin/auditor-fees/${editing!.id}`, body),
    onSuccess: () => { toast.success('Auditor fee updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/auditor-fees/${id}`),
    onSuccess: () => { toast.success('Auditor fee deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.standardName.trim() || !form.accreditationBody.trim()) { toast.error('Standard name and accreditation body are required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  const grouped = fees.reduce((acc, fee) => {
    (acc[fee.standardName] ||= []).push(fee)
    return acc
  }, {} as Record<string, AuditorFee[]>)

  return (
    <SectionCard
      title="Auditor Fees"
      description={`${fees.length} certification body fees — pass-through costs`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Auditor Fee</Button>}
    >
      {Object.keys(grouped).length === 0 ? (
        <EmptyState title="No auditor fees" description="Add your first auditor fee entry" />
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([standard, standardFees]) => (
            <div key={standard} className="rounded-lg border border-slate-200 p-3">
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{standard}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {standardFees.map((fee) => (
                  <div key={fee.id} className="group relative flex items-center justify-between rounded bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-slate-700">{fee.accreditationBody}</p>
                      {fee.notes && <p className="text-[10px] text-slate-400">{fee.notes}</p>}
                      {!fee.isActive && <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">Inactive</span>}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatINR(fee.feeInr)}</p>
                      <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <EditButton onClick={() => openEdit(fee)} />
                        <DeleteConfirm label={fee.accreditationBody} onConfirm={() => deleteMutation.mutate(fee.id)} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Auditor Fee' : 'Add Auditor Fee'}</DialogTitle>
            <DialogDescription>Set certification body pass-through costs</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Standard Name">
              <Input value={form.standardName} onChange={(e) => setForm({ ...form, standardName: e.target.value })} placeholder="e.g. ISO 27001" />
            </FormField>
            <FormField label="Accreditation Body">
              <Input value={form.accreditationBody} onChange={(e) => setForm({ ...form, accreditationBody: e.target.value })} placeholder="e.g. BSI, TUV, SGS" />
            </FormField>
            <FormField label="Fee (INR)">
              <Input type="number" value={form.feeInr} onChange={(e) => setForm({ ...form, feeInr: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Notes">
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Any additional notes..." rows={2} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 5. Add-on Services ───────────────────────────────────────

const ADDON_CATEGORIES: AddonCategory[] = ['gap_analysis', 'documentation', 'training', 'audit', 'advisory']

function AddonsSection({ addons }: { addons: AddonService[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<AddonService | null>(null)
  const [form, setForm] = useState({ name: '', description: '', category: 'gap_analysis' as AddonCategory, feeInr: 0, sortOrder: 0, isActive: true })

  const resetForm = useCallback((a?: AddonService) => {
    if (a) setForm({ name: a.name, description: a.description ?? '', category: a.category, feeInr: a.feeInr, sortOrder: a.sortOrder, isActive: a.isActive })
    else setForm({ name: '', description: '', category: 'gap_analysis', feeInr: 0, sortOrder: 0, isActive: true })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (a: AddonService) => { resetForm(a); setEditing(a); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<AddonService>('/admin/addon-services', body),
    onSuccess: () => { toast.success('Add-on service added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<AddonService>(`/admin/addon-services/${editing!.id}`, body),
    onSuccess: () => { toast.success('Add-on service updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/addon-services/${id}`),
    onSuccess: () => { toast.success('Add-on service deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  const categoryLabel = (c: string) => c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())

  return (
    <SectionCard
      title="Add-on Services"
      description={`${addons.length} optional bolt-on services`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Service</Button>}
    >
      {addons.length === 0 ? (
        <EmptyState title="No add-on services" description="Add your first add-on service" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {addons.map((addon) => (
            <div key={addon.id} className="group relative rounded-lg border border-slate-200 p-4 flex items-start justify-between gap-3 hover:border-brand-300 transition-colors">
              <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditButton onClick={() => openEdit(addon)} />
                <DeleteConfirm label={addon.name} onConfirm={() => deleteMutation.mutate(addon.id)} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{addon.name}</p>
                <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{addon.description}</p>
                <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
                  {categoryLabel(addon.category)}
                </span>
                {!addon.isActive && <span className="inline-block mt-1 ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">Inactive</span>}
              </div>
              <p className="text-sm font-bold text-slate-900 shrink-0">{formatINR(addon.feeInr)}</p>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Add-on Service' : 'Add Add-on Service'}</DialogTitle>
            <DialogDescription>{editing ? 'Update service details' : 'Create a new add-on service'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gap Analysis Workshop" />
            </FormField>
            <FormField label="Category">
              <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v as AddonCategory })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ADDON_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{categoryLabel(c)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
            </FormField>
            <FormField label="Fee (INR)">
              <Input type="number" value={form.feeInr} onChange={(e) => setForm({ ...form, feeInr: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Sort Order">
              <Input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 6. GRC Tools ─────────────────────────────────────────────

function GrcSection({ tools }: { tools: GrcTool[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<GrcTool | null>(null)
  const [form, setForm] = useState({ planName: '', description: '', feeInrAnnual: 0, maxUsers: 100, isActive: true })

  const resetForm = useCallback((t?: GrcTool) => {
    if (t) setForm({ planName: t.planName, description: t.description ?? '', feeInrAnnual: t.feeInrAnnual, maxUsers: t.maxUsers, isActive: t.isActive })
    else setForm({ planName: '', description: '', feeInrAnnual: 0, maxUsers: 100, isActive: true })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (t: GrcTool) => { resetForm(t); setEditing(t); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<GrcTool>('/admin/grc-tools', body),
    onSuccess: () => { toast.success('GRC tool added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<GrcTool>(`/admin/grc-tools/${editing!.id}`, body),
    onSuccess: () => { toast.success('GRC tool updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/grc-tools/${id}`),
    onSuccess: () => { toast.success('GRC tool deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.planName.trim()) { toast.error('Plan name is required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  return (
    <SectionCard
      title="GRC Tools"
      description={`${tools.length} annual subscription plans`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add GRC Tool</Button>}
    >
      {tools.length === 0 ? (
        <EmptyState title="No GRC tools" description="Add your first GRC tool plan" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <div key={tool.id} className="group relative rounded-lg border border-slate-200 p-4 hover:border-brand-300 transition-colors">
              <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <EditButton onClick={() => openEdit(tool)} />
                <DeleteConfirm label={tool.planName} onConfirm={() => deleteMutation.mutate(tool.id)} />
              </div>
              <p className="text-sm font-bold text-slate-900">{tool.planName}</p>
              <p className="text-2xl font-bold text-brand-700 mt-1">{formatINR(tool.feeInrAnnual)}</p>
              <p className="text-xs text-slate-500">/year</p>
              <p className="text-xs text-slate-600 mt-2 line-clamp-2">{tool.description}</p>
              <p className="text-xs text-slate-500 mt-2">
                Up to {tool.maxUsers >= 999999 ? 'unlimited' : tool.maxUsers} users
              </p>
              {!tool.isActive && <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">Inactive</span>}
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit GRC Tool' : 'Add GRC Tool'}</DialogTitle>
            <DialogDescription>{editing ? 'Update GRC tool plan' : 'Create a new GRC tool subscription plan'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Plan Name">
              <Input value={form.planName} onChange={(e) => setForm({ ...form, planName: e.target.value })} placeholder="e.g. VComply Starter" />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
            </FormField>
            <FormField label="Annual Fee (INR)">
              <Input type="number" value={form.feeInrAnnual} onChange={(e) => setForm({ ...form, feeInrAnnual: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <FormField label="Max Users (999999 for unlimited)">
              <Input type="number" value={form.maxUsers} onChange={(e) => setForm({ ...form, maxUsers: parseInt(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 7. DPO / vCISO ────────────────────────────────────────────

const DPO_TYPES: { value: DpoVcisoType; label: string }[] = [
  { value: 'DPO', label: 'DPO' },
  { value: 'vCISO', label: 'vCISO' },
  { value: 'DPO_vCISO', label: 'DPO + vCISO Combined' },
]

function DpoSection({ packages }: { packages: DpoVcisoPackage[] }) {
  const qc = useQueryClient()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<DpoVcisoPackage | null>(null)
  const [form, setForm] = useState({ serviceType: 'DPO' as DpoVcisoType, name: '', description: '', hoursPerMonth: 0, feeInrMonthly: 0, feeInrAnnual: 0, isActive: true })

  const resetForm = useCallback((p?: DpoVcisoPackage) => {
    if (p) setForm({ serviceType: p.serviceType, name: p.name, description: p.description ?? '', hoursPerMonth: p.hoursPerMonth, feeInrMonthly: p.feeInrMonthly, feeInrAnnual: p.feeInrAnnual, isActive: p.isActive })
    else setForm({ serviceType: 'DPO', name: '', description: '', hoursPerMonth: 0, feeInrMonthly: 0, feeInrAnnual: 0, isActive: true })
  }, [])

  const openAdd = () => { resetForm(); setEditing(null); setOpen(true) }
  const openEdit = (p: DpoVcisoPackage) => { resetForm(p); setEditing(p); setOpen(true) }

  const addMutation = useMutation({
    mutationFn: (body: typeof form) => api.post<DpoVcisoPackage>('/admin/dpo-vciso', body),
    onSuccess: () => { toast.success('Package added'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const editMutation = useMutation({
    mutationFn: (body: Partial<typeof form>) => api.put<DpoVcisoPackage>(`/admin/dpo-vciso/${editing!.id}`, body),
    onSuccess: () => { toast.success('Package updated'); setOpen(false); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/admin/dpo-vciso/${id}`),
    onSuccess: () => { toast.success('Package deleted'); qc.invalidateQueries({ queryKey: ['pricing'] }) },
    onError: (e: Error) => toast.error(e.message),
  })

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    if (editing) editMutation.mutate(form)
    else addMutation.mutate(form)
  }

  const grouped = packages.reduce((acc, pkg) => {
    (acc[pkg.serviceType] ||= []).push(pkg)
    return acc
  }, {} as Record<string, DpoVcisoPackage[]>)

  const typeLabel = (t: string) => DPO_TYPES.find((d) => d.value === t)?.label ?? t

  return (
    <SectionCard
      title="DPO / vCISO Packages"
      description={`${packages.length} managed compliance service plans`}
      action={<Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={openAdd}><Plus className="h-4 w-4 mr-1" /> Add Package</Button>}
    >
      {packages.length === 0 ? (
        <EmptyState title="No DPO/vCISO packages" description="Add your first managed service package" />
      ) : (
        <div className="space-y-5">
          {Object.entries(grouped).map(([type, typePkgs]) => (
            <div key={type}>
              <h4 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-2">{typeLabel(type)}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {typePkgs.map((pkg) => (
                  <div key={pkg.id} className="group relative rounded-lg border border-slate-200 p-4 hover:border-brand-300 transition-colors">
                    <div className="absolute top-3 right-3 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <EditButton onClick={() => openEdit(pkg)} />
                      <DeleteConfirm label={pkg.name} onConfirm={() => deleteMutation.mutate(pkg.id)} />
                    </div>
                    <p className="text-sm font-bold text-slate-900">{pkg.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{pkg.hoursPerMonth} hours/month</p>
                    <div className="mt-3 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Monthly</span>
                        <span className="font-medium text-slate-900">{formatINR(pkg.feeInrMonthly)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Annual</span>
                        <span className="font-bold text-brand-700">{formatINR(pkg.feeInrAnnual)}</span>
                      </div>
                    </div>
                    {!pkg.isActive && <span className="inline-block mt-2 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-200 text-slate-500">Inactive</span>}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null) }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit DPO/vCISO Package' : 'Add DPO/vCISO Package'}</DialogTitle>
            <DialogDescription>{editing ? 'Update package details' : 'Create a new managed compliance service package'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <FormField label="Service Type">
              <Select value={form.serviceType} onValueChange={(v) => setForm({ ...form, serviceType: v as DpoVcisoType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DPO_TYPES.map((d) => (
                    <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormField>
            <FormField label="Name">
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. DPO Essential" />
            </FormField>
            <FormField label="Description">
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Brief description..." rows={2} />
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Hours / Month">
                <Input type="number" value={form.hoursPerMonth} onChange={(e) => setForm({ ...form, hoursPerMonth: parseFloat(e.target.value) || 0 })} />
              </FormField>
              <FormField label="Monthly Fee (INR)">
                <Input type="number" value={form.feeInrMonthly} onChange={(e) => setForm({ ...form, feeInrMonthly: parseFloat(e.target.value) || 0 })} />
              </FormField>
            </div>
            <FormField label="Annual Fee (INR)">
              <Input type="number" value={form.feeInrAnnual} onChange={(e) => setForm({ ...form, feeInrAnnual: parseFloat(e.target.value) || 0 })} />
            </FormField>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label className="text-xs text-slate-600">Active</Label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>Cancel</Button>
              <Button size="sm" className="bg-brand-700 hover:bg-brand-800 text-white" onClick={handleSubmit} disabled={addMutation.isPending || editMutation.isPending}>
                {(addMutation.isPending || editMutation.isPending) && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                {editing ? 'Update' : 'Create'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </SectionCard>
  )
}

// ─── 8. FX Rate ────────────────────────────────────────────────

function FxSection({ rate: currentRate }: { rate: number }) {
  const qc = useQueryClient()
  const [rate, setRate] = useState(currentRate)
  const [editing, setEditing] = useState(false)

  const updateMutation = useMutation({
    mutationFn: (newRate: number) => api.put('/admin/fx-rate', { rate: newRate }),
    onSuccess: () => {
      toast.success('FX rate updated')
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['pricing'] })
      qc.invalidateQueries({ queryKey: ['fx-rate-sidebar'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  return (
    <SectionCard title="FX Rate" description="USD to INR conversion rate — used for USD equivalent on quotes">
      <div className="max-w-md">
        <div className="rounded-lg border border-slate-200 p-5">
          <p className="text-xs text-slate-500 mb-1">Current USD/INR Rate</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-slate-900">₹{rate}</span>
            <span className="text-sm text-slate-500">per USD</span>
          </div>

          {editing ? (
            <div className="mt-4 space-y-3">
              <FormField label="New Rate">
                <Input
                  type="number"
                  value={rate}
                  onChange={(e) => setRate(parseFloat(e.target.value) || 0)}
                  step="0.01"
                />
              </FormField>
              <div className="flex gap-2">
                <Button
                  onClick={() => updateMutation.mutate(rate)}
                  disabled={updateMutation.isPending}
                  className="flex-1 bg-brand-700 hover:bg-brand-800 text-white"
                  size="sm"
                >
                  {updateMutation.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                  <Check className="h-4 w-4 mr-1" /> Save
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setRate(currentRate); setEditing(false) }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
              className="mt-4"
            >
              <Pencil className="h-3.5 w-3.5 mr-1" /> Update Rate
            </Button>
          )}
        </div>

        <div className="mt-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
          <p className="text-xs text-amber-800">
            <TrendingUp className="inline h-3.5 w-3.5 mr-1" />
            This rate is snapshotted at quote creation time. Existing quotes retain their original rate.
          </p>
        </div>
      </div>
    </SectionCard>
  )
}