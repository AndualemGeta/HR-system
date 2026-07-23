import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding CI test fixtures...')

  const existingUsers = await prisma.user.count()
  if (existingUsers > 0) {
    console.log('CI database already seeded — skipping.')
    return
  }

  // ── Permissions ──
  const allPermKeys = [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update',
    'status.view', 'status.update',
    'assignment.view', 'assignment.update',
    'onboarding.view', 'onboarding.update', 'onboarding.complete',
    'reports.view', 'audit.view',
    'user.view', 'user.manage',
    'role.view', 'role.manage',
    'organization.view', 'organization.manage',
    'document.view', 'document.upload', 'document.download', 'document.deactivate', 'document.manageRules',
    'employee.import', 'employee.importPreview', 'employee.importConfirm',
    'employee.importHistory', 'employee.payrollReadiness.view', 'employee.payrollReadiness.export',
    'salaryStructure.view', 'salaryStructure.manageComponents', 'salaryStructure.manageRules',
    'salaryStructure.preview', 'salaryStructure.activateRule', 'salaryStructure.deactivateRule',
    'salaryStructure.auditView',
    'dataQuality.view', 'dataQuality.manage', 'dataQuality.export',
    'changeRequest.view', 'changeRequest.create', 'changeRequest.approve', 'changeRequest.reject', 'changeRequest.cancel',
    'salaryRuleApproval.view', 'salaryRuleApproval.request', 'salaryRuleApproval.approve', 'salaryRuleApproval.reject',
    'phaseControl.view', 'phaseControl.update',
    'payrollPeriod.view', 'payrollPeriod.create', 'payrollPeriod.update', 'payrollPeriod.open', 'payrollPeriod.close', 'payrollPeriod.cancel',
    'payrollInputType.view', 'payrollInputType.manage',
    'payrollInput.view', 'payrollInput.create', 'payrollInput.submit', 'payrollInput.review', 'payrollInput.import', 'payrollInput.export',
    'payrollInput.lock', 'payrollInput.unlock',
    'payrollInputRequirement.view', 'payrollInputRequirement.manage',
    'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate',
    'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation',
    'payrollPreparationSummary.view', 'payrollPreparationSummary.export',
    'shop.view', 'shop.create', 'shop.update', 'shop.deactivate', 'shop.reactivate',
    'shop.assignManager', 'shop.updateCriteria', 'shop.viewCriteriaHistory',
    'shopManagerIncentive.view', 'shopManagerIncentive.createPeriod', 'shopManagerIncentive.updatePeriod',
    'shopManagerIncentive.inputSales', 'shopManagerIncentive.inputDistribution', 'shopManagerIncentive.inputEbu', 'shopManagerIncentive.inputAll',
    'shopManagerIncentive.calculate',
    'shopManagerIncentive.export', 'shopManagerIncentive.sendToPayroll',
    'shopManagerIncentive.viewInputConfig', 'shopManagerIncentive.manageInputConfig',
    'payrollCalculation.view', 'payrollCalculation.readiness', 'payrollCalculation.preview',
    'payrollCalculation.calculate', 'payrollCalculation.recalculate',
    'payrollCalculation.review', 'payrollCalculation.validate', 'payrollCalculation.approve',
    'payrollCalculation.return', 'payrollCalculation.reopen', 'payrollCalculation.export',
    'payrollStatutory.view', 'payrollStatutory.manage', 'payrollStatutory.approve',
    // Phase 5B
    'payrollFinalization.view', 'payrollFinalization.create', 'payrollFinalization.review', 'payrollFinalization.approve', 'payrollFinalization.cancel',
    'payslip.viewAll', 'payslip.viewOwn', 'payslip.generate', 'payslip.publish', 'payslip.download',
    'paymentBatch.view', 'paymentBatch.create', 'paymentBatch.review', 'paymentBatch.approve', 'paymentBatch.release', 'paymentBatch.cancel', 'paymentBatch.export', 'paymentBatch.reconcile',
    'statutoryReport.view', 'statutoryReport.generate', 'statutoryReport.review', 'statutoryReport.approve', 'statutoryReport.markFiled', 'statutoryReport.export',
    'payrollJournal.view', 'payrollJournal.generate', 'payrollJournal.approve', 'payrollJournal.export',
    'paymentExportTemplate.view', 'paymentExportTemplate.manage', 'paymentExportTemplate.approve',
  ]

  const permissionMap = new Map<string, string>()
  for (const key of allPermKeys) {
    const perm = await prisma.permission.create({
      data: { key, description: key.split('.').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') },
    })
    permissionMap.set(key, perm.id)
  }
  console.log(`  ${allPermKeys.length} permissions created`)

  // ── Roles ──
  const adminRole = await prisma.role.create({
    data: { name: 'Admin', permissions: { create: allPermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  const financePermKeys = [
    'employee.view', 'salary.view', 'payrollPeriod.view', 'payrollInput.view', 'payrollInput.create', 'payrollInput.submit',
    'payrollInput.review', 'payrollInput.lock', 'payrollCalculation.view', 'payrollCalculation.readiness',
    'payrollCalculation.preview', 'payrollCalculation.calculate', 'payrollCalculation.recalculate',
    'payrollCalculation.review', 'payrollCalculation.validate', 'payrollCalculation.approve',
    'payrollCalculation.return', 'payrollCalculation.reopen', 'payrollCalculation.export',
    'payrollInputType.view', 'payrollInputType.manage',
    'payrollInputRequirement.view', 'payrollInputRequirement.manage',
    'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate',
    'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation',
    'payrollPreparationSummary.view', 'payrollPreparationSummary.export',
    'payrollStatutory.view', 'payrollStatutory.manage', 'payrollStatutory.approve',
    'reports.view', 'audit.view', 'organization.view',
    // Phase 5B — Finance Payroll (generate, cannot approve own)
    'payrollFinalization.view', 'payrollFinalization.create',
    'payslip.viewAll', 'payslip.generate', 'payslip.publish', 'payslip.download',
    'paymentBatch.view', 'paymentBatch.create', 'paymentBatch.export',
    'statutoryReport.view', 'statutoryReport.generate', 'statutoryReport.export',
    'payrollJournal.view', 'payrollJournal.generate', 'payrollJournal.export',
    'paymentExportTemplate.view',
  ]
  await prisma.role.create({
    data: { name: 'Finance Payroll', permissions: { create: financePermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  const directorPermKeys = [
    ...financePermKeys,
    'payrollCalculation.review', 'payrollCalculation.validate', 'payrollCalculation.approve',
    'payrollCalculation.return', 'payrollCalculation.reopen', 'payrollStatutory.approve',
    // Phase 5B — Finance Director (review, approve, cannot generate)
    'payrollFinalization.view', 'payrollFinalization.review', 'payrollFinalization.approve', 'payrollFinalization.cancel',
    'payslip.viewAll', 'payslip.download',
    'paymentBatch.view', 'paymentBatch.approve',
    'statutoryReport.view', 'statutoryReport.review', 'statutoryReport.approve', 'statutoryReport.markFiled', 'statutoryReport.export',
    'payrollJournal.view', 'payrollJournal.approve', 'payrollJournal.export',
    'paymentExportTemplate.view', 'paymentExportTemplate.approve',
  ]
  await prisma.role.create({
    data: { name: 'Finance Director', permissions: { create: directorPermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  const treasuryPermKeys = [
    'employee.view', 'payrollPeriod.view', 'reports.view', 'audit.view',
    'paymentBatch.view', 'paymentBatch.review', 'paymentBatch.release', 'paymentBatch.reconcile',
    'paymentBatch.export', 'paymentBatch.cancel',
    'payrollFinalization.view',
    'paymentExportTemplate.view',
  ]
  await prisma.role.create({
    data: { name: 'Treasury Manager', permissions: { create: treasuryPermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  const auditorPermKeys = [
    'employee.view', 'payrollPeriod.view', 'reports.view', 'audit.view',
    'payrollFinalization.view',
    'payslip.viewAll',
    'paymentBatch.view',
    'statutoryReport.view',
    'payrollJournal.view',
    'paymentExportTemplate.view',
  ]
  await prisma.role.create({
    data: { name: 'Auditor', permissions: { create: auditorPermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  // MVP-specific roles for E2E tests
  const mvpHrPermKeys = [
    'employee.view', 'employee.create', 'employee.update', 'employee.delete',
    'salary.view', 'salary.update',
    'payrollPeriod.view', 'payrollPeriod.create', 'payrollPeriod.update', 'payrollPeriod.open', 'payrollPeriod.close', 'payrollPeriod.cancel',
    'payrollPeriod.review',
    'reports.view', 'audit.view',
    'organization.view',
    'user.view', 'role.view',
    'employee.import', 'employee.importPreview', 'employee.importConfirm',
  ]
  const mvpHRRole = await prisma.role.create({
    data: { name: 'MVP HR', permissions: { create: mvpHrPermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  const mvpFinancePermKeys = [
    'employee.view',
    'salary.view',
    'payrollPeriod.view', 'payrollPeriod.close',
    'reports.view', 'audit.view',
    'organization.view',
  ]
  const mvpFinanceRole = await prisma.role.create({
    data: { name: 'MVP Finance', permissions: { create: mvpFinancePermKeys.map(key => ({ permissionId: permissionMap.get(key)! })) } },
  })

  await prisma.role.create({
    data: { name: 'Employee', permissions: { create: [{ permissionId: permissionMap.get('employee.view')! }, { permissionId: permissionMap.get('payslip.viewOwn')! }, { permissionId: permissionMap.get('payslip.download')! }] } },
  })
  console.log('  9 roles created')

  // ── Users ──
  const passwordHash = await bcrypt.hash('Test123!', 10)

  await prisma.user.create({
    data: { email: 'admin@leapfrog.com', name: 'Admin User', passwordHash, roles: { create: [{ roleId: adminRole.id }] } },
  })
  const financeRole = await prisma.role.findUnique({ where: { name: 'Finance Payroll' } })
  await prisma.user.create({
    data: { email: 'finance.payroll@leapfrog.com', name: 'Finance Payroll', passwordHash, roles: { create: [{ roleId: financeRole!.id }] } },
  })
  const directorRole = await prisma.role.findUnique({ where: { name: 'Finance Director' } })
  await prisma.user.create({
    data: { email: 'finance.director@leapfrog.com', name: 'Finance Director', passwordHash, roles: { create: [{ roleId: directorRole!.id }] } },
  })
  const treasuryRole = await prisma.role.findUnique({ where: { name: 'Treasury Manager' } })
  await prisma.user.create({
    data: { email: 'treasury@leapfrog.com', name: 'Treasury Manager', passwordHash, roles: { create: [{ roleId: treasuryRole!.id }] } },
  })
  const auditorRole = await prisma.role.findUnique({ where: { name: 'Auditor' } })
  await prisma.user.create({
    data: { email: 'auditor@leapfrog.com', name: 'Auditor User', passwordHash, roles: { create: [{ roleId: auditorRole!.id }] } },
  })
  const empRole = await prisma.role.findUnique({ where: { name: 'Employee' } })
  await prisma.user.create({
    data: { email: 'employee@leapfrog.com', name: 'Employee User', passwordHash, roles: { create: [{ roleId: empRole!.id }] } },
  })
  const mvpHRRoleRef = await prisma.role.findUnique({ where: { name: 'MVP HR' } })
  await prisma.user.create({
    data: { email: 'mvp.hr@leapfrog.com', name: 'MVP HR User', passwordHash, roles: { create: [{ roleId: mvpHRRoleRef!.id }] } },
  })
  const mvpFinanceRoleRef = await prisma.role.findUnique({ where: { name: 'MVP Finance' } })
  await prisma.user.create({
    data: { email: 'mvp.finance@leapfrog.com', name: 'MVP Finance User', passwordHash, roles: { create: [{ roleId: mvpFinanceRoleRef!.id }] } },
  })
  console.log('  8 users created')

  // ── Department (required for employee creation) ──
  await prisma.department.create({
    data: { id: 'cd63b2cb-fd31-4e5b-a8cc-2be089e4f8df', name: 'Sales', code: 'SALES', isActive: true },
  })
  console.log('  1 department created')

  console.log('\nCI seed complete.')
}

main()
  .catch(e => { console.error('CI seed error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
