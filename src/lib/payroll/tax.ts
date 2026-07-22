import { prisma } from '@/lib/prisma'
import { round2 } from '@/lib/payroll-rounding'
import { calcPercent } from '@/lib/money'
import type { PayeBracket } from './types'

export function calcPaye(taxableIncome: number, bracket: PayeBracket): number {
  return Math.max(0, round2(calcPercent(taxableIncome, bracket.taxRate).minus(bracket.deductionAmount)))
}

export function selectPayeBracket(taxableIncome: number, brackets: PayeBracket[]): { bracket: PayeBracket | null; blockers: string[] } {
  const blockers: string[] = []
  if (brackets.length === 0) {
    blockers.push('MISSING_PAYE_SCHEDULE')
    return { bracket: null, blockers }
  }
  const codes = new Set(brackets.map(b => b.scheduleCode))
  if (codes.size > 1) {
    blockers.push('MULTIPLE_PAYE_SCHEDULE_CODES')
    return { bracket: null, blockers }
  }
  const highest = brackets[brackets.length - 1]
  if (highest.maxIncome !== null) {
    blockers.push('HIGHEST_BRACKET_NOT_OPEN_ENDED')
    return { bracket: null, blockers }
  }
  const matching = brackets.filter(b => {
    if (b.maxIncome === null) return taxableIncome >= b.minIncome
    return taxableIncome >= b.minIncome && taxableIncome < b.maxIncome
  })
  if (matching.length === 0) {
    blockers.push(`Taxable income ${taxableIncome} falls outside any bracket (schedule gap)`)
    return { bracket: null, blockers }
  }
  if (matching.length > 1) {
    blockers.push(`Multiple brackets match taxable income ${taxableIncome}`)
    return { bracket: null, blockers }
  }
  return { bracket: matching[0], blockers }
}

export async function getApprovedPayeBrackets(payDate: Date): Promise<PayeBracket[]> {
  const brackets = await prisma.payeTaxBracket.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      isSample: false,
      effectiveStartDate: { lte: payDate },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: payDate } }],
    },
    orderBy: { minIncome: 'asc' },
  })

  // Collect distinct schedule codes (including null)
  const scheduleCodes = [...new Set(brackets.map(b => b.scheduleCode))]
  if (scheduleCodes.length > 1) {
    // Multiple schedules active — return empty, caller will see MULTIPLE_PAYE_SCHEDULE_CODES
    return []
  }

  return brackets.map(b => ({
    id: b.id,
    scheduleCode: b.scheduleCode,
    minIncome: Number(b.minIncome),
    maxIncome: b.maxIncome ? Number(b.maxIncome) : null,
    taxRate: Number(b.taxRate),
    deductionAmount: Number(b.deductionAmount),
  }))
}
