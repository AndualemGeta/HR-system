import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import { validateShopCriteria, calculateShopManagerIncentive, calculateAllShopManagerIncentives, sendIncentivesToPayrollInputs } from '../lib/shop-manager-incentives'

let passed = 0
let failed = 0
const errors: string[] = []
const cleanup: (() => Promise<void>)[] = []

async function assert(label: string, fn: () => Promise<boolean | undefined | void>) {
  try {
    if (await fn()) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
  }
}

const INCENTIVE_PERMS = [
  'shopManagerIncentive.view',
  'shopManagerIncentive.createPeriod',
  'shopManagerIncentive.updatePeriod',
  'shopManagerIncentive.inputSales',
  'shopManagerIncentive.inputDistribution',
  'shopManagerIncentive.inputEbu',
  'shopManagerIncentive.inputAll',
  'shopManagerIncentive.calculate',
  'shopManagerIncentive.export',
  'shopManagerIncentive.sendToPayroll',
] as const

type RolePermMap = Record<string, Record<string, boolean>>
function roleLabel(role: string): string { return role.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) }

async function checkPerms(userId: string | undefined, roleName: string, expected: Record<string, boolean>) {
  if (!userId) {
    for (const p of INCENTIVE_PERMS) {
      assert(`${roleLabel(roleName)} — ${p} = ${expected[p]} (user not found)`, async () => false)
    }
    return
  }
  for (const p of INCENTIVE_PERMS) {
    const want = expected[p]
    assert(`${roleLabel(roleName)} — ${p} = ${want}`, async () => await userHasPermission(userId, p as any) === want)
  }
}

async function main() {
  console.log('\n=== Phase 4C.2: Shop Manager Incentive Calculation Engine Tests ===\n')

  // ─── Lookup Seeded Data ──────────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
  const salesHeadUser = await prisma.user.findUnique({ where: { email: 'sales.head@leapfrog.com' } })
  const asmUser = await prisma.user.findUnique({ where: { email: 'asm@leapfrog.com' } })
  const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
  const shopManagerUser2 = await prisma.user.findUnique({ where: { email: 'shop.manager2@leapfrog.com' } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
  const auditorUser = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
  const financeDirUser = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
  const financePayrollUser = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })
  const distHeadUser = await prisma.user.findUnique({ where: { email: 'distribution.head@leapfrog.com' } })
  const ebuHeadUser = await prisma.user.findUnique({ where: { email: 'ebu.head@leapfrog.com' } })

  const shopThu = await prisma.location.findUnique({ where: { code: 'SHOP_THU' } })
  const shopLio = await prisma.location.findUnique({ where: { code: 'SHOP_LIO' } })
  const shopWar = await prisma.location.findUnique({ where: { code: 'SHOP_WAR' } })

  const shopManagerEmp = await prisma.employee.findFirst({ where: { email: 'shop.manager@leapfrog.com' } })

  // ─── Permissions ─────────────────────────────────────────────────────────
  console.log('[Permissions]')

  // SUPER_ADMIN: all 10
  await checkPerms(adminUser?.id, 'SUPER_ADMIN', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true,
    'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': true,
    'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': true,
    'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': true,
  })

  // HR_ADMIN: all 10
  await checkPerms(hrAdminUser?.id, 'HR_ADMIN', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true,
    'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': true,
    'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': true,
    'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': true,
  })

  // SALES_HEAD: view, createPeriod, updatePeriod, inputSales, inputAll, calculate, export, sendToPayroll (NOT inputDistribution, inputEbu)
  await checkPerms(salesHeadUser?.id, 'SALES_HEAD', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': true,
    'shopManagerIncentive.updatePeriod': true,
    'shopManagerIncentive.inputSales': true,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': true,
    'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': true,
  })

  // DISTRIBUTION_HEAD: view, inputDistribution, export (NOT createPeriod, inputSales, inputEbu, calculate, sendToPayroll)
  await checkPerms(distHeadUser?.id, 'DISTRIBUTION_HEAD', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': true,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // EBU_HEAD: view, inputEbu, export (NOT inputSales, inputDistribution, createPeriod, calculate)
  await checkPerms(ebuHeadUser?.id, 'EBU_HEAD', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': true,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // FINANCE_DIRECTOR: view, calculate, export, sendToPayroll
  await checkPerms(financeDirUser?.id, 'FINANCE_DIRECTOR', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': true,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': true,
  })

  // FINANCE_PAYROLL: view, export, sendToPayroll
  await checkPerms(financePayrollUser?.id, 'FINANCE_PAYROLL', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': true,
  })

  // ASM: view only
  await checkPerms(asmUser?.id, 'ASM', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // SHOP_MANAGER: view only
  await checkPerms(shopManagerUser?.id, 'SHOP_MANAGER', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // AUDITOR: view, export
  await checkPerms(auditorUser?.id, 'AUDITOR', {
    'shopManagerIncentive.view': true,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': true,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // EMPLOYEE: none
  await checkPerms(empUser?.id, 'EMPLOYEE', {
    'shopManagerIncentive.view': false,
    'shopManagerIncentive.createPeriod': false,
    'shopManagerIncentive.updatePeriod': false,
    'shopManagerIncentive.inputSales': false,
    'shopManagerIncentive.inputDistribution': false,
    'shopManagerIncentive.inputEbu': false,
    'shopManagerIncentive.inputAll': false,
    'shopManagerIncentive.calculate': false,
    'shopManagerIncentive.export': false,
    'shopManagerIncentive.sendToPayroll': false,
  })

  // ─── Shop Criteria Validation ────────────────────────────────────────────
  console.log('\n[Shop Criteria Validation]')

  assert('validateShopCriteria(\'Gold\') returns GOLD', async () => validateShopCriteria('Gold') === 'GOLD')
  assert('validateShopCriteria(\'At-risk\') returns AT_RISK', async () => validateShopCriteria('At-risk') === 'AT_RISK')
  assert('validateShopCriteria(\'Unassigned\') throws error', async () => {
    try { validateShopCriteria('Unassigned'); return false }
    catch { return true }
  })
  assert('validateShopCriteria(\'INVALID\') throws error', async () => {
    try { validateShopCriteria('INVALID'); return false }
    catch { return true }
  })

  // ─── Incentive Period CRUD ──────────────────────────────────────────────
  console.log('\n[Incentive Period CRUD]')

  let testPeriodId: string | null = null
  let testPayrollPeriodId: string | null = null
  let testInputId: string | null = null

  if (adminUser) {
    const payrollPeriod = await prisma.payrollPeriod.create({
      data: {
        periodName: 'Test Period 4C2',
        periodStart: new Date('2026-07-01'),
        periodEnd: new Date('2026-07-31'),
        payDate: new Date('2026-08-05'),
        createdById: adminUser.id,
      },
    })
    testPayrollPeriodId = payrollPeriod.id
    cleanup.push(async () => { await prisma.payrollPeriod.delete({ where: { id: payrollPeriod.id } }).catch(() => {}) })

    const period = await prisma.shopManagerIncentivePeriod.create({
      data: {
        payrollPeriodId: payrollPeriod.id,
        name: 'July 2026 Test',
        month: 7,
        year: 2026,
        status: 'DRAFT',
        createdById: adminUser.id,
      },
    })
    testPeriodId = period.id
    cleanup.push(async () => { await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {}) })

    assert('can create incentive period with DRAFT status', async () => period.status === 'DRAFT' && !!period.id)

    const periods = await prisma.shopManagerIncentivePeriod.findMany()
    assert('can list periods', async () => periods.length > 0)

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id: period.id },
      data: { name: 'July 2026 Updated' },
    })
    assert('can update period name', async () => updated.name === 'July 2026 Updated')

    const opened = await prisma.shopManagerIncentivePeriod.update({
      where: { id: period.id },
      data: { status: 'OPEN' },
    })
    assert('can open period (DRAFT → OPEN)', async () => opened.status === 'OPEN')

    const cancelled = await prisma.shopManagerIncentivePeriod.update({
      where: { id: period.id },
      data: { status: 'CANCELLED' },
    })
    assert('can cancel period (OPEN → CANCELLED)', async () => cancelled.status === 'CANCELLED')

    // Clean up this period (will recreate for workflow tests)
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: payrollPeriod.id } }).catch(() => {})
    testPeriodId = null
    testPayrollPeriodId = null
  }

  // ─── Input CRUD ──────────────────────────────────────────────────────────
  console.log('\n[Input CRUD]')

  if (adminUser && shopThu && shopManagerEmp) {
    const pp = await prisma.payrollPeriod.create({
      data: {
        periodName: 'Input CRUD Period',
        periodStart: new Date('2026-08-01'),
        periodEnd: new Date('2026-08-31'),
        payDate: new Date('2026-09-05'),
        createdById: adminUser.id,
      },
    })
    cleanup.push(async () => { await prisma.payrollPeriod.delete({ where: { id: pp.id } }).catch(() => {}) })

    const period = await prisma.shopManagerIncentivePeriod.create({
      data: {
        payrollPeriodId: pp.id,
        name: 'Input CRUD Test',
        month: 8,
        year: 2026,
        status: 'OPEN',
        createdById: adminUser.id,
      },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {}) })

    const input = await prisma.shopManagerIncentiveInput.create({
      data: {
        incentivePeriodId: period.id,
        shopLocationId: shopThu.id,
        shopManagerId: shopManagerEmp.id,
        shopCriteria: 'GOLD',
        qgaAbove90: true,
        qgaQuantity: 150,
        mmQoAbove90: true,
        dsaAirtimeAchievementPercent: 85,
        corridorStatus: true,
        evdAbove100AndReconciled: true,
        mpesaTargetAndReconciled: true,
        mpesaFloatSold: 50000,
        baSite: true,
        ebuTargetAchieved: true,
        ebuRevenueMade: true,
        ebuAverageTopupAbove500: true,
        ebuFirstMonthLfRevenue: 75000,
        createdById: adminUser.id,
      },
    })
    testInputId = input.id
    cleanup.push(async () => { await prisma.shopManagerIncentiveInput.delete({ where: { id: input.id } }).catch(() => {}) })

    assert('create input with valid shop location, shop criteria, sales fields', async () => {
      return input.shopCriteria === 'GOLD' && input.qgaAbove90 === true && input.qgaQuantity === 150
    })

    // At-risk input
    const atRiskInput = await prisma.shopManagerIncentiveInput.create({
      data: {
        incentivePeriodId: period.id,
        shopLocationId: shopLio?.id || shopThu.id,
        shopCriteria: 'AT_RISK',
        qgaAbove90: true,
        qgaQuantity: 100,
        createdById: adminUser.id,
      },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentiveInput.delete({ where: { id: atRiskInput.id } }).catch(() => {}) })
    assert('create input with At-risk criteria stores other fields', async () => {
      return atRiskInput.shopCriteria === 'AT_RISK' && atRiskInput.qgaAbove90 === true && atRiskInput.qgaQuantity === 100
    })

    // Update input
    const updatedInput = await prisma.shopManagerIncentiveInput.update({
      where: { id: input.id },
      data: { qgaQuantity: 200, responsibleRemarks: 'Updated for testing' },
    })
    assert('update input fields', async () => updatedInput.qgaQuantity === 200 && updatedInput.responsibleRemarks === 'Updated for testing')

    // Unique constraint on (incentivePeriodId, shopLocationId)
    try {
      await prisma.shopManagerIncentiveInput.create({
        data: {
          incentivePeriodId: period.id,
          shopLocationId: shopThu.id,
          shopManagerId: shopManagerEmp.id,
          shopCriteria: 'SILVER',
          createdById: adminUser.id,
        },
      })
      assert('unique constraint on incentivePeriodId + shopLocationId', async () => false)
    } catch {
      assert('unique constraint on incentivePeriodId + shopLocationId', async () => true)
    }

    // Clean up for workflow tests
    await prisma.shopManagerIncentiveInput.deleteMany({ where: { incentivePeriodId: period.id } }).catch(() => {})
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: pp.id } }).catch(() => {})
    testInputId = null
  }

  // ─── Calculation Rules ───────────────────────────────────────────────────
  console.log('\n[Calculation Rules - QGA Bonus]')

  assert('GOLD + qgaAbove90=true → qgaBonus = 5000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaBonus === 5000
  })
  assert('SILVER + qgaAbove90=true → qgaBonus = 3000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaBonus === 3000
  })
  assert('BRONZE + qgaAbove90=true → qgaBonus = 1500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaBonus === 1500
  })
  assert('qgaAbove90=false → qgaBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: false, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaBonus === 0
  })

  console.log('[Calculation Rules - QGA SIM Commission]')
  assert('GOLD + qgaAbove90=true + qgaQuantity=100 → qgaSimCommission = 150', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaSimCommission === 150
  })
  assert('SILVER + qgaAbove90=true + qgaQuantity=100 → qgaSimCommission = 100', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaSimCommission === 100
  })
  assert('BRONZE + qgaAbove90=true + qgaQuantity=100 → qgaSimCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaSimCommission === 0
  })
  assert('qgaAbove90=false → qgaSimCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: false, qgaQuantity: 100, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaSimCommission === 0
  })
  assert('qgaAbove90=true + qgaQuantity=null → qgaSimCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qgaSimCommission === 0
  })

  console.log('[Calculation Rules - EVD Bonus]')
  assert('GOLD + evdAbove100AndReconciled=true → evdBonus = 3000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.evdBonus === 3000
  })
  assert('SILVER + evdAbove100AndReconciled=true → evdBonus = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.evdBonus === 2000
  })
  assert('BRONZE + evdAbove100AndReconciled=true → evdBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.evdBonus === 0
  })
  assert('evdAbove100AndReconciled=false → evdBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: false, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.evdBonus === 0
  })

  console.log('[Calculation Rules - M-PESA Commission]')
  assert('GOLD + target=true + floatSold=100000 → mpesaCommission = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: true, mpesaFloatSold: 100000, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.mpesaCommission === 2000
  })
  assert('SILVER + target=true + floatSold=100000 → mpesaCommission = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: true, mpesaFloatSold: 100000, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.mpesaCommission === 2000
  })
  assert('BRONZE + target=true + floatSold=100000 → mpesaCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: true, mpesaFloatSold: 100000, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.mpesaCommission === 0
  })
  assert('mpesaTargetAndReconciled=false → mpesaCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: false, mpesaFloatSold: 100000, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.mpesaCommission === 0
  })
  assert('target=true + floatSold=null → mpesaCommission = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: true, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.mpesaCommission === 0
  })

  console.log('[Calculation Rules - BA/Site Bonus]')
  assert('GOLD + baSite=true → baSiteBonus = 4000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: true, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.baSiteBonus === 4000
  })
  assert('SILVER + baSite=true → baSiteBonus = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: true, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.baSiteBonus === 2000
  })
  assert('BRONZE + baSite=true → baSiteBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: true, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.baSiteBonus === 0
  })
  assert('baSite=false → baSiteBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: false, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.baSiteBonus === 0
  })

  console.log('[Calculation Rules - DSA Achievement Bonus]')
  assert('dsaAirtimeAchievementPercent > 90 → dsaAchievementBonus = 2000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 95, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 2000
  })
  assert('dsa 60-89% → dsaAchievementBonus = 1500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 75, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1500
  })
  assert('dsa 50-59% → dsaAchievementBonus = 1000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 55, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 1000
  })
  assert('dsa < 50% → dsaAchievementBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: 30, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 0
  })
  assert('dsa null → dsaAchievementBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.dsaAchievementBonus === 0
  })

  console.log('[Calculation Rules - QO Bonus]')
  assert('mmQoAbove90=true → qoBonus = 4000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: true, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qoBonus === 4000
  })
  assert('mmQoAbove90=false → qoBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: false, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.qoBonus === 0
  })

  console.log('[Calculation Rules - EBU Activation Bonus]')
  assert('GOLD + all 3 EBU conditions → ebuActivationBonus = 3000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 3000
  })
  assert('SILVER + all 3 EBU conditions → ebuActivationBonus = 1500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 1500
  })
  assert('BRONZE + all 3 EBU conditions → ebuActivationBonus = 500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 500
  })
  assert('ebuTargetAchieved=false → ebuActivationBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: false, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })
  assert('ebuRevenueMade=false → ebuActivationBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: false, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })
  assert('ebuAverageTopupAbove500=false → ebuActivationBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: false, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })
  assert('all 3 EBU conditions null → ebuActivationBonus = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.ebuActivationBonus === 0
  })

  console.log('[Calculation Rules - EBU Revenue Share]')
  assert('GOLD + revenue=true + firstMonthLF=100000 → ebuRevenueShare = 25000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 100000 })
    return r.ebuRevenueShare === 25000
  })
  assert('SILVER + revenue=true + firstMonthLF=100000 → ebuRevenueShare = 15000', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'SILVER', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 100000 })
    return r.ebuRevenueShare === 15000
  })
  assert('BRONZE + revenue=true + firstMonthLF=100000 → ebuRevenueShare = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'BRONZE', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 100000 })
    return r.ebuRevenueShare === 0
  })
  assert('ebuRevenueMade=false → ebuRevenueShare = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: false, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 100000 })
    return r.ebuRevenueShare === 0
  })
  assert('firstMonthLF=null → ebuRevenueShare = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.ebuRevenueShare === 0
  })
  assert('GOLD + revenue=true + firstMonthLF=50000 → ebuRevenueShare = 12500', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 50000 })
    return r.ebuRevenueShare === 12500
  })
  assert('GOLD + revenue=true + firstMonthLF=75000 → ebuRevenueShare = 18750', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'GOLD', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: true, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: 75000 })
    return r.ebuRevenueShare === 18750
  })

  // ─── Calculation Rules - AT_RISK ─────────────────────────────────────────
  console.log('[Calculation Rules - AT_RISK]')
  assert('AT_RISK all components = 0', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'AT_RISK', qgaAbove90: true, qgaQuantity: 100, mmQoAbove90: true, dsaAirtimeAchievementPercent: 95, corridorStatus: true, evdAbove100AndReconciled: true, mpesaTargetAndReconciled: true, mpesaFloatSold: 100000, baSite: true, ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 100000 })
    return r.qgaBonus === 0 && r.qgaSimCommission === 0 && r.evdBonus === 0 && r.mpesaCommission === 0 && r.baSiteBonus === 0 && r.dsaAchievementBonus === 0 && r.qoBonus === 0 && r.ebuActivationBonus === 0 && r.ebuRevenueShare === 0 && r.totalIncentive === 0
  })
  assert('AT_RISK calculation note', async () => {
    const r = calculateShopManagerIncentive({ shopCriteria: 'AT_RISK', qgaAbove90: null, qgaQuantity: null, mmQoAbove90: null, dsaAirtimeAchievementPercent: null, corridorStatus: null, evdAbove100AndReconciled: null, mpesaTargetAndReconciled: null, mpesaFloatSold: null, baSite: null, ebuTargetAchieved: null, ebuRevenueMade: null, ebuAverageTopupAbove500: null, ebuFirstMonthLfRevenue: null })
    return r.calculationNote === 'At-risk shop: all incentive components are zero.'
  })

  // ─── Calculation Rules - Total ───────────────────────────────────────────
  console.log('[Calculation Rules - Total]')
  assert('total = sum of all 9 components (GOLD, all positive)', async () => {
    const r = calculateShopManagerIncentive({
      shopCriteria: 'GOLD', qgaAbove90: true, qgaQuantity: 100,
      corridorStatus: true,
      evdAbove100AndReconciled: true,
      mpesaTargetAndReconciled: true, mpesaFloatSold: 100000,
      baSite: true,
      dsaAirtimeAchievementPercent: 95,
      mmQoAbove90: true,
      ebuTargetAchieved: true, ebuRevenueMade: true, ebuAverageTopupAbove500: true, ebuFirstMonthLfRevenue: 100000,
    })
    // 5000 + 150 + 3000 + 2000 + 4000 + 2000 + 4000 + 3000 + 25000 = 48150
    return r.totalIncentive === 48150
  })

  // ─── Workflow ────────────────────────────────────────────────────────────
  console.log('\n[Workflow]')

  if (adminUser && shopThu && shopManagerEmp) {
    const wfPayrollPeriod = await prisma.payrollPeriod.create({
      data: {
        periodName: 'Workflow Test Period',
        periodStart: new Date('2026-09-01'),
        periodEnd: new Date('2026-09-30'),
        payDate: new Date('2026-10-05'),
        createdById: adminUser.id,
      },
    })

    const wfPeriod = await prisma.shopManagerIncentivePeriod.create({
      data: {
        payrollPeriodId: wfPayrollPeriod.id,
        name: 'Workflow Test Sep 2026',
        month: 9,
        year: 2026,
        status: 'DRAFT',
        createdById: adminUser.id,
      },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentivePeriod.delete({ where: { id: wfPeriod.id } }).catch(() => {}) })
    cleanup.push(async () => { await prisma.payrollPeriod.delete({ where: { id: wfPayrollPeriod.id } }).catch(() => {}) })

    assert('workflow: create period with DRAFT', async () => wfPeriod.status === 'DRAFT')

    await prisma.shopManagerIncentivePeriod.update({ where: { id: wfPeriod.id }, data: { status: 'OPEN' } })
    assert('workflow: open period (DRAFT → OPEN)', async () => {
      const p = await prisma.shopManagerIncentivePeriod.findUnique({ where: { id: wfPeriod.id } })
      return p?.status === 'OPEN'
    })

    const wfInput = await prisma.shopManagerIncentiveInput.create({
      data: {
        incentivePeriodId: wfPeriod.id,
        shopLocationId: shopThu.id,
        shopManagerId: shopManagerEmp.id,
        shopCriteria: 'GOLD',
        qgaAbove90: true,
        qgaQuantity: 100,
        mmQoAbove90: true,
        dsaAirtimeAchievementPercent: 95,
        corridorStatus: true,
        evdAbove100AndReconciled: true,
        mpesaTargetAndReconciled: true,
        mpesaFloatSold: 100000,
        baSite: true,
        ebuTargetAchieved: true,
        ebuRevenueMade: true,
        ebuAverageTopupAbove500: true,
        ebuFirstMonthLfRevenue: 100000,
        createdById: adminUser.id,
      },
    })
    cleanup.push(async () => { await prisma.shopManagerIncentiveInput.delete({ where: { id: wfInput.id } }).catch(() => {}) })
    assert('workflow: create input', async () => !!wfInput.id)

    // Calculate
    const calcResult = await calculateAllShopManagerIncentives(wfPeriod.id)
    assert('workflow: calculate produces results', async () => calcResult.calculations.length > 0)
    assert('workflow: calculate sets status to CALCULATED', async () => calcResult.status === 'CALCULATED')

    const calcRecords = await prisma.shopManagerIncentiveCalculation.findMany({ where: { incentivePeriodId: wfPeriod.id } })
    assert('workflow: calculation records exist', async () => calcRecords.length > 0)
    cleanup.push(async () => { await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: wfPeriod.id } }).catch(() => {}) })

    // Verify component values in calculation
    const calc = calcRecords[0]
    assert('workflow: qgaBonus stored correctly', async () => Number(calc.qgaBonus) === 5000)
    assert('workflow: qgaSimCommission stored correctly', async () => Number(calc.qgaSimCommission) === 150)
    assert('workflow: totalIncentive stored correctly', async () => Number(calc.totalIncentive) === 48150)

    // Send to payroll
    const payrollResult = await sendIncentivesToPayrollInputs(wfPeriod.id)
    assert('workflow: sendToPayroll processes calculations', async () => payrollResult.calculationsProcessed > 0)

    const payrollInputs = await prisma.payrollInput.findMany({
      where: { payrollPeriodId: wfPayrollPeriod.id, employeeId: shopManagerEmp.id },
    })
    assert('workflow: payroll input records exist', async () => payrollInputs.length > 0)
    cleanup.push(async () => { await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: wfPayrollPeriod.id } }).catch(() => {}) })

    // Cleanup workflow data
    await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: wfPeriod.id } }).catch(() => {})
    await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: wfPayrollPeriod.id } }).catch(() => {})
    await prisma.shopManagerIncentiveInput.deleteMany({ where: { incentivePeriodId: wfPeriod.id } }).catch(() => {})
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: wfPeriod.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: wfPayrollPeriod.id } }).catch(() => {})
  }

  // ─── Regression ──────────────────────────────────────────────────────────
  console.log('\n[Regression]')

  const employeesExist = await prisma.employee.count()
  assert('Phase 4C.1 shop setup still works', async () => {
    const shops = await prisma.location.count({ where: { type: 'SHOP' } })
    return shops > 0
  })
  assert('employee registration still works', async () => employeesExist > 0)

  // ─── Results ─────────────────────────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log(`Failed: ${errors.join(', ')}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
}).finally(async () => {
  for (const fn of cleanup.reverse()) {
    try { await fn() } catch {}
  }
  await prisma.$disconnect()
})
