'use client'

import { Providers } from '@/components/providers'
import { useAuthStore, useNavStore } from '@/store'
import { LoginView } from '@/components/isecurify/LoginView'
import { Sidebar, MobileNav } from '@/components/isecurify/Shell'
import { DashboardView } from '@/components/isecurify/DashboardView'
import { QuotesListView, QuoteDetailView } from '@/components/isecurify/QuotesViews'
import { QuoteBuilderView } from '@/components/isecurify/QuoteBuilderView'
import { ClientsView } from '@/components/isecurify/ClientsView'
import { AdminView } from '@/components/isecurify/AdminView'
import { UserManagementView } from '@/components/isecurify/UserManagementView'

function AppContent() {
  const { user } = useAuthStore()
  const { view, params } = useNavStore()

  if (!user) return <LoginView />

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          {view === 'dashboard' && <DashboardView />}
          {view === 'quote-builder' && <QuoteBuilderView />}
          {view === 'quotes' &&
            (params.id ? (
              <QuoteDetailView quoteId={params.id} />
            ) : (
              <QuotesListView />
            ))}
          {view === 'clients' && <ClientsView />}
          {view === 'admin' && <AdminView />}
          {view === 'users' && <UserManagementView />}
        </main>
      </div>
      <MobileNav />
    </div>
  )
}

export default function Home() {
  return (
    <Providers>
      <AppContent />
    </Providers>
  )
}