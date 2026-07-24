import { test, expect } from '@playwright/test'
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

const testSuffix = `ui_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
let userId = ''
let employeeId = ''
let periodId = ''
let rowIds: string[] = []
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
    await expect(page.locator('[data-testid="login-email"], input[type="email"]').first()).toBeVisible({ timeout: 5000 })
    await page.fill('[data-testid="login-email"], input[type="email"]', `ui_${testSuffix}@test.com`)
    await page.fill('[data-testid="login-password"], input[type="password"]', 'Test123!')
    await page.click('button[type="submit"]')
    await page.waitForURL('**/dashboard', { timeout: 15000 })

    // 2. Create employee through the employee form
    await page.goto('/employees/new')
    await page.waitForLoadState('networkidle')

    // Select HEAD_OFFICE category
    await page.getByText('Head Office Department').click()
    await page.waitForLoadState('networkidle')

    // Fill personal information
    await page.fill('[data-testid="employee-first-name"]', 'UI')
    await page.fill('[data-testid="employee-last-name"]', 'Test')

    // Fill employment details
    await page.selectOption('[data-testid="employee-employment-type"], select >> nth=0', 'FULL_TIME')
    await page.selectOption('[data-testid="employee-status"], select >> nth=1', 'ACTIVE')
    await page.fill('[data-testid="employee-hire-date"]', '2025-01-15')

    // Fill HO assignment
    await page.selectOption('[data-testid="employee-department"], select >> nth=2', { index: 1 })
    await page.selectOption('[data-testid="employee-role"], select >> nth=3', 'ACCOUNTANT')
    await page.selectOption('[data-testid="employee-level"], select >> nth=4', 'MID')

    // Fill compensation
    await page.fill('[data-testid="employee-basic-salary"]', '10000')
    await page.fill('[data-testid="employee-salary-effective-date"]', '2025-01-15')

    // Fill payroll profile
    await page.selectOption('[data-testid="employee-payment-method"], select >> nth=5', 'BANK')
    await page.fill('[data-testid="employee-bank-name"]', 'Test Bank')
    await page.fill('[data-testid="employee-bank-account"]', '1234567890')
    await page.fill('[data-testid="employee-tax-id"]', 'TAX_UI')
    await page.fill('[data-testid="employee-pension-id"]', 'PEN_UI')
    await page.selectOption('[data-testid="employee-payroll-group"]', 'HO_AA_SHOP')

    // Submit
    await page.click('button[type="submit"]')
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

    // Click "New Period" link
    await page.getByText('New Period').click()
    await page.waitForLoadState('networkidle')

    // Fill month and year
    await page.selectOption('[data-testid="payroll-create-month"]', '1')
    await page.fill('[data-testid="payroll-create-year"]', '2035')
    await page.click('button[type="submit"]')
    await page.waitForURL(/\/payroll\//, { timeout: 15000 })
    const periodUrl = page.url()
    const periodUrlMatch = periodUrl.match(/\/payroll\/([^/]+)/)
    if (periodUrlMatch) {
      periodId = periodUrlMatch[1]
      createdPeriodIds.push(periodId)
    }
    expect(periodId).toBeTruthy()

    // 4. Click Snapshot button
    const snapshotBtn = page.locator('[data-testid="payroll-snapshot"]')
    await expect(snapshotBtn).toBeVisible({ timeout: 5000 })
    await snapshotBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // Verify rows exist by checking table content
    await expect(page.locator('table')).toBeVisible({ timeout: 5000 })
    const tableRows = page.locator('table tbody tr')
    await expect(tableRows.first()).toBeVisible({ timeout: 5000 })

    // Get row IDs from the table
    const editInputs = page.locator('[data-testid^="payroll-workingDays-"]')
    const inputCount = await editInputs.count()
    expect(inputCount).toBeGreaterThan(0)

    // Collect row IDs
    for (let i = 0; i < inputCount; i++) {
      const testId = await editInputs.nth(i).getAttribute('data-testid')
      if (testId) {
        const rid = testId.replace('payroll-workingDays-', '')
        rowIds.push(rid)
      }
    }
    expect(rowIds.length).toBeGreaterThan(0)

    // 5. Edit working days for first row
    const wdInput = page.locator(`[data-testid="payroll-workingDays-${rowIds[0]}"]`)
    await expect(wdInput).toBeVisible({ timeout: 5000 })
    await wdInput.fill('25')

    // 6. Edit commission for first row
    const commInput = page.locator(`[data-testid="payroll-commission-${rowIds[0]}"]`)
    await expect(commInput).toBeVisible({ timeout: 5000 })
    await commInput.fill('500')

    // 7. Edit overtime for first row
    const otInput = page.locator(`[data-testid="payroll-overtime-${rowIds[0]}"]`)
    await expect(otInput).toBeVisible({ timeout: 5000 })
    await otInput.fill('300')

    // 8. Click Calculate
    const calcBtn = page.locator('[data-testid="payroll-calculate"]')
    await expect(calcBtn).toBeVisible({ timeout: 5000 })
    await calcBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 9. Click Validate
    const valBtn = page.locator('[data-testid="payroll-validate"]')
    await expect(valBtn).toBeVisible({ timeout: 5000 })
    await valBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 10. Check validation results
    const pageContent = await page.textContent('body')
    expect(pageContent).toMatch(/Blockers|Warnings|VALID/)

    // 11. Click Mark Ready
    const readyBtn = page.locator('[data-testid="payroll-ready"]')
    await expect(readyBtn).toBeVisible({ timeout: 5000 })
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('READY')
      dialog.accept()
    })
    await readyBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 12. Click Export Excel
    const exportBtn = page.locator('[data-testid="payroll-export"]')
    await expect(exportBtn).toBeVisible({ timeout: 5000 })

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 })
    await exportBtn.click()
    const download = await downloadPromise
    expect(download).toBeTruthy()
    expect(download.suggestedFilename()).toMatch(/\.xlsx$/)

    // 13. Wait for page to process export, then click Lock
    await page.waitForTimeout(3000)
    await page.waitForLoadState('networkidle')

    const lockBtn = page.locator('[data-testid="payroll-lock"]')
    await expect(lockBtn).toBeVisible({ timeout: 5000 })
    page.once('dialog', dialog => {
      expect(dialog.message()).toContain('Lock')
      dialog.accept()
    })
    await lockBtn.click()
    await page.waitForTimeout(2000)
    await page.waitForLoadState('networkidle')

    // 14. Verify LOCKED status
    await page.goto(`/payroll/${periodId}`)
    await page.waitForLoadState('networkidle')
    const finalText = await page.textContent('body')
    expect(finalText).toContain('LOCKED')
  })
})