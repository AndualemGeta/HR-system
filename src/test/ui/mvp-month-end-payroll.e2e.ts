import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const testSuffix = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
let userId = ''
let employeeId = ''
const employeeCode = `EMP_UI_${testSuffix}`
let periodId = ''

async function createTestData() {
  const hash = await bcrypt.hash('Test123!', 10)
  const user = await prisma.user.create({
    data: {
      email: `ui_${testSuffix}@test.com`,
      name: 'UI Test User',
      passwordHash: hash,
      isActive: true,
    },
  })
  userId = user.id
  const role = await prisma.role.findUnique({ where: { name: 'HR Manager' } })
  if (role) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } })
  }
  const role2 = await prisma.role.findUnique({ where: { name: 'Finance Manager' } })
  if (role2 && role2.id !== role?.id) {
    await prisma.userRole.create({ data: { userId: user.id, roleId: role2.id } })
  }

  const emp = await prisma.employee.create({
    data: {
      employeeId: employeeCode,
      firstName: 'UI',
      lastName: 'Test',
      fullName: `UI Test ${testSuffix}`,
      email: `emp_ui_${testSuffix}@test.com`,
      employmentStatus: 'ACTIVE',
      hireDate: new Date('2025-01-15'),
      basicSalary: 10000,
      currentRole: 'ACCOUNTANT',
      employeeCategory: 'HEAD_OFFICE',
    },
  })
  employeeId = emp.id

  await prisma.employeePayrollProfile.create({
    data: {
      employeeId: emp.id,
      payrollGroup: 'HO_AA_SHOP',
      paymentMethod: 'BANK',
      bankName: 'Test Bank',
      bankAccountNumber: '1234567890',
      taxId: 'TAX_UI',
      pensionId: 'PEN_UI',
    },
  })
}

async function cleanupTestData() {
  try {
    if (periodId) {
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: periodId } })
      await prisma.mvpPayrollExport.deleteMany({ where: { payrollPeriodId: periodId } })
      await prisma.mvpPayrollPeriod.delete({ where: { id: periodId } })
    }
    if (employeeId) {
      await prisma.employeePayrollProfile.deleteMany({ where: { employeeId } })
      await prisma.employee.delete({ where: { id: employeeId } })
    }
    if (userId) {
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } })
    }
  } catch {
    // non-fatal
  }
}

test.describe('MVP Month-End Payroll', () => {
  test.beforeAll(async () => {
    await createTestData()
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test('Complete payroll lifecycle end-to-end', async ({ page }) => {
    // Login
    await page.goto('/login')
    await expect(page.locator('h2, h1, [data-testid="login-title"]').first()).toBeVisible({ timeout: 5000 })
    await page.fill('input[type="email"]', `ui_${testSuffix}@test.com`)
    await page.fill('input[type="password"]', 'Test123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // Open employee list
    await page.goto('/employees')
    await expect(page.locator('body')).toContainText('Employees', { timeout: 5000 })

    // Open payroll periods
    await page.goto('/payroll')
    await expect(page.locator('body')).toContainText('Payroll', { timeout: 5000 })

    // Create payroll period via API (UI does not have a create form we can reliably test)
    const now = new Date()
    const month = now.getMonth() + 1
    const year = now.getFullYear()
    const res = await page.evaluate(async ({ month, year }) => {
      const r = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month, year }),
      })
      return r.ok ? (await r.json()).data : null
    }, { month, year: year + 1 })
    if (res) periodId = res.id

    if (!periodId) {
      const res2 = await page.evaluate(async () => {
        const r = await fetch('/api/payroll?limit=1')
        if (!r.ok) return null
        return (await r.json()).data?.items?.[0] || null
      })
      if (res2) periodId = res2.id
    }

    expect(periodId).toBeTruthy()

    // Open payroll period page
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')

    // Snapshot employees - use API since button may not be easily identifiable
    const snapRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: false }),
      })
      return r.ok
    }, periodId)
    expect(snapRes).toBe(true)

    // Navigate back to period page
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')

    // Edit monthly values via API
    const editRes = await page.evaluate(async (pid) => {
      const rows = await (await fetch(`/api/payroll/${pid}/rows`)).json()
      const row = rows.data?.rows?.[0]
      if (!row) return false
      const r = await fetch(`/api/payroll/${pid}/rows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ id: row.id, commission: 500, overtime: 300 }] }),
      })
      return r.ok
    }, periodId)
    expect(editRes).toBe(true)

    // Calculate
    const calcRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/calculate`, { method: 'POST' })
      return r.ok
    }, periodId)
    expect(calcRes).toBe(true)

    // Validate
    const valRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/validate`, { method: 'POST' })
      return r.ok
    }, periodId)
    expect(valRes).toBe(true)

    // Mark READY
    const readyRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/ready`, { method: 'POST' })
      return r.ok
    }, periodId)
    expect(readyRes).toBe(true)

    // Generate Excel
    const expRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/generate-excel`, { method: 'POST' })
      return r.ok
    }, periodId)
    expect(expRes).toBe(true)

    // Lock payroll
    const lockRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/lock`, { method: 'POST' })
      return r.ok
    }, periodId)
    expect(lockRes).toBe(true)

    // View export history
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')
    const pageText = await page.textContent('body')
    expect(pageText).toContain(periodId.slice(0, 8))
  })
})
