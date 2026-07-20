import { PrismaClient } from '@prisma/client'
import { Page } from '@playwright/test'

const prisma = new PrismaClient()

export interface CreatedEmployee {
  id: string
  employeeId: string
  fullName: string
}

let counter = 0

function uniqueId(): string {
  counter++
  return `TEST_KPI_UI_${Date.now()}_${counter}`
}

export async function loginAs(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL('**/dashboard')
}

export async function createEmployeeViaApi(page: Page): Promise<CreatedEmployee> {
  const uid = uniqueId()
  const res = await page.evaluate(async (uid: string) => {
    const r = await fetch('/api/employees', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        firstName: uid,
        lastName: 'E2E',
        email: `${uid}@test.local`,
        phoneNumber: '0911000000',
        gender: 'MALE',
        employmentType: 'FULL_TIME',
        employmentStatus: 'ACTIVE',
        employeeCategory: 'HEAD_OFFICE',
        currentRole: 'OTHER',
        currentLevel: 'JUNIOR',
        currentDepartmentId: 'cd63b2cb-fd31-4e5b-a8cc-2be089e4f8df',
        hireDate: '2026-01-01',
      }),
    })
    const json = await r.json()
    return { ok: r.ok, data: json.data || json, error: json.error }
  }, uid)
  if (!res.ok) throw new Error(`Employee creation failed: ${res.error || JSON.stringify(res.data)}`)
  return { id: res.data.id, employeeId: res.data.employeeId, fullName: res.data.fullName }
}

export async function createKpiAssignmentViaApi(page: Page, employeeId: string): Promise<void> {
  const res = await page.evaluate(async ({ employeeId }: { employeeId: string }) => {
    const r = await fetch(`/api/employees/${employeeId}/pay-component-assignments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payComponentCode: 'KPI_ALLOWANCE', defaultAmount: 7500, effectiveFrom: '2026-01-01' }),
    })
    const json = await r.json()
    return { ok: r.ok, error: json.error }
  }, { employeeId })
  if (!res.ok) throw new Error(`KPI assignment creation failed: ${res.error}`)
}

export async function cleanupEmployee(employeeId: string): Promise<void> {
  try {
    await prisma.employeePayComponentAssignment.deleteMany({ where: { employeeId } })
    await prisma.payrollPeriodEmployee.deleteMany({ where: { employeeId } })
    await prisma.payrollInput.deleteMany({ where: { employeeId } })
    await prisma.employee.delete({ where: { id: employeeId } })
  } catch {
    // ignore cleanup errors
  } finally {
    await prisma.$disconnect().catch(() => {})
  }
}
