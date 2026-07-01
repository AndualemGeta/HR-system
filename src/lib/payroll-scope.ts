import { prisma } from './prisma'
import { buildEmployeeScopeWhere } from './rbac'

export async function assertEmployeeInUserScope(userId: string, employeeId: string): Promise<{ allowed: boolean; error?: string }> {
  const scopeWhere = await buildEmployeeScopeWhere(userId)
  if (Object.keys(scopeWhere).length === 0) return { allowed: true }
  const count = await prisma.employee.count({ where: { ...scopeWhere, id: employeeId } })
  if (count === 0) return { allowed: false, error: 'Employee is outside your payroll input scope.' }
  return { allowed: true }
}

export async function assertEmployeesInUserScope(userId: string, employeeIds: string[]): Promise<{ allowed: boolean; outOfScopeIds: string[]; error?: string }> {
  const scopeWhere = await buildEmployeeScopeWhere(userId)
  if (Object.keys(scopeWhere).length === 0) return { allowed: true, outOfScopeIds: [] }
  const allowed = await prisma.employee.findMany({
    where: { ...scopeWhere, id: { in: employeeIds } },
    select: { id: true },
  })
  const allowedSet = new Set(allowed.map(e => e.id))
  const outOfScopeIds = employeeIds.filter(eid => !allowedSet.has(eid))
  if (outOfScopeIds.length > 0) return { allowed: false, outOfScopeIds, error: 'Some employees are outside your payroll input scope.' }
  return { allowed: true, outOfScopeIds: [] }
}

export async function assertPayrollInputInUserScope(userId: string, payrollInputId: string): Promise<{ allowed: boolean; error?: string }> {
  const scopeWhere = await buildEmployeeScopeWhere(userId)
  if (Object.keys(scopeWhere).length === 0) return { allowed: true }
  const input = await prisma.payrollInput.findUnique({
    where: { id: payrollInputId },
    select: { employeeId: true },
  })
  if (!input) return { allowed: false, error: 'Input record not found' }
  const count = await prisma.employee.count({ where: { ...scopeWhere, id: input.employeeId } })
  if (count === 0) return { allowed: false, error: 'Input record is outside your payroll input scope.' }
  return { allowed: true }
}
