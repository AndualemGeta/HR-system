import { NextRequest } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission, canViewEmployee } from '@/lib/rbac'
import { notFound, badRequest, success, unauthorized, forbidden, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { payrollGroupOptionalSchema } from '@/lib/payroll-group'

const updateSchema = z.object({
  paymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  mpesaAccount: z.string().optional(),
  taxId: z.string().optional(),
  pensionId: z.string().optional(),
  payrollGroup: payrollGroupOptionalSchema,
})

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'employee.view'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const profile = await prisma.employeePayrollProfile.findUnique({
      where: { employeeId: id },
    })

    if (!profile) {
      return success({
        paymentMethod: null,
        bankName: null,
        bankAccountNumber: null,
        mpesaAccount: null,
        taxId: null,
        pensionId: null,
      })
    }

    const canViewSalary = await userHasPermission(session.userId, 'salary.view')
    const result: Record<string, unknown> = { ...profile }
    if (!canViewSalary) {
      if (result.bankAccountNumber) result.bankAccountNumber = 'REDACTED'
      if (result.mpesaAccount) result.mpesaAccount = 'REDACTED'
      if (result.taxId) result.taxId = 'REDACTED'
      if (result.pensionId) result.pensionId = 'REDACTED'
    }

    return success(result)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'salary.update'))) return forbidden()
    if (!(await canViewEmployee(session.userId, id))) return forbidden()

    const existing = await prisma.employee.findUnique({ where: { id } })
    if (!existing) return notFound()

    const body = await req.json().catch(() => ({}))
    const parsed = updateSchema.safeParse(body)
    if (!parsed.success) return badRequest('Invalid input', parsed.error.flatten())

    const data = parsed.data

    const profile = await prisma.employeePayrollProfile.upsert({
      where: { employeeId: id },
      create: {
        employeeId: id,
        paymentMethod: data.paymentMethod || null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        mpesaAccount: data.mpesaAccount || null,
        taxId: data.taxId || null,
        pensionId: data.pensionId || null,
        payrollGroup: data.payrollGroup ? (data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup) : undefined,
      },
      update: {
        paymentMethod: data.paymentMethod,
        bankName: data.bankName,
        bankAccountNumber: data.bankAccountNumber,
        mpesaAccount: data.mpesaAccount,
        taxId: data.taxId,
        pensionId: data.pensionId,
        payrollGroup: data.payrollGroup ? (data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup) : undefined,
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'PAYROLL_PROFILE_UPDATE',
      entityType: 'Employee',
      entityId: id,
      oldValue: { profile: existing.id },
      newValue: { profile: profile.id },
    })

    return success(profile)
  } catch (err) {
    console.error(err)
    return internalError()
  }
}
