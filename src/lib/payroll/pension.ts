import { prisma } from '@/lib/prisma'
import { round2 } from '@/lib/payroll-rounding'
import { calcPercent } from '@/lib/money'
import type { PensionRuleInfo, CalculationLine } from './types'

export function calcPension(pensionableBase: number, rule: PensionRuleInfo): { employeePension: number; employerPension: number } {
  let base = pensionableBase
  if (rule.minimumBase !== null && base < rule.minimumBase) base = rule.minimumBase
  if (rule.maximumBase !== null && base > rule.maximumBase) base = rule.maximumBase
  return {
    employeePension: round2(calcPercent(base, rule.employeeRate)),
    employerPension: round2(calcPercent(base, rule.employerRate)),
  }
}

export function selectPensionRule(
  rules: PensionRuleInfo[],
  employee: { employmentType?: string | null; role?: string | null },
): { rule: PensionRuleInfo | null; blockers: string[] } {
  const blockers: string[] = []
  if (rules.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  const applicable = rules.filter(r => {
    if (r.applicableRole !== null && r.applicableRole !== (employee.role ?? null)) return false
    if (r.applicableEmploymentType !== null && r.applicableEmploymentType !== (employee.employmentType ?? null)) return false
    return true
  })

  if (applicable.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  const scored = applicable.map(r => {
    let score = 0
    if (r.applicableRole) score += 10
    if (r.applicableEmploymentType) score += 5
    return { rule: r, score }
  })

  const maxScore = Math.max(...scored.map(s => s.score))
  const topScored = scored.filter(s => s.score === maxScore)

  if (topScored.length === 0) {
    blockers.push('MISSING_PENSION_RULE')
    return { rule: null, blockers }
  }

  const maxPriority = Math.max(...topScored.map(s => s.rule.priority))
  const topPriority = topScored.filter(s => s.rule.priority === maxPriority)

  if (topPriority.length > 1) {
    blockers.push('AMBIGUOUS_PENSION_RULE')
    return { rule: null, blockers }
  }

  return { rule: topPriority[0].rule, blockers }
}

export function determinePensionableIncome(
  proratedBasicSalary: number,
  lines: CalculationLine[],
  baseType: string,
): number {
  switch (baseType) {
    case 'BASIC_SALARY':
      return proratedBasicSalary
    case 'PENSIONABLE_EARNINGS':
      return round2(lines.reduce((sum, l) => sum + (l.pensionableAmount ?? 0), 0))
    default:
      return proratedBasicSalary
  }
}

export async function getApprovedPensionRules(payDate: Date): Promise<PensionRuleInfo[]> {
  const rules = await prisma.pensionRule.findMany({
    where: {
      approvalStatus: 'APPROVED',
      isActive: true,
      isSample: false,
      effectiveStartDate: { lte: payDate },
      OR: [{ effectiveEndDate: null }, { effectiveEndDate: { gte: payDate } }],
    },
    orderBy: [{ priority: 'desc' }, { effectiveStartDate: 'desc' }],
  })
  return rules.map(r => ({
    id: r.id,
    employeeRate: Number(r.employeeRate),
    employerRate: Number(r.employerRate),
    pensionBaseType: r.pensionBaseType,
    minimumBase: r.minimumBase ? Number(r.minimumBase) : null,
    maximumBase: r.maximumBase ? Number(r.maximumBase) : null,
    priority: r.priority,
    applicableRole: r.applicableRole,
    applicableEmploymentType: r.applicableEmploymentType,
  }))
}
