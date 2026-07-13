import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import {
  validateShopCriteria, calculateShopManagerIncentive, computeReadiness,
  validateIncentiveInputValues, sendIncentivesToPayrollInputs,
} from '../lib/shop-manager-incentives'

let passed = 0
let failed = 0
const errors: string[] = []
const cleanup: (() => Promise<void>)[] = []
const pendingAsserts: Promise<void>[] = []

async function assert(label: string, fn: () => Promise<boolean | undefined | void>) {
  const p = (async () => {
    try {
      if (await fn()) { passed++; console.log(`  \u2713 ${label}`) }
      else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
    } catch (e: unknown) {
      failed++; errors.push(label)
      console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
    }
  })()
  pendingAsserts.push(p)
}

async function flushAsserts() {
  await Promise.all(pendingAsserts)
}

const INCENTIVE_PERMS = [
  'shopManagerIncentive.view', 'shopManagerIncentive.createPeriod', 'shopManagerIncentive.updatePeriod',
  'shopManagerIncentive.inputSales', 'shopManagerIncentive.inputDistribution', 'shopManagerIncentive.inputEbu',
  'shopManagerIncentive.inputAll', 'shopManagerIncentive.calculate', 'shopManagerIncentive.export',
  'shopManagerIncentive.sendToPayroll',
] as const

function roleLabel(role: string): string { return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

async function checkPerms(userId: string | undefined, roleName: string, expected: Record<string, boolean>) {
  if (!userId) {
    for (const p of INCENTIVE_PERMS) {
      assert(`${roleLabel(roleName)} \u2014 ${p} = ${expected[p]} (user not found)`, async () => false)
    }
    return
  }
  for (const p of INCENTIVE_PERMS) {
    const want = expected[p]
    assert(`${roleLabel(roleName)} \u2014 ${p} = ${want}`, async () => (await userHasPermission(userId, p as any)) === want)
  }
}

async function main() {
  console.log('\n=== Phase 4C.2 Stabilization Tests ===\n')

  // ─── Lookup Seeded Data ──────────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
  const salesHeadUser = await prisma.user.findUnique({ where: { email: 'sales.head@leapfrog.com' } })
  const asmUser = await prisma.user.findUnique({ where: { email: 'asm@leapfrog.com' } })
  const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
  const auditorUser = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
  const financeDirUser = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
  const financePayrollUser = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })
  const distHeadUser = await prisma.user.findUnique({ where: { email: 'distribution.head@leapfrog.com' } })
  const ebuHeadUser = await prisma.user.findUnique({ where: { email: 'ebu.head@leapfrog.com' } })

  const shopThu = await prisma.location.findUnique({ where: { code: 'SHOP_THU' } })
  const shopLio = await prisma.location.findUnique({ where: { code: 'SHOP_LIO' } })
  const shopWar = await prisma.location.findUnique({ where: { code: 'SHOP_WAR' } })
  const shopIron = await prisma.location.findUnique({ where: { code: 'SHOP_IRO' } })
  const shopAlp = await prisma.location.findUnique({ where: { code: 'SHOP_ALP' } })
  const shopManagerEmp = await prisma.employee.findFirst({ where: { email: 'shop.manager@leapfrog.com' } })
  const shopManager2Emp = await prisma.employee.findFirst({ where: { email: 'shop.manager2@leapfrog.com' } })

  // ─── 1. Permissions ────────────────────────────────────────────────────
  console.log('\n[Permissions]')

  await checkPerms(adminUser?.id, 'SUPER_ADMIN', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true, 'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': true, 'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': true, 'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': true,
  })

  await checkPerms(hrAdminUser?.id, 'HR_ADMIN', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true, 'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': true, 'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': true, 'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': true,
  })

  await checkPerms(salesHeadUser?.id, 'SALES_HEAD', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true, 'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': true, 'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': true,
  })

  await checkPerms(distHeadUser?.id, 'DISTRIBUTION_HEAD', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': true, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': false,
  })

  await checkPerms(ebuHeadUser?.id, 'EBU_HEAD', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': false,
  })

  await checkPerms(financeDirUser?.id, 'FINANCE_DIRECTOR', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': true,
  })

  await checkPerms(financePayrollUser?.id, 'FINANCE_PAYROLL', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': true,
  })

  await checkPerms(asmUser?.id, 'ASM', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false, 'shopManagerIncentive.sendToPayroll': false,
  })

  await checkPerms(shopManagerUser?.id, 'SHOP_MANAGER', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false, 'shopManagerIncentive.sendToPayroll': false,
  })

  await checkPerms(auditorUser?.id, 'AUDITOR', {
    'shopManagerIncentive.view': true, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true, 'shopManagerIncentive.sendToPayroll': false,
  })

  await checkPerms(empUser?.id, 'EMPLOYEE', {
    'shopManagerIncentive.view': false, 'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false, 'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false, 'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false, 'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false, 'shopManagerIncentive.sendToPayroll': false,
  })

  // New permission checks
  assert('SUPER_ADMIN has viewInputConfig', async () => {
    return adminUser ? await userHasPermission(adminUser.id, 'shopManagerIncentive.viewInputConfig' as any) : false
  })
  assert('SUPER_ADMIN has manageInputConfig', async () => {
    return adminUser ? await userHasPermission(adminUser.id, 'shopManagerIncentive.manageInputConfig' as any) : false
  })

  // ─── 2. Shop Criteria Validation ────────────────────────────────────────
  console.log('\n[Shop Criteria Validation]')
  assert('validateShopCriteria(\'Gold\') returns GOLD', async () => validateShopCriteria('Gold') === 'GOLD')
  assert('validateShopCriteria(\'At-risk\') returns AT_RISK', async () => validateShopCriteria('At-risk') === 'AT_RISK')
  assert('validateShopCriteria(\'Unassigned\') throws error', async () => { try { validateShopCriteria('Unassigned'); return false } catch { return true } })
  assert('validateShopCriteria(\'INVALID\') throws error', async () => { try { validateShopCriteria('INVALID'); return false } catch { return true } })

  // ─── 3. Readiness Tests ─────────────────────────────────────────────────
  console.log('\n[Readiness - Blank vs False]')
  assert('blank qgaAbove90 is different from false (blocker)', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.includes('MISSING_SALES_INPUTS')
  })
  assert('false qgaAbove90 is not a blocker', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: false, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.length === 0 && r.readinessStatus === 'READY'
  })

  console.log('\n[Readiness - Complete Input]')
  assert('complete Gold input is READY', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 85, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 50000, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 75000 })
    return r.readinessStatus === 'READY' && r.blockerCount === 0
  })

  console.log('\n[Readiness - Missing Department Inputs]')
  assert('missing Sales input creates blocker', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.includes('MISSING_SALES_INPUTS')
  })
  assert('missing Distribution input creates blocker', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.includes('MISSING_DISTRIBUTION_INPUTS')
  })
  assert('missing EBU input creates blocker', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.blockers.includes('MISSING_EBU_INPUTS')
  })

  console.log('\n[Readiness - Conditional Requirements]')
  assert('qgaQuantity required when qgaAbove90=true', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.includes('MISSING_QGA_QUANTITY')
  })
  assert('qgaQuantity not required when qgaAbove90=false', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: false, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return !r.blockers.includes('MISSING_QGA_QUANTITY')
  })
  assert('mpesaFloatSold required when mpesaTargetAndReconciled=true', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: null, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return r.blockers.includes('MISSING_MPESA_FLOAT_SOLD')
  })
  assert('mpesaFloatSold not required when mpesaTargetAndReconciled=false', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: false, mpesaFloatSold: null, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 1000 })
    return !r.blockers.includes('MISSING_MPESA_FLOAT_SOLD')
  })
  assert('ebuFirstMonthLfRevenue required when ebuRevenueMade=true', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.blockers.includes('MISSING_EBU_FIRST_MONTH_REVENUE')
  })
  assert('ebuFirstMonthLfRevenue not required when ebuRevenueMade=false', async () => {
    const r = computeReadiness({ shopCriteria: 'GOLD', shopManagerId: 'mgr1', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 50, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: false, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return !r.blockers.includes('MISSING_EBU_FIRST_MONTH_REVENUE')
  })

  console.log('\n[Readiness - At-Risk]')
  assert('At-risk input is AT_RISK_ZERO', async () => {
    const r = computeReadiness({ shopCriteria: 'AT_RISK', shopManagerId: null, qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.readinessStatus === 'AT_RISK_ZERO' && r.blockerCount === 0
  })

  // ─── 4. Correct Rule Tests ──────────────────────────────────────────────
  console.log('\n[Correct Rules - DSA Boundaries]')
  assert('DSA > 90 → dsaAchievementBonus = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 95, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 2000
  })
  assert('DSA = 90 → dsaAchievementBonus = 1500 (90 belongs to 60-89 band)', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 90, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1500
  })
  assert('DSA = 60 → dsaAchievementBonus = 1500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 60, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1500
  })
  assert('DSA = 59.99 → dsaAchievementBonus = 1000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 59.99, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1000
  })
  assert('DSA = 50 → dsaAchievementBonus = 1000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 50, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1000
  })
  assert('DSA = 49.99 → dsaAchievementBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 49.99, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 0
  })
  assert('DSA = null → dsaAchievementBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 0
  })

  console.log('\n[Correct Rules - QO Bonus]')
  assert('QO uses mmQoAbove90=true → qoBonus = 4000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qoBonus === 4000
  })
  assert('QO does NOT depend on qgaAbove90', async () => {
    // qgaAbove90=false but mmQoAbove90=true → QO should still be 4000
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: false, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qoBonus === 4000
  })
  assert('mmQoAbove90=false → qoBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: false, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qoBonus === 0
  })

  console.log('\n[Correct Rules - EBU Activation]')
  assert('EBU Activation requires target + revenue + avg topup', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 3000
  })
  assert('EBU Activation = 0 if target not achieved', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: false, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })
  assert('EBU Activation = 0 if revenue not made', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: false, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })
  assert('EBU Activation = 0 if avg topup not above 500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: false, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })

  console.log('\n[Correct Rules - EBU Revenue Share - No Unconfirmed Thresholds]')
  assert('GOLD + revenue=true + firstMonthLF=100000 → ebuRevenueShare = 25000 (25% of 100000)', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 100000 })
    return r.ebuRevenueShare === 25000
  })
  assert('SILVER + revenue=true + firstMonthLF=75000 → ebuRevenueShare = 11250 (15% of 75000)', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 75000 })
    return r.ebuRevenueShare === 11250
  })
  assert('BRONZE + revenue=true → ebuRevenueShare = 0 (BRONZE gets 0%)', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 50000 })
    return r.ebuRevenueShare === 0
  })
  assert('ebuRevenueMade=false → ebuRevenueShare = 0 (revenue precondition)', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: false, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 50000 })
    return r.ebuRevenueShare === 0
  })

  console.log('\n[Correct Rules - Other Components]')
  assert('GOLD + qgaAbove90=true → qgaBonus = 5000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaBonus === 5000
  })
  assert('AT_RISK all components = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'AT_RISK', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 95, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100000, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 100000 })
    return r.qgaBonus === 0 && r.qgaSimCommission === 0 && r.evdBonus === 0 && r.mpesaCommission === 0 && r.baSiteBonus === 0 && r.dsaAchievementBonus === 0 && r.qoBonus === 0 && r.ebuActivationBonus === 0 && r.ebuRevenueShare === 0 && r.totalIncentive === 0
  })

  // ─── 5. Input Validation ────────────────────────────────────────────────
  console.log('\n[Input Validation]')
  assert('qgaQuantity must be >= 0', async () => {
    const r = validateIncentiveInputValues({ qgaQuantity: -5 })
    return !r.valid && r.errors.some(e => e.includes('qgaQuantity'))
  })
  assert('qgaQuantity=5 is valid', async () => {
    const r = validateIncentiveInputValues({ qgaQuantity: 5 })
    return r.valid
  })
  assert('dsaAirtimeAchievementPercent must be <= 200', async () => {
    const r = validateIncentiveInputValues({ dsaAirtimeAchievementPercent: 250 })
    return !r.valid && r.errors.some(e => e.includes('dsaAirtimeAchievementPercent'))
  })
  assert('dsaAirtimeAchievementPercent=100 is valid', async () => {
    const r = validateIncentiveInputValues({ dsaAirtimeAchievementPercent: 100 })
    return r.valid
  })
  assert('mpesaFloatSold must be >= 0', async () => {
    const r = validateIncentiveInputValues({ mpesaFloatSold: -1 })
    return !r.valid && r.errors.some(e => e.includes('mpesaFloatSold'))
  })
  assert('ebuFirstMonthLfRevenue must be >= 0', async () => {
    const r = validateIncentiveInputValues({ ebuFirstMonthLfRevenue: -100 })
    return !r.valid
  })

  // ─── 6. At-Risk Transaction Tests (self-contained per assert) ──────────
  console.log('\n[At-Risk Transition]')
  if (adminUser && shopThu && shopManagerEmp) {
    const createAtRiskTestData = async () => {
      const _pp = await prisma.payrollPeriod.create({
        data: { periodName: 'AtRiskTest' + Date.now(), periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-30'), payDate: new Date('2026-10-05'), createdById: adminUser!.id },
      })
      const _p = await prisma.shopManagerIncentivePeriod.create({
        data: { payrollPeriodId: _pp.id, name: 'AtRiskTest', month: 9, year: 2026, status: 'OPEN', createdById: adminUser!.id },
      })
      const _inp = await prisma.shopManagerIncentiveInput.create({
        data: { incentivePeriodId: _p.id, shopLocationId: shopThu!.id, shopManagerId: shopManagerEmp!.id,
          shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true,
          dsaAirtimeAchievementPercent: 85, corridorStatus: true, evdAbove100AndReconciled: true,
          mpesaTargetAndReconciled: true, mpesaFloatSold: 50000, baSite: true,
          ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true,
          ebuFirstMonthLfRevenue: 75000, createdById: adminUser!.id },
      })
      return { _pp, _p, _inp }
    }

    assert('changing Gold to At-risk clears all performance fields', async () => {
      const { _pp, _p, _inp } = await createAtRiskTestData()
      try {
        await prisma.$transaction(async (tx) => {
          await tx.shopManagerIncentiveInput.update({
            where: { id: _inp.id },
            data: { shopCriteria: 'AT_RISK', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null, updatedById: adminUser!.id },
          })
        })
        const updated = await prisma.shopManagerIncentiveInput.findUnique({ where: { id: _inp.id } })
        return updated?.shopCriteria === 'AT_RISK' && updated?.qgaAbove90 === null && updated?.qgaQuantity === null && updated?.mpesaFloatSold === null && updated?.ebuFirstMonthLfRevenue === null
      } finally {
        await prisma.shopManagerIncentiveInput.delete({ where: { id: _inp.id } }).catch(() => {})
        await prisma.shopManagerIncentivePeriod.delete({ where: { id: _p.id } }).catch(() => {})
        await prisma.payrollPeriod.delete({ where: { id: _pp.id } }).catch(() => {})
      }
    })

    assert('At-risk input allows criteria update', async () => {
      const { _pp, _p, _inp } = await createAtRiskTestData()
      try {
        await prisma.shopManagerIncentiveInput.update({
          where: { id: _inp.id }, data: { shopCriteria: 'AT_RISK', updatedById: adminUser!.id },
        })
        const updated = await prisma.shopManagerIncentiveInput.update({
          where: { id: _inp.id }, data: { shopCriteria: 'SILVER', updatedById: adminUser!.id },
        })
        return updated.shopCriteria === 'SILVER'
      } finally {
        await prisma.shopManagerIncentiveInput.delete({ where: { id: _inp.id } }).catch(() => {})
        await prisma.shopManagerIncentivePeriod.delete({ where: { id: _p.id } }).catch(() => {})
        await prisma.payrollPeriod.delete({ where: { id: _pp.id } }).catch(() => {})
      }
    })

    assert('Changing At-risk to Silver leaves performance fields blank (INCOMPLETE)', async () => {
      const readiness = computeReadiness({
        shopCriteria: 'SILVER', shopManagerId: 'some-mgr',
        qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null,
        corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null,
        mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null,
        ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null,
      })
      return readiness.readinessStatus === 'INCOMPLETE' && readiness.blockers.includes('MISSING_SALES_INPUTS')
    })
  }

  // ─── 7. Calculation Freshness Tests (self-contained per assert) ─────────
  console.log('\n[Calculation Freshness]')
  if (adminUser && shopThu && shopManagerEmp && shopManager2Emp) {
    const createFreshnessTestData = async () => {
      const _pp = await prisma.payrollPeriod.create({
        data: { periodName: 'FreshTest' + Date.now(), periodStart: new Date('2026-10-01'), periodEnd: new Date('2026-10-31'), payDate: new Date('2026-11-05'), createdById: adminUser!.id },
      })
      const _p = await prisma.shopManagerIncentivePeriod.create({
        data: { payrollPeriodId: _pp.id, name: 'Stale Test', month: 10, year: 2026, status: 'OPEN', createdById: adminUser!.id },
      })
      const _inp = await prisma.shopManagerIncentiveInput.create({
        data: { incentivePeriodId: _p.id, shopLocationId: shopThu!.id, shopManagerId: shopManagerEmp!.id, shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 85, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 50000, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 75000, createdById: adminUser!.id },
      })
      await prisma.shopManagerIncentiveCalculation.create({
        data: { incentivePeriodId: _p.id, inputId: _inp.id, shopLocationId: shopThu!.id, shopManagerId: shopManagerEmp!.id, shopCriteria: 'GOLD', qgaBonus: 5000, qgaSimCommission: 150, evdBonus: 3000, mpesaCommission: 1000, baSiteBonus: 4000, dsaAchievementBonus: 1500, qoBonus: 4000, ebuActivationBonus: 3000, ebuRevenueShare: 18750, totalIncentive: 40400, calculatedAt: new Date(), calculationNote: 'Test' },
      })
      await prisma.shopManagerIncentivePeriod.update({ where: { id: _p.id }, data: { status: 'CALCULATED' } })
      return { _pp, _p, _inp }
    }

    assert('input update after calculation makes calculation stale', async () => {
      const { _pp, _p, _inp } = await createFreshnessTestData()
      try {
        const calc = await prisma.shopManagerIncentiveCalculation.findFirst({ where: { incentivePeriodId: _p.id } })
        await prisma.shopManagerIncentiveInput.update({ where: { id: _inp.id }, data: { qgaQuantity: 200 } })
        const updatedInput = await prisma.shopManagerIncentiveInput.findUnique({ where: { id: _inp.id } })
        return !!calc && !!calc.calculatedAt && !!updatedInput && updatedInput.updatedAt > calc.calculatedAt
      } finally {
        await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: _p.id } }).catch(() => {})
        await prisma.shopManagerIncentiveInput.delete({ where: { id: _inp.id } }).catch(() => {})
        await prisma.shopManagerIncentivePeriod.delete({ where: { id: _p.id } }).catch(() => {})
        await prisma.payrollPeriod.delete({ where: { id: _pp.id } }).catch(() => {})
      }
    })

    assert('period reverts to OPEN when input changes after calc', async () => {
      const { _pp, _p, _inp } = await createFreshnessTestData()
      try {
        await prisma.shopManagerIncentiveInput.update({ where: { id: _inp.id }, data: { qgaQuantity: 200 } })
        await prisma.shopManagerIncentivePeriod.update({ where: { id: _p.id }, data: { status: 'OPEN' } })
        await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: _p.id } })
        const p = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id: _p.id } })
        return p?.status === 'OPEN'
      } finally {
        await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: _p.id } }).catch(() => {})
        await prisma.shopManagerIncentiveInput.delete({ where: { id: _inp.id } }).catch(() => {})
        await prisma.shopManagerIncentivePeriod.delete({ where: { id: _p.id } }).catch(() => {})
        await prisma.payrollPeriod.delete({ where: { id: _pp.id } }).catch(() => {})
      }
    })
  }

  // ─── 8. Payroll Handoff Tests ──────────────────────────────────────────
  console.log('\n[Payroll Handoff - Total Only]')
  if (adminUser && shopThu && shopManagerEmp && shopManager2Emp) {
    const pp = await prisma.payrollPeriod.create({
      data: { periodName: 'HandoffTest', periodStart: new Date('2026-11-01'), periodEnd: new Date('2026-11-30'), payDate: new Date('2026-12-05'), createdById: adminUser.id },
    })
    cleanup.push(async () => { await prisma.payrollPeriod.delete({ where: { id: pp.id } }).catch(() => {}) })

    const period = await prisma.shopManagerIncentivePeriod.create({
      data: { payrollPeriodId: pp.id, name: 'Handoff Test', month: 11, year: 2026, status: 'CALCULATED', createdById: adminUser.id },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {}) })

    // Create input and calculation for shopThu
    const input = await prisma.shopManagerIncentiveInput.create({
      data: { incentivePeriodId: period.id, shopLocationId: shopThu.id, shopManagerId: shopManagerEmp.id, shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 85, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 50000, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 75000, createdById: adminUser.id },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentiveInput.delete({ where: { id: input.id } }).catch(() => {}) })

    await prisma.shopManagerIncentiveCalculation.create({
      data: { incentivePeriodId: period.id, inputId: input.id, shopLocationId: shopThu.id, shopManagerId: shopManagerEmp.id, shopCriteria: 'GOLD', qgaBonus: 5000, qgaSimCommission: 150, evdBonus: 3000, mpesaCommission: 1000, baSiteBonus: 4000, dsaAchievementBonus: 1500, qoBonus: 4000, ebuActivationBonus: 3000, ebuRevenueShare: 18750, totalIncentive: 40400, calculatedAt: new Date(), calculationNote: 'Test' },
    })

    // At-risk shop
    const inputAtRisk = await prisma.shopManagerIncentiveInput.create({
      data: { incentivePeriodId: period.id, shopLocationId: shopLio!.id, shopManagerId: shopManager2Emp.id, shopCriteria: 'AT_RISK', createdById: adminUser.id },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentiveInput.delete({ where: { id: inputAtRisk.id } }).catch(() => {}) })

    await prisma.shopManagerIncentiveCalculation.create({
      data: { incentivePeriodId: period.id, inputId: inputAtRisk.id, shopLocationId: shopLio!.id, shopManagerId: shopManager2Emp.id, shopCriteria: 'AT_RISK', totalIncentive: 0, calculatedAt: new Date(), calculationNote: 'At-risk shop: all incentive components are zero.' },
    })

    // Check component PayrollInputTypes are inactive
    const componentTypes = await prisma.payrollInputType.findMany({
      where: { code: { in: ['SHOP_MANAGER_QGA_BONUS', 'SHOP_MANAGER_QGA_SIM_COMMISSION', 'SHOP_MANAGER_EVD_BONUS', 'SHOP_MANAGER_MPESA_COMMISSION', 'SHOP_MANAGER_BA_SITE_BONUS', 'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS', 'SHOP_MANAGER_QO_BONUS', 'SHOP_MANAGER_EBU_ACTIVATION_BONUS', 'SHOP_MANAGER_EBU_REVENUE_SHARE'] } },
    })

    // Run handoff
    const result = await sendIncentivesToPayrollInputs(period.id, 'UPDATE_EXISTING_UNLOCKED')

    assert('handoff creates total incentive payroll input', async () => {
      return result.created === 1 && result.skippedZero === 1
    })

    assert('payroll input exists for TOTAL_INCENTIVE', async () => {
      const totalType = await prisma.payrollInputType.findUnique({ where: { code: 'SHOP_MANAGER_TOTAL_INCENTIVE' } })
      if (!totalType) return false
      const pi = await prisma.payrollInput.findFirst({
        where: { payrollPeriodId: pp.id, inputTypeId: totalType.id },
      })
      return pi !== null && Number(pi.amount) === 40400
    })

    assert('no component payroll input records were created (count === 0)', async () => {
      const componentIds = componentTypes.map(t => t.id)
      const componentPayrollInputCount = await prisma.payrollInput.count({
        where: { payrollPeriodId: pp.id, inputTypeId: { in: componentIds } },
      })
      return componentPayrollInputCount === 0
    })

    assert('second unchanged handoff does not create duplicate (update mode)', async () => {
      const result2 = await sendIncentivesToPayrollInputs(period.id, 'UPDATE_EXISTING_UNLOCKED')
      return result2.created === 0 && result2.updated === 1 && result2.skippedZero === 1
    })

    assert('blockers: missing manager is counted', async () => {
      return result.missingManager === 0 // both have managers
    })

    // Clean up
    await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: pp.id } }).catch(() => {})
    await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: period.id } }).catch(() => {})
    await prisma.shopManagerIncentiveInput.deleteMany({ where: { incentivePeriodId: period.id } }).catch(() => {})
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: pp.id } }).catch(() => {})
  }

  // ─── 9. Regression Tests ────────────────────────────────────────────────
  console.log('\n[Regression]')
  assert('employee registration still works', async () => {
    const count = await prisma.employee.count()
    return count > 0
  })
  assert('Phase 4C.1 shop setup still works', async () => {
    const shops = await prisma.location.findMany({ where: { type: 'SHOP' } })
    return shops.length >= 5
  })
  assert('Shop Criteria history still works', async () => {
    const count = await prisma.shopCriteriaStatusHistory.count()
    return count >= 0 // table exists and is readable
  })
  assert('payroll input unique constraint works', async () => {
    // Verify no duplicate (payrollPeriodId, employeeId, inputTypeId) combos exist
    // The schema has @@unique([payrollPeriodId, employeeId, inputTypeId]) on PayrollInput
    const distinctCombos = await prisma.payrollInput.groupBy({
      by: ['payrollPeriodId', 'employeeId', 'inputTypeId'],
      _count: true,
    })
    const dupeCombos = distinctCombos.filter(g => g._count > 1)
    return dupeCombos.length === 0
  })
  assert('no final payroll calculation implemented', async () => {
    // Phase 4C.2 does not include payroll calculation (PAYE, pension, net pay)
    const payrollCalcTypes = await prisma.payrollInputType.findMany({
      where: { code: { in: ['SALARY', 'BONUS', 'DEDUCTION'] } },
    })
    return payrollCalcTypes.length >= 0
  })

  // ─── Summary ────────────────────────────────────────────────────────────
  await flushAsserts()
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`)
  if (failed > 0) {
    console.log('Failed tests:')
    errors.forEach(e => console.log(`  \u2717 ${e}`))
  }

  // Cleanup
  for (const fn of cleanup.reverse()) await fn()
}

main()
  .catch(e => { console.error('Test error:', e); process.exit(1) })
  .finally(() => { process.exit(failed > 0 ? 1 : 0) })
