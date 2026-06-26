/**
 * iSecurify GRC Platform — Seed Script
 * Seeds the root tenant, a default admin user, and all master pricing data
 * (global frameworks, tiers, framework prices, auditor fees, addon services,
 *  DPO/vCISO packages, GRC tools, and the FX rate).
 *
 * Run: bun run prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  console.log('🌱 Seeding iSecurify GRC platform...')

  // ── 1. Root tenant ─────────────────────────────────────────────
  const tenant = await db.tenant.upsert({
    where: { slug: 'isecurify' },
    update: {},
    create: {
      id: 'tenant-isecurify',
      slug: 'isecurify',
      name: 'iSecurify',
      primaryColor: '#812671',
      secondaryColor: '#571A4D',
      domain: 'isecurify.in',
      plan: 'enterprise',
      isActive: true,
    },
  })
  console.log(`  ✓ Tenant: ${tenant.name}`)

  // ── 2. Demo users (bcrypt-hashed passwords) ───────────────────
  const adminHash = await hash('Admin@iSecurify2025!', 12)
  const mgrHash = await hash('Sales@Manager2025!', 12)
  const execHash = await hash('Sales@Exec2025!', 12)
  const finHash = await hash('Finance@iSecurify2025!', 12)

  const admin = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@isecurify.in' } },
    update: {},
    create: {
      id: 'user-admin',
      tenantId: tenant.id,
      email: 'admin@isecurify.in',
      name: 'System Administrator',
      role: 'super_admin',
      hashedPassword: adminHash,
      isActive: true,
    },
  })
  const salesMgr = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sales.manager@isecurify.in' } },
    update: {},
    create: {
      id: 'user-sales-mgr',
      tenantId: tenant.id,
      email: 'sales.manager@isecurify.in',
      name: 'Priya Sharma',
      role: 'sales_manager',
      hashedPassword: mgrHash,
    },
  })
  const salesExec = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'sales.exec@isecurify.in' } },
    update: {},
    create: {
      id: 'user-sales-exec',
      tenantId: tenant.id,
      email: 'sales.exec@isecurify.in',
      name: 'Rahul Verma',
      role: 'sales_executive',
      hashedPassword: execHash,
    },
  })
  const financeUser = await db.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'finance@isecurify.in' } },
    update: {},
    create: {
      id: 'user-finance',
      tenantId: tenant.id,
      email: 'finance@isecurify.in',
      name: 'Anita Desai',
      role: 'finance',
      hashedPassword: finHash,
    },
  })
  console.log(`  ✓ Users: ${admin.name}, ${salesMgr.name}, ${salesExec.name}, ${financeUser.name}`)

  // ── 3. Global Tiers ────────────────────────────────────────────
  const tierStartup = await db.tier.upsert({
    where: { id: 'tier-startup' },
    update: {},
    create: { id: 'tier-startup', name: 'Startup', retainerPct: 20, sortOrder: 1 },
  })
  const tierMidsize = await db.tier.upsert({
    where: { id: 'tier-midsize' },
    update: {},
    create: { id: 'tier-midsize', name: 'Mid-size', retainerPct: 18, sortOrder: 2 },
  })
  const tierEnterprise = await db.tier.upsert({
    where: { id: 'tier-enterprise' },
    update: {},
    create: { id: 'tier-enterprise', name: 'Enterprise', retainerPct: 15, sortOrder: 3 },
  })
  console.log(`  ✓ Tiers: ${tierStartup.name}, ${tierMidsize.name}, ${tierEnterprise.name}`)

  // ── 4. Global Frameworks ───────────────────────────────────────
  const frameworkDefs: Array<[string, string, string, number]> = [
    // [name, category, description, sortOrder]
    ['ISO 27001', 'IT_Security', 'Information Security Management System', 1],
    ['ISO 22301', 'IT_Security', 'Business Continuity Management', 2],
    ['ISO 42001', 'IT_Security', 'Artificial Intelligence Management System', 3],
    ['ISO 20000-1', 'IT_Security', 'IT Service Management', 4],
    ['SOC 2 Type 2', 'Privacy', 'Service Organization Controls (Trust Services)', 5],
    ['HIPAA', 'Privacy', 'Health Insurance Portability and Accountability Act', 6],
    ['GDPR', 'Privacy', 'General Data Protection Regulation (EU)', 7],
    ['CCPA', 'Privacy', 'California Consumer Privacy Act', 8],
    ['DPDP (India)', 'Privacy', 'Digital Personal Data Protection Act, 2023', 9],
    ['PCI-DSS', 'Privacy', 'Payment Card Industry Data Security Standard', 10],
    ['NIST', 'Privacy', 'NIST Cybersecurity Framework', 11],
    ['ISO 9001', 'Quality', 'Quality Management System', 12],
    ['ISO 14001', 'Quality', 'Environmental Management System', 13],
    ['ISO 45001', 'Quality', 'Occupational Health & Safety', 14],
    ['ISO 22000', 'Food_Safety', 'Food Safety Management System', 15],
    ['HACCP', 'Food_Safety', 'Hazard Analysis Critical Control Point', 16],
    ['HALAL', 'Food_Safety', 'Halal Certification', 17],
    ['KOSHER', 'Food_Safety', 'Kosher Certification', 18],
    ['BRC', 'Food_Safety', 'British Retail Consortium Standard', 19],
    ['ORGANIC', 'Food_Safety', 'Organic Certification', 20],
    ['GMP', 'Food_Safety', 'Good Manufacturing Practice', 21],
    ['CMMI Level 3', 'Industry', 'Capability Maturity Model Integration — Level 3 (Defined)', 22],
    ['CMMI Level 5', 'Industry', 'Capability Maturity Model Integration — Level 5 (Optimizing)', 23],
    ['HITRUST', 'Industry', 'HITRUST CSF Certification', 24],
    ['FCC', 'Industry', 'Federal Communications Commission Certification', 25],
    ['FEDRAMP', 'Industry', 'Federal Risk and Authorization Management Program', 26],
  ]

  const frameworks: Record<string, { id: string }> = {}
  for (const [name, category, description, sortOrder] of frameworkDefs) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const id = `fw-${slug}`
    const fw = await db.framework.upsert({
      where: { id },
      update: {},
      create: { id, name, category, description, sortOrder, tenantId: null },
    })
    frameworks[name] = fw
  }
  console.log(`  ✓ Frameworks: ${frameworkDefs.length} created`)

  // ── 5. Global Framework Prices (INR) ───────────────────────────
  // [frameworkName, startup, midsize, enterprise]
  const priceMatrix: Array<[string, number, number, number]> = [
    ['ISO 27001', 150000, 400000, 900000],
    ['SOC 2 Type 2', 200000, 500000, 1200000],
    ['HIPAA', 180000, 450000, 1000000],
    ['GDPR', 120000, 300000, 700000],
    ['CCPA', 100000, 250000, 600000],
    ['DPDP (India)', 100000, 250000, 600000],
    ['PCI-DSS', 120000, 350000, 800000],
    ['ISO 9001', 50000, 150000, 300000],
    ['ISO 14001', 60000, 180000, 350000],
    ['ISO 45001', 70000, 200000, 400000],
    ['ISO 22000', 80000, 250000, 500000],
    ['ISO 22301', 150000, 400000, 900000],
    ['ISO 42001', 150000, 400000, 900000],
    ['ISO 20000-1', 150000, 400000, 900000],
    ['NIST', 150000, 400000, 900000],
    ['CMMI Level 3', 300000, 800000, 2000000],
    ['CMMI Level 5', 500000, 1500000, 3500000],
    ['HACCP', 80000, 200000, 450000],
    ['HALAL', 60000, 150000, 350000],
    ['KOSHER', 60000, 150000, 350000],
    ['BRC', 100000, 250000, 550000],
    ['ORGANIC', 70000, 180000, 400000],
    ['GMP', 70000, 180000, 400000],
    ['HITRUST', 250000, 600000, 1400000],
    ['FCC', 100000, 250000, 600000],
    ['FEDRAMP', 400000, 1000000, 2500000],
  ]

  const tiers = [
    { tier: tierStartup, mult: 1 },
    { tier: tierMidsize, mult: 1 },
    { tier: tierEnterprise, mult: 1 },
  ]

  let priceCount = 0
  for (const [fwName, startupFee, midsizeFee, enterpriseFee] of priceMatrix) {
    const fw = frameworks[fwName]
    if (!fw) continue
    const fees = [startupFee, midsizeFee, enterpriseFee]
    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i].tier
      const projectFee = fees[i]
      const retainerFee = Math.round(projectFee * (tier.retainerPct / 100))
      const id = `fp-${fw.id}-${tier.id}`
      await db.frameworkPrice.upsert({
        where: { id },
        update: {},
        create: {
          id,
          frameworkId: fw.id,
          tierId: tier.id,
          projectFeeInr: projectFee,
          retainerFeeInr: retainerFee,
          tenantId: null,
        },
      })
      priceCount++
    }
  }
  console.log(`  ✓ Framework Prices: ${priceCount} created`)

  // ── 6. Global Auditor Fees (INR) ────────────────────────────────
  const auditorFees: Array<[string, string, number, string?]> = [
    ['ISO 9001', 'EGAC', 2500],
    ['ISO 9001', 'UAF', 3500],
    ['ISO 14001', 'EGAC', 4000],
    ['ISO 14001', 'UAF', 5000],
    ['ISO 45001', 'EGAC', 5000],
    ['ISO 45001', 'UAF', 6500],
    ['ISO 22000', 'EGAC', 7000],
    ['ISO 22000', 'UAF', 8500],
    ['ISO 27001', 'EGAC', 12500],
    ['ISO 27001', 'UAF', 17000],
    ['ISO 22301', 'EGAC', 15000],
    ['ISO 22301', 'UAF', 18000],
    ['ISO 20000-1', 'EGAC', 15000],
    ['ISO 20000-1', 'UAF', 18000],
    ['HIPAA', 'Compliance', 15000],
    ['GDPR / CCPA', 'Compliance', 15000],
    ['DPDP (India)', 'Compliance', 10000],
    ['ISO 42001', 'Compliance', 15000],
    ['SOC 2 Type 2', 'Compliance', 125000],
    ['CMMI Level 3', 'EGAC', 1000000],
    ['CMMI Level 3', 'Compliance', 7500],
    ['CMMI Level 5', 'EGAC', 2750000],
    ['CMMI Level 5', 'Compliance', 10000],
    ['VAPT / Cert-In', 'Cert-In', 5000, 'Basic VAPT'],
    ['VAPT / Cert-In', 'Cert-In', 12000, 'Standard VAPT'],
    ['VAPT / Cert-In', 'Cert-In', 25000, 'Comprehensive VAPT'],
  ]
  for (const [standardName, body, feeInr, notes] of auditorFees) {
    const slug = `${standardName}-${body}-${feeInr}`.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const id = `af-${slug}`
    await db.auditorFee.upsert({
      where: { id },
      update: {},
      create: { id, standardName, accreditationBody: body, feeInr, notes, tenantId: null },
    })
  }
  console.log(`  ✓ Auditor Fees: ${auditorFees.length} created`)

  // ── 7. Global Add-on Services (INR) ────────────────────────────
  const addons: Array<[string, string, string, number]> = [
    // [name, category, description, feeInr]
    ['Gap Analysis Report', 'gap_analysis', 'Comprehensive gap analysis against the target framework', 25000],
    ['Risk Assessment & Control Mapping', 'advisory', 'Risk register and control mapping exercise', 20000],
    ['Policy & Documentation Pack', 'documentation', 'Complete policy and procedure documentation set', 30000],
    ['Internal Audit Training (1 day)', 'training', 'One-day internal auditor training workshop', 15000],
    ['Audit Attendance (per day)', 'audit', 'On-site attendance during external audit, per day', 10000],
    ['Readiness Assessment Report', 'advisory', 'Pre-audit readiness assessment and report', 15000],
    ['Employee Awareness Training', 'training', 'Organization-wide security awareness session', 12000],
    ['Third-Party Vendor Assessment', 'advisory', 'Vendor risk assessment and due diligence', 20000],
  ]
  for (const [name, category, description, feeInr] of addons) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const id = `addon-${slug}`
    await db.addonService.upsert({
      where: { id },
      update: {},
      create: { id, name, category, description, feeInr, tenantId: null, sortOrder: addons.indexOf([name, category, description, feeInr]) + 1 },
    })
  }
  console.log(`  ✓ Add-on Services: ${addons.length} created`)

  // ── 8. DPO & vCISO Packages ────────────────────────────────────
  const dpoVciso: Array<[string, string, string, number, number, number]> = [
    // [serviceType, name, description, hoursPerMonth, monthlyFee, annualFee]
    ['DPO', 'Basic', 'Data Protection Officer — Basic plan', 8, 15000, 162000],
    ['DPO', 'Standard', 'Data Protection Officer — Standard plan', 16, 25000, 270000],
    ['DPO', 'Comprehensive', 'Data Protection Officer — Comprehensive plan', 32, 45000, 486000],
    ['vCISO', 'Basic', 'Virtual CISO — Basic plan', 8, 20000, 216000],
    ['vCISO', 'Standard', 'Virtual CISO — Standard plan', 16, 35000, 378000],
    ['vCISO', 'Comprehensive', 'Virtual CISO — Comprehensive plan', 32, 60000, 648000],
    ['DPO_vCISO', 'Combined', 'Combined DPO + vCISO service', 40, 75000, 810000],
  ]
  for (const [serviceType, name, description, hours, monthly, annual] of dpoVciso) {
    const slug = `${serviceType}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-')
    const id = `dpv-${slug}`
    await db.dpoVcisoPackage.upsert({
      where: { id },
      update: {},
      create: {
        id,
        serviceType,
        name,
        description,
        hoursPerMonth: hours,
        feeInrMonthly: monthly,
        feeInrAnnual: annual,
        scopeJson: JSON.stringify({ hours, monthly, annual }),
        tenantId: null,
      },
    })
  }
  console.log(`  ✓ DPO/vCISO Packages: ${dpoVciso.length} created`)

  // ── 9. GRC Tools (annual plans) ────────────────────────────────
  const grcTools: Array<[string, string, number, number]> = [
    ['Basic', 'GRC tool — up to 10 users', 50000, 10],
    ['Standard', 'GRC tool — up to 50 users', 120000, 50],
    ['Enterprise', 'GRC tool — unlimited users', 250000, 999999],
  ]
  for (const [planName, description, fee, maxUsers] of grcTools) {
    const slug = planName.toLowerCase()
    const id = `grc-${slug}`
    await db.grcTool.upsert({
      where: { id },
      update: {},
      create: { id, planName, description, feeInrAnnual: fee, maxUsers, tenantId: null },
    })
  }
  console.log(`  ✓ GRC Tools: ${grcTools.length} created`)

  // ── 10. FX Rate ────────────────────────────────────────────────
  await db.fxRate.upsert({
    where: { id: 1 },
    update: {},
    create: { id: 1, currencyPair: 'USD_INR', rate: 83, updatedById: admin.id },
  })
  console.log(`  ✓ FX Rate: USD/INR = 83`)

  // ── 11. Sample clients ─────────────────────────────────────────
  const clients = [
    ['Acme Technologies Pvt Ltd', 'IT Services', 'Startup', 'qualified'],
    ['BlueWave Fintech', 'Financial Services', 'Mid-size', 'proposal_sent'],
    ['Nimbus Healthcare', 'Healthcare', 'Enterprise', 'negotiation'],
    ['Verdant Foods Ltd', 'Food & Beverage', 'Mid-size', 'won'],
    ['Quantum Logistics', 'Supply Chain', 'Enterprise', 'prospect'],
    ['Stellar Innovations', 'SaaS', 'Startup', 'proposal_sent'],
    ['Orchid Manufacturing', 'Manufacturing', 'Mid-size', 'qualified'],
    ['Pinnacle Retail Group', 'Retail', 'Enterprise', 'negotiation'],
  ]
  for (const [companyName, sector, size, stage] of clients) {
    const slug = companyName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    const id = `client-${slug}`
    await db.client.upsert({
      where: { id },
      update: {},
      create: {
        id,
        tenantId: tenant.id,
        companyName,
        sector,
        companySize: size,
        dealStage: stage,
        createdById: salesExec.id,
        contactsJson: JSON.stringify([
          { name: 'CTO Contact', email: `cto@${slug}.com`, phone: '+91 98XXXXXX00', role: 'CTO' },
        ]),
        notes: 'Sample client for demonstration.',
      },
    })
  }
  console.log(`  ✓ Sample Clients: ${clients.length} created`)

  console.log('\n✅ Seeding complete!')
  console.log('   Super Admin: admin@isecurify.in / Admin@iSecurify2025!')
  console.log('   Sales Mgr:  sales.manager@isecurify.in / Sales@Manager2025!')
  console.log('   Sales Exec:  sales.exec@isecurify.in / Sales@Exec2025!')
  console.log('   Finance:     finance@isecurify.in / Finance@iSecurify2025!')
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
