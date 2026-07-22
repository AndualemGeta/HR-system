import { prisma } from '@/lib/prisma'
import crypto from 'crypto'

export interface PayslipData {
  id: string
  employeeCode: string
  fullName: string
  snapshot: Record<string, unknown>
  grossSalary: number
  totalDeductions: number
  netSalary: number
  documentHash: string
}

function maskAccount(account?: string | null): string {
  if (!account) return '****'
  if (account.length <= 4) return account
  return '****' + account.slice(-4)
}

export function renderPayslipHtml(snapshot: Record<string, unknown>, maskBank = true): string {
  const s = snapshot as Record<string, unknown> & {
    employeeCode?: string; fullName?: string; role?: string; department?: string
    region?: string; area?: string; shop?: string; employmentType?: string
    grossSalary?: number; taxableIncome?: number; totalDeductions?: number
    netSalary?: number; basicSalary?: number; proratedBasicSalary?: number
    employeePension?: number; employerPension?: number; payeTax?: number
    employerTotalCost?: number; preTaxDeductions?: number; postTaxDeductions?: number
    lines?: Array<{ componentCode?: string; componentName?: string; grossAmount?: number; taxableAmount?: number; deductionAmount?: number }>
  }

  const lines = (s.lines || []).map(l => `
    <tr>
      <td style="padding:4px 8px;border:1px solid #ddd">${l.componentName || l.componentCode || ''}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${(l.grossAmount || 0).toFixed(2)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${(l.taxableAmount || 0).toFixed(2)}</td>
      <td style="padding:4px 8px;border:1px solid #ddd;text-align:right">${(l.deductionAmount || 0).toFixed(2)}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Payslip - ${s.employeeCode}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; margin: 20px; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 16px; }
  th, td { border: 1px solid #999; padding: 6px 8px; text-align: left; }
  th { background: #f0f0f0; }
  .header { text-align: center; margin-bottom: 20px; }
  .header h1 { margin: 0; font-size: 18px; }
  .header h2 { margin: 4px 0; font-size: 14px; color: #555; }
  .summary td { font-weight: bold; }
  .right { text-align: right; }
</style></head><body>
<div class="header">
  <h1>Leapfrog Software Technology Africa PLC</h1>
  <h2>Payslip</h2>
</div>
<table>
  <tr><td><strong>Employee Code:</strong></td><td>${s.employeeCode || ''}</td>
      <td><strong>Name:</strong></td><td>${s.fullName || ''}</td></tr>
  <tr><td><strong>Role:</strong></td><td>${s.role || ''}</td>
      <td><strong>Department:</strong></td><td>${s.department || ''}</td></tr>
  <tr><td><strong>Region:</strong></td><td>${s.region || ''}</td>
      <td><strong>Shop:</strong></td><td>${s.shop || ''}</td></tr>
  <tr><td><strong>Employment Type:</strong></td><td>${s.employmentType || ''}</td>
      <td><strong>Basic Salary:</strong></td><td>${(s.basicSalary || 0).toFixed(2)}</td></tr>
</table>
<h3>Earnings & Deductions</h3>
<table>
  <tr><th>Component</th><th>Gross</th><th>Taxable</th><th>Deduction</th></tr>
  ${lines}
</table>
<h3>Summary</h3>
<table class="summary">
  <tr><td>Gross Salary</td><td class="right">${(s.grossSalary || 0).toFixed(2)}</td></tr>
  <tr><td>Taxable Income</td><td class="right">${(s.taxableIncome || 0).toFixed(2)}</td></tr>
  <tr><td>PAYE Tax</td><td class="right">${(s.payeTax || 0).toFixed(2)}</td></tr>
  <tr><td>Employee Pension</td><td class="right">${(s.employeePension || 0).toFixed(2)}</td></tr>
  <tr><td>Total Deductions</td><td class="right">${(s.totalDeductions || 0).toFixed(2)}</td></tr>
  <tr><td><strong>Net Salary</strong></td><td class="right"><strong>${(s.netSalary || 0).toFixed(2)}</strong></td></tr>
  <tr><td>Employer Pension</td><td class="right">${(s.employerPension || 0).toFixed(2)}</td></tr>
  <tr><td>Employer Total Cost</td><td class="right">${(s.employerTotalCost || 0).toFixed(2)}</td></tr>
</table>
<p style="font-size:10px;color:#888;margin-top:20px">Generated from approved immutable payroll snapshot | Hash: ${crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex').slice(0, 16)}...</p>
</body></html>`
}

export async function getPayslipForUser(payslipId: string, userId: string): Promise<{ data?: PayslipData; error?: string; status: number }> {
  const snapshot = await prisma.payslipSnapshot.findUnique({ where: { id: payslipId } })
  if (!snapshot) return { error: 'Payslip not found', status: 404 }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
  })
  if (!user) return { error: 'Unauthorized', status: 403 }

  const perms = user.roles.flatMap(r => r.role.permissions.map(p => p.permission.key))

  if (perms.includes('payslip.viewAll')) {
    // Full access
  } else if (perms.includes('payslip.viewOwn') && snapshot.employeeId === user.id) {
    // Own payslip only
  } else if (perms.includes('payslip.viewOwn')) {
    // Check if user's employee profile matches
    const employee = await prisma.employee.findFirst({ where: { employeeId: user.email } }).catch(() => null)
    if (!employee || employee.id !== snapshot.employeeId) {
      return { error: 'Forbidden', status: 403 }
    }
  } else {
    return { error: 'Forbidden', status: 403 }
  }

  const parsed = JSON.parse(snapshot.snapshotJson) as Record<string, unknown>

  return {
    data: {
      id: snapshot.id,
      employeeCode: snapshot.employeeCode,
      fullName: snapshot.fullName,
      snapshot: parsed,
      grossSalary: Number(snapshot.grossSalary) || 0,
      totalDeductions: Number(snapshot.totalDeductions) || 0,
      netSalary: Number(snapshot.netSalary) || 0,
      documentHash: snapshot.documentHash || '',
    },
    status: 200,
  }
}

export async function publishPayslips(outputPackageId: string, userId: string): Promise<{ success: boolean; count: number; error?: string }> {
  const pkg = await prisma.payrollOutputPackage.findUnique({ where: { id: outputPackageId } })
  if (!pkg) return { success: false, count: 0, error: 'Output package not found' }
  if (pkg.status !== 'APPROVED' && pkg.status !== 'REVIEWED') {
    return { success: false, count: 0, error: `Cannot publish payslips for package with status ${pkg.status}` }
  }

  const result = await prisma.payslipSnapshot.updateMany({
    where: { outputPackageId, publishedAt: null },
    data: { publishedAt: new Date() },
  })
  return { success: true, count: result.count }
}
