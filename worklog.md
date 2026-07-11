# 11-builder-ui — Quote Builder Currency Toggle, Retainer Mode, Discount Mode

## Changes Made

### 1. Currency Toggle (Step 0 — StepFramework)
- Added INR/USD billing currency toggle card after `FxRateCard` and before Client selection.
- Two-button inline toggle styled with brand-700 active state; updates `selection.billingCurrency`.
- Subtitle "USD quotes exclude GST" for clarity.

### 2. Tier Description Subtitle (Step 1 — StepTier)
- Changed `PricingCard` subtitle to use `tier.description` when available, falling back to `Retainer: X%`.

### 3. Retainer Mode Selector (Step 1 — StepTier)
- Added radio-based retainer mode selector (percent vs. fixed custom amount) after the "Include Annual Retainer" checkbox.
- Only visible when `selection.includeRetainer` is true.
- Fixed mode reveals a number input for custom INR retainer amount (per framework/year).
- Updates `selection.retainerMode` and `selection.retainerCustomInr`.

### 4. Summary Panel — Currency-Aware Totals
- Subtotal, discount, and grand total lines now check `calc.billingCurrency`.
- USD mode: displays `formatUSD(amount / usdInrRate)`, shows "No GST" note, hides GST line when zero.
- INR mode: shows INR amounts with USD equivalent and FX rate.
- GST row now conditionally rendered only when `gstAmountInr > 0`.

### 5. Discount Mode Toggle (Step 5 — StepReview)
- Replaced simple percentage discount input with a mode toggle (percent vs. fixed amount).
- "Discount by %" / "Discount by amount" buttons with brand-600 active styling.
- Fixed amount mode shows `discountFixedInr` input with currency-aware label.
- Reason field retained in both modes.

### 6. Review Summary — Currency Display
- Added `ReviewItem` row for "Currency" showing `selection.billingCurrency` after "Line items".
- Grand total box in review now conditionally renders based on `calc.billingCurrency`:
  - USD: "Grand Total (USD, no GST)" with `formatUSD(totalUsd)`.
  - INR: "Grand Total (incl. GST @ X%)" with INR amount + USD equivalent.
  - Removed hardcoded "USD @ ₹X" from validity line.

---

# 12-admin-ui — Admin Panel Tiers Description & Per-Cell Price Editing

## Changes Made

### 1. TiersSection — Tier Description Support
- **Form state**: Added `description: ''` field to the TiersSection form state.
- **resetForm**: Now populates `description` from `t.description ?? ''` when editing; resets to `''` when adding.
- **Tier card**: Conditionally renders `tier.description` below the tier name as a small slate-500 text line.
- **Dialog form**: Added a new `FormField` for "Description" between Name and Retainer %, with placeholder `e.g. "1–50 employees"`.

### 2. PricesSection — Per-Cell Editing (Grid Bug Fix)
- **`cellTarget` state**: New `useState<{ frameworkId: string; tierId: string } | null>(null)` to track which grid cell is being edited.
- **`resetForm`**: Updated signature to accept optional `fwId` and `tId` parameters, pre-filling the form for new cell additions.
- **`openAdd`/`openEdit`**: Updated to manage `cellTarget` — `openAdd` clears it, `openEdit` sets it from the price's IDs.
- **`openCell`**: New function that opens the dialog for a specific framework×tier cell, handling both existing prices and new additions.
- **Table body**: Replaced row-level Edit button with clickable `<td>` cells. Each cell shows the price or "+ Add" link, with hover styling (`hover:bg-brand-50`, `cursor-pointer`). The actions column is now empty (`<td className="px-2 py-2" />`).
- **Dialog Framework/Tier selects**: Added `disabled={!!cellTarget}` so these are read-only when editing a specific cell.
- **Dialog `onOpenChange`**: Now clears both `editing` and `cellTarget` on close.---
Task ID: 1-7-combined
Agent: main
Task: Implement 7 targeted changes to iSecurify GRC pricing platform

Work Log:
- Fixed null quote crash in QuotesViews.tsx (already resolved in prior session)
- Added billingCurrency, discountMode, discountFixedInr to Quote schema and QuoteBuilderSelection type
- Added description field to Tier schema and type
- Added retainerMode, retainerCustomInr to Quote schema and QuoteBuilderSelection type
- Updated seed.ts with tier descriptions (1-50 employees, 51-500, 500+)
- Pushed schema to DB, reseeded, updated tier descriptions via direct SQL
- Updated quoteCalculator.ts: currency-aware GST (0 for USD), discount mode (% or fixed), retainer mode (% or custom), billingCurrency in result
- Updated pricingEngine.ts: same server-side logic mirroring client calculator
- Added formatINRPdf() to currency.ts using "Rs." instead of "₹" for jsPDF compatibility
- Updated POST /api/quotes to handle new fields (billingCurrency, discountMode, discountFixedInr, retainerMode, retainerCustomInr)
- Updated PUT /api/quotes/[id] to handle new fields
- Added live FX rate re-computation for non-finalized quotes (DRAFT/PENDING_REVIEW/PENDING_FINANCE) in GET /api/quotes/[id] and GET /api/quote-pdf/[id]
- Rewrote quote-pdf/[id]/route.ts: currency-aware totals (INR vs USD), Rs. format, wider amount column (48mm), tier description display, conditional GST row, status+currency badges, live FX
- Updated QuoteBuilderView: INR/USD toggle in Step 0, tier description in Step 1, retainer mode selector in Step 1, discount mode toggle in Step 5, currency-aware summary panel and review
- Updated AdminView: tier description field in TiersSection (form + display), per-cell price grid editing in PricesSection (cellTarget state, openCell function, disabled framework/tier selects)

Stage Summary:
- 7 changes implemented across schema, types, calculator, pricing engine, currency utils, 3 API routes, 2 UI components
- All changes verified: lint clean, dev server running, agent-browser confirmed currency toggle, tier descriptions, per-cell grid, and price cells clickable
- PDF now uses "Rs." instead of "₹" for Helvetica compatibility, amount column widened from 36mm to 48mm
- Non-finalized quotes auto-refresh FX rate on GET/PDF generation
---
Task ID: 1
Agent: main
Task: Fix line items showing ₹ when billingCurrency is USD — create shared formatLineAmount helper

Work Log:
- Analyzed all locations where formatINR is called on quote line item amounts across 4 files
- Created formatLineAmount() and formatLineAmountPdf() helpers in src/lib/currency.ts
- Replaced direct formatINR calls in QuoteBuilderView.tsx (sidebar line items, subtotal, discount)
- Replaced direct formatINR calls in QuotesViews.tsx (quote list total, detail line items, subtotal, discount, GST, grand total, approval timeline, payment terms)
- Redefined PDF amtFmt to use formatLineAmountPdf — one-line fix covering all 10+ amtFmt call sites
- Fixed null guard on approval timeline amounts (a.amountBefore/a.amountAfter can be null)
- Verified no new TS errors introduced (all remaining errors pre-existing)
- ESLint passes clean

Stage Summary:
- New helpers: formatLineAmount (UI) and formatLineAmountPdf (PDF) in src/lib/currency.ts
- 4 files modified: currency.ts, QuoteBuilderView.tsx, QuotesViews.tsx, quote-pdf/[id]/route.ts
- Internal time advisory lines intentionally left as formatINR (not billed)
- INR rendering path untouched — formatLineAmount returns formatINR when billingCurrency !== USD
---
---
Task ID: 1
Agent: main
Task: Fix line items displaying ₹ in USD mode — replace remaining formatINR calls with shared formatLineAmount helper

Work Log:
- Read currency.ts — confirmed formatLineAmount and formatLineAmountPdf helpers already exist and work correctly
- Read QuoteBuilderView.tsx — found line items (line 307), subtotal (316), discount (321) already use formatLineAmount ✓
- Read QuotesViews.tsx — found line items (471), subtotal (481), discount (486), GST (491), grand total (496) already use formatLineAmount ✓
- Read quote-pdf/[id]/route.ts — confirmed amtFmt uses formatLineAmountPdf everywhere ✓
- Fixed 4 remaining formatINR calls in QuoteBuilderView.tsx:
  - Line 327: GST amount → formatLineAmount(calc.gstAmountInr, calc.billingCurrency, calc.usdInrRate)
  - Line 348: Advisory internal time → formatLineAmount(calc.internalTimeCostInr, calc.billingCurrency, calc.usdInrRate)
  - Line 611: Tier card retainer tooltip → formatLineAmount(totalRetainer, selection.billingCurrency, pricing.fxRate)
  - Line 918: Internal hours cost → formatLineAmount(hours*rate, selection.billingCurrency, pricing.fxRate)
- Fixed 1 remaining formatINR call in QuotesViews.tsx:
  - Line 509: Advisory internal time → formatLineAmount(line.amountInr, quote.billingCurrency, quote.usdInrRateSnapshot)
- Verified 2 remaining formatINR calls in QuoteBuilderView.tsx (lines 340, 1043) are in INR-only else branches — correct as-is
- Confirmed subtotal uses the same formatLineAmount helper (no change needed)
- Ran bun run lint — zero errors

Stage Summary:
- All line item amounts now use the single shared formatLineAmount helper across sidebar, Review step, saved-quote detail, and PDF
- INR rendering path is untouched — formatLineAmount calls formatINR internally for INR mode
- Lint passes clean

---
Task ID: 2
Agent: main
Task: Fix two FX rate bugs — (1) hardcoded default 83 in computeQuote calls, (2) stale sidebar widget

Work Log:
- Read /api/quotes/route.ts POST handler — computeQuote(selection) called without rate arg
- Read /api/quotes/[id]/route.ts PUT handler — same issue
- Read pricingEngine.ts — confirmed computeQuote(selection, usdInrRate=83, gstRate=GST_RATE) signature
- BUG 1 FIX: Added db.fxRate.findFirst() before computeQuote in both routes, pass liveRate explicitly with ??83 fallback
- Imported GST_RATE in both route files to also pass it explicitly
- Read AdminView.tsx FxSection — found onSuccess only invalidates [pricing] and [dashboard]
- Read QuoteBuilderView.tsx FxRateCard — found onSuccess only invalidates [pricing]
- BUG 2 FIX: Added qc.invalidateQueries({ queryKey: [\"fx-rate-sidebar\"] }) in both mutation onSuccess handlers
- Ran bun run lint — zero errors

Stage Summary:
- POST /api/quotes and PUT /api/quotes/[id] now use live FX rate from FxRate table
- Shell.tsx sidebar widget refreshes immediately after FX rate updates from Admin or Builder
- Lint passes clean

---
Task ID: 3
Agent: main
Task: Hide FX rate display when billingCurrency is INR — show only when USD

Work Log:
- Searched all files for FX rate display patterns
- PDF: Fixed inverted condition (if (!isUsd) → if (isUsd)) for FX Rate row on Tier line
- PDF: Removed else branch that showed "Grand Total (USD): $XXX @ rate" when INR; kept "Equivalent INR" only for USD
- Sidebar Grand Total: Removed "{formatUSD(calc.totalUsd)} @ Rs.{calc.usdInrRate}" from INR branch
- Review Grand Total: Removed "{formatUSD(calc.totalUsd)}" from INR branch
- Review "Valid for" line: Added conditional "• USD @ ₹{rate}" suffix only when USD
- QuotesViews list table: Changed unconditional formatUSD(q.totalUsd) to conditional INR reference only when USD
- QuotesViews detail Grand Total: Changed unconditional "@ ₹{rate}" to conditional, only shown when USD
- Ran bun run lint — zero errors
- Final grep for unguarded "@ Rs." / "@ ₹" — all remaining instances are properly guarded

Stage Summary:
- FX rate info is now completely absent when billingCurrency is INR across all views (sidebar, review, saved quotes, PDF)
- FX rate is shown when USD: PDF shows FX Rate row + Equivalent INR, sidebar shows "No GST", review shows "• USD @ ₹rate"
- No leftover labels, no empty lines, no vertical whitespace gaps
- Lint passes clean


---
Task ID: 1
Agent: Main
Task: Implement Part 1 (Complimentary-Value Summary Breakdown) + Part 2 (Tier-wise Addon Pricing)

Work Log:
- Discovered that Part 2 (AddonServicePrice model, admin grid, API routes, DB backfill) was already implemented in prior sessions
- Identified that Part 1 (complimentary summary) and several Part 2 frontend pieces were missing from disk
- Updated types/index.ts: Added isComplimentary/customScope to QuoteLineItem, added complimentaryKeys/customScopes/internalHoursManuallySet to QuoteBuilderSelection
- Rewrote quoteCalculator.ts: Added addonServicePrices to PricingContext, complimentary logic (isComp helper, compKeys), tier-specific addon pricing via getAddonFee pattern, three new fields (totalServiceValueInr, complimentaryValueInr, billableSubtotalInr)
- Rewrote pricingEngine.ts: Added complimentary logic, tier-specific addon pricing via db.addonServicePrice lookup, same three new fields in ComputeQuoteResult
- Rewrote QuoteBuilderView.tsx: Added CompToggle component, Tier badge on steps 2-5, updated PricingData with addonServicePrices, StepAddons uses tier-specific price lookup, added CompToggle on Framework/Auditor/Addon/GRC/DPO cards, updated SummaryPanel with Total Service Value → Less: Complimentary → Billable Subtotal → Discount → GST → Grand Total (Net Payable), updated StepReview with same breakdown
- Updated PDF generation (quote-pdf/[id]/route.ts): Added Total Service Value, Less: Complimentary Items (conditional), renamed Subtotal to Billable Subtotal, added "Net Payable" to Grand Total label, added "(Complimentary)" to line item descriptions
- Updated quotes API (quotes/route.ts): Added complimentaryKeys/customScopes to selection type, buildLineItems now sets isComplimentary on each line and uses tier-specific addon pricing via db.addonServicePrice

Stage Summary:
- All changes compile cleanly (bun run lint = 0 errors)
- Dev server runs without errors
- Browser verification confirmed: CompToggle on all card types, Tier badge on steps 2-5, summary panel shows correct breakdown with/without complimentary items, Review step shows same breakdown, addon prices use tier-specific lookup
- No schema changes needed (AddonServicePrice model already existed)
- No existing currency/GST/discount/retainer/approval/FX-rate logic was modified
