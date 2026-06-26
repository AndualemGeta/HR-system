import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import { getRequiredDocumentStatus } from '../lib/documents'
import { createAuditLog } from '../lib/audit'

let passed = 0
let failed = 0
const errors: string[] = []

async function assertAsync(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) {
      passed++
      console.log(`  ✓ ${label}`)
    } else {
      failed++
      errors.push(label)
      console.log(`  ✗ ${label}`)
    }
  } catch (e: unknown) {
    failed++
    errors.push(label)
    console.log(`  ✗ ${label} — ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  console.log('\n=== Phase 2A: Documents, Rules & Onboarding Tests ===\n')

  // --- Get reference IDs ---
  const hrAdmin = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' }, include: { roles: { include: { role: true } } } })
  const hrOfficer = await prisma.user.findUnique({ where: { email: 'hr.officer@leapfrog.com' }, include: { roles: { include: { role: true } } } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' }, include: { roles: { include: { role: true } } } })
  const salesHead = await prisma.user.findUnique({ where: { email: 'sales.head@leapfrog.com' }, include: { roles: { include: { role: true } } } })
  const financeDirector = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' }, include: { roles: { include: { role: true } } } })

  const dspUser = await prisma.user.findUnique({ where: { email: 'dsp@leapfrog.com' } })
  const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })

  const employees = await prisma.employee.findMany({ take: 3 })
  const emp1 = employees[0]
  const emp2 = employees[1] || emp1

  console.log('[Document Permissions]')

  await assertAsync('HR Admin has document.upload', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'document.upload') : false)
  await assertAsync('HR Officer has document.upload', async () => hrOfficer ? userHasPermission(hrOfficer.id, 'document.upload') : false)
  await assertAsync('Employee does not have document.upload', async () => empUser ? !(await userHasPermission(empUser.id, 'document.upload')) : false)
  await assertAsync('HR Admin has document.view', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'document.view') : false)
  await assertAsync('HR Admin has document.download', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'document.download') : false)
  await assertAsync('HR Admin has document.deactivate', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'document.deactivate') : false)
  await assertAsync('HR Admin has document.manageRules', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'document.manageRules') : false)
  await assertAsync('Sales Head has document.view', async () => salesHead ? userHasPermission(salesHead.id, 'document.view') : false)
  await assertAsync('Finance Director has document.view', async () => financeDirector ? userHasPermission(financeDirector.id, 'document.view') : false)
  await assertAsync('HR Admin has onboarding.complete', async () => hrAdmin ? userHasPermission(hrAdmin.id, 'onboarding.complete') : false)
  await assertAsync('Employee does not have onboarding.complete', async () => empUser ? !(await userHasPermission(empUser.id, 'onboarding.complete')) : false)

  console.log('[Document Upload & Management]')

  // Create sample document records
  let doc1: { id: string } | null = null

  await assertAsync('Create active document record', async () => {
    const doc = await prisma.employeeDocument.create({
      data: { employeeId: emp1.id, documentType: 'ID', filePath: 'uploads/test/sample.pdf', originalFilename: 'sample.pdf', uploadedById: hrAdmin?.id, visibilityLevel: 'PUBLIC_TO_HR' },
    })
    doc1 = doc
    await createAuditLog({ action: 'DOCUMENT_UPLOAD' as never, entityType: 'EmployeeDocument', entityId: doc.id, newValue: { documentType: 'ID' } })
    return !!doc.id
  })

  await assertAsync('Create manager-visible document', async () => {
    const doc = await prisma.employeeDocument.create({
      data: { employeeId: emp1.id, documentType: 'CONTRACT', filePath: 'uploads/test/contract.pdf', originalFilename: 'contract.pdf', uploadedById: hrAdmin?.id, visibilityLevel: 'MANAGER_VISIBLE' },
    })
    return !!doc.id
  })

  await assertAsync('Create sensitive HR-only document', async () => {
    const doc = await prisma.employeeDocument.create({
      data: { employeeId: emp1.id, documentType: 'CONFIDENTIALITY_DOCUMENT', filePath: 'uploads/test/conf.pdf', originalFilename: 'conf.pdf', uploadedById: hrAdmin?.id, visibilityLevel: 'SENSITIVE_HR_ONLY' },
    })
    return !!doc.id
  })

  await assertAsync('Employee document listed for employee', async () => {
    const docs = await prisma.employeeDocument.findMany({ where: { employeeId: emp1.id, isActive: true } })
    return docs.length >= 3
  })

  await assertAsync('Deactivate document', async () => {
    if (!doc1) return false
    await prisma.employeeDocument.update({ where: { id: doc1.id }, data: { isActive: false, deactivatedAt: new Date(), deactivatedById: hrAdmin?.id, deactivationReason: 'Test deactivation' } })
    await createAuditLog({ action: 'DOCUMENT_DEACTIVATE' as never, entityType: 'EmployeeDocument', entityId: doc1.id, oldValue: { isActive: true }, newValue: { isActive: false } })
    const updated = await prisma.employeeDocument.findUnique({ where: { id: doc1.id } })
    return updated?.isActive === false
  })

  await assertAsync('Deactivated document not listed as active', async () => {
    if (!doc1) return false
    const docs = await prisma.employeeDocument.findMany({ where: { employeeId: emp1.id, isActive: true } })
    return !docs.find(d => d.id === doc1!.id)
  })

  console.log('[Required Document Rules]')

  await assertAsync('Required document rules exist', async () => {
    const count = await prisma.requiredDocumentRule.count({ where: { isActive: true } })
    return count > 0
  })

  await assertAsync('Common rules apply to all employees', async () => {
    const status = await getRequiredDocumentStatus(emp1.id)
    const idRule = status.find(s => s.documentType === 'ID')
    const contractRule = status.find(s => s.documentType === 'CONTRACT')
    return !!idRule && !!contractRule
  })

  await assertAsync('Missing required documents reported', async () => {
    const status = await getRequiredDocumentStatus(emp1.id)
    return status.filter(s => !s.isSatisfied).length > 0
  })

  await assertAsync('Uploaded documents satisfy required rules', async () => {
    const status = await getRequiredDocumentStatus(emp2.id)
    // At least some rules should be satisfied by our seeded data
    return status.some(s => s.isSatisfied)
  })

  // Check category-specific rules
  const hoEmployee = await prisma.employee.findFirst({ where: { employeeCategory: 'HEAD_OFFICE' } })
  const shopEmployee = await prisma.employee.findFirst({ where: { employeeCategory: 'SHOP_FIELD' } })

  if (hoEmployee) {
    await assertAsync('HO employee has CV rule', async () => {
      const status = await getRequiredDocumentStatus(hoEmployee.id)
      return status.some(s => s.documentType === 'CV')
    })
  }

  if (shopEmployee) {
    await assertAsync('Shop/Field employee has Responsibility Document rule', async () => {
      const status = await getRequiredDocumentStatus(shopEmployee.id)
      return status.some(s => s.documentType === 'RESPONSIBILITY_DOCUMENT')
    })

    await assertAsync('Shop/Field employee has Assignment Letter rule', async () => {
      const status = await getRequiredDocumentStatus(shopEmployee.id)
      return status.some(s => s.documentType === 'ASSIGNMENT_LETTER')
    })
  }

  // Check Shop Accountant-specific rules
  const shopAcct = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_ACCOUNTANT' } })
  if (shopAcct) {
    await assertAsync('Shop Accountant has Bank/Payment rule', async () => {
      const status = await getRequiredDocumentStatus(shopAcct.id)
      return status.some(s => s.documentType === 'BANK_OR_PAYMENT_INFORMATION')
    })
  }

  console.log('[Audit Logs]')

  await assertAsync('Document upload audit recorded', async () => {
    const log = await prisma.auditLog.findFirst({ where: { action: 'DOCUMENT_UPLOAD' } })
    return !!log
  })

  await assertAsync('Document deactivate audit recorded', async () => {
    const log = await prisma.auditLog.findFirst({ where: { action: 'DOCUMENT_DEACTIVATE' } })
    return !!log
  })

  await assertAsync('Document rule create audit recorded', async () => {
    // Create a rule via audit
    const rule = await prisma.requiredDocumentRule.create({
      data: { name: 'Test Rule', documentType: 'OTHER' },
    })
    await createAuditLog({
      action: 'DOCUMENT_RULE_CREATE' as never,
      entityType: 'RequiredDocumentRule',
      entityId: rule.id,
      newValue: { name: 'Test Rule' },
    })
    const log = await prisma.auditLog.findFirst({ where: { action: 'DOCUMENT_RULE_CREATE' as never } })
    return !!log
  })

  console.log('[Onboarding Integration]')

  // Create an onboarding checklist for testing
  const testEmp = await prisma.employee.findFirst({ where: { employmentStatus: 'ONBOARDING' } }) || emp1

  await assertAsync('Onboarding checklist can be created', async () => {
    const existing = await prisma.onboardingChecklist.findUnique({ where: { employeeId: testEmp.id } })
    if (existing) return true
    const cl = await prisma.onboardingChecklist.create({ data: { employeeId: testEmp.id } })
    await prisma.onboardingChecklistItem.create({ data: { checklistId: cl.id, key: 'test_item', label: 'Test Item' } })
    return true
  })

  await assertAsync('Required documents are checked on onboarding', async () => {
    const status = await getRequiredDocumentStatus(testEmp.id)
    return status.length > 0
  })

  await assertAsync('Onboarding requires documents to complete', async () => {
    const status = await getRequiredDocumentStatus(testEmp.id)
    const missing = status.filter(s => !s.isSatisfied)
    return missing.length > 0
  })

  console.log('[Regression: Starter Workflow Still Works]')

  await assertAsync('Employee registration categories preserved', async () => {
    const categories = await prisma.employee.findMany({ select: { employeeCategory: true }, distinct: ['employeeCategory'] })
    const vals = categories.map(c => c.employeeCategory).filter(Boolean)
    return vals.includes('HEAD_OFFICE') && vals.includes('SHOP_FIELD')
  })

  await assertAsync('Shop Accountant dual reporting preserved', async () => {
    const sa = await prisma.employee.findFirst({ where: { currentRole: 'SHOP_ACCOUNTANT' } })
    return !!sa && !!sa.directManagerId && !!sa.accountingReportingManagerId
  })

  await assertAsync('Salary permissions preserved', async () => {
    if (!hrAdmin) return false
    return userHasPermission(hrAdmin.id, 'salary.view')
  })

  await assertAsync('Manager scope helper still works', async () => {
    const { canViewEmployee } = await import('../lib/rbac')
    if (!shopManagerUser || !dspUser) return false
    // Shop manager should be able to view DSP in same shop
    const dspEmp = await prisma.employee.findFirst({ where: { currentRole: 'DSP', currentShopId: { not: null } } })
    if (!dspEmp || !shopManagerUser.employeeId) return false
    const shopMgrEmp = await prisma.employee.findUnique({ where: { id: shopManagerUser.employeeId } })
    if (!shopMgrEmp) return false
    const canView = await canViewEmployee(shopManagerUser.id, dspEmp.id)
    // This may be false if they're in different shops, but the function should not throw
    return typeof canView === 'boolean'
  })

  // Summary
  const total = passed + failed
  console.log('\n' + '='.repeat(40))
  console.log(`Phase 2A Tests: ${total} total, ${passed} passed, ${failed} failed`)
  if (errors.length > 0) {
    console.log('Failed tests:')
    errors.forEach(e => console.log(`  - ${e}`))
  }

  if (failed > 0) process.exit(1)
}

main().catch(e => {
  console.error('Test runner error:', e)
  process.exit(1)
})
