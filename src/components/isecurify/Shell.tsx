/**
 * iSecurify — App Shell
 * Sidebar navigation + top bar. This is the persistent layout for the single-page app.
 */
'use client'

import { useNavStore, useAuthStore } from '@/store'
import { cn } from '@/lib/utils'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { UserRole } from '@/types'
import Image from 'next/image'
import {
  LayoutDashboard,
  FilePlus2,
  FileText,
  Users,
  Settings,
  TrendingUp,
  UserCog,
  LogOut,
} from 'lucide-react'

// ── Navigation items with role-based visibility ────────────────
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: null },
  { id: 'quote-builder', label: 'Quote Builder', icon: FilePlus2, allowedRoles: ['sales_executive', 'sales_manager', 'super_admin'] as UserRole[] },
  { id: 'quotes', label: 'Quotes', icon: FileText, allowedRoles: null },
  { id: 'clients', label: 'Clients', icon: Users, allowedRoles: ['sales_executive', 'sales_manager', 'super_admin'] as UserRole[] },
  { id: 'admin', label: 'Admin Panel', icon: Settings, allowedRoles: ['super_admin'] as UserRole[] },
  { id: 'users', label: 'User Mgmt', icon: UserCog, allowedRoles: ['super_admin', 'sales_manager'] as UserRole[] },
]

// ── Role badge color map ───────────────────────────────────────
const ROLE_BADGE_CLASSES: Record<UserRole, string> = {
  super_admin: 'bg-purple-100 text-purple-800 ring-1 ring-purple-300',
  sales_manager: 'bg-amber-100 text-amber-800 ring-1 ring-amber-300',
  sales_executive: 'bg-teal-100 text-teal-800 ring-1 ring-teal-300',
  finance: 'bg-blue-100 text-blue-800 ring-1 ring-blue-300',
  tenant_admin: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300',
  viewer: 'bg-slate-100 text-slate-800 ring-1 ring-slate-300',
}

function getRoleBadgeClass(role: UserRole): string {
  return ROLE_BADGE_CLASSES[role] ?? 'bg-slate-100 text-slate-800 ring-1 ring-slate-300'
}

function formatRole(role: UserRole): string {
  return role
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function filterNavItems(role: UserRole | undefined) {
  return NAV_ITEMS.filter((item) => item.allowedRoles === null || (role && item.allowedRoles.includes(role)))
}

export function Sidebar() {
  const { view, navigate } = useNavStore()
  const user = useAuthStore((s) => s.user)

  const { data: fxData } = useQuery({
    queryKey: ['fx-rate-sidebar'],
    queryFn: () => api.get<{ rate: number }>('/admin/fx-rate'),
    staleTime: 60_000,
  })
  const fxRate = fxData?.rate ?? 83.0

  const visibleItems = filterNavItems(user?.role)

  return (
    <aside className="hidden md:flex w-64 flex-col border-r border-slate-200 bg-white shrink-0">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-5 h-16 border-b border-slate-200">
        <Image
          src="/logo-full.png"
          alt="iSecurify"
          width={32}
          height={32}
          className="h-8 w-8 rounded-md"
        />
        <div className="flex flex-col leading-tight">
          <span className="text-sm font-bold text-slate-900">iSecurify</span>
          <span className="text-[11px] text-slate-500">GRC Pricing Platform</span>
        </div>
      </div>

      {/* ── Navigation ─────────────────────────────────────── */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const active = view === item.id
          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                active
                  ? 'bg-brand-50 text-brand-800'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </button>
          )
        })}
      </nav>

      {/* ── User info ──────────────────────────────────────── */}
      {user && (
        <div className="px-3 pb-3">
          <div className="flex items-center gap-2.5 rounded-lg bg-slate-50 px-3 py-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 text-xs font-bold">
              {user.name
                .split(' ')
                .map((w) => w[0])
                .join('')
                .toUpperCase()
                .slice(0, 2)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{user.name}</p>
              <span
                className={cn(
                  'mt-0.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none',
                  getRoleBadgeClass(user.role),
                )}
              >
                {formatRole(user.role)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ── FX Rate widget ─────────────────────────────────── */}
      <div className="px-3 pt-2 pb-3">
        <div className="rounded-lg bg-gradient-to-br from-brand-700 via-brand-800 to-brand-700 p-4 text-white">
          <div className="flex items-center gap-2 mb-1.5">
            <TrendingUp className="h-4 w-4" />
            <span className="text-xs font-semibold uppercase tracking-wide">Live Rate</span>
          </div>
          <p className="text-lg font-bold">USD/INR {fxRate.toFixed(2)}</p>
          <p className="text-[11px] text-brand-100 mt-0.5">GST 18% • Indian Lakh format</p>
        </div>
      </div>

      {/* ── Sign Out ───────────────────────────────────────── */}
      <div className="px-3 pb-4">
        <button
          onClick={() => useAuthStore.getState().logout()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-500 hover:text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  )
}

export function MobileNav() {
  const { view, navigate } = useNavStore()
  const user = useAuthStore((s) => s.user)
  const visibleItems = filterNavItems(user?.role)

  return (
    <nav
      className="md:hidden fixed bottom-0 inset-x-0 z-50 bg-white border-t border-slate-200 grid"
      style={{ gridTemplateColumns: `repeat(${visibleItems.length}, 1fr)` }}
    >
      {visibleItems.map((item) => {
        const Icon = item.icon
        const active = view === item.id
        return (
          <button
            key={item.id}
            onClick={() => navigate(item.id)}
            className={cn(
              'flex flex-col items-center justify-center gap-0.5 py-2.5 text-[10px] font-medium',
              active ? 'text-brand-700' : 'text-slate-500',
            )}
          >
            <Icon className="h-5 w-5" />
            {item.label.split(' ')[0]}
          </button>
        )
      })}
    </nav>
  )
}

export function TopBar({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-4 px-4 md:px-8 h-16 border-b border-slate-200 bg-white/80 backdrop-blur">
      <div className="min-w-0">
        <h1 className="text-lg md:text-xl font-bold text-slate-900 truncate">{title}</h1>
        {subtitle && <p className="text-xs md:text-sm text-slate-500 truncate">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}