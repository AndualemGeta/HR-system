import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollPreparationSummary.export'))) return forbidden()
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound('Payroll period not found')
    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    let scopeFilter: any = {}
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmps = await prisma.employee.findMany({ where: scopeWhere, select: { id: true } })
      scopeFilter = { employeeId: { in: scopeEmps.map(e => e.id) } }
    }
    const inputWhere: any = { payrollPeriodId: id }
    if (scopeFilter.employeeId) inputWhere.employeeId = scopeFilter.employeeId
    const inputs = await prisma.payrollInput.findMany({
      where: inputWhere,
      include: { employee: { select: { employeeId: true, fullName: true, currentRole: true } }, inputType: { select: { code: true, name: true } } },
      orderBy: [{ employeeId: 'asc' }, { inputType: { code: 'asc' } }],
    })
    const rows = inputs.map(i => [
      i.employee.employeeId,
      i.employee.fullName,
      i.employee.currentRole,
      i.inputType.code,
      i.inputType.name,
      i.value?.toString() || '',
      i.amount?.toString() || '',
      i.status,
      i.source,
      i.isLocked ? 'LOCKED' : 'UNLOCKED',
      i.note || '',
    ])
    const csvHeader = 'EmployeeID,FullName,Role,InputTypeCode,InputTypeName,Value,Amount,Status,Source,LockStatus,Note'
    const csvBody = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const csv = csvHeader + '\n' + csvBody
    await createAuditLog({ userId: session.userId, action: 'PAYROLL_PREPARATION_SUMMARY_EXPORT', entityType: 'PayrollPeriod', entityId: id, newValue: { exportedRows: rows.length } })
    return new Response(csv, {
      headers: { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="payroll-summary-${id}.csv"` },
    })
  } catch (err) { console.error(err); return internalError() }
}
