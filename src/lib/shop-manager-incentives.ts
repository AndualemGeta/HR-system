import { prisma } from './prisma'
import { ShopCriteria, CalculationStatus, IncentiveComponentCode, IncentiveIssueSeverity, IncentiveIssueCode, IncentivePeriodStatus } from '@prisma/client'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export async function getShopCriteriaForPeriod(shopId: string, periodDate: Date): Promise<{ criteria: string | null; historyEntry: any }> {
  const entry = await prisma.shopCriteriaStatusHistory.findFirst({
    where: {
      shopLocationId: shopId,
      effectiveFrom: { lte: periodDate },
      OR: [
        { effectiveTo: null },
        { effectiveTo: { gte: periodDate } },
      ],
    },
    orderBy: { effectiveFrom: 'desc' },
  })

  if (!entry) {
    return { criteria: null, historyEntry: null }
  }

  return { criteria: entry.criteria, historyEntry: entry }
}

export async function getShopProfileForIncentive(shopId: string): Promise<{ corridorType: string; shopManagerId: string | null; isIncentiveEligible: boolean } | null> {
  const profile = await prisma.shopProfile.findUnique({
    where: { shopLocationId: shopId },
  })

  if (!profile) return null

  return {
    corridorType: profile.corridorType,
    shopManagerId: profile.defaultShopManagerId,
    isIncentiveEligible: profile.isIncentiveEligible,
  }
}

export async function validatePerformanceInput(input: any): Promise<{ valid: boolean; issues: Array<{ severity: string; issueCode: string; message: string }> }> {
  const issues: Array<{ severity: string; issueCode: string; message: string }> = []

  if (!input.shopManagerId) {
    issues.push({
      severity: 'BLOCKER',
      issueCode: 'MISSING_SHOP_MANAGER',
      message: 'No shop manager assigned to this shop',
    })
  }

  if (!input.shopCriteria || input.shopCriteria === 'UNASSIGNED') {
    issues.push({
      severity: 'BLOCKER',
      issueCode: 'SHOP_CRITERIA_UNASSIGNED',
      message: 'Shop criteria has not been assigned',
    })
  }

  if (!input.corridorType || input.corridorType === 'UNKNOWN') {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_CORRIDOR_TYPE',
      message: 'Corridor type is not set for this shop',
    })
  }

  if (input.qgaAchievementPercent === null || input.qgaAchievementPercent === undefined || input.qgaCount === null || input.qgaCount === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_QGA_INPUT',
      message: 'QGA performance data is missing',
    })
  }

  if (input.evdAchievementPercent === null || input.evdAchievementPercent === undefined || input.evdReconciled === null || input.evdReconciled === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_EVD_INPUT',
      message: 'EVD performance data is missing',
    })
  }

  if (input.mpesaFloatSold === null || input.mpesaFloatSold === undefined || input.mpesaTargetAchieved === null || input.mpesaTargetAchieved === undefined || input.mpesaReconciled === null || input.mpesaReconciled === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_MPESA_RECONCILIATION',
      message: 'M-PESA performance data is missing',
    })
  }

  if (input.dsaAirtimeAchievementPercent === null || input.dsaAirtimeAchievementPercent === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_DSA_INPUT',
      message: 'DSA achievement data is missing',
    })
  }

  if (input.mmQoTargetPercent === null || input.mmQoTargetPercent === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_QO_INPUT',
      message: 'QO performance data is missing',
    })
  }

  if (input.ebuTargetAchieved === null || input.ebuTargetAchieved === undefined || input.ebuRevenue === null || input.ebuRevenue === undefined) {
    issues.push({
      severity: 'WARNING',
      issueCode: 'MISSING_EBU_INPUT',
      message: 'EBU performance data is missing',
    })
  }

  return {
    valid: issues.length === 0 || issues.every(i => i.severity !== 'BLOCKER'),
    issues,
  }
}

export async function calculateShopManagerIncentive(input: {
  shopCriteria: string;
  corridorType: string;
  qgaAchievementPercent: number | null;
  qgaCount: number | null;
  evdAchievementPercent: number | null;
  evdReconciled: boolean | null;
  baSiteRequirementMet: boolean | null;
  mpesaFloatSold: number | null;
  mpesaTargetAchieved: boolean | null;
  mpesaReconciled: boolean | null;
  dsaAirtimeAchievementPercent: number | null;
  mmQoTargetPercent: number | null;
  ebuTargetAchieved: boolean | null;
  ebuRevenue: number | null;
  ebuAverageTopup: number | null;
  ebuFirstMonthLeapfrogRevenue: number | null;
}): Promise<{
  components: Array<{
    componentCode: string;
    componentName: string;
    inputMetric: string | null;
    inputValue: number | null;
    conditionMet: boolean | null;
    amount: number;
    calculationNote: string | null;
  }>;
  totalAmount: number;
  issues: Array<{ severity: string; issueCode: string; message: string }>;
}> {
  const issues: Array<{ severity: string; issueCode: string; message: string }> = []
  const components: Array<{
    componentCode: string;
    componentName: string;
    inputMetric: string | null;
    inputValue: number | null;
    conditionMet: boolean | null;
    amount: number;
    calculationNote: string | null;
  }> = []

  if (input.shopCriteria === 'UNASSIGNED') {
    issues.push({
      severity: 'BLOCKER',
      issueCode: 'SHOP_CRITERIA_UNASSIGNED',
      message: 'Cannot calculate incentive: shop criteria is unassigned',
    })
    return { components: [], totalAmount: 0, issues }
  }

  if (input.shopCriteria === 'AT_RISK') {
    issues.push({
      severity: 'INFO',
      issueCode: 'SHOP_AT_RISK_ZERO_INCENTIVE',
      message: 'Shop is AT_RISK: all incentive components are zero',
    })
    return { components: [], totalAmount: 0, issues }
  }

  const criteria = input.shopCriteria as ShopCriteria

  function criteriaAmount(gold: number, silver: number, bronze: number): number {
    if (criteria === 'GOLD') return gold
    if (criteria === 'SILVER') return silver
    if (criteria === 'BRONZE') return bronze
    return 0
  }

  // QGA_BONUS
  let qgaBonusAmount = 0
  if (input.qgaAchievementPercent !== null && input.qgaAchievementPercent > 90) {
    qgaBonusAmount = criteriaAmount(5000, 3000, 1500)
  }
  components.push({
    componentCode: 'QGA_BONUS',
    componentName: 'QGA Bonus',
    inputMetric: 'qgaAchievementPercent',
    inputValue: input.qgaAchievementPercent,
    conditionMet: input.qgaAchievementPercent !== null ? input.qgaAchievementPercent > 90 : null,
    amount: round2(qgaBonusAmount),
    calculationNote: input.qgaAchievementPercent !== null && input.qgaAchievementPercent > 90
      ? `Achieved ${input.qgaAchievementPercent}% > 90% threshold`
      : input.qgaAchievementPercent !== null
        ? `Achieved ${input.qgaAchievementPercent}% does not exceed 90% threshold`
        : 'QGA achievement data missing',
  })

  // QGA_SIM_COMMISSION
  let qgaSimAmount = 0
  if (input.qgaAchievementPercent !== null && input.qgaAchievementPercent > 90 && input.qgaCount !== null) {
    qgaSimAmount = criteriaAmount(input.qgaCount * 1.5, input.qgaCount * 1, 0)
  }
  components.push({
    componentCode: 'QGA_SIM_COMMISSION',
    componentName: 'QGA SIM Commission',
    inputMetric: 'qgaCount',
    inputValue: input.qgaCount,
    conditionMet: input.qgaAchievementPercent !== null ? input.qgaAchievementPercent > 90 : null,
    amount: round2(qgaSimAmount),
    calculationNote: criteria === 'BRONZE' ? 'Bronze shops do not earn QGA SIM commission'
      : input.qgaAchievementPercent !== null && input.qgaAchievementPercent > 90 && input.qgaCount !== null
        ? `Achieved ${input.qgaAchievementPercent}% > 90%: ${input.qgaCount} SIMs × ${criteria === 'GOLD' ? '1.5' : '1.0'}`
        : input.qgaAchievementPercent !== null
          ? `Achieved ${input.qgaAchievementPercent}% does not exceed 90% threshold`
          : 'QGA data insufficient',
  })

  // EVD_BONUS
  let evdAmount = 0
  if (input.evdAchievementPercent !== null && input.evdAchievementPercent > 100 && input.evdReconciled === true) {
    evdAmount = criteriaAmount(3000, 2000, 0)
  }
  components.push({
    componentCode: 'EVD_BONUS',
    componentName: 'EVD Bonus',
    inputMetric: 'evdAchievementPercent',
    inputValue: input.evdAchievementPercent,
    conditionMet: input.evdAchievementPercent !== null ? (input.evdAchievementPercent > 100 && input.evdReconciled === true) : null,
    amount: round2(evdAmount),
    calculationNote: criteria === 'BRONZE' ? 'Bronze shops do not earn EVD bonus'
      : input.evdAchievementPercent !== null && input.evdAchievementPercent > 100 && input.evdReconciled === true
        ? `Achieved ${input.evdAchievementPercent}% > 100% and reconciled`
        : input.evdAchievementPercent !== null
          ? `Condition not met (${input.evdAchievementPercent}%, reconciled: ${input.evdReconciled})`
          : 'EVD data insufficient',
  })

  // BA_SITE_BONUS
  let baAmount = 0
  if (input.baSiteRequirementMet === true) {
    baAmount = criteriaAmount(4000, 2000, 0)
  }
  components.push({
    componentCode: 'BA_SITE_BONUS',
    componentName: 'BA/Site Bonus',
    inputMetric: 'baSiteRequirementMet',
    inputValue: input.baSiteRequirementMet !== null ? (input.baSiteRequirementMet ? 1 : 0) : null,
    conditionMet: input.baSiteRequirementMet,
    amount: round2(baAmount),
    calculationNote: criteria === 'BRONZE' ? 'Bronze shops do not earn BA/Site bonus'
      : input.baSiteRequirementMet === true
        ? 'BA/Site requirement met'
        : input.baSiteRequirementMet === false
          ? 'BA/Site requirement not met'
          : 'BA/Site data missing',
  })

  // MPESA_COMMISSION
  let mpesaAmount = 0
  if (input.mpesaTargetAchieved === true && input.mpesaReconciled === true && input.mpesaFloatSold !== null) {
    mpesaAmount = criteriaAmount(input.mpesaFloatSold * 0.02, input.mpesaFloatSold * 0.02, 0)
  }
  components.push({
    componentCode: 'MPESA_COMMISSION',
    componentName: 'M-PESA Commission',
    inputMetric: 'mpesaFloatSold',
    inputValue: input.mpesaFloatSold,
    conditionMet: (input.mpesaTargetAchieved === true && input.mpesaReconciled === true),
    amount: round2(mpesaAmount),
    calculationNote: criteria === 'BRONZE' ? 'Bronze shops do not earn M-PESA commission'
      : input.mpesaTargetAchieved === true && input.mpesaReconciled === true && input.mpesaFloatSold !== null
        ? `Target achieved, reconciled: ${input.mpesaFloatSold} × 0.02`
        : `Condition not met (target: ${input.mpesaTargetAchieved}, reconciled: ${input.mpesaReconciled})`,
  })

  // DSA_ACHIEVEMENT_BONUS
  let dsaAmount = 0
  if (input.dsaAirtimeAchievementPercent !== null) {
    if (input.dsaAirtimeAchievementPercent > 90) {
      dsaAmount = 2000
    } else if (input.dsaAirtimeAchievementPercent >= 60 && input.dsaAirtimeAchievementPercent <= 89) {
      dsaAmount = 1500
    } else if (input.dsaAirtimeAchievementPercent >= 50 && input.dsaAirtimeAchievementPercent <= 59) {
      dsaAmount = 1000
    }
  }
  components.push({
    componentCode: 'DSA_ACHIEVEMENT_BONUS',
    componentName: 'DSA Achievement Bonus',
    inputMetric: 'dsaAirtimeAchievementPercent',
    inputValue: input.dsaAirtimeAchievementPercent,
    conditionMet: input.dsaAirtimeAchievementPercent !== null ? input.dsaAirtimeAchievementPercent >= 50 : null,
    amount: round2(dsaAmount),
    calculationNote: input.dsaAirtimeAchievementPercent !== null
      ? `DSA achievement ${input.dsaAirtimeAchievementPercent}% → ${dsaAmount}`
      : 'DSA data missing',
  })

  // QO_BONUS
  let qoAmount = 0
  if (input.mmQoTargetPercent !== null && input.mmQoTargetPercent > 90) {
    qoAmount = 4000
  }
  components.push({
    componentCode: 'QO_BONUS',
    componentName: 'QO Bonus',
    inputMetric: 'mmQoTargetPercent',
    inputValue: input.mmQoTargetPercent,
    conditionMet: input.mmQoTargetPercent !== null ? input.mmQoTargetPercent > 90 : null,
    amount: round2(qoAmount),
    calculationNote: input.mmQoTargetPercent !== null && input.mmQoTargetPercent > 90
      ? `QO ${input.mmQoTargetPercent}% > 90% threshold`
      : input.mmQoTargetPercent !== null
        ? `QO ${input.mmQoTargetPercent}% does not exceed 90% threshold`
        : 'QO data missing',
  })

  // EBU_ACTIVATION_BONUS
  let ebuActivationAmount = 0
  if (input.ebuTargetAchieved === true && input.ebuRevenue !== null && input.ebuRevenue > 0 && input.ebuAverageTopup !== null && input.ebuAverageTopup > 500) {
    ebuActivationAmount = criteriaAmount(3000, 1500, 500)
  }
  components.push({
    componentCode: 'EBU_ACTIVATION_BONUS',
    componentName: 'EBU Activation Bonus',
    inputMetric: 'ebuRevenue',
    inputValue: input.ebuRevenue,
    conditionMet: input.ebuTargetAchieved === true && input.ebuRevenue !== null && input.ebuRevenue > 0 && input.ebuAverageTopup !== null && input.ebuAverageTopup > 500,
    amount: round2(ebuActivationAmount),
    calculationNote: input.ebuTargetAchieved === true && input.ebuRevenue !== null && input.ebuRevenue > 0 && input.ebuAverageTopup !== null && input.ebuAverageTopup > 500
      ? `Target achieved, revenue ${input.ebuRevenue} > 0, avg topup ${input.ebuAverageTopup} > 500: ${criteria} = ${ebuActivationAmount}`
      : `Condition not met (target: ${input.ebuTargetAchieved}, revenue: ${input.ebuRevenue}, avgTopup: ${input.ebuAverageTopup})`,
  })

  // EBU_REVENUE_SHARE
  let ebuRevenueAmount = 0
  if (input.ebuFirstMonthLeapfrogRevenue !== null) {
    ebuRevenueAmount = criteriaAmount(
      input.ebuFirstMonthLeapfrogRevenue * 0.25,
      input.ebuFirstMonthLeapfrogRevenue * 0.15,
      0,
    )
  }
  components.push({
    componentCode: 'EBU_REVENUE_SHARE',
    componentName: 'EBU Revenue Share',
    inputMetric: 'ebuFirstMonthLeapfrogRevenue',
    inputValue: input.ebuFirstMonthLeapfrogRevenue,
    conditionMet: input.ebuFirstMonthLeapfrogRevenue !== null ? input.ebuFirstMonthLeapfrogRevenue > 0 : null,
    amount: round2(ebuRevenueAmount),
    calculationNote: criteria === 'BRONZE' ? 'Bronze shops do not earn EBU revenue share'
      : input.ebuFirstMonthLeapfrogRevenue !== null
        ? `${input.ebuFirstMonthLeapfrogRevenue} × ${criteria === 'GOLD' ? '0.25' : '0.15'}`
        : 'EBU first month revenue data missing',
  })

  const totalAmount = round2(components.reduce((sum, c) => sum + c.amount, 0))

  components.push({
    componentCode: 'TOTAL',
    componentName: 'Total Incentive',
    inputMetric: null,
    inputValue: null,
    conditionMet: null,
    amount: totalAmount,
    calculationNote: `Sum of all components = ${totalAmount}`,
  })

  return { components, totalAmount, issues }
}

export async function calculateAllShopManagerIncentives(periodId: string): Promise<any> {
  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: {
      performanceInputs: {
        include: {
          shopLocation: {
            include: {
              shopProfile: true,
            },
          },
          shopManager: true,
        },
      },
    },
  })

  if (!period) {
    throw new Error(`Incentive period not found: ${periodId}`)
  }

  const results: any[] = []

  for (const perfInput of period.performanceInputs) {
    const inputId = perfInput.id
    const shopId = perfInput.shopLocationId

    const shopProfile = perfInput.shopLocation.shopProfile

    let shopCriteria = perfInput.shopCriteria
    if (!shopCriteria) {
      const criteriaResult = await getShopCriteriaForPeriod(shopId, new Date(period.year, period.month - 1))
      shopCriteria = criteriaResult.criteria as any
    }

    const calcInput = {
      shopCriteria: shopCriteria || 'UNASSIGNED',
      corridorType: perfInput.corridorType || 'UNKNOWN',
      qgaAchievementPercent: perfInput.qgaAchievementPercent ? Number(perfInput.qgaAchievementPercent) : null,
      qgaCount: perfInput.qgaCount,
      evdAchievementPercent: perfInput.evdAchievementPercent ? Number(perfInput.evdAchievementPercent) : null,
      evdReconciled: perfInput.evdReconciled,
      baSiteRequirementMet: perfInput.baSiteRequirementMet,
      mpesaFloatSold: perfInput.mpesaFloatSold ? Number(perfInput.mpesaFloatSold) : null,
      mpesaTargetAchieved: perfInput.mpesaTargetAchieved,
      mpesaReconciled: perfInput.mpesaReconciled,
      dsaAirtimeAchievementPercent: perfInput.dsaAirtimeAchievementPercent ? Number(perfInput.dsaAirtimeAchievementPercent) : null,
      mmQoTargetPercent: perfInput.mmQoTargetPercent ? Number(perfInput.mmQoTargetPercent) : null,
      ebuTargetAchieved: perfInput.ebuTargetAchieved,
      ebuRevenue: perfInput.ebuRevenue ? Number(perfInput.ebuRevenue) : null,
      ebuAverageTopup: perfInput.ebuAverageTopup ? Number(perfInput.ebuAverageTopup) : null,
      ebuFirstMonthLeapfrogRevenue: perfInput.ebuFirstMonthLeapfrogRevenue ? Number(perfInput.ebuFirstMonthLeapfrogRevenue) : null,
    }

    const validationResult = await validatePerformanceInput({
      shopManagerId: perfInput.shopManagerId,
      shopCriteria: calcInput.shopCriteria,
      corridorType: calcInput.corridorType,
      qgaAchievementPercent: calcInput.qgaAchievementPercent,
      qgaCount: calcInput.qgaCount,
      evdAchievementPercent: calcInput.evdAchievementPercent,
      evdReconciled: calcInput.evdReconciled,
      baSiteRequirementMet: calcInput.baSiteRequirementMet,
      mpesaFloatSold: calcInput.mpesaFloatSold,
      mpesaTargetAchieved: calcInput.mpesaTargetAchieved,
      mpesaReconciled: calcInput.mpesaReconciled,
      dsaAirtimeAchievementPercent: calcInput.dsaAirtimeAchievementPercent,
      mmQoTargetPercent: calcInput.mmQoTargetPercent,
      ebuTargetAchieved: calcInput.ebuTargetAchieved,
      ebuRevenue: calcInput.ebuRevenue,
      ebuAverageTopup: calcInput.ebuAverageTopup,
      ebuFirstMonthLeapfrogRevenue: calcInput.ebuFirstMonthLeapfrogRevenue,
    })

    const calculationResult = await calculateShopManagerIncentive(calcInput)

    const blockerCount = calculationResult.issues.filter(i => i.severity === 'BLOCKER').length + validationResult.issues.filter(i => i.severity === 'BLOCKER').length
    const warningCount = calculationResult.issues.filter(i => i.severity === 'WARNING').length + validationResult.issues.filter(i => i.severity === 'WARNING').length

    const combinedIssues = [...validationResult.issues, ...calculationResult.issues.filter(i => i.severity !== 'INFO')]

    const finalStatus: CalculationStatus = blockerCount > 0 ? 'BLOCKED' : 'CALCULATED'

    const existingCalc = await prisma.shopManagerIncentiveCalculation.findUnique({
      where: {
        incentivePeriodId_shopLocationId: {
          incentivePeriodId: periodId,
          shopLocationId: shopId,
        },
      },
    })

    let calculation
    if (existingCalc) {
      calculation = await prisma.shopManagerIncentiveCalculation.update({
        where: { id: existingCalc.id },
        data: {
          performanceInputId: inputId,
          shopManagerId: perfInput.shopManagerId,
          shopCriteria: shopCriteria,
          status: finalStatus,
          totalAmount: calculationResult.totalAmount,
          blockerCount,
          warningCount,
          calculatedAt: new Date(),
        },
      })

      await prisma.shopManagerIncentiveComponent.deleteMany({
        where: { calculationId: calculation.id },
      })

      await prisma.shopManagerIncentiveIssue.deleteMany({
        where: {
          incentivePeriodId: periodId,
          shopLocationId: shopId,
        },
      })
    } else {
      calculation = await prisma.shopManagerIncentiveCalculation.create({
        data: {
          incentivePeriodId: periodId,
          performanceInputId: inputId,
          shopLocationId: shopId,
          shopManagerId: perfInput.shopManagerId,
          shopCriteria: shopCriteria,
          status: finalStatus,
          totalAmount: calculationResult.totalAmount,
          blockerCount,
          warningCount,
          calculatedAt: new Date(),
        },
      })
    }

    if (calculationResult.components.length > 0) {
      await prisma.shopManagerIncentiveComponent.createMany({
        data: calculationResult.components.map(c => ({
          calculationId: calculation.id,
          componentCode: c.componentCode as IncentiveComponentCode,
          componentName: c.componentName,
          inputMetric: c.inputMetric,
          inputValue: c.inputValue !== null ? c.inputValue : null,
          conditionMet: c.conditionMet,
          amount: c.amount,
          calculationNote: c.calculationNote,
        })),
      })
    }

    if (combinedIssues.length > 0) {
      await prisma.shopManagerIncentiveIssue.createMany({
        data: combinedIssues.map(i => ({
          incentivePeriodId: periodId,
          shopLocationId: shopId,
          shopManagerId: perfInput.shopManagerId,
          severity: i.severity as IncentiveIssueSeverity,
          issueCode: i.issueCode as IncentiveIssueCode,
          message: i.message,
        })),
      })
    }

    results.push({
      shopId,
      calculationId: calculation.id,
      status: finalStatus,
      totalAmount: calculationResult.totalAmount,
      issueCount: combinedIssues.length,
    })
  }

  await prisma.shopManagerIncentivePeriod.update({
    where: { id: periodId },
    data: { status: 'CALCULATED' as IncentivePeriodStatus },
  })

  return {
    periodId,
    status: 'CALCULATED',
    calculations: results,
  }
}

export async function sendApprovedIncentivesToPayrollInputs(
  periodId: string,
  options?: { overwriteMode?: string },
): Promise<any> {
  const overwriteMode = options?.overwriteMode || 'SKIP_EXISTING'

  const period = await prisma.shopManagerIncentivePeriod.findUnique({
    where: { id: periodId },
    include: { payrollPeriod: true },
  })

  if (!period) {
    throw new Error(`Incentive period not found: ${periodId}`)
  }

  const calculations = await prisma.shopManagerIncentiveCalculation.findMany({
    where: {
      incentivePeriodId: periodId,
      status: { in: ['APPROVED', 'LOCKED'] as any },
    },
    include: {
      components: true,
      shopLocation: true,
      shopManager: true,
    },
  })

  const inputTypes = await prisma.payrollInputType.findMany({
    where: {
      code: {
        in: [
          'SHOP_MANAGER_QGA_BONUS',
          'SHOP_MANAGER_QGA_SIM_COMMISSION',
          'SHOP_MANAGER_EVD_BONUS',
          'SHOP_MANAGER_BA_SITE_BONUS',
          'SHOP_MANAGER_MPESA_COMMISSION',
          'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS',
          'SHOP_MANAGER_QO_BONUS',
          'SHOP_MANAGER_EBU_ACTIVATION_BONUS',
          'SHOP_MANAGER_EBU_REVENUE_SHARE',
          'SHOP_MANAGER_TOTAL_INCENTIVE',
        ],
      },
    },
  })

  const inputTypeMap = new Map(inputTypes.map(it => [it.code, it.id]))

  const componentCodeToInputTypeCode: Record<string, string> = {
    'QGA_BONUS': 'SHOP_MANAGER_QGA_BONUS',
    'QGA_SIM_COMMISSION': 'SHOP_MANAGER_QGA_SIM_COMMISSION',
    'EVD_BONUS': 'SHOP_MANAGER_EVD_BONUS',
    'BA_SITE_BONUS': 'SHOP_MANAGER_BA_SITE_BONUS',
    'MPESA_COMMISSION': 'SHOP_MANAGER_MPESA_COMMISSION',
    'DSA_ACHIEVEMENT_BONUS': 'SHOP_MANAGER_DSA_ACHIEVEMENT_BONUS',
    'QO_BONUS': 'SHOP_MANAGER_QO_BONUS',
    'EBU_ACTIVATION_BONUS': 'SHOP_MANAGER_EBU_ACTIVATION_BONUS',
    'EBU_REVENUE_SHARE': 'SHOP_MANAGER_EBU_REVENUE_SHARE',
    'TOTAL': 'SHOP_MANAGER_TOTAL_INCENTIVE',
  }

  const payrollPeriodId = period.payrollPeriodId
  const results: any[] = []

  for (const calc of calculations) {
    if (!calc.shopManagerId) continue

    for (const component of calc.components) {
      const inputTypeCode = componentCodeToInputTypeCode[component.componentCode]
      if (!inputTypeCode) continue

      const inputTypeId = inputTypeMap.get(inputTypeCode)
      if (!inputTypeId) continue

      const existingInput = await prisma.payrollInput.findUnique({
        where: {
          payrollPeriodId_employeeId_inputTypeId: {
            payrollPeriodId,
            employeeId: calc.shopManagerId,
            inputTypeId,
          },
        },
      })

      const existingIsLocked = existingInput?.isLocked === true

      if (existingInput) {
        if (existingIsLocked) {
          results.push({
            shopId: calc.shopLocationId,
            employeeId: calc.shopManagerId,
            componentCode: component.componentCode,
            action: 'SKIPPED_LOCKED',
          })
          continue
        }

        if (overwriteMode === 'SKIP_EXISTING') {
          results.push({
            shopId: calc.shopLocationId,
            employeeId: calc.shopManagerId,
            componentCode: component.componentCode,
            action: 'SKIPPED_EXISTING',
          })
          continue
        }

        if (overwriteMode === 'UPDATE_EXISTING_DRAFT_ONLY') {
          if (existingInput.status !== 'DRAFT') {
            results.push({
              shopId: calc.shopLocationId,
              employeeId: calc.shopManagerId,
              componentCode: component.componentCode,
              action: 'SKIPPED_NOT_DRAFT',
            })
            continue
          }

          await prisma.payrollInput.update({
            where: { id: existingInput.id },
            data: {
              value: component.amount,
              amount: component.amount,
              note: `Updated from incentive calculation: ${component.calculationNote || ''}`,
              source: 'SYSTEM',
            },
          })

          results.push({
            shopId: calc.shopLocationId,
            employeeId: calc.shopManagerId,
            componentCode: component.componentCode,
            action: 'UPDATED',
          })
          continue
        }

        if (overwriteMode === 'REPLACE_EXISTING_NOT_LOCKED') {
          await prisma.payrollInput.delete({
            where: { id: existingInput.id },
          })
        }
      }

      await prisma.payrollInput.create({
        data: {
          payrollPeriodId,
          employeeId: calc.shopManagerId,
          inputTypeId,
          value: component.amount,
          amount: component.amount,
          note: `From incentive calculation: ${component.calculationNote || ''}`,
          source: 'SYSTEM',
          status: 'ACCEPTED',
          isLocked: false,
        },
      })

      results.push({
        shopId: calc.shopLocationId,
        employeeId: calc.shopManagerId,
        componentCode: component.componentCode,
        action: 'CREATED',
      })
    }
  }

  return {
    periodId,
    payrollPeriodId,
    calculationsProcessed: calculations.length,
    payrollInputsCreatedOrUpdated: results.length,
    details: results,
  }
}
