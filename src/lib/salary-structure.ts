import { prisma } from './prisma'
import type { PayRule } from '@prisma/client'

export interface PreviewResult {
  calculatedAmount: number
  explanation: string
  warnings: string[]
}

interface TierConfig {
  min: number
  percent?: number
  amount?: number
}

export interface ValidationError {
  field: string
  message: string
}

export function validateRuleFields(body: Record<string, unknown>, isUpdate = false): ValidationError[] {
  const errors: ValidationError[] = []

  const method = (body.calculationMethod as string) || (body.ruleType as string)
  const thresholdValue = body.thresholdValue
  const percentageRate = body.percentageRate
  const baseAmount = body.baseAmount
  const maxAmount = body.maxAmount
  const minAmount = body.minAmount
  const tierConfigJson = body.tierConfigJson

  if (!isUpdate) {
    if (method === 'FIXED_AMOUNT' && !baseAmount) {
      errors.push({ field: 'baseAmount', message: 'baseAmount is required for FIXED_AMOUNT method' })
    }
    if (method === 'PERCENTAGE' && (!percentageRate || Number(percentageRate) <= 0)) {
      errors.push({ field: 'percentageRate', message: 'percentageRate (>0) is required for PERCENTAGE method' })
    }
    if (method === 'THRESHOLD' && thresholdValue === undefined) {
      errors.push({ field: 'thresholdValue', message: 'thresholdValue is required for THRESHOLD method' })
    }
    if (method === 'TIERED' && !tierConfigJson) {
      errors.push({ field: 'tierConfigJson', message: 'tierConfigJson is required for TIERED method' })
    }
  }

  if (thresholdValue !== undefined && Number(thresholdValue) < 0) {
    errors.push({ field: 'thresholdValue', message: 'thresholdValue cannot be negative' })
  }
  if (percentageRate !== undefined && (Number(percentageRate) < 0 || Number(percentageRate) > 100)) {
    errors.push({ field: 'percentageRate', message: 'percentageRate must be between 0 and 100' })
  }
  if (baseAmount !== undefined && Number(baseAmount) < 0) {
    errors.push({ field: 'baseAmount', message: 'baseAmount cannot be negative' })
  }
  if (maxAmount !== undefined && Number(maxAmount) < 0) {
    errors.push({ field: 'maxAmount', message: 'maxAmount cannot be negative' })
  }
  if (minAmount !== undefined && Number(minAmount) < 0) {
    errors.push({ field: 'minAmount', message: 'minAmount cannot be negative' })
  }

  if (tierConfigJson) {
    try {
      const tiers = JSON.parse(tierConfigJson as string) as TierConfig[]
      if (!Array.isArray(tiers) || tiers.length === 0) {
        errors.push({ field: 'tierConfigJson', message: 'Tier config must be a non-empty array' })
      } else {
        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i]
          if (t.min < 0) errors.push({ field: 'tierConfigJson', message: `Tier ${i}: min value cannot be negative` })
          if (t.amount !== undefined && t.amount < 0) errors.push({ field: 'tierConfigJson', message: `Tier ${i}: amount cannot be negative` })
        }
        const mins = tiers.map(t => t.min)
        for (let i = 1; i < mins.length; i++) {
          if (mins[i] >= mins[i - 1]) {
            errors.push({ field: 'tierConfigJson', message: 'Tier min values must be in descending order (highest first)' })
            break
          }
        }
      }
    } catch {
      errors.push({ field: 'tierConfigJson', message: 'Invalid tier config JSON' })
    }
  }

  return errors
}

function parseTiers(tierConfigJson: string | null): TierConfig[] {
  if (!tierConfigJson) return []
  try {
    return JSON.parse(tierConfigJson) as TierConfig[]
  } catch {
    return []
  }
}

export function calculateRulePreview(rule: PayRule, inputValue: number): PreviewResult {
  const warnings: string[] = []
  let calculatedAmount = 0
  let explanation = ''

  const method = rule.calculationMethod || rule.ruleType

  switch (method) {
    case 'FIXED_AMOUNT': {
      const base = Number(rule.baseAmount ?? 0)
      calculatedAmount = base
      explanation = `Fixed amount: ${base}`
      break
    }

    case 'PERCENTAGE': {
      const rate = Number(rule.percentageRate ?? 0)
      calculatedAmount = (inputValue * rate) / 100
      explanation = `Percentage: ${inputValue} × ${rate}% = ${calculatedAmount}`
      break
    }

    case 'THRESHOLD': {
      const threshold = Number(rule.thresholdValue ?? 0)
      if (inputValue < threshold) {
        calculatedAmount = 0
        explanation = `Threshold not met: input ${inputValue} < threshold ${threshold}`
      } else {
        const flatAmount = rule.baseAmount !== null ? Number(rule.baseAmount) : (inputValue * Number(rule.percentageRate ?? 0)) / 100
        calculatedAmount = flatAmount
        explanation = `Threshold met (${inputValue} ≥ ${threshold}): flat amount ${flatAmount}`
      }
      break
    }

    case 'TIERED': {
      const tiers = parseTiers(rule.tierConfigJson)
      if (tiers.length === 0) {
        calculatedAmount = 0
        explanation = 'No tier configuration defined'
        break
      }
      const sorted = [...tiers].sort((a, b) => b.min - a.min)
      let matched = false
      for (const tier of sorted) {
        if (inputValue >= tier.min) {
          const amt = tier.amount ?? (tier.percent ? (inputValue * tier.percent) / 100 : 0)
          calculatedAmount = amt
          explanation = `Tier matched (min ${tier.min}): ${amt}`
          matched = true
          break
        }
      }
      if (!matched) {
        calculatedAmount = 0
        explanation = 'No tier matched'
      }
      break
    }

    case 'MANUAL_INPUT': {
      calculatedAmount = inputValue
      explanation = 'Manual input: requires user-provided value'
      break
    }

    default: {
      calculatedAmount = 0
      explanation = `Unsupported calculation method: ${method}`
      warnings.push(`Calculation method ${method} is not supported for preview`)
    }
  }

  const maxAmt = rule.maxAmount ? Number(rule.maxAmount) : null
  const minAmt = rule.minAmount ? Number(rule.minAmount) : null

  if (maxAmt !== null && calculatedAmount > maxAmt) {
    warnings.push(`Capped at max amount ${maxAmt} (was ${calculatedAmount})`)
    calculatedAmount = maxAmt
  }

  if (minAmt !== null && calculatedAmount < minAmt) {
    warnings.push(`Floored at min amount ${minAmt} (was ${calculatedAmount})`)
    calculatedAmount = minAmt
  }

  return { calculatedAmount, explanation, warnings }
}

export async function findMatchingRule(params: {
  role?: string
  employeeCategory?: string
  departmentId?: string
  regionId?: string
  areaId?: string
  shopId?: string
  employmentType?: string
  effectiveDate: Date
}): Promise<PayRule[]> {
  const where: Record<string, unknown> = {
    status: 'ACTIVE',
    effectiveFrom: { lte: params.effectiveDate },
    AND: [
      { OR: [{ effectiveTo: null }, { effectiveTo: { gte: params.effectiveDate } }] },
    ],
  }

  if (params.role) where.role = params.role
  if (params.employeeCategory) where.employeeCategory = params.employeeCategory
  if (params.departmentId) where.departmentId = params.departmentId
  if (params.regionId) where.regionId = params.regionId
  if (params.areaId) where.areaId = params.areaId
  if (params.shopId) where.shopId = params.shopId
  if (params.employmentType) where.employmentType = params.employmentType

  return prisma.payRule.findMany({ where: where as any, orderBy: { priority: 'desc' } })
}

export async function validateRuleForActivation(ruleId: string): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  const rule = await prisma.payRule.findUnique({ where: { id: ruleId }, include: { component: true } })
  if (!rule) { errors.push('Rule not found'); return { valid: false, errors } }

  if (!rule.component || !rule.component.isActive) {
    errors.push('Component must exist and be active')
  }

  if (!rule.effectiveFrom) {
    errors.push('Effective from date is required')
  }

  if (rule.baseAmount !== null && Number(rule.baseAmount) < 0) {
    errors.push('Base amount cannot be negative')
  }

  if (rule.maxAmount !== null && Number(rule.maxAmount) < 0) {
    errors.push('Max amount cannot be negative')
  }

  if (rule.percentageRate !== null && (Number(rule.percentageRate) < 0 || Number(rule.percentageRate) > 100)) {
    errors.push('Percentage rate must be between 0 and 100')
  }

  if (rule.thresholdValue !== null && Number(rule.thresholdValue) < 0) {
    errors.push('Threshold value cannot be negative')
  }

  if (rule.tierConfigJson) {
    try {
      const tiers = JSON.parse(rule.tierConfigJson) as TierConfig[]
      if (!Array.isArray(tiers) || tiers.length === 0) {
        errors.push('Tier config must be a non-empty array')
      } else {
        for (let i = 0; i < tiers.length; i++) {
          const t = tiers[i]
          if (t.min < 0) errors.push(`Tier ${i}: min value cannot be negative`)
          if (t.amount !== undefined && t.amount < 0) errors.push(`Tier ${i}: amount cannot be negative`)
        }
        const mins = tiers.map(t => t.min)
        for (let i = 1; i < mins.length; i++) {
          if (mins[i] >= mins[i - 1]) {
            errors.push('Tier min values must be in descending order (highest first)')
            break
          }
        }
      }
    } catch {
      errors.push('Invalid tier config JSON')
    }
  }

  const method = rule.calculationMethod || rule.ruleType
  const calcMethodsNeedingTiers = ['TIERED']

  if (calcMethodsNeedingTiers.includes(method) && !rule.tierConfigJson) {
    errors.push('Tier config is required for TIERED calculation method')
  }

  if (method === 'PERCENTAGE' && (rule.percentageRate === null || Number(rule.percentageRate) <= 0)) {
    errors.push('Percentage rate is required for PERCENTAGE calculation method')
  }
  if (method === 'THRESHOLD' && rule.baseAmount === null && (rule.percentageRate === null || Number(rule.percentageRate) <= 0)) {
    errors.push('Either baseAmount or percentageRate is required for THRESHOLD method')
  }

  const existingActive = await prisma.payRule.findFirst({
    where: {
      id: { not: ruleId },
      componentId: rule.componentId,
      role: rule.role,
      employeeCategory: rule.employeeCategory,
      departmentId: rule.departmentId,
      regionId: rule.regionId,
      areaId: rule.areaId,
      shopId: rule.shopId,
      employmentType: rule.employmentType,
      status: 'ACTIVE',
      effectiveFrom: { lte: rule.effectiveTo || new Date('9999-12-31') },
      AND: [
        { OR: [{ effectiveTo: null }, { effectiveTo: { gte: rule.effectiveFrom } }] },
      ],
    },
  })
  if (existingActive) {
    errors.push('An active rule already exists for the same component, scope, and overlapping effective date range')
  }

  return { valid: errors.length === 0, errors }
}
