import { prisma } from './prisma'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const ALLOWED_CRITERIA = ['GOLD', 'SILVER', 'BRONZE', 'AT_RISK']

export function validateShopCriteria(criteria: string): string {
  const upper = criteria.toUpperCase().replace('-', '_')
  if (ALLOWED_CRITERIA.includes(upper)) return upper
  throw new Error(`Invalid shop criteria: ${criteria}. Must be Gold, Silver, Bronze, or At-risk.`)
}

export function calculateShopManagerIncentive(input: {
  shopCriteria: string
  qgaAbove90: boolean | null
  qgaQuantity: number | null
  mmQoAbove90: boolean | null
  dsaAirtimeAchievementPercent: number | null
  corridorStatus: boolean | null
  evdAbove100AndReconciled: boolean | null
  mpesaTargetAndReconciled: boolean | null
  mpesaFloatSold: number | null
  baSite: boolean | null
  ebuTargetAchieved: boolean | null
  ebuRevenueMade: boolean | null
  ebuAverageTopupAbove500: boolean | null
  ebuFirstMonthLfRevenue: number | null
}): {
  qgaBonus: number
  qgaSimCommission: number
  evdBonus: number
  mpesaCommission: number
  baSiteBonus: number
  dsaAchievementBonus: number
  qoBonus: number
  ebuActivationBonus: number
  ebuRevenueShare: number
  totalIncentive: number
  calculationNote: string
} {
  const criteria = input.shopCriteria.toUpperCase().replace('-', '_')

  if (criteria === 'AT_RISK') {
    return {
      qgaBonus: 0, qgaSimCommission: 0, evdBonus: 0, mpesaCommission: 0,
      baSiteBonus: 0, dsaAchievementBonus: 0, qoBonus: 0,
      ebuActivationBonus: 0, ebuRevenueShare: 0, totalIncentive: 0,
      calculationNote: 'At-risk shop: all incentive components are zero.',
    }
  }

  if (!ALLOWED_CRITERIA.includes(criteria)) {
    return {
      qgaBonus: 0, qgaSimCommission: 0, evdBonus: 0, mpesaCommission: 0,
      baSiteBonus: 0, dsaAchievementBonus: 0, qoBonus: 0,
      ebuActivationBonus: 0, ebuRevenueShare: 0, totalIncentive: 0,
      calculationNote: `Invalid shop criteria: ${input.shopCriteria}. Must be Gold, Silver, Bronze, or At-risk.`,
    }
  }

  function criteriaAmount(gold: number, silver: number, bronze: number): number {
    if (criteria === 'GOLD') return gold
    if (criteria === 'SILVER') return silver
    return bronze
  }

  // QGA Bonus
  let qgaBonus = 0
  if (input.qgaAbove90 === true) qgaBonus = criteriaAmount(5000, 3000, 1500)

  // QGA SIM Commission
  let qgaSimCommission = 0
  if (input.qgaAbove90 === true && input.qgaQuantity !== null) {
    qgaSimCommission = criteriaAmount(input.qgaQuantity * 1.5, input.qgaQuantity * 1, 0)
  }

  // EVD Bonus
  let evdBonus = 0
  if (input.evdAbove100AndReconciled === true) evdBonus = criteriaAmount(3000, 2000, 0)

  // M-PESA Commission
  let mpesaCommission = 0
  if (input.mpesaTargetAndReconciled === true && input.mpesaFloatSold !== null) {
    mpesaCommission = criteriaAmount(input.mpesaFloatSold * 0.02, input.mpesaFloatSold * 0.02, 0)
  }

  // BA/Site Bonus
  let baSiteBonus = 0
  if (input.baSite === true) baSiteBonus = criteriaAmount(4000, 2000, 0)

  // DSA Achievement Bonus
  let dsaAchievementBonus = 0
  if (input.dsaAirtimeAchievementPercent !== null) {
    if (input.dsaAirtimeAchievementPercent > 90) dsaAchievementBonus = 2000
    else if (input.dsaAirtimeAchievementPercent >= 60) dsaAchievementBonus = 1500
    else if (input.dsaAirtimeAchievementPercent >= 50) dsaAchievementBonus = 1000
  }

  // QO Bonus
  let qoBonus = 0
  if (input.mmQoAbove90 === true) qoBonus = 4000

  // EBU Activation Bonus
  let ebuActivationBonus = 0
  if (input.ebuTargetAchieved === true && input.ebuRevenueMade === true && input.ebuAverageTopupAbove500 === true) {
    ebuActivationBonus = criteriaAmount(3000, 1500, 500)
  }

  // EBU Revenue Share
  let ebuRevenueShare = 0
  if (input.ebuRevenueMade === true && input.ebuFirstMonthLfRevenue !== null) {
    ebuRevenueShare = criteriaAmount(input.ebuFirstMonthLfRevenue * 0.25, input.ebuFirstMonthLfRevenue * 0.15, 0)
  }

  const totalIncentive = round2(qgaBonus + qgaSimCommission + evdBonus + mpesaCommission + baSiteBonus + dsaAchievementBonus + qoBonus + ebuActivationBonus + ebuRevenueShare)

  qgaBonus = round2(qgaBonus)
  qgaSimCommission = round2(qgaSimCommission)
  evdBonus = round2(evdBonus)
  mpesaCommission = round2(mpesaCommission)
  baSiteBonus = round2(baSiteBonus)
  dsaAchievementBonus = round2(dsaAchievementBonus)
  qoBonus = round2(qoBonus)
  ebuActivationBonus = round2(ebuActivationBonus)
  ebuRevenueShare = round2(ebuRevenueShare)

  return {
    qgaBonus, qgaSimCommission, evdBonus, mpesaCommission, baSiteBonus,
    dsaAchievementBonus, qoBonus, ebuActivationBonus, ebuRevenueShare,
    totalIncentive,
    calculationNote: `Calculated for ${criteria} shop`,
  }
}

export async function calculateAllShopManagerIncentives(periodId: string): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: {
      inputs: {
        include: {
          shopLocation: { include: { shopProfile: true } },
          shopManager: true,
        },
      },
    },
  })

  if (!period) throw new Error(`Incentive period not found: ${periodId}`)

  const results: any[] = []

  for (const input of period.inputs) {
    if (!input.shopCriteria) continue
    const criteria = input.shopCriteria

    const calcInput = {
      shopCriteria: criteria,
      qgaAbove90: input.qgaAbove90,
      qgaQuantity: input.qgaQuantity,
      mmQoAbove90: input.mmQoAbove90,
      dsaAirtimeAchievementPercent: input.dsaAirtimeAchievementPercent ? Number(input.dsaAirtimeAchievementPercent) : null,
      corridorStatus: input.corridorStatus,
      evdAbove100AndReconciled: input.evdAbove100AndReconciled,
      mpesaTargetAndReconciled: input.mpesaTargetAndReconciled,
      mpesaFloatSold: input.mpesaFloatSold ? Number(input.mpesaFloatSold) : null,
      baSite: input.baSite,
      ebuTargetAchieved: input.ebuTargetAchieved,
      ebuRevenueMade: input.ebuRevenueMade,
      ebuAverageTopupAbove500: input.ebuAverageTopupAbove500,
      ebuFirstMonthLfRevenue: input.ebuFirstMonthLfRevenue ? Number(input.ebuFirstMonthLfRevenue) : null,
    }

    const result = calculateShopManagerIncentive(calcInput)

    const existing = await prisma.shopManagerIncentiveCalculation.findUnique({
      where: { incentivePeriodId_shopLocationId: { incentivePeriodId: periodId, shopLocationId: input.shopLocationId } },
    })

    const calcData = {
      incentivePeriodId: periodId,
      inputId: input.id,
      shopLocationId: input.shopLocationId,
      shopManagerId: input.shopManagerId,
      shopCriteria: criteria,
      qgaBonus: result.qgaBonus,
      qgaSimCommission: result.qgaSimCommission,
      evdBonus: result.evdBonus,
      mpesaCommission: result.mpesaCommission,
      baSiteBonus: result.baSiteBonus,
      dsaAchievementBonus: result.dsaAchievementBonus,
      qoBonus: result.qoBonus,
      ebuActivationBonus: result.ebuActivationBonus,
      ebuRevenueShare: result.ebuRevenueShare,
      totalIncentive: result.totalIncentive,
      calculationNote: result.calculationNote,
      calculatedAt: new Date(),
    }

    let calculation
    if (existing) {
      calculation = await prisma.shopManagerIncentiveCalculation.update({
        where: { id: existing.id },
        data: calcData,
      })
    } else {
      calculation = await prisma.shopManagerIncentiveCalculation.create({ data: calcData })
    }

    results.push({ shopId: input.shopLocationId, calculationId: calculation.id, totalIncentive: result.totalIncentive })
  }

  await prisma.shopManagerIncentivePeriod.update({
    where: { id: periodId },
    data: { status: 'CALCULATED' as any },
  })

  return { periodId, status: 'CALCULATED', calculations: results }
}

export async function sendIncentivesToPayrollInputs(periodId: string): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: { payrollPeriod: true },
  })
  if (!period) throw new Error(`Incentive period not found: ${periodId}`)

  const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
    where: { incentivePeriodId: periodId },
    include: { shopManager: true },
  })

  const inputTypes = await prisma.payrollInputType.findMany({
    where: {
      code: {
        in: [
          'SHOP_MANAGER_QGA_BONUS', 'SHOP_MANAGER_QGA_SIM_COMMISSION',
          'SHOP_MANAGER_EVD_BONUS', 'SHOP_MANAGER_BA_SITE_BONUS',
          'SHOP_MANAGER_MPESA_COMMISSION', 'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS',
          'SHOP_MANAGER_QO_BONUS', 'SHOP_MANAGER_EBU_ACTIVATION_BONUS',
          'SHOP_MANAGER_EBU_REVENUE_SHARE', 'SHOP_MANAGER_TOTAL_INCENTIVE',
        ],
      },
    },
  })
  const inputTypeMap = new Map(inputTypes.map(it => [it.code, it.id]))

  const componentFields = [
    { field: 'qgaBonus' as const, code: 'SHOP_MANAGER_QGA_BONUS' },
    { field: 'qgaSimCommission' as const, code: 'SHOP_MANAGER_QGA_SIM_COMMISSION' },
    { field: 'evdBonus' as const, code: 'SHOP_MANAGER_EVD_BONUS' },
    { field: 'mpesaCommission' as const, code: 'SHOP_MANAGER_MPESA_COMMISSION' },
    { field: 'baSiteBonus' as const, code: 'SHOP_MANAGER_BA_SITE_BONUS' },
    { field: 'dsaAchievementBonus' as const, code: 'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS' },
    { field: 'qoBonus' as const, code: 'SHOP_MANAGER_QO_BONUS' },
    { field: 'ebuActivationBonus' as const, code: 'SHOP_MANAGER_EBU_ACTIVATION_BONUS' },
    { field: 'ebuRevenueShare' as const, code: 'SHOP_MANAGER_EBU_REVENUE_SHARE' },
  ]

  const payrollPeriodId = period.payrollPeriodId
  const results: any[] = []

  for (const calc of calculations) {
    if (!calc.shopManagerId) continue

    for (const { field, code } of componentFields) {
      const amount = Number((calc as any)[field] || 0)
      if (amount <= 0) continue

      const inputTypeId = inputTypeMap.get(code)
      if (!inputTypeId) continue

      const existing = await prisma.payrollInput.findUnique({
        where: { payrollPeriodId_employeeId_inputTypeId: { payrollPeriodId, employeeId: calc.shopManagerId, inputTypeId } },
      })
      if (existing) {
        results.push({ employeeId: calc.shopManagerId, component: code, action: 'SKIPPED_EXISTING' })
        continue
      }

      await prisma.payrollInput.create({
        data: {
          payrollPeriodId,
          employeeId: calc.shopManagerId,
          inputTypeId,
          value: amount,
          amount,
          note: `From incentive calculation: ${calc.calculationNote || ''}`,
          source: 'SYSTEM',
          status: 'ACCEPTED',
          isLocked: false,
        },
      })
      results.push({ employeeId: calc.shopManagerId, component: code, action: 'CREATED' })
    }

    const totalTypeId = inputTypeMap.get('SHOP_MANAGER_TOTAL_INCENTIVE')
    if (totalTypeId && calc.totalIncentive && Number(calc.totalIncentive) > 0) {
      const existingTotal = await prisma.payrollInput.findUnique({
        where: { payrollPeriodId_employeeId_inputTypeId: { payrollPeriodId, employeeId: calc.shopManagerId, inputTypeId: totalTypeId } },
      })
      if (!existingTotal) {
        await prisma.payrollInput.create({
          data: {
            payrollPeriodId,
            employeeId: calc.shopManagerId,
            inputTypeId: totalTypeId,
            value: Number(calc.totalIncentive),
            amount: Number(calc.totalIncentive),
            note: `Total incentive from calculation`,
            source: 'SYSTEM',
            status: 'ACCEPTED',
            isLocked: false,
          },
        })
        results.push({ employeeId: calc.shopManagerId, component: 'SHOP_MANAGER_TOTAL_INCENTIVE', action: 'CREATED' })
      }
    }
  }

  return { periodId, payrollPeriodId, calculationsProcessed: calculations.length, details: results }
}
