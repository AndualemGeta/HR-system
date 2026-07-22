import { prisma } from '@/lib/prisma'
import { roundMoney, sumMoney, money } from '@/lib/money'
import crypto from 'crypto'

export interface PaymentReadinessResult {
  readyCount: number
  blockedCount: number
  bankTotal: number
  mpesaTotal: number
  manualTotal: number
  heldTotal: number
  employeeResults: Array<{
    employeeId: string
    paymentMethod: string
    amount: number
    blockers: string[]
  }>
}

export async function evaluatePaymentReadiness(outputPackageId: string): Promise<PaymentReadinessResult> {
  const snapshots = await prisma.payslipSnapshot.findMany({
    where: { outputPackageId },
  })

  let readyCount = 0, blockedCount = 0
  let bankTotal = 0, mpesaTotal = 0, manualTotal = 0, heldTotal = 0
  const employeeResults: PaymentReadinessResult['employeeResults'] = []

  for (const snap of snapshots) {
    const netSalary = Number(snap.netSalary) || 0
    const blockers: string[] = []

    const profile = await prisma.employeePayrollProfile.findFirst({
      where: { employeeId: snap.employeeId },
    })

    let paymentMethod = 'HOLD'
    if (profile?.paymentMethod) paymentMethod = profile.paymentMethod

    if (netSalary <= 0) {
      blockers.push('INVALID_NET_PAY')
    }
    if (paymentMethod === 'BANK' || paymentMethod === 'BANK_TRANSFER') {
      paymentMethod = 'BANK'
      if (!profile?.bankName) blockers.push('MISSING_BANK_NAME')
      if (!profile?.bankAccountNumber) blockers.push('MISSING_BANK_ACCOUNT')
    } else if (paymentMethod === 'MPESA' || paymentMethod === 'MOBILE_MONEY') {
      paymentMethod = 'MPESA'
      if (!profile?.mpesaAccount) blockers.push('MISSING_MPESA_ACCOUNT')
    } else if (paymentMethod === 'MANUAL') {
      if (!profile?.bankName && !profile?.bankAccountNumber) {
        blockers.push('MISSING_PAYMENT_METHOD')
      }
    } else {
      blockers.push('MISSING_PAYMENT_METHOD')
    }

    if (blockers.length > 0) {
      blockedCount++
    } else {
      readyCount++
      if (paymentMethod === 'BANK') bankTotal = roundMoney(money(bankTotal).plus(netSalary))
      else if (paymentMethod === 'MPESA') mpesaTotal = roundMoney(money(mpesaTotal).plus(netSalary))
      else if (paymentMethod === 'MANUAL') manualTotal = roundMoney(money(manualTotal).plus(netSalary))
      else heldTotal = roundMoney(money(heldTotal).plus(netSalary))
    }

    employeeResults.push({ employeeId: snap.employeeId, paymentMethod, amount: netSalary, blockers })
  }

  return { readyCount, blockedCount, bankTotal, mpesaTotal, manualTotal, heldTotal, employeeResults }
}

export async function createPaymentBatch(
  outputPackageId: string,
  paymentMethod: string,
  userId: string,
  includedEmployeeIds?: string[],
  exclusionReason?: string,
): Promise<{ success: boolean; batchId?: string; error?: string }> {
  const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id: outputPackageId } })
  if (!pkg) return { success: false, error: 'Output package not found' }
  if (pkg.status !== 'APPROVED') return { success: false, error: `Package status is ${pkg.status}, expected APPROVED` }

  const readiness = await evaluatePaymentReadiness(outputPackageId)
  const eligible = readiness.employeeResults.filter(r => r.blockers.length === 0 && r.paymentMethod === paymentMethod)

  if (includedEmployeeIds) {
    // Only include specified employees
  }

  if (eligible.length === 0) return { success: false, error: 'No eligible employees for this payment method' }

  const totalAmount = roundMoney(sumMoney(...eligible.map(e => e.amount)))
  const batchRef = `PAY-${pkg.batchVersion}-${paymentMethod}-${Date.now()}`

  const batch = await prisma.$transaction(async (tx) => {
    const b = await tx.payrollPaymentBatch.create({
      data: {
        outputPackageId,
        paymentMethod: paymentMethod as 'BANK' | 'MPESA' | 'MANUAL' | 'HOLD',
        status: 'DRAFT',
        batchReference: batchRef,
        employeeCount: eligible.length,
        totalAmount,
        generatedById: userId,
        generatedAt: new Date(),
      },
    })

    for (const emp of eligible) {
      const profile = await tx.employeePayrollProfile.findFirst({
        where: { employeeId: emp.employeeId },
      })
      await tx.payrollPaymentInstruction.create({
        data: {
          paymentBatchId: b.id,
          employeeId: emp.employeeId,
          paymentMethod: emp.paymentMethod as 'BANK' | 'MPESA' | 'MANUAL' | 'HOLD',
          beneficiaryName: profile?.beneficiaryName || undefined,
          bankName: profile?.bankName || undefined,
          bankAccountNumber: profile?.bankAccountNumber || undefined,
          mpesaAccount: profile?.mpesaAccount || undefined,
          amount: emp.amount,
          status: 'PENDING',
        },
      })
    }

    // Update batch status to GENERATED
    await tx.payrollPaymentBatch.update({
      where: { id: b.id },
      data: { status: 'GENERATED' },
    })

    return b
  })

  return { success: true, batchId: batch.id }
}

export async function generatePaymentExport(
  batchId: string,
  templateId: string,
  userId: string,
): Promise<{ success: boolean; exportId?: string; error?: string }> {
  const batch = await prisma.payrollPaymentBatch.findUnique({
    where: { id: batchId },
    include: { instructions: true },
  })
  if (!batch) return { success: false, error: 'Payment batch not found' }

  const template = await prisma.paymentExportTemplate.findUnique({ where: { id: templateId } })
  if (!template) return { success: false, error: 'Export template not found' }

  const rows = batch.instructions.map(i => ({
    'Batch Reference': batch.batchReference || '',
    'Employee Code': i.id,
    'Beneficiary Name': i.beneficiaryName || '',
    'Bank Name': i.bankName || '',
    'Account Number': i.bankAccountNumber || '',
    'Normalized Mobile': i.mpesaAccount || '',
    'Amount': Number(i.amount).toFixed(2),
    'Payment Description': `Payroll ${batch.batchReference}`,
    'Payroll Period': '',
  }))

  const header = template.hasHeader ? Object.keys(rows[0] || {}).join(template.delimiter) + '\n' : ''
  const csvContent = header + rows.map(r => Object.values(r).join(template.delimiter)).join('\n')
  const checksum = crypto.createHash('sha256').update(csvContent).digest('hex')

  const exportRecord = await prisma.payrollExportRecord.create({
    data: {
      outputPackageId: batch.outputPackageId,
      paymentBatchId: batchId,
      exportType: template.name,
      format: template.format,
      fileName: `${batch.batchReference}_${template.code}.csv`,
      rowCount: rows.length,
      totalAmount: Number(batch.totalAmount) || 0,
      checksum,
      generatedById: userId,
    },
  })

  return { success: true, exportId: exportRecord.id }
}
