import { test, expect } from '@playwright/test'
import { loginAs, createEmployeeViaApi, createKpiAssignmentViaApi, cleanupEmployee } from './fixtures'

test.describe('KPI Assignment UI', () => {

  test('salary.update user can view and manage KPI on employee detail', async ({ page }) => {
    let empId = ''

    try {
      await loginAs(page, 'admin@leapfrog.com', 'Test123!')
      const emp = await createEmployeeViaApi(page)
      empId = emp.id

      await createKpiAssignmentViaApi(page, emp.id)

      await page.goto(`/employees/${emp.id}`)
      await page.waitForLoadState('networkidle')

      await expect(page.locator('text=KPI Entitlement')).toBeVisible()
      const infoRow = page.locator('text=KPI Default Amount').locator('..')
      await expect(infoRow).toBeVisible()
      await expect(infoRow.locator('text=7,500')).toBeVisible()
    } finally {
      if (empId) await cleanupEmployee(empId)
    }
  })

  test('can open Add KPI modal for employee without assignment', async ({ page }) => {
    let empId = ''

    try {
      await loginAs(page, 'admin@leapfrog.com', 'Test123!')
      const emp = await createEmployeeViaApi(page)
      empId = emp.id

      await page.goto(`/employees/${emp.id}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const addBtn = page.locator('button:has-text("Add KPI")')
      await expect(addBtn).toBeVisible({ timeout: 10000 })

      await addBtn.click()
      await expect(page.locator('text=Add KPI Assignment')).toBeVisible()

      await page.fill('input[type="number"]', '5000')
      await page.fill('input[type="date"]', '2026-01-01')

      await page.click('button:has-text("Save")')
      await page.waitForTimeout(2000)

      const kpiRow = page.locator('text=KPI Default Amount').locator('..')
      await expect(kpiRow).toBeVisible()
      await expect(kpiRow.locator('text=5,000')).toBeVisible()
    } finally {
      if (empId) await cleanupEmployee(empId)
    }
  })

  test('validation errors show in modal when saving without values', async ({ page }) => {
    let empId = ''

    try {
      await loginAs(page, 'admin@leapfrog.com', 'Test123!')
      const emp = await createEmployeeViaApi(page)
      empId = emp.id

      await page.goto(`/employees/${emp.id}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      const addBtn = page.locator('button:has-text("Add KPI")')
      await expect(addBtn).toBeVisible({ timeout: 10000 })
      await addBtn.click()

      await expect(page.locator('text=Add KPI Assignment')).toBeVisible()
      await page.click('button:has-text("Save")')

      await expect(page.locator('text=Valid non-negative amount required')).toBeVisible()
    } finally {
      if (empId) await cleanupEmployee(empId)
    }
  })

  test('employee without salary.view cannot see KPI section', async ({ page }) => {
    let empId = ''

    try {
      await loginAs(page, 'admin@leapfrog.com', 'Test123!')
      const emp = await createEmployeeViaApi(page)
      empId = emp.id

      await loginAs(page, 'employee@leapfrog.com', 'Test123!')

      await page.goto(`/employees/${emp.id}`)
      await page.waitForLoadState('networkidle')
      await page.waitForTimeout(500)

      await expect(page.locator('text=KPI Entitlement')).toHaveCount(0)
    } finally {
      if (empId) await cleanupEmployee(empId)
    }
  })
})
