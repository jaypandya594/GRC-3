/**
 * iSecurify — Quote Builder store (Zustand)
 * Holds the current in-progress quote builder selection state.
 */
'use client'

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { QuoteBuilderSelection } from '@/types'
import { DEFAULT_QUOTE_BUILDER_SELECTION } from '@/lib/quoteCalculator'

interface QuoteBuilderState {
  selection: QuoteBuilderSelection
  currentStep: number
  setStep: (step: number) => void
  nextStep: () => void
  prevStep: () => void
  update: (patch: Partial<QuoteBuilderSelection>) => void
  toggleFramework: (id: string) => void
  toggleAuditorFee: (id: string) => void
  toggleAddon: (id: string) => void
  reset: () => void
  load: (selection: QuoteBuilderSelection) => void
}

export const useQuoteBuilderStore = create<QuoteBuilderState>()(
  persist(
    (set) => ({
      selection: DEFAULT_QUOTE_BUILDER_SELECTION,
      currentStep: 0,
      setStep: (step) => set({ currentStep: step }),
      nextStep: () => set((s) => ({ currentStep: Math.min(5, s.currentStep + 1) })),
      prevStep: () => set((s) => ({ currentStep: Math.max(0, s.currentStep - 1) })),
      update: (patch) =>
        set((s) => ({ selection: { ...s.selection, ...patch } })),
      toggleFramework: (id) =>
        set((s) => {
          const ids = s.selection.selectedFrameworkIds
          const exists = ids.includes(id)
          return {
            selection: {
              ...s.selection,
              selectedFrameworkIds: exists
                ? ids.filter((x) => x !== id)
                : [...ids, id],
            },
          }
        }),
      toggleAuditorFee: (id) =>
        set((s) => {
          const ids = s.selection.selectedAuditorFeeIds
          const exists = ids.includes(id)
          return {
            selection: {
              ...s.selection,
              selectedAuditorFeeIds: exists
                ? ids.filter((x) => x !== id)
                : [...ids, id],
            },
          }
        }),
      toggleAddon: (id) =>
        set((s) => {
          const ids = s.selection.selectedAddonIds
          const exists = ids.includes(id)
          return {
            selection: {
              ...s.selection,
              selectedAddonIds: exists
                ? ids.filter((x) => x !== id)
                : [...ids, id],
            },
          }
        }),
      reset: () =>
        set({ selection: DEFAULT_QUOTE_BUILDER_SELECTION, currentStep: 0 }),
      load: (selection) => set({ selection, currentStep: 0 }),
    }),
    { name: 'isecurify-quote-builder' },
  ),
)

/**
 * App navigation store (which view is active on the single-page app).
 */
interface NavState {
  view: string
  params: Record<string, string>
  navigate: (view: string, params?: Record<string, string>) => void
}

export const useNavStore = create<NavState>((set) => ({
  view: 'dashboard',
  params: {},
  navigate: (view, params = {}) => set({ view, params }),
}))

/**
 * Authentication store — persists user session to localStorage.
 */
interface AuthUser {
  id: string
  email: string
  name: string
  role: string
  tenantId: string
}

interface AuthState {
  user: AuthUser | null
  token: string | null
  login: (user: AuthUser, token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: (user, token) => set({ user, token }),
      logout: () => set({ user: null, token: null }),
    }),
    { name: 'isecurify-auth' },
  ),
)
