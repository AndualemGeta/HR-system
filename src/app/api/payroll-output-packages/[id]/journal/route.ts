import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollJournal.generate'))) return forbidden()
    const { id } = await params
    const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id } })
    if (!pkg) return notFound()

    const mappings = await prisma.glAccountMapping.findMany()
    if (mappings.length === 0) return badRequest('MISSING_GL_ACCOUNT_MAPPING')

    const grossTotal = Number(pkg.grossTotal) || 0
    const netPayTotal = Number(pkg.netPayTotal) || 0
    const payeTotal = Number(pkg.payeTaxTotal) || 0
    const empPension = Number(pkg.employeePensionTotal) || 0
    const emprPension = Number(pkg.employerPensionTotal) || 0
    const deductionTotal = Number(pkg.deductionTotal) || 0

    const journal = await prisma.$transaction(async (tx) => {
      const jb = await tx.payrollJournalBatch.create({
        data: { outputPackageId: id, status: 'DRAFT', generatedById: session.userId },
      })

      const lines = [
        { accountCode: 'SALARY_EXPENSE', accountName: 'Basic Salary Expense', debitAmount: grossTotal, creditAmount: 0, description: 'Gross salary expense' },
        { accountCode: 'PAYE_PAYABLE', accountName: 'PAYE Payable', debitAmount: 0, creditAmount: payeTotal, description: 'PAYE tax payable' },
        { accountCode: 'PENSION_PAYABLE', accountName: 'Employee Pension Payable', debitAmount: 0, creditAmount: empPension, description: 'Employee pension payable' },
        { accountCode: 'ERP_PENSION_EXPENSE', accountName: 'Employer Pension Expense', debitAmount: emprPension, creditAmount: 0, description: 'Employer pension expense' },
        { accountCode: 'ERP_PENSION_PAYABLE', accountName: 'Employer Pension Payable', debitAmount: 0, creditAmount: emprPension, description: 'Employer pension payable' },
        { accountCode: 'SALARY_PAYABLE', accountName: 'Salary Payable', debitAmount: 0, creditAmount: netPayTotal, description: 'Net salary payable' },
        { accountCode: 'DEDUCTION_PAYABLE', accountName: 'Other Deductions Payable', debitAmount: 0, creditAmount: deductionTotal - payeTotal - empPension, description: 'Other deductions payable' },
      ]

      for (const l of lines) {
        await tx.payrollJournalLine.create({
          data: { journalBatchId: jb.id, ...l },
        })
      }

      const totalDebit = lines.reduce((s, l) => s + (l.debitAmount || 0), 0)
      const totalCredit = lines.reduce((s, l) => s + (l.creditAmount || 0), 0)

      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error('UNBALANCED_PAYROLL_JOURNAL')
      }

      await tx.payrollJournalBatch.update({
        where: { id: jb.id },
        data: { totalDebit, totalCredit, status: 'DRAFT' },
      })

      return { ...jb, totalDebit, totalCredit }
    })

    await createAuditLog({ userId: session.userId, action: 'PAYROLL_JOURNAL_GENERATE' as never, entityType: 'PayrollJournalBatch', entityId: journal.id, newValue: { totalDebit: journal.totalDebit, totalCredit: journal.totalCredit } })
    return success(journal)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Journal generation failed'
    if (msg === 'UNBALANCED_PAYROLL_JOURNAL') return badRequest(msg)
    console.error(e); return internalError()
  }
}
