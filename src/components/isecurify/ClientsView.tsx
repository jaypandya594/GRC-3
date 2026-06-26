/**
 * iSecurify — Clients view
 */
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { useNavStore } from '@/store'
import { TopBar } from '@/components/isecurify/Shell'
import { DealStageBadge, SectionCard, EmptyState } from '@/components/isecurify/Atoms'
import { formatRelativeTime } from '@/lib/currency'
import { toast } from 'sonner'
import {
  Plus,
  Search,
  Users,
  Loader2,
  Building2,
  Mail,
  Phone,
} from 'lucide-react'
import { useState } from 'react'
import type { Client, DealStage } from '@/types'

const STAGES: DealStage[] = ['prospect', 'qualified', 'proposal_sent', 'negotiation', 'won', 'lost']

export function ClientsView() {
  const { navigate } = useNavStore()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: clients, isLoading } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.get<(Client & { quoteCount?: number })[]>('/clients'),
  })

  const createMutation = useMutation({
    mutationFn: (body: Partial<Client>) => api.post<Client>('/clients', body),
    onSuccess: () => {
      toast.success('Client created')
      setShowAdd(false)
      qc.invalidateQueries({ queryKey: ['clients'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
    onError: (e: Error) => toast.error(e.message),
  })

  const filtered = (clients || []).filter((c) =>
    !search ||
    c.companyName.toLowerCase().includes(search.toLowerCase()) ||
    c.sector?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <>
      <TopBar
        title="Clients"
        subtitle={`${clients?.length || 0} prospects and customers`}
        action={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
          >
            <Plus className="h-4 w-4" /> Add Client
          </button>
        }
      />

      <div className="p-4 md:p-8 space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients by name or sector..."
            className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-600"
          />
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <SectionCard>
            <EmptyState
              icon={<Users className="h-10 w-10" />}
              title="No clients found"
              description="Add your first client to start creating quotes."
            />
          </SectionCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c) => (
              <div
                key={c.id}
                className="rounded-xl border border-slate-200 bg-white p-5 hover:border-brand-400 hover:shadow-sm transition-all cursor-pointer"
                onClick={() => navigate('quote-builder')}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <DealStageBadge stage={c.dealStage} />
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">{c.companyName}</h3>
                <p className="text-xs text-slate-500 mb-3">{c.sector || '—'} • {c.companySize} • {c.country}</p>

                {c.contacts && c.contacts.length > 0 && (
                  <div className="space-y-1 border-t border-slate-100 pt-3">
                    {c.contacts.slice(0, 2).map((contact, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                        <Mail className="h-3 w-3 text-slate-400" />
                        <span className="truncate">{contact.email}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>{c.quoteCount || 0} quotes</span>
                  <span>{formatRelativeTime(c.createdAt)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add client modal */}
      {showAdd && (
        <AddClientModal
          onClose={() => setShowAdd(false)}
          onSubmit={(body) => createMutation.mutate(body)}
          loading={createMutation.isPending}
        />
      )}
    </>
  )
}

function AddClientModal({ onClose, onSubmit, loading }: {
  onClose: () => void
  onSubmit: (body: Partial<Client>) => void
  loading: boolean
}) {
  const [form, setForm] = useState({
    companyName: '',
    sector: '',
    companySize: 'Mid-size',
    dealStage: 'prospect',
    contactName: '',
    contactEmail: '',
    contactPhone: '',
    notes: '',
  })

  const submit = () => {
    if (!form.companyName) {
      toast.error('Company name is required')
      return
    }
    onSubmit({
      companyName: form.companyName,
      sector: form.sector || undefined,
      companySize: form.companySize as 'Startup' | 'Mid-size' | 'Enterprise',
      dealStage: form.dealStage as DealStage,
      notes: form.notes || undefined,
      contacts: form.contactEmail ? [{
        name: form.contactName || 'Primary contact',
        email: form.contactEmail,
        phone: form.contactPhone || undefined,
        role: 'Primary',
      }] : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">Add New Client</h3>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Company Name *">
            <input value={form.companyName} onChange={(e) => setForm({ ...form, companyName: e.target.value })}
              className="input" placeholder="Acme Technologies Pvt Ltd" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Sector">
              <input value={form.sector} onChange={(e) => setForm({ ...form, sector: e.target.value })}
                className="input" placeholder="IT Services" />
            </Field>
            <Field label="Company Size">
              <select value={form.companySize} onChange={(e) => setForm({ ...form, companySize: e.target.value })}
                className="input">
                <option>Startup</option>
                <option>Mid-size</option>
                <option>Enterprise</option>
              </select>
            </Field>
          </div>
          <Field label="Deal Stage">
            <select value={form.dealStage} onChange={(e) => setForm({ ...form, dealStage: e.target.value })}
              className="input">
              {STAGES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
            </select>
          </Field>
          <div className="border-t border-slate-200 pt-4">
            <p className="text-xs font-semibold text-slate-700 mb-2">Primary Contact</p>
            <div className="space-y-3">
              <input value={form.contactName} onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                className="input" placeholder="Contact name" />
              <div className="grid grid-cols-2 gap-3">
                <input value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                  className="input" placeholder="email@company.com" />
                <input value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
                  className="input" placeholder="+91 ..." />
              </div>
            </div>
          </div>
        </div>
        <div className="px-5 py-4 border-t border-slate-200 flex justify-end gap-2">
          <button onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">
            Cancel
          </button>
          <button onClick={submit} disabled={loading}
            className="rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800 disabled:opacity-50">
            {loading ? 'Saving...' : 'Save Client'}
          </button>
        </div>
      </div>
      <style jsx>{`
        .input { width: 100%; border-radius: 0.5rem; border: 1px solid #e2e8f0; padding: 0.5rem 0.75rem; font-size: 0.875rem; }
        .input:focus { outline: none; box-shadow: 0 0 0 2px #0f766e; }
      `}</style>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-600 mb-1 block">{label}</label>
      {children}
    </div>
  )
}
