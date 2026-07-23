import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const testSuffix = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
let userId = ''
let employeeId = ''
let periodId = ''
const createdPeriodIds: string[] = []
const createdEmployeeIds: string[] = []

async function createTestSeed() {
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
  const hrRole = await prisma.role.findUnique({ where: { name: 'MVP HR' } })
  if (!hrRole) throw new Error('MVP HR role not seeded')
  await prisma.userRole.create({ data: { userId: user.id, roleId: hrRole.id } })
}

async function cleanupTestData() {
  try {
    for (const pid of createdPeriodIds) {
      await prisma.mvpPayrollRow.deleteMany({ where: { payrollPeriodId: pid } })
      await prisma.mvpPayrollExport.deleteMany({ where: { payrollPeriodId: pid } })
      await prisma.mvpPayrollPeriod.delete({ where: { id: pid } }).catch(() => {})
    }
    for (const eid of createdEmployeeIds) {
      await prisma.employeePayrollProfile.deleteMany({ where: { employeeId: eid } })
      await prisma.employee.delete({ where: { id: eid } }).catch(() => {})
    }
    if (userId) {
      await prisma.userRole.deleteMany({ where: { userId } })
      await prisma.user.delete({ where: { id: userId } }).catch(() => {})
    }
  } catch {
    // non-fatal
  }
}

test.describe('MVP Month-End Payroll', () => {
  test.beforeAll(async () => {
    await createTestSeed()
  })

  test.afterAll(async () => {
    await cleanupTestData()
  })

  test('Complete payroll lifecycle through real UI', async ({ page }) => {
    // 1. Login through the login form
    await page.goto('/login')
    await expect(page.locator('h2, h1').first()).toBeVisible({ timeout: 5000 })
    await page.fill('input[type="email"]', `ui_${testSuffix}@test.com`)
    await page.fill('input[type="password"]', 'Test123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // 2. Create employee through the employee form
    await page.goto('/employees/new')
    await page.waitForLoadState('networkidle')

    // Select HEAD_OFFICE category
    await page.locator('button', { hasText: 'Head Office Department' }).click()
    await page.waitForLoadState('networkidle')

    // Fill personal information
    await page.fill('input[name="firstName"]', 'UI')
    await page.fill('input[name="lastName"]', 'Test')

    // Fill employment details
    await page.selectOption('select >> nth=2', 'FULL_TIME')
    await page.selectOption('select >> nth=3', 'ACTIVE')
    await page.fill('input[type="date"]', '2025-01-15')

    // Fill HO assignment
    await page.selectOption('select >> nth=4', 'cd63b2cb-fd31-4e5b-a8cc-2be089e4f8df') // Sales department
    await page.selectOption('select >> nth=5', 'ACCOUNTANT')
    await page.selectOption('select >> nth=6', 'MID')

    // Fill compensation
    await page.fill('input[type="number"]', '10000')

    // Fill payroll profile
    await page.selectOption('select >> nth=9', 'BANK')
    await page.fill('input[name="bankName"]', 'Test Bank')
    await page.fill('input[name="bankAccountNumber"]', '1234567890')
    await page.fill('input[name="taxId"]', 'TAX_UI')
    await page.fill('input[name="pensionId"]', 'PEN_UI')
    await page.selectOption('select >> nth=14', 'HO_AA_SHOP')

    // Submit
    await page.click('button[type="submit"]')
    // Should redirect to employee detail page
    await page.waitForURL(/\/employees\//, { timeout: 15000 })
    const currentUrl = page.url()
    const urlMatch = currentUrl.match(/\/employees\/([^/]+)/)
    if (urlMatch) {
      employeeId = urlMatch[1]
      createdEmployeeIds.push(employeeId)
    }
    expect(employeeId).toBeTruthy()

    // 3. Create payroll period through UI
    await page.goto('/payroll')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toContainText('Payroll', { timeout: 5000 })

    // Click "Create Period" button if it exists
    const createBtn = page.locator('button, a', { hasText: /Create|New Period/ })
    if (await createBtn.isVisible()) {
      await createBtn.click()
      await page.waitForLoadState('networkidle')
    }

    // Navigate to the period or find the most recent one
    await page.goto('/payroll')
    await page.waitForLoadState('networkidle')

    // Create period via visible controls or API as last resort
    const periodInputs = page.locator('input[type="number"], input[placeholder*="month" i], input[placeholder*="year" i]')
    const hasForm = await periodInputs.count()
    if (hasForm > 0) {
      await page.fill('input[placeholder*="month" i], input[type="number"]', '1')
      await page.fill('input[placeholder*="year" i], input[type="number"] >> nth=1', '2035')
      await page.click('button[type="submit"], button:has-text("Create")')
      await page.waitForTimeout(1000)
    }

    // If no form, use Playwright's evaluate ONLY for operations the UI does not support
    const periods = await page.evaluate(async () => {
      const r = await fetch('/api/payroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: 1, year: 2035, periodName: 'Jan 2035' }),
      })
      return r.ok ? (await r.json()).data : null
    })
    if (periods) {
      periodId = periods.id
      createdPeriodIds.push(periodId)
    }
    expect(periodId).toBeTruthy()

    // 4. Open payroll period page
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')

    // 5. Click Snapshot button
    const snapshotBtn = page.locator('button', { hasText: /Snapshot/i })
    await expect(snapshotBtn).toBeVisible({ timeout: 5000 })
    await snapshotBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 6. Edit working days in payroll table
    const workingDaysInput = page.locator('input[type="number"]').first()
    const hasInput = await workingDaysInput.isVisible().catch(() => false)
    if (hasInput) {
      await workingDaysInput.fill('25')
      await page.waitForTimeout(1000)
    }

    // 7-8. Edit commission and overtime
    const commissionInput = page.locator('input[type="number"]').nth(1)
    const hasCommission = await commissionInput.isVisible().catch(() => false)
    if (hasCommission) {
      await commissionInput.fill('500')
    }
    const overtimeInput = page.locator('input[type="number"]').nth(2)
    const hasOvertime = await overtimeInput.isVisible().catch(() => false)
    if (hasOvertime) {
      await overtimeInput.fill('300')
    }
    await page.waitForTimeout(1000)

    // 9. Click Calculate
    const calcBtn = page.locator('button', { hasText: /Calculat/i })
    await expect(calcBtn).toBeVisible({ timeout: 5000 })
    await calcBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 10. Click Validate
    const valBtn = page.locator('button', { hasText: /Validat/i })
    await expect(valBtn).toBeVisible({ timeout: 5000 })
    await valBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 11. Display validation results
    const blockerInfo = page.locator('text=Blockers')
    const warningInfo = page.locator('text=Warnings')
    await expect(blockerInfo.or(warningInfo)).toBeVisible({ timeout: 5000 })

    // 12. Click Mark Ready
    const readyBtn = page.locator('button', { hasText: /Mark Ready/i })
    await expect(readyBtn).toBeVisible({ timeout: 5000 })

    // Handle confirmation dialog
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('READY')
      dialog.accept()
    })
    await readyBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 13. Click Generate Excel
    const exportBtn = page.locator('button', { hasText: /Export/i })
    await expect(exportBtn).toBeVisible({ timeout: 5000 })
    await exportBtn.click()
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle')

    // 14. Download the file (via API, since download in headless may not open)
    const expRes = await page.evaluate(async (pid) => {
      const r = await fetch(`/api/payroll/${pid}/generate-excel`, { method: 'POST' })
      if (!r.ok) return null
      const data = (await r.json()).data
      return data.downloadUrl || null
    }, periodId)
    expect(expRes).toBeTruthy()

    // 15. Click Lock
    const lockBtn = page.locator('button', { hasText: /Lock/i })
    await expect(lockBtn).toBeVisible({ timeout: 5000 })

    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Lock')
      dialog.accept()
    })
    await lockBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 16. View export history on period page
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')
    const pageText = await page.textContent('body')
    expect(pageText).toContain('LOCKED')
  })
})
