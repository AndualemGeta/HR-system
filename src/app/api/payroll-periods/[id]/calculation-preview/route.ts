import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { resolveSalary } from '@/lib/payroll-calculation-engine'
import { round2, sum } from '@/lib/payroll-rounding'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.preview'))) return forbidden()

    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY_FOR_CALCULATION') return badRequest(`Period status is ${period.status}, expected READY_FOR_CALCULATION`)

    const selectedEmployees = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true, removedAt: null },
      include: { employee: true },
    })

    if (selectedEmployees.length === 0) return badRequest('No selected employees')

    let grossEarningsTotal = 0
    const rows: Record<string, unknown>[] = []

    for (const pe of selectedEmployees) {
      const emp = pe.employee
      const salary = await resolveSalary(emp.id, period.periodEnd)
      const blockers: string[] = []
      const warnings: string[] = []

      if (!salary.basicSalary || salary.basicSalary <= 0) blockers.push('MISSING_EFFECTIVE_BASIC_SALARY')

      const proratedBasicSalary = salary.basicSalary || 0
      const lines: Record<string, unknown>[] = []

      if (proratedBasicSalary > 0) {
        lines.push({
          componentCode: 'BASIC_SALARY',
          componentName: 'Basic Salary',
          lineType: 'BASIC_SALARY',
          sourceType: salary.salarySource,
          grossAmount: proratedBasicSalary,
          taxableAmount: proratedBasicSalary,
        })
      }

      const acceptedInputs = await prisma.payrollInput.findMany({
        where: { payrollPeriodId: id, employeeId: emp.id, status: 'ACCEPTED', isLocked: true },
        include: { inputType: true },
      })

      for (const inp of acceptedInputs) {
        const amount = inp.amount ? Number(inp.amount) : 0
        if (amount > 0) {
          lines.push({
            componentCode: inp.inputType.code,
            componentName: inp.inputType.name,
            lineType: 'ALLOWANCE',
            sourceType: 'PAYROLL_INPUT',
            grossAmount: amount,
            taxableAmount: amount,
          })
        }
      }

      const grossSalary = round2(sum(...lines.map(l => l.grossAmount as number)))
      const taxableIncome = round2(sum(...lines.map(l => l.taxableAmount as number)))
      const status = blockers.length > 0 ? 'BLOCKED' : warnings.length > 0 ? 'WARNING' : 'READY'
      grossEarningsTotal += grossSalary

      rows.push({
        employeeId: emp.id,
        employeeCode: emp.employeeId,
        fullName: emp.fullName,
        role: emp.currentRole,
        level: emp.currentLevel,
        basicSalary: proratedBasicSalary,
        grossSalary,
        taxableIncome,
        status,
        blockers,
        warnings,
        lineCount: lines.length,
      })
    }

    return success({
      payrollPeriodId: id,
      totalEmployees: selectedEmployees.length,
      grossEarningsTotal: round2(grossEarningsTotal),
      rows,
    })
  } catch (e) { console.error(e); return internalError() }
}
