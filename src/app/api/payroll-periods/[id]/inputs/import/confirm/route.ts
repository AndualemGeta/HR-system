import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, buildEmployeeScopeWhere } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

const confirmRowSchema = z.object({
  employeeId: z.string().min(1),
  inputTypeCode: z.string().min(1),
  value: z.number().optional(),
  amount: z.number().optional(),
  note: z.string().optional(),
})

const confirmSchema = z.object({
  rows: z.array(confirmRowSchema).min(1),
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
    const parsed = confirmSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const { rows, importMode } = parsed.data

    const allInputTypes = await prisma.payrollInputType.findMany({ select: { id: true, code: true, isActive: true } })
    const inputTypeMap = new Map(allInputTypes.map(it => [it.code, it]))

    const allSelected = await prisma.payrollPeriodEmployee.findMany({
      where: { payrollPeriodId: id, isSelected: true },
      select: { employeeId: true },
    })
    const selectedSet = new Set(allSelected.map(s => s.employeeId))

    const scopeWhere = await buildEmployeeScopeWhere(session.userId)
    let scopeEmployeeSet: Set<string> | null = null
    if (Object.keys(scopeWhere).length > 0) {
      const scopeEmployees = await prisma.employee.findMany({
        where: scopeWhere,
        select: { id: true },
      })
      scopeEmployeeSet = new Set(scopeEmployees.map(e => e.id))
    }

    let imported = 0
    let skipped = 0
    let errors = 0
    const details: Array<{ employeeId: string; inputTypeCode: string; status: string; error?: string }> = []

    for (const row of rows) {
      let rowError: string | undefined

      if (!selectedSet.has(row.employeeId)) {
        rowError = 'Employee not selected in this period'
      }
      if (!rowError && scopeEmployeeSet && !scopeEmployeeSet.has(row.employeeId)) {
        rowError = 'Employee is outside your payroll input scope.'
      }

      const inputType = inputTypeMap.get(row.inputTypeCode)
      if (!inputType) {
        rowError = `Input type code '${row.inputTypeCode}' not found`
      } else if (!inputType.isActive) {
        rowError = `Input type '${row.inputTypeCode}' is not active`
      }

      if (rowError) {
        errors++
        details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'ERROR', error: rowError })
        continue
      }

      const existing = await prisma.payrollInput.findUnique({
        where: {
          payrollPeriodId_employeeId_inputTypeId: {
            payrollPeriodId: id,
            employeeId: row.employeeId,
            inputTypeId: inputType!.id,
          },
        },
      })

      if (existing) {
        if (importMode === 'CREATE_ONLY') {
          errors++
          details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'ERROR', error: 'Record already exists. CREATE_ONLY mode disallows updates.' })
          continue
        }

        if (importMode === 'UPDATE_DRAFT_ONLY' && existing.status !== 'DRAFT' && existing.status !== 'RETURNED') {
          errors++
          details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'ERROR', error: `Existing record has status '${existing.status}' and cannot be updated in UPDATE_DRAFT_ONLY mode.` })
          continue
        }

        if (importMode === 'SKIP_EXISTING') {
          skipped++
          details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'SKIPPED' })
          continue
        }

        await prisma.payrollInput.update({
          where: { id: existing.id },
          data: {
            value: row.value !== undefined ? row.value : existing.value,
            amount: row.amount !== undefined ? row.amount : existing.amount,
            note: row.note !== undefined ? row.note : existing.note,
            source: 'IMPORT',
          },
        })
        imported++
        details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'UPDATED' })
      } else {
        await prisma.payrollInput.create({
          data: {
            payrollPeriodId: id,
            employeeId: row.employeeId,
            inputTypeId: inputType!.id,
            value: row.value !== undefined ? row.value : null,
            amount: row.amount !== undefined ? row.amount : null,
            note: row.note,
            source: 'IMPORT',
            status: 'DRAFT',
          },
        })
        imported++
        details.push({ employeeId: row.employeeId, inputTypeCode: row.inputTypeCode, status: 'CREATED' })
      }
    }

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_INPUT_IMPORT_CONFIRM',
      entityType: 'PayrollPeriod',
      entityId: id,
      newValue: { imported, skipped, errors, importMode },
    })

    return success({ imported, skipped, errors, details })
  } catch (err) { console.error(err); return internalError() }
}
