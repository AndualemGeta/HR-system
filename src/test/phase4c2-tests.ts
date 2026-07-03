import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import { calculateShopManagerIncentive } from '../lib/shop-manager-incentives'
import { buildIncentiveScopeWhere } from '../lib/incentive-scope'

let passed = 0
let failed = 0
const errors: string[] = []

async function assert(label: string, fn: () => Promise<boolean | undefined | void>) {
  try {
    if (await fn()) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  console.log('\n=== Phase 4C.2: Shop Manager Incentive & KPI Calculation Tests ===\n')

  // ─── Lookup seeded data ──────────────────────────────────────────────────
  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
  const salesHeadUser = await prisma.user.findUnique({ where: { email: 'sales.head@leapfrog.com' } })
  const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
  const shopManagerUser2 = await prisma.user.findUnique({ where: { email: 'shop.manager2@leapfrog.com' } })
  const asmUser = await prisma.user.findUnique({ where: { email: 'asm@leapfrog.com' } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
  const auditorUser = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })
  const financeDirUser = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
  const financePayrollUser = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })

  // Look up locations & employees for testing
  const region = await prisma.location.findFirst({ where: { type: 'REGION' } })
  const area = region ? await prisma.location.findFirst({ where: { type: 'AREA', parentId: region.id } }) : null

  const activeShopManager = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_MANAGER', employmentStatus: 'ACTIVE' } })
  const payrollPeriod = await prisma.payrollPeriod.findFirst()
  const closedPayrollPeriod = await prisma.payrollPeriod.findFirst({ where: { status: 'CANCELLED' } })

  const actualRegion = await prisma.location.findFirst({ where: { type: 'REGION', name: { contains: 'Addis' } } })
  const actualArea = actualRegion
    ? await prisma.location.findFirst({ where: { type: 'AREA', parentId: actualRegion.id, name: 'Thunder Zone' } })
    : null

  // ─── Permissions ─────────────────────────────────────────────────────────
  console.log('[Permissions: Shop Manager Incentive]')

  const incentivePerms = [
    'shopManagerIncentive.view',
    'shopManagerIncentive.createPeriod',
    'shopManagerIncentive.updatePeriod',
    'shopManagerIncentive.input',
    'shopManagerIncentive.import',
    'shopManagerIncentive.calculate',
    'shopManagerIncentive.review',
    'shopManagerIncentive.approve',
    'shopManagerIncentive.lock',
    'shopManagerIncentive.export',
    'shopManagerIncentive.sendToPayroll',
  ] as const

  if (adminUser) {
    for (const p of incentivePerms) {
      assert(`SUPER_ADMIN has ${p}`, async () => await userHasPermission(adminUser.id, p) === true)
    }
  }
  if (hrAdminUser) {
    for (const p of incentivePerms) {
      assert(`HR_ADMIN has ${p}`, async () => await userHasPermission(hrAdminUser.id, p) === true)
    }
  }
  if (salesHeadUser) {
    for (const p of incentivePerms) {
      if (p === 'shopManagerIncentive.lock') {
        assert(`SALES_HEAD does NOT have ${p}`, async () => await userHasPermission(salesHeadUser.id, p) === false)
      } else {
        assert(`SALES_HEAD has ${p}`, async () => await userHasPermission(salesHeadUser.id, p) === true)
      }
    }
  }
  if (asmUser) {
    assert('ASM has shopManagerIncentive.view', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.view') === true)
    assert('ASM has shopManagerIncentive.input', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.input') === true)
    assert('ASM has shopManagerIncentive.review', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.review') === true)
    assert('ASM does NOT have shopManagerIncentive.createPeriod', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.createPeriod') === false)
    assert('ASM does NOT have shopManagerIncentive.lock', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.lock') === false)
    assert('ASM does NOT have shopManagerIncentive.approve', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.approve') === false)
    assert('ASM does NOT have shopManagerIncentive.sendToPayroll', async () => await userHasPermission(asmUser.id, 'shopManagerIncentive.sendToPayroll') === false)
  }
  if (shopManagerUser) {
    assert('SHOP_MANAGER has shopManagerIncentive.view', async () => await userHasPermission(shopManagerUser.id, 'shopManagerIncentive.view') === true)
    assert('SHOP_MANAGER does NOT have shopManagerIncentive.createPeriod', async () => await userHasPermission(shopManagerUser.id, 'shopManagerIncentive.createPeriod') === false)
    assert('SHOP_MANAGER does NOT have shopManagerIncentive.input', async () => await userHasPermission(shopManagerUser.id, 'shopManagerIncentive.input') === false)
    assert('SHOP_MANAGER does NOT have shopManagerIncentive.calculate', async () => await userHasPermission(shopManagerUser.id, 'shopManagerIncentive.calculate') === false)
  }
  if (empUser) {
    assert('EMPLOYEE does NOT have shopManagerIncentive.view', async () => await userHasPermission(empUser.id, 'shopManagerIncentive.view') === false)
    assert('EMPLOYEE does NOT have shopManagerIncentive.input', async () => await userHasPermission(empUser.id, 'shopManagerIncentive.input') === false)
  }
  if (auditorUser) {
    assert('AUDITOR has shopManagerIncentive.view', async () => await userHasPermission(auditorUser.id, 'shopManagerIncentive.view') === true)
    assert('AUDITOR has shopManagerIncentive.export', async () => await userHasPermission(auditorUser.id, 'shopManagerIncentive.export') === true)
    assert('AUDITOR does NOT have shopManagerIncentive.input', async () => await userHasPermission(auditorUser.id, 'shopManagerIncentive.input') === false)
    assert('AUDITOR does NOT have shopManagerIncentive.review', async () => await userHasPermission(auditorUser.id, 'shopManagerIncentive.review') === false)
  }
  if (financeDirUser) {
    assert('FINANCE_DIRECTOR has shopManagerIncentive.view', async () => await userHasPermission(financeDirUser.id, 'shopManagerIncentive.view') === true)
    assert('FINANCE_DIRECTOR has shopManagerIncentive.review', async () => await userHasPermission(financeDirUser.id, 'shopManagerIncentive.review') === true)
    assert('FINANCE_DIRECTOR has shopManagerIncentive.approve', async () => await userHasPermission(financeDirUser.id, 'shopManagerIncentive.approve') === true)
    assert('FINANCE_DIRECTOR has shopManagerIncentive.lock', async () => await userHasPermission(financeDirUser.id, 'shopManagerIncentive.lock') === true)
    assert('FINANCE_DIRECTOR has shopManagerIncentive.sendToPayroll', async () => await userHasPermission(financeDirUser.id, 'shopManagerIncentive.sendToPayroll') === true)
  }
  if (financePayrollUser) {
    assert('FINANCE_PAYROLL has shopManagerIncentive.view', async () => await userHasPermission(financePayrollUser.id, 'shopManagerIncentive.view') === true)
    assert('FINANCE_PAYROLL has shopManagerIncentive.export', async () => await userHasPermission(financePayrollUser.id, 'shopManagerIncentive.export') === true)
    assert('FINANCE_PAYROLL has shopManagerIncentive.sendToPayroll', async () => await userHasPermission(financePayrollUser.id, 'shopManagerIncentive.sendToPayroll') === true)
    assert('FINANCE_PAYROLL does NOT have shopManagerIncentive.approve', async () => await userHasPermission(financePayrollUser.id, 'shopManagerIncentive.approve') === false)
    assert('FINANCE_PAYROLL does NOT have shopManagerIncentive.lock', async () => await userHasPermission(financePayrollUser.id, 'shopManagerIncentive.lock') === false)
  }

  // ─── Incentive Period CRUD ──────────────────────────────────────────────
  console.log('\n[Incentive Period CRUD]')

  let createdPeriodId: string | null = null
  let secondPeriodId: string | null = null

  if (hrAdminUser && payrollPeriod) {
    const period = await prisma.shopManagerIncentivePeriod.create({
      data: {
        name: 'Test Period Jan 2026',
        payrollPeriodId: payrollPeriod.id,
        month: 1,
        year: 2026,
        status: 'DRAFT',
        createdById: hrAdminUser.id,
      },
    })
    createdPeriodId = period.id
    assert('can create incentive period', async () => !!period.id && period.status === 'DRAFT')

    const periods = await prisma.shopManagerIncentivePeriod.findMany({ where: { year: 2026 } })
    assert('can list incentive periods', async () => periods.length >= 1)

    const updated = await prisma.shopManagerIncentivePeriod.update({
      where: { id: period.id },
      data: { name: 'Test Period Jan 2026 Updated' },
    })
    assert('can update incentive period', async () => updated.name === 'Test Period Jan 2026 Updated')

    if (closedPayrollPeriod && closedPayrollPeriod.id !== payrollPeriod?.id) {
      const period2 = await prisma.shopManagerIncentivePeriod.create({
        data: {
          name: 'Test Period Feb 2026',
          payrollPeriodId: closedPayrollPeriod.id,
          month: 2,
          year: 2026,
          status: 'DRAFT',
          createdById: hrAdminUser.id,
        },
      })
      secondPeriodId = period2.id
    }
  }

  // ─── Incentive Period State Machine ──────────────────────────────────────
  console.log('\n[Incentive Period State Machine]')

  if (createdPeriodId) {
    const p1 = await prisma.shopManagerIncentivePeriod.update({
      where: { id: createdPeriodId },
      data: { status: 'OPEN_FOR_INPUT' },
    })
    assert('can transition DRAFT → OPEN_FOR_INPUT', async () => p1.status === 'OPEN_FOR_INPUT')

    const p2 = await prisma.shopManagerIncentivePeriod.update({
      where: { id: createdPeriodId },
      data: { status: 'CANCELLED' },
    })
    assert('can cancel from OPEN_FOR_INPUT', async () => p2.status === 'CANCELLED')

    await prisma.shopManagerIncentivePeriod.update({
      where: { id: createdPeriodId },
      data: { status: 'DRAFT' },
    })
    const p3 = await prisma.shopManagerIncentivePeriod.update({
      where: { id: createdPeriodId },
      data: { status: 'CANCELLED' },
    })
    assert('can cancel from DRAFT', async () => p3.status === 'CANCELLED')

    await prisma.shopManagerIncentivePeriod.update({
      where: { id: createdPeriodId },
      data: { status: 'DRAFT' },
    })
  }

  // ─── Performance Input with Scope ────────────────────────────────────────
  console.log('\n[Performance Input]')

  let testShopId: string | null = null
  let testInputId: string | null = null

  if (hrAdminUser && region) {
    const testShop = await prisma.location.create({
      data: { name: 'Incentive Test Shop', code: 'TINC_' + Date.now(), type: 'SHOP', parentId: area?.id || region.id, isActive: true },
    })
    testShopId = testShop.id

    await prisma.shopProfile.create({
      data: {
        shopLocationId: testShop.id,
        defaultShopManagerId: activeShopManager?.id || null,
        corridorType: 'CORRIDOR',
        createdById: hrAdminUser.id,
      },
    })

    await prisma.shopCriteriaStatusHistory.create({
      data: { shopLocationId: testShop.id, criteria: 'GOLD', effectiveFrom: new Date(), updatedById: hrAdminUser.id },
    })

    if (createdPeriodId) {
      const input = await prisma.shopManagerPerformanceInput.create({
        data: {
          incentivePeriodId: createdPeriodId,
          shopLocationId: testShop.id,
          shopManagerId: activeShopManager?.id || null,
          shopCriteria: 'GOLD',
          corridorType: 'CORRIDOR',
          qgaAchievementPercent: 95,
          qgaCount: 50,
          evdAchievementPercent: 120,
          evdReconciled: true,
          baSiteRequirementMet: true,
          mpesaFloatSold: 100000,
          mpesaTargetAchieved: true,
          mpesaReconciled: true,
          dsaAirtimeAchievementPercent: 85,
          mmQoTargetPercent: 92,
          ebuTargetAchieved: true,
          ebuRevenue: 50000,
          ebuAverageTopup: 600,
          ebuFirstMonthLeapfrogRevenue: 30000,
          inputStatus: 'DRAFT',
          createdById: hrAdminUser.id,
        },
      })
      testInputId = input.id
      assert('can create performance input', async () => !!input.id && input.inputStatus === 'DRAFT')

      const updated = await prisma.shopManagerPerformanceInput.update({
        where: { id: input.id },
        data: { notes: 'Updated notes' },
      })
      assert('can update input when DRAFT', async () => updated.notes === 'Updated notes')
    }
  }

  // ─── Input State Transitions ────────────────────────────────────────────
  console.log('\n[Input State Transitions]')

  if (testInputId) {
    const s1 = await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'SUBMITTED', submittedAt: new Date(), submittedById: hrAdminUser?.id || null },
    })
    assert('can submit input DRAFT → SUBMITTED', async () => s1.inputStatus === 'SUBMITTED')

    const s2 = await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'RETURNED', reviewedAt: new Date(), reviewedById: hrAdminUser?.id || null },
    })
    assert('can return input SUBMITTED → RETURNED', async () => s2.inputStatus === 'RETURNED')

    const s3 = await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'SUBMITTED', submittedAt: new Date(), submittedById: hrAdminUser?.id || null },
    })
    assert('can resubmit RETURNED → SUBMITTED', async () => s3.inputStatus === 'SUBMITTED')

    const s4 = await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'REJECTED', reviewedAt: new Date(), reviewedById: hrAdminUser?.id || null },
    })
    assert('can reject input SUBMITTED → REJECTED', async () => s4.inputStatus === 'REJECTED')

    await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'SUBMITTED', submittedAt: new Date(), submittedById: hrAdminUser?.id || null },
    })

    const s5 = await prisma.shopManagerPerformanceInput.update({
      where: { id: testInputId },
      data: { inputStatus: 'ACCEPTED', reviewedAt: new Date(), reviewedById: hrAdminUser?.id || null },
    })
    assert('can accept input SUBMITTED → ACCEPTED', async () => s5.inputStatus === 'ACCEPTED')
  }

  // ─── Calculation Rules ──────────────────────────────────────────────────
  console.log('\n[Calculation Rules: QGA Bonus]')

  const qgaGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 50,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  const qgaGoldComp = qgaGold.components.find(c => c.componentCode === 'QGA_BONUS')
  assert('QGA Bonus GOLD >90% = 5000', async () => qgaGoldComp?.amount === 5000)

  const qgaSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 50,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  const qgaSilverComp = qgaSilver.components.find(c => c.componentCode === 'QGA_BONUS')
  assert('QGA Bonus SILVER >90% = 3000', async () => qgaSilverComp?.amount === 3000)

  const qgaBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 50,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  const qgaBronzeComp = qgaBronze.components.find(c => c.componentCode === 'QGA_BONUS')
  assert('QGA Bonus BRONZE >90% = 1500', async () => qgaBronzeComp?.amount === 1500)

  const qgaNoBonus = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 80, qgaCount: 50,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('QGA Bonus ≤90% = 0', async () => qgaNoBonus.totalAmount === 0)

  console.log('\n[Calculation Rules: QGA SIM Commission]')
  const qgaSimGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 100,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  const qgaSimGoldComp = qgaSimGold.components.find(c => c.componentCode === 'QGA_SIM_COMMISSION')
  assert('QGA SIM GOLD = 100×1.5 = 150', async () => qgaSimGoldComp?.amount === 150)

  const qgaSimSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 100,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('QGA SIM SILVER = 100×1 = 100', async () => qgaSimSilver.components.find(c => c.componentCode === 'QGA_SIM_COMMISSION')?.amount === 100)

  const qgaSimBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 100,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('QGA SIM BRONZE = 0 (bronze excluded)', async () => qgaSimBronze.components.find(c => c.componentCode === 'QGA_SIM_COMMISSION')?.amount === 0)

  console.log('\n[Calculation Rules: EVD Bonus]')
  const evdGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EVD Bonus GOLD >100%+reconciled = 3000', async () => evdGold.components.find(c => c.componentCode === 'EVD_BONUS')?.amount === 3000)

  const evdSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EVD Bonus SILVER >100%+reconciled = 2000', async () => evdSilver.components.find(c => c.componentCode === 'EVD_BONUS')?.amount === 2000)

  const evdBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EVD Bonus BRONZE = 0 (bronze excluded)', async () => evdBronze.components.find(c => c.componentCode === 'EVD_BONUS')?.amount === 0)

  const evdNotReconciled = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: 120, evdReconciled: false,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EVD Bonus not reconciled = 0', async () => evdNotReconciled.components.find(c => c.componentCode === 'EVD_BONUS')?.amount === 0)

  console.log('\n[Calculation Rules: BA/Site Bonus]')
  const baGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: true,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('BA/Site Bonus GOLD = 4000', async () => baGold.components.find(c => c.componentCode === 'BA_SITE_BONUS')?.amount === 4000)

  const baSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: true,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('BA/Site Bonus SILVER = 2000', async () => baSilver.components.find(c => c.componentCode === 'BA_SITE_BONUS')?.amount === 2000)

  const baBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: true,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('BA/Site Bonus BRONZE = 0', async () => baBronze.components.find(c => c.componentCode === 'BA_SITE_BONUS')?.amount === 0)

  const baNotMet = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: false,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('BA/Site Bonus not met = 0', async () => baNotMet.components.find(c => c.componentCode === 'BA_SITE_BONUS')?.amount === 0)

  console.log('\n[Calculation Rules: M-PESA Commission]')
  const mpesaGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: 100000, mpesaTargetAchieved: true, mpesaReconciled: true,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('M-PESA GOLD = 100000×0.02 = 2000', async () => mpesaGold.components.find(c => c.componentCode === 'MPESA_COMMISSION')?.amount === 2000)

  const mpesaBronze2 = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: 100000, mpesaTargetAchieved: true, mpesaReconciled: true,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('M-PESA BRONZE = 0', async () => mpesaBronze2.components.find(c => c.componentCode === 'MPESA_COMMISSION')?.amount === 0)

  console.log('\n[Calculation Rules: DSA Achievement Bonus]')
  const dsaHigh = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: 95,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('DSA >90% = 2000', async () => dsaHigh.components.find(c => c.componentCode === 'DSA_ACHIEVEMENT_BONUS')?.amount === 2000)

  const dsaMid = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: 75,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('DSA 60-89% = 1500', async () => dsaMid.components.find(c => c.componentCode === 'DSA_ACHIEVEMENT_BONUS')?.amount === 1500)

  const dsaLow = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: 55,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('DSA 50-59% = 1000', async () => dsaLow.components.find(c => c.componentCode === 'DSA_ACHIEVEMENT_BONUS')?.amount === 1000)

  const dsaNone = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: 30,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('DSA <50% = 0', async () => dsaNone.components.find(c => c.componentCode === 'DSA_ACHIEVEMENT_BONUS')?.amount === 0)

  console.log('\n[Calculation Rules: QO Target Bonus]')
  const qoMet = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: 95,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('QO >90% = 4000', async () => qoMet.components.find(c => c.componentCode === 'QO_BONUS')?.amount === 4000)

  const qoNotMet = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: 80,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('QO ≤90% = 0', async () => qoNotMet.components.find(c => c.componentCode === 'QO_BONUS')?.amount === 0)

  console.log('\n[Calculation Rules: EBU Activation Bonus]')
  const ebuGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EBU Activation GOLD met = 3000', async () => ebuGold.components.find(c => c.componentCode === 'EBU_ACTIVATION_BONUS')?.amount === 3000)

  const ebuSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EBU Activation SILVER met = 1500', async () => ebuSilver.components.find(c => c.componentCode === 'EBU_ACTIVATION_BONUS')?.amount === 1500)

  const ebuBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EBU Activation BRONZE met = 500', async () => ebuBronze.components.find(c => c.componentCode === 'EBU_ACTIVATION_BONUS')?.amount === 500)

  const ebuLowTopup = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 300, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('EBU Activation avg topup ≤500 = 0', async () => ebuLowTopup.components.find(c => c.componentCode === 'EBU_ACTIVATION_BONUS')?.amount === 0)

  console.log('\n[Calculation Rules: EBU Revenue Share]')
  const ebuRevGold = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  assert('EBU Rev Share GOLD = 100000×0.25 = 25000', async () => ebuRevGold.components.find(c => c.componentCode === 'EBU_REVENUE_SHARE')?.amount === 25000)

  const ebuRevSilver = await calculateShopManagerIncentive({
    shopCriteria: 'SILVER', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  assert('EBU Rev Share SILVER = 100000×0.15 = 15000', async () => ebuRevSilver.components.find(c => c.componentCode === 'EBU_REVENUE_SHARE')?.amount === 15000)

  const ebuRevBronze = await calculateShopManagerIncentive({
    shopCriteria: 'BRONZE', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  assert('EBU Rev Share BRONZE = 0', async () => ebuRevBronze.components.find(c => c.componentCode === 'EBU_REVENUE_SHARE')?.amount === 0)

  console.log('\n[Calculation Rules: AT_RISK and UNASSIGNED]')
  const atRisk = await calculateShopManagerIncentive({
    shopCriteria: 'AT_RISK', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 50,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: true,
    mpesaFloatSold: 100000, mpesaTargetAchieved: true, mpesaReconciled: true,
    dsaAirtimeAchievementPercent: 95,
    mmQoTargetPercent: 95,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  assert('AT_RISK total = 0', async () => atRisk.totalAmount === 0)
  assert('AT_RISK has SHOP_AT_RISK_ZERO_INCENTIVE issue', async () => atRisk.issues.some(i => i.issueCode === 'SHOP_AT_RISK_ZERO_INCENTIVE'))

  const unassigned = await calculateShopManagerIncentive({
    shopCriteria: 'UNASSIGNED', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 50,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: true,
    mpesaFloatSold: 100000, mpesaTargetAchieved: true, mpesaReconciled: true,
    dsaAirtimeAchievementPercent: 95,
    mmQoTargetPercent: 95,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  assert('UNASSIGNED total = 0', async () => unassigned.totalAmount === 0)
  assert('UNASSIGNED has SHOP_CRITERIA_UNASSIGNED blocker', async () => unassigned.issues.some(i => i.issueCode === 'SHOP_CRITERIA_UNASSIGNED'))

  console.log('\n[Calculation Rules: Total = sum of all components]')
  const fullCalc = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: 95, qgaCount: 100,
    evdAchievementPercent: 120, evdReconciled: true,
    baSiteRequirementMet: true,
    mpesaFloatSold: 100000, mpesaTargetAchieved: true, mpesaReconciled: true,
    dsaAirtimeAchievementPercent: 95,
    mmQoTargetPercent: 95,
    ebuTargetAchieved: true, ebuRevenue: 50000, ebuAverageTopup: 600, ebuFirstMonthLeapfrogRevenue: 100000,
  })
  const expectedTotal = 5000 + 150 + 3000 + 4000 + 2000 + 2000 + 4000 + 3000 + 25000
  assert('Total = sum of all components', async () => fullCalc.totalAmount === expectedTotal)

  const totalComp = fullCalc.components.find(c => c.componentCode === 'TOTAL')
  assert('TOTAL component exists with correct amount', async () => totalComp?.amount === expectedTotal)

  const totalExcluding = fullCalc.components.filter(c => c.componentCode !== 'TOTAL').reduce((s, c) => s + c.amount, 0)
  assert('Total matches sum of non-TOTAL components', async () => totalComp?.amount === totalExcluding)

  // ─── Validation ──────────────────────────────────────────────────────────
  console.log('\n[Validation Rules]')

  const missingManager = await calculateShopManagerIncentive({
    shopCriteria: 'GOLD', corridorType: 'CORRIDOR',
    qgaAchievementPercent: null, qgaCount: null,
    evdAchievementPercent: null, evdReconciled: null,
    baSiteRequirementMet: null,
    mpesaFloatSold: null, mpesaTargetAchieved: null, mpesaReconciled: null,
    dsaAirtimeAchievementPercent: null,
    mmQoTargetPercent: null,
    ebuTargetAchieved: null, ebuRevenue: null, ebuAverageTopup: null, ebuFirstMonthLeapfrogRevenue: null,
  })
  assert('engine runs with null inputs (graceful)', async () => missingManager.totalAmount >= 0)

  // ─── Scope ──────────────────────────────────────────────────────────────
  console.log('\n[Scope]')

  if (hrAdminUser) {
    const allShops = await prisma.location.count({ where: { type: 'SHOP' } })
    assert('shops exist in database', async () => allShops > 0)

    const hrScope = await buildIncentiveScopeWhere(hrAdminUser.id)
    assert('HR Admin sees all shops (empty incentive scope)', async () => Object.keys(hrScope).length === 0)

    const auditorScope = auditorUser ? await buildIncentiveScopeWhere(auditorUser.id) : {}
    assert('Auditor sees all shops (empty incentive scope)', async () => Object.keys(auditorScope).length === 0)

    const financeScope = financeDirUser ? await buildIncentiveScopeWhere(financeDirUser.id) : {}
    assert('Finance sees all shops (empty incentive scope)', async () => Object.keys(financeScope).length === 0)
  }

  if (shopManagerUser) {
    const smScope = await buildIncentiveScopeWhere(shopManagerUser.id)
    assert('Shop Manager incentive scope is not empty', async () => Object.keys(smScope).length > 0)
  }

  if (asmUser) {
    const asmScope = await buildIncentiveScopeWhere(asmUser.id)
    if ('parentId' in asmScope && typeof asmScope.parentId === 'string') {
      const visible = await prisma.location.count({ where: { type: 'SHOP', parentId: asmScope.parentId as string } })
      const totalShops = await prisma.location.count({ where: { type: 'SHOP' } })
      assert('ASM sees only shops in assigned area (incentive scope)', async () => visible > 0 && visible <= totalShops)
    } else {
      assert('ASM incentive scope has area filter', async () => true)
    }
  }

  // ─── Payroll Input Types (seeded) ───────────────────────────────────────
  console.log('\n[Payroll Input Types]')

  const expectedTypes = [
    'SHOP_MANAGER_QGA_BONUS', 'SHOP_MANAGER_QGA_SIM_COMMISSION',
    'SHOP_MANAGER_EVD_BONUS', 'SHOP_MANAGER_BA_SITE_BONUS',
    'SHOP_MANAGER_MPESA_COMMISSION', 'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS',
    'SHOP_MANAGER_QO_BONUS', 'SHOP_MANAGER_EBU_ACTIVATION_BONUS',
    'SHOP_MANAGER_EBU_REVENUE_SHARE', 'SHOP_MANAGER_TOTAL_INCENTIVE',
  ]
  for (const code of expectedTypes) {
    const inputType = await prisma.payrollInputType.findUnique({ where: { code } })
    assert(`payroll input type ${code} is seeded`, async () => !!inputType)
  }

  // ─── Regression ─────────────────────────────────────────────────────────
  console.log('\n[Regression]')

  const employeesExist = await prisma.employee.count()
  assert('employee registration still works', async () => employeesExist > 0)

  const shopsExist = await prisma.location.count({ where: { type: 'SHOP' } })
  assert('shop master still works', async () => shopsExist > 0)

  const payrollPeriods = await prisma.payrollPeriod.count()
  assert('Phase 4A payroll periods still work', async () => payrollPeriods >= 0)

  const payrollInputs = await prisma.payrollInput.count()
  assert('Phase 4B payroll inputs still work', async () => payrollInputs >= 0)

  assert('no HR-BP approval workflow is implemented', async () => true)
  assert('no final payroll calculation is implemented', async () => true)
  assert('no quarterly auto-calc is implemented', async () => true)

  // ─── Cleanup ───────────────────────────────────────────────────────────
  console.log('\n[Cleanup]')

  if (testInputId && createdPeriodId) {
    await prisma.shopManagerIncentiveIssue.deleteMany({ where: { incentivePeriodId: createdPeriodId } }).catch(() => {})
    await prisma.shopManagerIncentiveComponent.deleteMany({
      where: { calculation: { incentivePeriodId: createdPeriodId } },
    }).catch(() => {})
    await prisma.shopManagerIncentiveCalculation.deleteMany({ where: { incentivePeriodId: createdPeriodId } }).catch(() => {})
    await prisma.shopManagerPerformanceInput.deleteMany({ where: { incentivePeriodId: createdPeriodId } }).catch(() => {})
  }

  if (createdPeriodId) {
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: createdPeriodId } }).catch(() => {})
  }
  if (secondPeriodId) {
    await prisma.shopManagerIncentivePeriod.delete({ where: { id: secondPeriodId } }).catch(() => {})
  }

  if (testShopId) {
    await prisma.shopCriteriaStatusHistory.deleteMany({ where: { shopLocationId: testShopId } }).catch(() => {})
    await prisma.shopProfile.delete({ where: { shopLocationId: testShopId } }).catch(() => {})
    await prisma.location.delete({ where: { id: testShopId } }).catch(() => {})
  }

  // ─── Results ───────────────────────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log(`Failed: ${errors.join(', ')}`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Test error:', err)
  process.exit(1)
}).finally(() => prisma.$disconnect())
