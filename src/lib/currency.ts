/**
 * iSecurify — Currency & number formatting utilities
 * Implements Indian lakh number system (₹1,50,000 not ₹150,000).
 */

/**
 * Format a number as INR using the Indian lakh system (PDF-safe, no ₹ glyph).
 * Uses "Rs." instead of "₹" for compatibility with jsPDF's default Helvetica.
 * Example: 150000 → "Rs.1,50,000"
 */
export function formatINRPdf(amount: number): string {
  const rounded = Math.round(amount)
  return 'Rs.' + rounded.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/**
 * Format a number as INR using the Indian lakh system.
 * Example: 150000 → "₹1,50,000"
 */
export function formatINR(amount: number): string {
  const rounded = Math.round(amount)
  return '₹' + rounded.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/**
 * Format a number as INR with paise (2 decimal places).
 * Example: 150000.5 → "₹1,50,000.50"
 */
export function formatINRWithPaise(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Format a number as USD.
 * Example: 1807.23 → "$1,807.23"
 */
export function formatUSD(amount: number): string {
  return '$' + amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

/**
 * Convert INR to USD using a given exchange rate.
 * Rounds to 2 decimal places.
 */
export function inrToUsd(inr: number, rate: number): number {
  if (!rate || rate <= 0) return 0
  return Math.round((inr / rate) * 100) / 100
}

/**
 * Format an INR amount according to the selected billing currency.
 * Returns formatINR(amountInr) when billingCurrency is 'INR',
 * or formatUSD(amountInr / usdInrRate) when billingCurrency is 'USD'.
 * Use this ONE helper everywhere a line-item amount is displayed so all
 * line types (consulting_fee, retainer, auditor_fee, addon, grc_tool,
 * dpo_vciso, discount, etc.) automatically render in the correct currency
 * with no per-type code needed.
 */
export function formatLineAmount(amountInr: number, billingCurrency: string, usdInrRate: number): string {
  if (billingCurrency === 'USD') {
    return formatUSD(inrToUsd(amountInr, usdInrRate))
  }
  return formatINR(amountInr)
}

/**
 * PDF-safe version of formatLineAmount.
 * Uses formatINRPdf (Rs.) instead of formatINR (₹) for jsPDF compatibility.
 */
export function formatLineAmountPdf(amountInr: number, billingCurrency: string, usdInrRate: number): string {
  if (billingCurrency === 'USD') {
    return formatUSD(inrToUsd(amountInr, usdInrRate))
  }
  return formatINRPdf(amountInr)
}

/**
 * Format a number with Indian digit grouping (no symbol).
 */
export function formatNumberIN(n: number): string {
  return n.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

/**
 * Parse an INR-formatted string back to a number.
 * Handles "₹1,50,000", "150000", "1,50,000"
 */
export function parseINR(value: string): number {
  const cleaned = value.replace(/[₹,\s]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? 0 : n
}

/**
 * Format a date for display.
 */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/**
 * Format a date with time.
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * Format a relative time (e.g., "2 days ago").
 */
export function formatRelativeTime(date: string | Date | null | undefined): string {
  if (!date) return '—'
  const d = typeof date === 'string' ? new Date(date) : date
  const now = new Date()
  const diffMs = now.getTime() - d.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 30) return `${diffDays}d ago`
  return formatDate(d)
}
