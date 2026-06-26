# iSecurify GRC Pricing Calculator — Worklog

---
Task ID: 1
Agent: Main Orchestrator
Task: Copy base files from tar and set up project foundation

Work Log:
- Extracted workspace tar to /tmp/workspace-extract
- Analyzed diff between `src` (complete) and `src-new` (simplified) — chose `src` as the v2 base
- Copied all source files: components, API routes, lib, types, store, CSS
- Copied prisma schema and seed file
- Updated prisma schema tenant primaryColor from #0F766E to #812671 (v2 spec)
- Updated seed to use bcryptjs for password hashing with v2-specified passwords
- Pushed schema to SQLite and seeded all data (4 users, 26 frameworks, 78 prices, 26 auditor fees, 8 add-ons, 7 DPO/vCISO packages, 3 GRC tools, 8 clients)
- Installed bcryptjs + @types/bcryptjs
- Fixed APPROVED status color and IT_Security category color in quoteCalculator.ts

Stage Summary:
- Complete project foundation with all files from previous implementation
- Database seeded with v2-compliant data
- All 22 API routes copied (admin CRUD for frameworks, tiers, prices, auditor fees, add-ons, GRC tools, DPO/vCISO, FX rate, quotes, clients, dashboard, PDF export)

---
Task ID: 2
Agent: fullstack-developer (auth-system)
Task: Build auth system (login, auth store, providers, layout, page routing)

Work Log:
- Created /api/auth/route.ts with POST login (bcryptjs compare) and GET /me session verification
- Updated store/index.ts with useAuthStore (persisted Zustand store with login/logout)
- Created LoginView.tsx with centered card, ShieldCheck branding, email/password form
- Updated layout.tsx with "iSecurify GRC Pricing Platform" title
- Created providers.tsx with TanStack QueryClientProvider
- Updated page.tsx with auth-aware routing (LoginView when unauthenticated, Shell+ViewRouter when authenticated)

Stage Summary:
- Full authentication flow: login → session stored in localStorage → protected app shell
- Login page with brand styling (purple ShieldCheck icon, brand-700 sign-in button)
- Demo credentials: admin@isecurify.in / Admin@iSecurify2025!

---
Task ID: 3
Agent: fullstack-developer (shell-v2)
Task: Update Shell.tsx for v2 role-based navigation

Work Log:
- Added role-based nav filtering (allowedRoles per item)
- Added User Management nav item (UserCog icon) for super_admin + sales_manager
- Replaced img logo with ShieldCheck icon in rounded bg-brand-700 div
- Added user info section with initials avatar + role badge (color-coded per v2 spec)
- Added FX rate widget with live data from /admin/fx-rate API
- Added Sign Out button at bottom
- Updated MobileNav to use dynamic grid columns

Stage Summary:
- Shell supports 4 roles with proper visibility: Dashboard, Quote Builder, Quotes, Clients, Admin Panel, User Management
- Role badge colors: super_admin=purple, sales_manager=amber, sales_executive=teal, finance=blue

---
Task ID: 4
Agent: Main Orchestrator
Task: Build User Management API routes and UserManagementView

Work Log:
- Created /api/users/route.ts with GET (list with search/filter) and POST (create with validation)
- Created /api/users/[id]/route.ts with PATCH (update) and DELETE (hard delete with quote reassignment)
- Created /api/users/[id]/reset-password/route.ts with POST (bcrypt hash + validation)
- Created /api/users/[id]/toggle-active/route.ts with PATCH (toggle isActive)
- Built full UserManagementView.tsx with:
  - Search bar, role-colored badge table, status badges
  - Create User dialog with password strength indicator
  - Reset Password dialog with validation
  - Block/Unblock toggle
  - Delete with AlertDialog confirmation + quote reassignment warning
  - Role-scoped actions (manager can't manage admins, can't delete self)

Stage Summary:
- Complete User Management CRUD per v2 spec Section 15 Phase 3
- Password validation: min 8 chars, 1 uppercase, 1 digit (enforced both client and server)
- Sales Manager scope: can only manage sales_executive, finance, viewer roles

---
Task ID: 5
Agent: Main Orchestrator
Task: Update QuotesViews for v2 role-based actions

Work Log:
- Changed hardcoded `role = 'super_admin'` to use actual user role from useAuthStore
- Restricted Delete Quote button (list + detail) to super_admin only
- Delete button disabled and dimmed for non-super_admin users
- Approval/reject/submit actions automatically gated by canPerformAction() based on user's actual role

Stage Summary:
- All quote actions are now role-aware per v2 spec Section 10
- Sales Executive: can submit only
- Sales Manager: can submit, approve, reject, send, recall
- Finance: can approve (PENDING_FINANCE), reject, override
- Super Admin: full access including delete

---
Task ID: 3
Agent: Main Orchestrator
Task: Apply proper iSecurify branding with uploaded logo images

Work Log:
- LoginView.tsx: Replaced ShieldCheck icon with `/logo-small.png` (wide logo with text) using `next/image`, kept "GRC Pricing Platform" subtitle below
- Shell.tsx sidebar: Replaced ShieldCheck icon in purple div with `/logo-full.png` (square icon) using `next/image`, removed ShieldCheck import, kept "iSecurify" text and subtitle
- layout.tsx: Updated favicon icon from `/logo-small.png` to `/logo-full.png` (square format more appropriate for browser tab icon)
- PDF route: Changed logo path from `public/logo-full.png` to `public/logo-small.png` (wide format), adjusted logo width from 22mm to 40mm (height 18.3mm to maintain aspect ratio), shifted text/badge right to m+45 to avoid overlap, removed redundant "iSecurify" text since wide logo already includes it

Stage Summary:
- All four files updated with proper iSecurify branding
- No color changes — existing brand colors (Purple #812671, Teal #1B887D, Orange #C46C1D, Blue #146F9E) preserved
- Lint passes cleanly

---
Task ID: 4
Agent: Main Orchestrator
Task: Add "Edit Name" feature for admins in User Management

Work Log:
- Verified PATCH /api/users/[id] already supports updating `name` field (no backend changes needed)
- Imported `Pencil` icon from lucide-react
- Added `editNameUser` and `editName` state variables to track editing context
- Added `editNameMut` mutation that calls PATCH /api/users/[id] with { name }
- Added Pencil (Edit Name) button BEFORE the Reset Password button in the actions column
- Added Edit Name Dialog with: pre-filled name input, min 2 character validation, Save button with brand styling
- Button only visible for users the current admin can manage (respects `canAct` logic)
- Success toast on name update, invalidates ['users'] query to refresh table

Stage Summary:
- Admins (super_admin and sales_manager) can now edit user names via a pencil icon button
- Validation ensures name is not empty and has at least 2 characters
- Consistent styling with existing dialogs and actions---
Task ID: 5
Agent: Main Orchestrator
Task: Fix PDF alignment, logo visibility, and multi-framework display

Work Log:
- Completely rewrote /api/quote-pdf/[id]/route.ts with improved PDF layout:
  - Added solid white opaque rounded-rect background behind logo for contrast against purple header
  - Restructured header with clear coordinate system (teal stripe → orange line → purple band)
  - Fixed all element positioning to prevent overlaps
  - Added proper cellPadding to all autoTable calls for better text alignment
  - Used column width constraints for cleaner table layouts
  - Added page-break safety checks before every major section
  - Renamed "Line Items" to "Pricing Breakdown" for clarity
  - Improved Compliance Services section to show all frameworks from consulting_fee lines as bulleted list
  - Placed Tier and FX Rate on the same row for space efficiency
  - Added proper grand total highlight box with border
- Updated QuoteDetailView in QuotesViews.tsx:
  - Added getAllFrameworkNames() helper that extracts all framework names from consulting_fee line items
  - Added buildQuoteSubtitle() helper for the TopBar
  - Updated subtitle to show all frameworks (e.g., "ISO 27001, ISO 9001 • Mid-size • v1")
  - Updated Meta label from "Framework" to "Framework(s)"
- Updated QuotesListView to show all frameworks in the table column using getFrameworkNamesFromLines() helper
- Verified PDF generation produces valid 1.7MB PDF with embedded logo
- Verified quote detail shows "ISO 2701, ISO 9001" correctly in subtitle, meta, and line items

Stage Summary:
- PDF logo now has white opaque background pill for clear visibility against purple header
- PDF alignment fixed with proper spacing, padding, and coordinate calculations
- Multi-framework display works end-to-end: Quote Builder → Quote Detail → PDF → Quote List
