import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const rowSchema = z.object({
  employeeId: z.string().min(1),
  employeeName: z.string().optional(),
  inputTypeCode: z.string().min(1),
  value: z.number().optional(),
  amount: z.number().optional(),
  note: z.string().optional(),
})

const previewSchema = z.object({
  rows: z.array(rowSchema).min(1),
  importMode: z.enum(['CREATE_ONLY', 'UPDATE_DRAFT_ONLY', 'SKIP_EXISTING']),
})

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollInput.import'))) return forbidden()

    const period = await prisma.payrollPeriod.findUnique({ where: { id }, select: { id: true, status: true } })
    if (!period) return notFound('Payroll period not found')
    if (period.status !== 'OPEN_FOR_INPUT') return badRequest('Inputs can only be imported in OPEN_FOR_INPUT periods.')

    const body = await req.json().catch(() => ({}))
    const parsed = previewSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { rows, importMode } = parsed.data

    const allInputTypes = await prisma.payrollInputType.findMany({ select: { id: true, code: true, isActive: true } })
    const inputTypeMap = new Map(allInputTypes.map(it => [it.code, it]))

    const allSelected = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true },
      select: { employeeId: true },
    })
    const selectedSet = new Set(allSelected.map(s => s.employeeId))

    const allEmployees = await prisma.employee.findMany({
      where: { id: { in: [...selectedSet] } },
      select: { id: true, employeeId: true, fullName: true },
    })
    const employeeMap = new Map(allEmployees.map(e => [e.id, e]))

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    let scopeEmployeeSet: Set<string> | null = null
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmployees = await prisma.employee.findMany({
        where: scopeWhere,
        select: { id: true },
      })
      scopeEmployeeSet = new Set(scopeEmployees.map(e => e.id))
    }

    const existingRecords = await prisma.payrollInput.findMany({
      where: { payrollPeriodId: id },
      select: { employeeId: true, inputTypeId: true, status: true },
    })
    const existingKeySet = new Set(existingRecords.map(r => `${r.employeeId}:${r.inputTypeId}`))
    const existingStatusMap = new Map(existingRecords.map(r => [`${r.employeeId}:${r.inputTypeId}`, r.status]))

    const seenPairs = new Set<string>()
    const resultRows: Array<{ rowNumber: number; status: string; errors: string[]; warnings: string[] }> = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      const rowNumber = i + 1
      const errors: string[] = []
      const warnings: string[] = []

      const pairKey = `${row.employeeId}:${row.inputTypeCode}`

      const emp = employeeMap.get(row.employeeId)
      if (!emp) {
        errors.push(`Employee '${row.employeeId}' is not selected in this period or does not exist`)
      }
      if (emp && scopeEmployeeSet && !scopeEmployeeSet.has(emp.id)) {
        errors.push('Employee is outside your payroll input scope.')
      }

      const inputType = inputTypeMap.get(row.inputTypeCode)
      if (!inputType) {
        errors.push(`Input type code '${row.inputTypeCode}' not found`)
      } else if (!inputType.isActive) {
        errors.push(`Input type '${row.inputTypeCode}' is not active`)
      }

      if (inputType && emp) {
        if (row.value !== undefined && isNaN(Number(row.value))) {
          errors.push('value must be a number')
        }
        if (row.amount !== undefined && isNaN(Number(row.amount))) {
          errors.push('amount must be a number')
        }

        if (inputType.isActive) {
          const existingKey = `${row.employeeId}:${inputType.id}`
          if (existingKeySet.has(existingKey)) {
            const currentStatus = existingStatusMap.get(existingKey)
            if (importMode === 'CREATE_ONLY') {
              errors.push(`Record already exists for employee '${row.employeeId}' and input type '${row.inputTypeCode}'. CREATE_ONLY mode disallows updates.`)
            } else if (importMode === 'UPDATE_DRAFT_ONLY') {
              if (currentStatus !== 'DRAFT' && currentStatus !== 'RETURNED') {
                errors.push(`Existing record for employee '${row.employeeId}' and input type '${row.inputTypeCode}' has status '${currentStatus}' and cannot be updated in UPDATE_DRAFT_ONLY mode.`)
              }
            }
          }

          if (seenPairs.has(pairKey)) {
            warnings.push(`Duplicate employee+inputType combination within import (row ${rows.findIndex((r, idx) => idx < i && r.employeeId === row.employeeId && r.inputTypeCode === row.inputTypeCode) + 1})`)
          }
          seenPairs.add(pairKey)
        }
      }

      let status = 'VALID'
      if (errors.length > 0) status = 'ERROR'
      else if (warnings.length > 0) status = 'WARNING'

      resultRows.push({ rowNumber, status, errors, warnings })
    }

    const validRows = resultRows.filter(r => r.status === 'VALID' || r.status === 'WARNING')
    const errorRows = resultRows.filter(r => r.status === 'ERROR')

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_IMPORT_PREVIEW',
      entityType: 'PayrollPeriod',
      entityId: id,
      newValue: { totalRows: rows.length, validRows: validRows.length, errorRows: errorRows.length, importMode },
    })

    const validRowsPayload = rows.filter((_, i) => resultRows[i].status === 'VALID' || resultRows[i].status === 'WARNING')

    return success({
      totalRows: rows.length,
      validRows: validRowsPayload,
      errorRows: errorRows.length,
      rows: resultRows,
    })
  } catch (err) { console.error(err); return internalError() }
}
