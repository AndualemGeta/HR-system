import { prisma } from './prisma'
import { createAuditLog } from './audit'

interface IssueDef {
  issueType: string
  severity: 'BLOCKER' | 'WARNING' | 'INFO'
  description: string
  suggestedFix: string
}

async function upsertIssue(employeeId: string | null, issueType: string, severity: string, description: string, suggestedFix: string) {
  const existing = await prisma.dataQualityIssue.findFirst({
    where: { employeeId: employeeId ?? null, issueType, status: { in: ['OPEN', 'IN_PROGRESS'] } },
  })
  if (existing) return existing
  return prisma.dataQualityIssue.create({
    data: { issueType, severity, employeeId, description, suggestedFix, status: 'OPEN' },
  })
}

export async function scanEmployeeDataQuality(): Promise<{ scanned: number; issues: number }> {
  const employees = await prisma.employee.findMany({
    include: {
      payrollProfile: true,
      assignments: { where: { isActive: true }, take: 1 },
    },
  })

  await prisma.dataQualityIssue.updateMany({ where: { status: 'OPEN' }, data: { status: 'IN_PROGRESS' } })

  let issueCount = 0
  for (const emp of employees) {
    const issues: IssueDef[] = []
    const profile = emp.payrollProfile

    if (!emp.basicSalary || Number(emp.basicSalary) <= 0) {
      issues.push({ issueType: 'MISSING_BASIC_SALARY', severity: 'BLOCKER', description: 'Missing basic salary', suggestedFix: 'Set basic salary in employee profile' })
    }
    if (!emp.salaryEffectiveDate) {
      issues.push({ issueType: 'MISSING_SALARY_EFF_DATE', severity: 'BLOCKER', description: 'Missing salary effective date', suggestedFix: 'Set salary effective date' })
    }
    if (!profile) {
      issues.push({ issueType: 'MISSING_PAYROLL_PROFILE', severity: 'BLOCKER', description: 'No payroll profile', suggestedFix: 'Create payroll profile with payment method' })
    } else {
      if (!profile.paymentMethod) {
        issues.push({ issueType: 'MISSING_PAYMENT_METHOD', severity: 'BLOCKER', description: 'Missing payment method', suggestedFix: 'Set payment method in payroll profile' })
      }
      if (profile.paymentMethod === 'BANK_TRANSFER' && !profile.bankAccountNumber) {
        issues.push({ issueType: 'MISSING_BANK_ACCOUNT', severity: 'BLOCKER', description: 'Bank transfer but no bank account', suggestedFix: 'Set bank account number' })
      }
      if (profile.paymentMethod === 'MOBILE_MONEY' && !profile.mpesaAccount) {
        issues.push({ issueType: 'MISSING_MPESA', severity: 'BLOCKER', description: 'Mobile money but no M-PESA account', suggestedFix: 'Set M-PESA account number' })
      }
      if (!profile.taxId) issues.push({ issueType: 'MISSING_TAX_ID', severity: 'WARNING', description: 'Missing tax ID', suggestedFix: 'Set tax ID in payroll profile' })
      if (!profile.pensionId) issues.push({ issueType: 'MISSING_PENSION_ID', severity: 'WARNING', description: 'Missing pension ID', suggestedFix: 'Set pension ID in payroll profile' })
      if (!profile.costCenter) issues.push({ issueType: 'MISSING_COST_CENTER', severity: 'INFO', description: 'Missing cost center', suggestedFix: 'Set cost center in payroll profile' })
    }

    if (!emp.employeeCategory) issues.push({ issueType: 'MISSING_CATEGORY', severity: 'BLOCKER', description: 'Missing employee category', suggestedFix: 'Set employee category' })
    if (!emp.currentRole) issues.push({ issueType: 'MISSING_ROLE', severity: 'BLOCKER', description: 'Missing role', suggestedFix: 'Set current role' })

    if (emp.employeeCategory === 'HEAD_OFFICE' && !emp.currentDepartmentId) {
      issues.push({ issueType: 'MISSING_DEPARTMENT_HO', severity: 'BLOCKER', description: 'Head Office employee missing department', suggestedFix: 'Assign department' })
    }

    const shopRoles = ['DSA', 'DSP', 'SHOP_MANAGER', 'SHOP_ACCOUNTANT']
    if (shopRoles.includes(emp.currentRole || '') && !emp.currentShopId) {
      issues.push({ issueType: 'MISSING_SHOP', severity: 'BLOCKER', description: `${emp.currentRole} missing shop assignment`, suggestedFix: 'Assign a shop' })
    }

    if (!emp.directManagerId) {
      issues.push({ issueType: 'MISSING_MANAGER', severity: 'WARNING', description: 'Missing direct manager', suggestedFix: 'Assign direct manager' })
    }

    if (emp.currentRole === 'SHOP_ACCOUNTANT' && !emp.accountingReportingManagerId) {
      issues.push({ issueType: 'MISSING_ACCTG_MANAGER', severity: 'WARNING', description: 'Shop Accountant missing accounting reporting manager', suggestedFix: 'Assign accounting reporting manager' })
    }

    for (const issue of issues) {
      await upsertIssue(emp.id, issue.issueType, issue.severity, issue.description, issue.suggestedFix)
      issueCount++
    }
  }

  await createAuditLog({ action: 'DATA_QUALITY_SCAN', entityType: 'System', entityId: 'scan', newValue: { employeesScanned: employees.length, issuesFound: issueCount } })
  return { scanned: employees.length, issues: issueCount }
}

export async function scanSingleEmployeeDataQuality(employeeId: string) {
  const emp = await prisma.employee.findUnique({ where: { id: employeeId }, include: { payrollProfile: true } })
  if (!emp) return { issues: 0 }
  const issues: IssueDef[] = []
  if (!emp.basicSalary || Number(emp.basicSalary) <= 0) issues.push({ issueType: 'MISSING_BASIC_SALARY', severity: 'BLOCKER', description: 'Missing basic salary', suggestedFix: 'Set basic salary' })
  if (!emp.salaryEffectiveDate) issues.push({ issueType: 'MISSING_SALARY_EFF_DATE', severity: 'BLOCKER', description: 'Missing salary effective date', suggestedFix: 'Set salary effective date' })
  if (!emp.payrollProfile) issues.push({ issueType: 'MISSING_PAYROLL_PROFILE', severity: 'BLOCKER', description: 'No payroll profile', suggestedFix: 'Create payroll profile' })
  if (!emp.employeeCategory) issues.push({ issueType: 'MISSING_CATEGORY', severity: 'BLOCKER', description: 'Missing employee category', suggestedFix: 'Set employee category' })
  if (!emp.currentRole) issues.push({ issueType: 'MISSING_ROLE', severity: 'BLOCKER', description: 'Missing role', suggestedFix: 'Set current role' })
  return { issues: issues.length }
}

export async function resolveDataQualityIssue(issueId: string, userId: string) {
  const updated = await prisma.dataQualityIssue.update({
    where: { id: issueId },
    data: { status: 'RESOLVED', resolvedById: userId, resolvedAt: new Date() },
  })
  await createAuditLog({ userId, action: 'DATA_QUALITY_RESOLVE', entityType: 'DataQualityIssue', entityId: issueId, oldValue: { status: 'OPEN' }, newValue: { status: 'RESOLVED' } })
  return updated
}

export async function ignoreDataQualityIssue(issueId: string, reason: string, userId: string) {
  const updated = await prisma.dataQualityIssue.update({
    where: { id: issueId },
    data: { status: 'IGNORED', ignoredById: userId, ignoredAt: new Date(), ignoreReason: reason },
  })
  await createAuditLog({ userId, action: 'DATA_QUALITY_IGNORE', entityType: 'DataQualityIssue', entityId: issueId, oldValue: { status: 'OPEN' }, newValue: { status: 'IGNORED', reason } })
  return updated
}
