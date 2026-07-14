import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.export'))) return forbidden()
    const { id } = await params

    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()

    const batch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id, status: { not: 'CANCELLED' } },
      orderBy: { version: 'desc' },
    })
    if (!batch) return notFound()

    const rows = await prisma.payrollPreparationRow.findMany({
      where: { batchId: batch.id, includedInExport: true },
      include: { calculationLines: true },
      orderBy: { fullName: 'asc' },
    })

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_EXPORT',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: { batchId: batch.id, version: batch.version, rowCount: rows.length },
    })

    return success({
      periodName: period.periodName,
      batchVersion: batch.version,
      exportedAt: new Date().toISOString(),
      rows: rows.map(r => ({
        employeeCode: r.employeeCode,
        fullName: r.fullName,
        role: r.role,
        basicSalary: r.basicSalary,
        grossSalary: r.grossSalary,
        taxableIncome: r.taxableIncome,
        employeePension: r.employeePension,
        employerPension: r.employerPension,
        payeTax: r.payeTax,
        totalDeductions: r.totalDeductions,
        netSalary: r.netSalary,
        employerTotalCost: r.employerTotalCost,
        lines: r.calculationLines.map(l => ({
          componentCode: l.componentCode,
          componentName: l.componentName,
          lineType: l.lineType,
          grossAmount: l.grossAmount,
          taxableAmount: l.taxableAmount,
          deductionAmount: l.deductionAmount,
          employerAmount: l.employerAmount,
        })),
      })),
    })
  } catch (e) { console.error(e); return internalError() }
}
