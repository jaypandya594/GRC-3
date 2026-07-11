/**
 * iSecurify — Shared TypeScript types
 * Mirrors the Prisma schema and backend API contracts.
 */

// ── Enums (as string union types) ─────────────────────────────
export type FrameworkCategory =
  | 'IT_Security'
  | 'Privacy'
  | 'Quality'
  | 'Food_Safety'
  | 'Industry'

export type UserRole =
  | 'super_admin'
  | 'tenant_admin'
  | 'sales_manager'
  | 'sales_executive'
  | 'finance'
  | 'viewer'

export type CompanySize = 'Startup' | 'Mid-size' | 'Enterprise'

export type DealStage =
  | 'prospect'
  | 'qualified'
  | 'proposal_sent'
  | 'negotiation'
  | 'won'
  | 'lost'

export type QuoteStatus =
  | 'DRAFT'
  | 'PENDING_REVIEW'
  | 'PENDING_FINANCE'
  | 'APPROVED'
  | 'SENT'
  | 'VIEWED'
  | 'EXPIRED'
  | 'REJECTED'

export type LineType =
  | 'consulting_fee'
  | 'auditor_fee'
  | 'addon_service'
  | 'grc_tool'
  | 'dpo_vciso'
  | 'retainer'
  | 'discount'
  | 'internal_time'

export type AddonCategory =
  | 'gap_analysis'
  | 'documentation'
  | 'training'
  | 'audit'
  | 'advisory'

export type DpoVcisoType = 'DPO' | 'vCISO' | 'DPO_vCISO'

export type ApprovalAction =
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'overridden'
  | 'recalled'
  | 'sent'

// ── Entity types ──────────────────────────────────────────────
export interface Tenant {
  id: string
  slug: string
  name: string
  logoUrl?: string | null
  primaryColor?: string | null
  secondaryColor?: string | null
  domain?: string | null
  plan: string
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface User {
  id: string
  tenantId: string
  email: string
  name: string
  role: UserRole
  is2faEnabled: boolean
  isActive: boolean
  lastLogin?: string | null
  createdAt: string
}

export interface Framework {
  id: string
  tenantId?: string | null
  name: string
  category: FrameworkCategory
  description?: string | null
  isActive: boolean
  sortOrder: number
}

export interface Tier {
  id: string
  tenantId?: string | null
  name: string
  description?: string | null
  retainerPct: number
  sortOrder: number
  isActive: boolean
}

export interface FrameworkPrice {
  id: string
  tenantId?: string | null
  frameworkId: string
  tierId: string
  projectFeeInr: number
  retainerFeeInr: number
  framework?: Framework
  tier?: Tier
}

export interface AuditorFee {
  id: string
  tenantId?: string | null
  standardName: string
  accreditationBody: string
  feeInr: number
  notes?: string | null
  isActive: boolean
}

export interface AddonService {
  id: string
  tenantId?: string | null
  name: string
  description?: string | null
  category: AddonCategory
  feeInr: number
  isActive: boolean
  sortOrder: number
}

export interface AddonServicePrice {
  id: string
  addonServiceId: string
  tierId: string
  priceInr: number
  addonService?: { id: string; name: string }
  tier?: { id: string; name: string }
}

export interface GrcTool {
  id: string
  tenantId?: string | null
  planName: string
  description?: string | null
  feeInrAnnual: number
  maxUsers: number
  isActive: boolean
}

export interface DpoVcisoPackage {
  id: string
  tenantId?: string | null
  serviceType: DpoVcisoType
  name: string
  description?: string | null
  hoursPerMonth: number
  feeInrMonthly: number
  feeInrAnnual: number
  scopeJson?: string | null
  isActive: boolean
}

export interface ClientContact {
  name: string
  email: string
  phone?: string
  role?: string
}

export interface Client {
  id: string
  tenantId: string
  companyName: string
  sector?: string | null
  companySize: CompanySize
  country: string
  contactsJson?: string | null
  contacts?: ClientContact[]
  dealStage: DealStage
  notes?: string | null
  createdById: string
  createdAt: string
  updatedAt: string
}

export interface QuoteLineItem {
  id?: string
  quoteId?: string
  lineType: LineType
  description: string
  referenceId?: string | null
  amountInr: number
  isComplimentary?: boolean
  customScope?: string | null
  sortOrder: number
}

export interface QuoteApproval {
  id: string
  quoteId: string
  actorId: string
  actorRole: UserRole
  action: ApprovalAction
  comment?: string | null
  amountBefore?: number | null
  amountAfter?: number | null
  createdAt: string
  actor?: { name: string; email: string }
}

export interface Quote {
  id: string
  tenantId: string
  clientId: string
  version: number
  status: QuoteStatus
  frameworkId: string
  tierId: string
  billingCurrency: string
  subtotalInr: number
  discountInr: number
  discountPct: number
  discountMode: string
  discountFixedInr: number
  discountReason?: string | null
  gstAmountInr: number
  totalInr: number
  totalUsd: number
  usdInrRateSnapshot: number
  gstRateSnapshot: number
  includeRetainer: boolean
  retainerMode: string
  retainerCustomInr: number
  retainerAmountInr: number
  internalHours: number
  internalHourlyRate: number
  validUntil?: string | null
  notes?: string | null
  createdById: string
  approvedById?: string | null
  sentAt?: string | null
  viewedAt?: string | null
  createdAt: string
  updatedAt: string
  client?: Client
  framework?: Framework
  tier?: Tier
  lineItems?: QuoteLineItem[]
  approvals?: QuoteApproval[]
  createdBy?: { name: string; email: string }
}

// ── Quote builder state (Zustand) ─────────────────────────────
export interface QuoteBuilderSelection {
  clientId: string | null
  billingCurrency: 'INR' | 'USD'
  selectedFrameworkIds: string[]
  tierId: string | null
  includeRetainer: boolean
  retainerMode: 'percent' | 'fixed'
  retainerCustomInr: number | null
  selectedAuditorFeeIds: string[]
  selectedAddonIds: string[]
  grcToolEnabled: boolean
  grcToolId: string | null
  grcToolCustomFee: number | null
  dpoVcisoPackageId: string | null
  internalHours: number
  internalHourlyRate: number
  discountPct: number
  discountMode: 'percent' | 'fixed'
  discountFixedInr: number
  discountReason: string
  validUntilDays: number
  notes: string
  complimentaryKeys: string[]
  customScopes: Record<string, string>
  internalHoursManuallySet: boolean
}

// ── Dashboard stats ───────────────────────────────────────────
export interface DashboardStats {
  totalQuotes: number
  quotesByStatus: Record<string, number>
  pipelineValueInr: number
  wonValueInr: number
  activeClients: number
  totalClients: number
  avgQuoteValueInr: number
  topFrameworks: Array<{ name: string; count: number; valueInr: number }>
  recentQuotes: Quote[]
  monthlyRevenue: Array<{ month: string; valueInr: number }>
}

// ── API response wrappers ─────────────────────────────────────
export interface ApiResponse<T> {
  data?: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
}
