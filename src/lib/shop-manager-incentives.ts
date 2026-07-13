import { prisma } from './prisma'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const ALLOWED_CRITERIA = ['GOLD', 'SILVER', 'BRONZE', 'AT_RISK'] as const

export type ReadinessStatus = 'READY' | 'INCOMPLETE' | 'AT_RISK_ZERO' | 'CALCULATED' | 'STALE_CALCULATION'

export type BlockerCode =
  | 'MISSING_SHOP_MANAGER'
  | 'MISSING_SHOP_CRITERIA'
  | 'MISSING_SALES_INPUTS'
  | 'MISSING_DISTRIBUTION_INPUTS'
  | 'MISSING_EBU_INPUTS'
  | 'MISSING_QGA_QUANTITY'
  | 'MISSING_MPESA_FLOAT_SOLD'
  | 'MISSING_EBU_FIRST_MONTH_REVENUE'
  | 'INVALID_PERCENTAGE'
  | 'INVALID_NEGATIVE_AMOUNT'
  | 'STALE_CALCULATION'

export function validateShopCriteria(criteria: string): string {
  const upper = criteria.toUpperCase().replace('-', '_')
  if (ALLOWED_CRITERIA.includes(upper as any)) return upper
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

  if (!(ALLOWED_CRITERIA as readonly string[]).includes(criteria)) {
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

  // DSA Achievement Bonus — confirmed boundaries: >90 = 2000, 60-90 = 1500, 50-59.99 = 1000, <50 = 0
  let dsaAchievementBonus = 0
  if (input.dsaAirtimeAchievementPercent !== null) {
    const pct = input.dsaAirtimeAchievementPercent
    if (pct > 90) dsaAchievementBonus = 2000
    else if (pct >= 60) dsaAchievementBonus = 1500
    else if (pct >= 50) dsaAchievementBonus = 1000
  }

  // QO Bonus — independent of QGA, uses mmQoAbove90
  let qoBonus = 0
  if (input.mmQoAbove90 === true) qoBonus = 4000

  // EBU Activation Bonus
  let ebuActivationBonus = 0
  if (input.ebuTargetAchieved === true && input.ebuRevenueMade === true && input.ebuAverageTopupAbove500 === true) {
    ebuActivationBonus = criteriaAmount(3000, 1500, 500)
  }

  // EBU Revenue Share — no unconfirmed thresholds, just percentage of revenue
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

export interface ReadinessResult {
  readinessStatus: ReadinessStatus
  missingFields: string[]
  missingSalesFields: string[]
  missingDistributionFields: string[]
  missingEbuFields: string[]
  blockerCount: number
  warningCount: number
  blockers: BlockerCode[]
  warnings: string[]
}

export function computeReadiness(input: {
  shopCriteria: string | null
  shopManagerId: string | null
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
  calculationExists?: boolean
  calculationStale?: boolean
}): ReadinessResult {
  const criteria = (input.shopCriteria || '').toUpperCase().replace('-', '_')
  const isAtRisk = criteria === 'AT_RISK'

  // At-risk shops are always AT_RISK_ZERO — no missing-field blockers
  if (isAtRisk) {
    return {
      readinessStatus: 'AT_RISK_ZERO',
      missingFields: [],
      missingSalesFields: [],
      missingDistributionFields: [],
      missingEbuFields: [],
      blockerCount: 0,
      warningCount: 0,
      blockers: [],
      warnings: [],
    }
  }

  if (!criteria || !['GOLD', 'SILVER', 'BRONZE'].includes(criteria)) {
    return {
      readinessStatus: 'INCOMPLETE',
      missingFields: ['shopCriteria'],
      missingSalesFields: [],
      missingDistributionFields: [],
      missingEbuFields: [],
      blockerCount: 1,
      warningCount: 0,
      blockers: ['MISSING_SHOP_CRITERIA'],
      warnings: ['Shop criteria must be Gold, Silver, or Bronze'],
    }
  }

  const missingFields: string[] = []
  const missingSalesFields: string[] = []
  const missingDistributionFields: string[] = []
  const missingEbuFields: string[] = []
  const blockers: BlockerCode[] = []
  const warnings: string[] = []

  // Shop setup requirements
  if (!input.shopManagerId) {
    missingFields.push('shopManagerId')
    blockers.push('MISSING_SHOP_MANAGER')
  }

  // Sales Head fields
  if (input.qgaAbove90 === null || input.qgaAbove90 === undefined) {
    missingFields.push('qgaAbove90')
    missingSalesFields.push('qgaAbove90')
    blockers.push('MISSING_SALES_INPUTS')
  }
  if (input.mmQoAbove90 === null || input.mmQoAbove90 === undefined) {
    missingFields.push('mmQoAbove90')
    missingSalesFields.push('mmQoAbove90')
    blockers.push('MISSING_SALES_INPUTS')
  }
  if (input.dsaAirtimeAchievementPercent === null || input.dsaAirtimeAchievementPercent === undefined) {
    missingFields.push('dsaAirtimeAchievementPercent')
    missingSalesFields.push('dsaAirtimeAchievementPercent')
    blockers.push('MISSING_SALES_INPUTS')
  }

  // Conditional: qgaQuantity required when qgaAbove90 = true
  if (input.qgaAbove90 === true && (input.qgaQuantity === null || input.qgaQuantity === undefined)) {
    missingFields.push('qgaQuantity')
    missingSalesFields.push('qgaQuantity')
    blockers.push('MISSING_QGA_QUANTITY')
  }

  // Distribution Head fields
  if (input.corridorStatus === null || input.corridorStatus === undefined) {
    missingFields.push('corridorStatus')
    missingDistributionFields.push('corridorStatus')
    blockers.push('MISSING_DISTRIBUTION_INPUTS')
  }
  if (input.evdAbove100AndReconciled === null || input.evdAbove100AndReconciled === undefined) {
    missingFields.push('evdAbove100AndReconciled')
    missingDistributionFields.push('evdAbove100AndReconciled')
    blockers.push('MISSING_DISTRIBUTION_INPUTS')
  }
  if (input.mpesaTargetAndReconciled === null || input.mpesaTargetAndReconciled === undefined) {
    missingFields.push('mpesaTargetAndReconciled')
    missingDistributionFields.push('mpesaTargetAndReconciled')
    blockers.push('MISSING_DISTRIBUTION_INPUTS')
  }
  if (input.baSite === null || input.baSite === undefined) {
    missingFields.push('baSite')
    missingDistributionFields.push('baSite')
    blockers.push('MISSING_DISTRIBUTION_INPUTS')
  }

  // Conditional: mpesaFloatSold required when mpesaTargetAndReconciled = true
  if (input.mpesaTargetAndReconciled === true && (input.mpesaFloatSold === null || input.mpesaFloatSold === undefined)) {
    missingFields.push('mpesaFloatSold')
    missingDistributionFields.push('mpesaFloatSold')
    blockers.push('MISSING_MPESA_FLOAT_SOLD')
  }

  // EBU Head fields
  if (input.ebuTargetAchieved === null || input.ebuTargetAchieved === undefined) {
    missingFields.push('ebuTargetAchieved')
    missingEbuFields.push('ebuTargetAchieved')
    blockers.push('MISSING_EBU_INPUTS')
  }
  if (input.ebuRevenueMade === null || input.ebuRevenueMade === undefined) {
    missingFields.push('ebuRevenueMade')
    missingEbuFields.push('ebuRevenueMade')
    blockers.push('MISSING_EBU_INPUTS')
  }
  if (input.ebuAverageTopupAbove500 === null || input.ebuAverageTopupAbove500 === undefined) {
    missingFields.push('ebuAverageTopupAbove500')
    missingEbuFields.push('ebuAverageTopupAbove500')
    blockers.push('MISSING_EBU_INPUTS')
  }

  // Conditional: ebuFirstMonthLfRevenue required when ebuRevenueMade = true
  if (input.ebuRevenueMade === true && (input.ebuFirstMonthLfRevenue === null || input.ebuFirstMonthLfRevenue === undefined)) {
    missingFields.push('ebuFirstMonthLfRevenue')
    missingEbuFields.push('ebuFirstMonthLfRevenue')
    blockers.push('MISSING_EBU_FIRST_MONTH_REVENUE')
  }

  // Validation checks
  if (input.dsaAirtimeAchievementPercent !== null && input.dsaAirtimeAchievementPercent !== undefined) {
    if (input.dsaAirtimeAchievementPercent < 0 || input.dsaAirtimeAchievementPercent > 200) {
      blockers.push('INVALID_PERCENTAGE')
      warnings.push('DSA airtime percentage must be between 0 and 200')
    }
  }
  if (input.qgaQuantity !== null && input.qgaQuantity !== undefined && input.qgaQuantity < 0) {
    blockers.push('INVALID_NEGATIVE_AMOUNT')
    warnings.push('QGA quantity must not be negative')
  }
  if (input.mpesaFloatSold !== null && input.mpesaFloatSold !== undefined && input.mpesaFloatSold < 0) {
    blockers.push('INVALID_NEGATIVE_AMOUNT')
    warnings.push('M-PESA float sold must not be negative')
  }
  if (input.ebuFirstMonthLfRevenue !== null && input.ebuFirstMonthLfRevenue !== undefined && input.ebuFirstMonthLfRevenue < 0) {
    blockers.push('INVALID_NEGATIVE_AMOUNT')
    warnings.push('EBU first month LF revenue must not be negative')
  }

  // Calculation staleness
  if (input.calculationStale) {
    blockers.push('STALE_CALCULATION')
    warnings.push('Inputs have changed since last calculation — recalculation required')
  }

  const hasBlockers = blockers.length > 0 && !(blockers.length === 1 && blockers[0] === 'STALE_CALCULATION' && missingFields.length === 0)
  // Only STALE with no missing fields means "recalculate needed"
  const isOnlyStale = blockers.length === 1 && blockers[0] === 'STALE_CALCULATION' && missingFields.length === 0
  // All missing fields filled but stale
  if (input.calculationExists && !input.calculationStale && missingFields.length === 0 && blockers.filter(b => b !== 'STALE_CALCULATION').length === 0) {
    return {
      readinessStatus: 'CALCULATED',
      missingFields: [], missingSalesFields: [], missingDistributionFields: [], missingEbuFields: [],
      blockerCount: 0, warningCount: 0, blockers: [], warnings: [],
    }
  }
  if (isOnlyStale) {
    return {
      readinessStatus: 'STALE_CALCULATION',
      missingFields, missingSalesFields, missingDistributionFields, missingEbuFields,
      blockerCount: 1, warningCount: warnings.length, blockers, warnings,
    }
  }
  if (missingFields.length === 0 && warnings.length === 0) {
    return {
      readinessStatus: 'READY',
      missingFields, missingSalesFields, missingDistributionFields, missingEbuFields,
      blockerCount: blockers.length, warningCount: warnings.length, blockers, warnings,
    }
  }

  return {
    readinessStatus: hasBlockers ? 'INCOMPLETE' : 'READY',
    missingFields, missingSalesFields, missingDistributionFields, missingEbuFields,
    blockerCount: blockers.length, warningCount: warnings.length, blockers, warnings,
  }
}

export function validateIncentiveInputValues(values: Record<string, unknown>): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  if (values.qgaQuantity !== undefined && values.qgaQuantity !== null) {
    const n = Number(values.qgaQuantity)
    if (!Number.isInteger(n) || n < 0) errors.push('qgaQuantity must be a non-negative integer')
  }
  if (values.dsaAirtimeAchievementPercent !== undefined && values.dsaAirtimeAchievementPercent !== null) {
    const n = Number(values.dsaAirtimeAchievementPercent)
    if (n < 0 || n > 200) errors.push('dsaAirtimeAchievementPercent must be between 0 and 200')
  }
  if (values.mpesaFloatSold !== undefined && values.mpesaFloatSold !== null) {
    const n = Number(values.mpesaFloatSold)
    if (n < 0) errors.push('mpesaFloatSold must not be negative')
  }
  if (values.ebuFirstMonthLfRevenue !== undefined && values.ebuFirstMonthLfRevenue !== null) {
    const n = Number(values.ebuFirstMonthLfRevenue)
    if (n < 0) errors.push('ebuFirstMonthLfRevenue must not be negative')
  }

  return { valid: errors.length === 0, errors }
}

export async function calculateAllShopManagerIncentives(periodId: string): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: {
      inputs: {
        include: {
          shopLocation: { include: { shopProfile: true } },
          shopManager: true,
          calculation: true,
        },
      },
    },
  })

  if (!period) throw new Error(`Incentive period not found: ${periodId}`)

  const results: any[] = []
  const blockers: any[] = []
  let incompleteCount = 0
  let readyCount = 0
  let atRiskCount = 0

  for (const input of period.inputs) {
    if (!input.shopCriteria) {
      incompleteCount++
      blockers.push({ shopLocationId: input.shopLocationId, reason: 'MISSING_SHOP_CRITERIA' })
      continue
    }
    const criteria = input.shopCriteria

    if (criteria === 'AT_RISK') {
      atRiskCount++
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
      const existing = input.calculation
      if (existing) {
        await prisma.shopManagerIncentiveCalculation.update({ where: { id: existing.id }, data: calcData })
      } else {
        await prisma.shopManagerIncentiveCalculation.create({ data: calcData })
      }
      results.push({ shopId: input.shopLocationId, totalIncentive: 0, atRisk: true })
      continue
    }

    // Check readiness for non-At-risk shops
    const readiness = computeReadiness({
      shopCriteria: input.shopCriteria,
      shopManagerId: input.shopManagerId,
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
    })

    if (readiness.blockers.length > 0) {
      incompleteCount++
      blockers.push({ shopLocationId: input.shopLocationId, shopName: input.shopLocation?.name, readiness })
      continue
    }

    readyCount++

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

    const existing = input.calculation
    if (existing) {
      await prisma.shopManagerIncentiveCalculation.update({ where: { id: existing.id }, data: calcData })
    } else {
      await prisma.shopManagerIncentiveCalculation.create({ data: calcData })
    }

    results.push({ shopId: input.shopLocationId, totalIncentive: result.totalIncentive })
  }

  // Only set period to CALCULATED if no non-At-risk shops have blockers
  if (blockers.length > 0) {
    return {
      periodId,
      status: 'BLOCKED',
      totalShops: period.inputs.length,
      readyShops: readyCount,
      atRiskShops: atRiskCount,
      incompleteShops: incompleteCount,
      calculatedShops: readyCount + atRiskCount,
      blockers,
      message: `${blockers.length} shop(s) blocked calculation due to incomplete inputs`,
    }
  }

  await prisma.shopManagerIncentivePeriod.update({
    where: { id: periodId },
    data: { status: 'CALCULATED' as any },
  })

  return {
    periodId,
    status: 'CALCULATED',
    totalShops: period.inputs.length,
    readyShops: readyCount,
    atRiskShops: atRiskCount,
    incompleteShops: incompleteCount,
    calculatedShops: readyCount + atRiskCount,
    calculations: results,
  }
}

export async function getPayrollHandoffPreview(periodId: string): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: { payrollPeriod: true },
  })
  if (!period) throw new Error(`Incentive period not found: ${periodId}`)

  const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
    where: { incentivePeriodId: periodId },
    include: {
      shopManager: true,
      shopLocation: { select: { name: true, code: true } },
      input: true,
    },
  })

  const totalType = await prisma.payrollInputType.findUnique({
    where: { code: 'SHOP_MANAGER_TOTAL_INCENTIVE' },
  })
  if (!totalType) throw new Error('SHOP_MANAGER_TOTAL_INCENTIVE payroll input type not found')

  const items: any[] = []
  for (const calc of calculations) {
    const item: any = {
      shopLocationId: calc.shopLocationId,
      shopName: calc.shopLocation?.name,
      shopManagerId: calc.shopManagerId,
      employeeId: calc.shopManager?.employeeId,
      employeeName: calc.shopManager?.fullName,
      criteria: calc.shopCriteria,
      totalIncentive: Number(calc.totalIncentive || 0),
      proposedAction: 'SKIPPED_ZERO',
      blocker: null,
    }

    if (!calc.shopManagerId) {
      item.proposedAction = 'BLOCKED'
      item.blocker = 'MISSING_SHOP_MANAGER'
      items.push(item)
      continue
    }

    // Check payroll period
    if (period.payrollPeriod && (period.payrollPeriod.status === 'INPUT_COLLECTION_CLOSED' || period.payrollPeriod.status === 'CANCELLED')) {
      item.proposedAction = 'BLOCKED'
      item.blocker = 'PAYROLL_PERIOD_CLOSED_OR_CANCELLED'
      items.push(item)
      continue
    }

    // Skip zero total
    if (Number(calc.totalIncentive || 0) <= 0) {
      item.proposedAction = 'SKIPPED_ZERO'
      items.push(item)
      continue
    }

    // Check existing payroll input
    const existing = await prisma.payrollInput.findUnique({
      where: {
        payrollPeriodId_employeeId_inputTypeId: {
          payrollPeriodId: period.payrollPeriodId,
          employeeId: calc.shopManagerId,
          inputTypeId: totalType.id,
        },
      },
    })

    if (existing) {
      if (existing.isLocked) {
        item.proposedAction = 'BLOCKED_LOCKED'
        item.blocker = 'LOCKED_EXISTING'
        item.existingAmount = Number(existing.amount)
      } else {
        item.proposedAction = 'UPDATE_EXISTING_UNLOCKED'
        item.existingAmount = Number(existing.amount)
        item.newAmount = Number(calc.totalIncentive)
      }
    } else {
      item.proposedAction = 'CREATE'
      item.newAmount = Number(calc.totalIncentive)
    }

    items.push(item)
  }

  const totalBlockers = items.filter(i => i.proposedAction === 'BLOCKED' || i.proposedAction === 'BLOCKED_LOCKED').length
  const readyForHandoff = totalBlockers === 0

  return {
    periodId,
    payrollPeriodId: period.payrollPeriodId,
    payrollPeriodStatus: period.payrollPeriod?.status,
    periodStatus: period.status,
    totalCalculations: calculations.length,
    totalZero: items.filter(i => i.proposedAction === 'SKIPPED_ZERO').length,
    totalCreate: items.filter(i => i.proposedAction === 'CREATE').length,
    totalUpdate: items.filter(i => i.proposedAction === 'UPDATE_EXISTING_UNLOCKED').length,
    totalBlocked: totalBlockers,
    readyForHandoff,
    items,
  }
}

export async function sendIncentivesToPayrollInputs(
  periodId: string,
  mode: 'SKIP_EXISTING' | 'UPDATE_EXISTING_UNLOCKED' = 'UPDATE_EXISTING_UNLOCKED'
): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: { payrollPeriod: true },
  })
  if (!period) throw new Error(`Incentive period not found: ${periodId}`)

  if (period.status !== 'CALCULATED') {
    throw new Error(`Period status must be CALCULATED (current: ${period.status})`)
  }

  if (period.payrollPeriod && (period.payrollPeriod.status === 'INPUT_COLLECTION_CLOSED' || period.payrollPeriod.status === 'CANCELLED')) {
    throw new Error(`Linked payroll period is ${period.payrollPeriod.status} — cannot handoff`)
  }

  const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
    where: { incentivePeriodId: periodId },
    include: {
      shopManager: true,
      shopLocation: { select: { name: true, code: true } },
    },
  })

  const totalType = await prisma.payrollInputType.findUnique({
    where: { code: 'SHOP_MANAGER_TOTAL_INCENTIVE' },
  })
  if (!totalType) throw new Error('SHOP_MANAGER_TOTAL_INCENTIVE payroll input type not found')
  if (!totalType.isActive) throw new Error('SHOP_MANAGER_TOTAL_INCENTIVE payroll input type is inactive')

  const payrollPeriodId = period.payrollPeriodId
  const details: any[] = []

  for (const calc of calculations) {
    const item: any = {
      employeeId: calc.shopManagerId,
      employeeName: calc.shopManager?.fullName,
      shopName: calc.shopLocation?.name,
      criteria: calc.shopCriteria,
      totalIncentive: Number(calc.totalIncentive || 0),
      action: null,
      note: null,
    }

    if (!calc.shopManagerId) {
      item.action = 'MISSING_MANAGER'
      details.push(item)
      continue
    }

    if (Number(calc.totalIncentive || 0) <= 0) {
      item.action = 'SKIPPED_ZERO'
      details.push(item)
      continue
    }

    const componentSummary = [
      calc.qgaBonus ? `QGA ${Number(calc.qgaBonus)}` : '',
      calc.qgaSimCommission ? `QGA SIM ${Number(calc.qgaSimCommission)}` : '',
      calc.evdBonus ? `EVD ${Number(calc.evdBonus)}` : '',
      calc.mpesaCommission ? `M-PESA ${Number(calc.mpesaCommission)}` : '',
      calc.baSiteBonus ? `BA/Site ${Number(calc.baSiteBonus)}` : '',
      calc.dsaAchievementBonus ? `DSA ${Number(calc.dsaAchievementBonus)}` : '',
      calc.qoBonus ? `QO ${Number(calc.qoBonus)}` : '',
      calc.ebuActivationBonus ? `EBU Activation ${Number(calc.ebuActivationBonus)}` : '',
      calc.ebuRevenueShare ? `EBU Rev Share ${Number(calc.ebuRevenueShare)}` : '',
    ].filter(Boolean).join(', ')

    const payrollNote = `Shop Manager incentive for ${period.name}. Shop: ${calc.shopLocation?.name || ''}. Criteria: ${calc.shopCriteria || ''}. Calculation ID: ${calc.id}. Components: ${componentSummary}.`

    const existing = await prisma.payrollInput.findUnique({
      where: {
        payrollPeriodId_employeeId_inputTypeId: {
          payrollPeriodId,
          employeeId: calc.shopManagerId,
          inputTypeId: totalType.id,
        },
      },
    })

    if (existing) {
      if (existing.isLocked) {
        item.action = 'BLOCKED_LOCKED'
        item.existingAmount = Number(existing.amount)
        details.push(item)
        continue
      }

      if (mode === 'SKIP_EXISTING') {
        item.action = 'SKIPPED_UNCHANGED'
        item.existingAmount = Number(existing.amount)
        details.push(item)
        continue
      }

      // UPDATE_EXISTING_UNLOCKED
      await prisma.payrollInput.update({
        where: { id: existing.id },
        data: {
          value: Number(calc.totalIncentive),
          amount: Number(calc.totalIncentive),
          note: payrollNote,
        },
      })
      item.action = 'UPDATED_UNLOCKED'
      item.oldAmount = Number(existing.amount)
      item.newAmount = Number(calc.totalIncentive)
    } else {
      await prisma.payrollInput.create({
        data: {
          payrollPeriodId,
          employeeId: calc.shopManagerId,
          inputTypeId: totalType.id,
          value: Number(calc.totalIncentive),
          amount: Number(calc.totalIncentive),
          note: payrollNote,
          source: 'SYSTEM',
          status: 'ACCEPTED',
          isLocked: false,
        },
      })
      item.action = 'CREATED'
      item.newAmount = Number(calc.totalIncentive)
    }

    details.push(item)
  }

  return {
    periodId,
    payrollPeriodId,
    mode,
    totalCalculations: calculations.length,
    created: details.filter(d => d.action === 'CREATED').length,
    updated: details.filter(d => d.action === 'UPDATED_UNLOCKED').length,
    skippedZero: details.filter(d => d.action === 'SKIPPED_ZERO').length,
    skippedUnchanged: details.filter(d => d.action === 'SKIPPED_UNCHANGED').length,
    blockedLocked: details.filter(d => d.action === 'BLOCKED_LOCKED').length,
    missingManager: details.filter(d => d.action === 'MISSING_MANAGER').length,
    details,
  }
}
