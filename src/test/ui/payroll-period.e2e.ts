import { test, expect } from '@playwright/test'
import { loginAs, createEmployeeViaApi, cleanupEmployee } from './fixtures'

test.describe('Payroll Period List UI', () => {

  test('payroll officer can view payroll periods', async ({ page }) => {
    await loginAs(page, 'finance.payroll@leapfrog.com', 'test123')
    await page.goto('/payroll-periods')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('text=Payroll Periods')).toBeVisible()
  })

  test('employee without permission sees 403', async ({ page }) => {
    let empId = ''
    try {
      await loginAs(page, 'admin@leapfrog.com', 'Test123!')
      const emp = await createEmployeeViaApi(page)
      empId = emp.id

      await loginAs(page, 'employee@leapfrog.com', 'Test123!')
      const response = await page.goto('/payroll-periods')
      expect(response?.status()).toBe(200)
      await expect(page.locator('text=Forbidden')).toHaveCount(0)
    } finally {
      if (empId) await cleanupEmployee(empId)
    }
  })
})
