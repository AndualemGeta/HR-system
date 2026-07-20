import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import {
  buildCalculationContext,
  calculateEmployeePayroll,
  evaluatePayrollPeriodReadiness,
} from '@/lib/payroll-calculation-engine'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.preview'))) return forbidden()

    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    // Run readiness first — same blockers as calculate
    const readiness = await evaluatePayrollPeriodReadiness({ payrollPeriodId: id, userId: session.userId, includeEmployeeDetails: true })
    if (!readiness.readyForCalculation) {
      return success({
        blocked: true,
        readyForCalculation: false,
        periodBlockers: readiness.periodBlockers,
        periodWarnings: readiness.periodWarnings,
        selectedEmployeeCount: readiness.selectedEmployeeCount,
        readyEmployeeCount: readiness.readyEmployeeCount,
        warningEmployeeCount: readiness.warningEmployeeCount,
        blockedEmployeeCount: readiness.blockedEmployeeCount,
        employeeResults: readiness.employeeResults,
        rows: [],
      })
    }

    const ctx = await buildCalculationContext(id)
    if (!ctx) return notFound()
    if (ctx.employees.length === 0) return badRequest('No selected employees')

    const results: Awaited<ReturnType<typeof calculateEmployeePayroll>>[] = []
    for (const emp of ctx.employees) {
      const result = await calculateEmployeePayroll(ctx, emp)
      results.push(result)
    }

    let grossTotal = 0, taxTotal = 0, netTotal = 0, pensionTotal = 0, payeTotal = 0

    const rows = results.map(r => {
      grossTotal += r.grossSalary
      taxTotal += r.taxableIncome
      netTotal += r.netSalary
      pensionTotal += r.employeePension
      payeTotal += r.payeTax
      return {
        employeeId: r.employeeId,
        employeeCode: ctx.employees.find(e => e.id === r.employeeId)?.employeeId || '',
        fullName: ctx.employees.find(e => e.id === r.employeeId)?.fullName || '',
        role: ctx.employees.find(e => e.id === r.employeeId)?.currentRole || '',
        level: ctx.employees.find(e => e.id === r.employeeId)?.currentLevel || '',
        basicSalary: r.proratedBasicSalary,
        grossSalary: r.grossSalary,
        grossTaxableEarnings: r.grossTaxableEarnings,
        grossNonTaxableEarnings: r.grossNonTaxableEarnings,
        taxableIncome: r.taxableIncome,
        employeePension: r.employeePension,
        employerPension: r.employerPension,
        payeTax: r.payeTax,
        preTaxDeductions: r.preTaxDeductions,
        postTaxDeductions: r.postTaxDeductions,
        totalDeductions: r.totalDeductions,
        netSalary: r.netSalary,
        employerTotalCost: r.employerTotalCost,
        status: r.blockers.length > 0 ? 'BLOCKED' : r.warnings.length > 0 ? 'WARNING' : 'READY',
        blockers: r.blockers,
        warnings: r.warnings,
        lineCount: r.lines.length,
        lines: r.lines,
      }
    })

    return success({
      payrollPeriodId: id,
      totalEmployees: results.length,
      grossEarningsTotal: grossTotal,
      taxableIncomeTotal: taxTotal,
      employeePensionTotal: pensionTotal,
      payeTaxTotal: payeTotal,
      netSalaryTotal: netTotal,
      blockerCount: results.filter(r => r.blockers.length > 0).length,
      rows,
    })
  } catch (e) { console.error(e); return internalError() }
}
