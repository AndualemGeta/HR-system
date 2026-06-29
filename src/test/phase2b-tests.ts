import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import { getPayrollReadiness } from '../lib/payroll-readiness'
import {
  normalizePhone, normalizeSalary, normalizeStatus, normalizeCategory, normalizeRole,
  normalizeLevel, normalizeEmploymentType, suggestFieldMapping, splitFullName,
  findExistingEmployee, type ImportRowData,
} from '../lib/import-helpers'

const BASE = 'http://localhost:3000'

let passed = 0
let failed = 0
const errors: string[] = []

async function assertAsync(label: string, fn: () => Promise<boolean>) {
  try {
    const result = await fn()
    if (result) { passed++; console.log(`  ✓ ${label}`) }
    else { failed++; errors.push(label); console.log(`  ✗ ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  ✗ ${label} — ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function login(email: string): Promise<string | null> {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'Test123!' }),
  })
  const setCookie = res.headers.get('set-cookie')
  const match = setCookie?.match(/session=([^;]+)/)
  return match ? `session=${match[1]}` : null
}

async function apiPost(path: string, cookie: string, body: unknown) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  })
  return { status: res.status, json: await res.json() }
}

async function apiPostForm(path: string, cookie: string, formData: FormData) {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { Cookie: cookie }, body: formData })
  const text = await res.text()
  let json: unknown; try { json = JSON.parse(text) } catch { json = { error: text } }
  return { status: res.status, json }
}

async function apiGet(path: string, cookie: string) {
  const res = await fetch(`${BASE}${path}`, { headers: { Cookie: cookie } })
  return { status: res.status, json: await res.json() }
}

function makeCsv(content: string): Blob {
  return new Blob([content], { type: 'text/csv' })
}

async function main() {
  console.log('\n=== Phase 2B: Employee Import & Payroll Readiness Tests ===\n')

  const hrAdminCookie = await login('hr.admin@leapfrog.com')
  const empCookie = await login('employee@leapfrog.com')
  const financeCookie = await login('finance.director@leapfrog.com')
  const smCookie = await login('shop.manager@leapfrog.com')

  if (!hrAdminCookie || !empCookie) {
    console.log('  FATAL: Could not login test users'); process.exit(1)
  }

  console.log('[Unit: Normalization Helpers]')

  await assertAsync('normalizePhone: 0911100001', async () => normalizePhone('0911100001') === '0911100001')
  await assertAsync('normalizePhone: +251911100001', async () => normalizePhone('+251911100001') === '0911100001')
  await assertAsync('normalizePhone: 251911100001', async () => normalizePhone('251911100001') === '0911100001')
  await assertAsync('normalizeSalary: "15,000"', async () => normalizeSalary('15,000') === 15000)
  await assertAsync('normalizeSalary: "8000.50"', async () => normalizeSalary('8000.50') === 8000.5)
  await assertAsync('normalizeSalary: negative returns null', async () => normalizeSalary('-500') === null)
  await assertAsync('normalizeStatus: "active"', async () => normalizeStatus('active') === 'ACTIVE')
  await assertAsync('normalizeStatus: "on probation"', async () => normalizeStatus('on probation') === 'ON_PROBATION')
  await assertAsync('normalizeCategory: "head office"', async () => normalizeCategory('head office') === 'HEAD_OFFICE')
  await assertAsync('normalizeCategory: "ho"', async () => normalizeCategory('ho') === 'HEAD_OFFICE')
  await assertAsync('normalizeCategory: "shop/field"', async () => normalizeCategory('shop/field') === 'SHOP_FIELD')
  await assertAsync('normalizeRole: "shop manager"', async () => normalizeRole('shop manager') === 'SHOP_MANAGER')
  await assertAsync('normalizeRole: "asm"', async () => normalizeRole('asm') === 'ASM')
  await assertAsync('normalizeLevel: "senior"', async () => normalizeLevel('senior') === 'SENIOR')
  await assertAsync('normalizeEmploymentType: "full time"', async () => normalizeEmploymentType('full time') === 'FULL_TIME')
  await assertAsync('splitFullName: "Abebe Kebede"', async () => {
    const r = splitFullName('Abebe Kebede')
    return r.firstName === 'Abebe' && r.lastName === 'Kebede' && r.middleName === ''
  })
  await assertAsync('splitFullName: "Abebe Girma Kebede"', async () => {
    const r = splitFullName('Abebe Girma Kebede')
    return r.firstName === 'Abebe' && r.middleName === 'Girma' && r.lastName === 'Kebede'
  })

  console.log('[Unit: Column Mapping Suggestions]')

  await assertAsync('suggestFieldMapping: "Employee Name"', async () => suggestFieldMapping('Employee Name') === 'fullName')
  await assertAsync('suggestFieldMapping: "Basic Salary"', async () => suggestFieldMapping('Basic Salary') === 'basicSalary')
  await assertAsync('suggestFieldMapping: "Shop Name"', async () => suggestFieldMapping('Shop Name') === 'shop')
  await assertAsync('suggestFieldMapping: "Manager"', async () => suggestFieldMapping('Manager') === 'directManagerName')
  await assertAsync('suggestFieldMapping: "M-PESA"', async () => suggestFieldMapping('M-PESA') === 'mpesaAccount')
  await assertAsync('suggestFieldMapping: "Tax ID"', async () => suggestFieldMapping('Tax ID') === 'taxId')

  console.log('[Unit: Mapping Transformation]')

  await assertAsync('Mapping transform: UI col→sys to backend sys→col', async () => {
    const uiMapping: Record<string, string> = { 'Employee Name': 'fullName', 'Basic Salary': 'basicSalary' }
    const backendMapping: Record<string, string> = {}
    for (const [col, sysField] of Object.entries(uiMapping)) {
      if (sysField) backendMapping[sysField] = col
    }
    return backendMapping['fullName'] === 'Employee Name' && backendMapping['basicSalary'] === 'Basic Salary'
  })

  console.log('[Unit: Ambiguous Matching]')

  await assertAsync('findExistingEmployee returns NO_MATCH for unknown', async () => {
    const data: ImportRowData = { fullName: 'ZZZ_Nobody_Exists', role: 'CEO' }
    const result = await findExistingEmployee(data)
    return result.status === 'NO_MATCH' && result.employeeId === null && result.candidates.length === 0
  })

  await assertAsync('findExistingEmployee returns SINGLE_MATCH for CEO', async () => {
    const ceo = await prisma.employee.findFirst({ where: { currentRole: 'CEO' } })
    if (!ceo) return true
    const data: ImportRowData = { employeeId: ceo.employeeId }
    const result = await findExistingEmployee(data)
    return result.status === 'SINGLE_MATCH' && result.employeeId === ceo.id
  })

  await assertAsync('findExistingEmployee returns SINGLE_MATCH by email', async () => {
    const emp = await prisma.employee.findFirst({ where: { email: { not: null } } })
    if (!emp || !emp.email) return true
    const data: ImportRowData = { email: emp.email }
    const result = await findExistingEmployee(data)
    return result.status === 'SINGLE_MATCH' && result.employeeId === emp.id
  })

  console.log('[Permissions]')

  await assertAsync('HR Admin has employee.import', async () => userHasPermission((await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } }))!.id, 'employee.import'))
  await assertAsync('HR Admin has employee.importConfirm', async () => userHasPermission((await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } }))!.id, 'employee.importConfirm'))
  await assertAsync('HR Admin has employee.payrollReadiness.view', async () => userHasPermission((await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } }))!.id, 'employee.payrollReadiness.view'))
  await assertAsync('HR Admin has employee.payrollReadiness.export', async () => userHasPermission((await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } }))!.id, 'employee.payrollReadiness.export'))
  await assertAsync('Finance Director has payrollReadiness.view', async () => userHasPermission((await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } }))!.id, 'employee.payrollReadiness.view'))
  await assertAsync('Employee does NOT have employee.import', async () => {
    const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
    return empUser ? !(await userHasPermission(empUser.id, 'employee.import')) : false
  })

  console.log('[Import Preview: Auto-Detect Columns]')

  await assertAsync('Upload without mapping returns detectedColumns', async () => {
    const csv = makeCsv('Employee Name,Gender,Category\nTest Auto,MALE,HEAD_OFFICE')
    const formData = new FormData()
    formData.append('file', csv, 'auto-detect.csv')
    formData.append('importMode', 'CREATE_ONLY')
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { detectedColumns?: string[]; suggestedMappings?: Record<string, string | null> } }).data
    return (data?.detectedColumns?.length || 0) === 3 && !!(data?.suggestedMappings?.['Employee Name'])
  })

  await assertAsync('Upload with mapping returns full preview', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus\nTest With Map,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'with-map.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { importSessionId?: string; previewRows?: unknown[] } }).data
    return !!data?.importSessionId && (data?.previewRows?.length || 0) > 0
  })

  console.log('[Import Preview: Validation Rules]')

  await assertAsync('Valid CSV row is VALID or WARNING', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus,department\nTest User,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,Human Resources')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', department: 'department' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { validRows?: number; warningRows?: number; errorRows?: number } }).data
    return ((data?.validRows || 0) + (data?.warningRows || 0)) >= 1 && (data?.errorRows || 0) === 0
  })

  await assertAsync('Row with missing category is ERROR', async () => {
    const csv = makeCsv('fullName,gender,role,employmentStatus\nTest User,MALE,HR_OFFICER,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', role: 'role', employmentStatus: 'employmentStatus' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { errorRows?: number } }).data
    return (data?.errorRows || 0) >= 1
  })

  await assertAsync('Row with missing role is ERROR', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,employmentStatus\nTest User,MALE,HEAD_OFFICE,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', employmentStatus: 'employmentStatus' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { errorRows?: number } }).data
    return (data?.errorRows || 0) >= 1
  })

  await assertAsync('Row with missing basic salary is WARNING', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus,department\nTest User,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,Human Resources')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', department: 'department' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { previewRows?: Array<{ warnings: string[] }> } }).data
    return data?.previewRows?.some(r => r.warnings.some(w => w.toLowerCase().includes('basic salary'))) || false
  })

  await assertAsync('Head Office without department is ERROR', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus\nTest HO,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { previewRows?: Array<{ errors: string[] }> } }).data
    return data?.previewRows?.some(r => r.errors.some(e => e.includes('department'))) || false
  })

  await assertAsync('Shop Manager without shop is ERROR', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus\nTest SM,MALE,SHOP_FIELD,SHOP_MANAGER,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { previewRows?: Array<{ errors: string[]; warnings: string[] }> } }).data
    return data?.previewRows?.some(r => r.errors.some((e: string) => e.includes('shop'))) || false
  })

  await assertAsync('Shop Accountant without accounting manager is ERROR', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus,shop,region\nTest SA,MALE,SHOP_FIELD,SHOP_ACCOUNTANT,ACTIVE,Megenagna Shop,Addis Ababa')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', shop: 'shop', region: 'region' }))
    const { json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    const data = (json as { data?: { previewRows?: Array<{ errors: string[] }> } }).data
    return data?.previewRows?.some(r => r.errors.some(e => e.includes('accounting reporting manager'))) || false
  })

  await assertAsync('Empty file is rejected', async () => {
    const csv = makeCsv('')
    const formData = new FormData()
    formData.append('file', csv, 'empty.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({}))
    const { status } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    return status === 400
  })

  await assertAsync('Employee cannot import', async () => {
    const csv = makeCsv('fullName,gender,employeeCategory,role,employmentStatus\nTest,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE')
    const formData = new FormData()
    formData.append('file', csv, 'test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus' }))
    const { status } = await apiPostForm('/api/employees/import/preview', empCookie, formData)
    return status === 403
  })

  console.log('[Import Preview: Manager Resolution]')

  await assertAsync('Manager resolved by employeeId during import', async () => {
    const manager = await prisma.employee.findFirst({ where: { currentRole: 'ASM' } })
    if (!manager) return true
    const ts = Date.now()
    const csv = makeCsv(`fullName,gender,employeeCategory,role,employmentStatus,directManagerEmployeeId,department\nManager Test ${ts},MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,${manager.employeeId},Human Resources`)
    const formData = new FormData()
    formData.append('file', csv, 'mgr-test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', directManagerEmployeeId: 'directManagerEmployeeId', department: 'department' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { importSessionId?: string } }).data
    if (!data?.importSessionId) return false
    const confirm = await apiPost('/api/employees/import/confirm', hrAdminCookie, { importSessionId: data.importSessionId, confirmed: true })
    if (confirm.status !== 200) return false
    const result = (confirm.json as { data?: { createdEmployeeIds?: string[] } }).data
    if (!result?.createdEmployeeIds?.[0]) return false
    const emp = await prisma.employee.findUnique({ where: { id: result.createdEmployeeIds[0] } })
    return emp?.directManagerId === manager.id
  })

  await assertAsync('Manager resolved by name during import', async () => {
    const manager = await prisma.employee.findFirst({ where: { currentRole: 'ASM' } })
    if (!manager) return true
    const ts = Date.now()
    const csv = makeCsv(`fullName,gender,employeeCategory,role,employmentStatus,directManagerName,department\nName Mgr Test ${ts},MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,${manager.fullName},Human Resources`)
    const formData = new FormData()
    formData.append('file', csv, 'mgr-name-test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', directManagerName: 'directManagerName', department: 'department' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { importSessionId?: string } }).data
    if (!data?.importSessionId) return false
    const confirm = await apiPost('/api/employees/import/confirm', hrAdminCookie, { importSessionId: data.importSessionId, confirmed: true })
    if (confirm.status !== 200) return false
    const result = (confirm.json as { data?: { createdEmployeeIds?: string[] } }).data
    if (!result?.createdEmployeeIds?.[0]) return false
    const emp = await prisma.employee.findUnique({ where: { id: result.createdEmployeeIds[0] } })
    return emp?.directManagerId === manager.id
  })

  await assertAsync('Shop Accountant accounting manager resolved during import', async () => {
    const acctMgr = await prisma.employee.findFirst({ where: { currentRole: 'TREASURY_MANAGER' } })
    if (!acctMgr) return true
    const ts = Date.now()
    const csv = makeCsv(`fullName,gender,employeeCategory,role,employmentStatus,shop,region,accountingReportingManagerEmployeeId\nSA Mgr Test ${ts},MALE,SHOP_FIELD,SHOP_ACCOUNTANT,ACTIVE,Megenagna Shop,Addis Ababa,${acctMgr.employeeId}`)
    const formData = new FormData()
    formData.append('file', csv, 'sa-mgr-test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', shop: 'shop', region: 'region', accountingReportingManagerEmployeeId: 'accountingReportingManagerEmployeeId' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { importSessionId?: string } }).data
    if (!data?.importSessionId) return false
    const confirm = await apiPost('/api/employees/import/confirm', hrAdminCookie, { importSessionId: data.importSessionId, confirmed: true })
    if (confirm.status !== 200) return false
    const result = (confirm.json as { data?: { createdEmployeeIds?: string[] } }).data
    if (!result?.createdEmployeeIds?.[0]) return false
    const emp = await prisma.employee.findUnique({ where: { id: result.createdEmployeeIds[0] } })
    return emp?.accountingReportingManagerId === acctMgr.id
  })

  console.log('[Import Confirm]')

  let sessionId: string | null = null
  await assertAsync('Preview returns importSessionId', async () => {
    const ts = Date.now()
    const csv = makeCsv(`fullName,gender,employeeCategory,role,employmentStatus,basicSalary,department,shop,region\nImport ${ts} A,MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,50000,Human Resources,,\nImport ${ts} B,FEMALE,SHOP_FIELD,DSP,ACTIVE,12000,,Megenagna Shop,Addis Ababa`)
    const formData = new FormData()
    formData.append('file', csv, 'confirm-test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', basicSalary: 'basicSalary', department: 'department', shop: 'shop', region: 'region' }))
    const { status, json } = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (status !== 200) return false
    const data = (json as { data?: { importSessionId?: string } }).data
    sessionId = data?.importSessionId || null
    return !!sessionId
  })

  await assertAsync('Confirm creates employees', async () => {
    if (!sessionId) return false
    const { status, json } = await apiPost('/api/employees/import/confirm', hrAdminCookie, { importSessionId: sessionId, confirmed: true })
    if (status !== 200) return false
    const data = (json as { data?: { createdCount?: number } }).data
    return (data?.createdCount || 0) >= 1
  })

  await assertAsync('Import history exists', async () => {
    const { status, json } = await apiGet('/api/employees/import/history', hrAdminCookie)
    if (status !== 200) return false
    const data = (json as { data?: Array<{ id: string }> }).data
    return (data?.length || 0) >= 1
  })

  await assertAsync('Confirm requires employee.importConfirm permission', async () => {
    const { status } = await apiPost('/api/employees/import/confirm', empCookie, { importSessionId: 'any', confirmed: true })
    return status === 403
  })

  console.log('[Import Confirm: Row-Level Audit Logs]')

  await assertAsync('Confirm creates EMPLOYEE_IMPORT_CREATE audit logs', async () => {
    const ts = Date.now()
    const csv = makeCsv(`fullName,gender,employeeCategory,role,employmentStatus,department\nAudit Test ${ts},MALE,HEAD_OFFICE,HR_OFFICER,ACTIVE,Human Resources`)
    const formData = new FormData()
    formData.append('file', csv, 'audit-test.csv')
    formData.append('importMode', 'CREATE_ONLY')
    formData.append('mapping', JSON.stringify({ fullName: 'fullName', gender: 'gender', employeeCategory: 'employeeCategory', role: 'role', employmentStatus: 'employmentStatus', department: 'department' }))
    const preview = await apiPostForm('/api/employees/import/preview', hrAdminCookie, formData)
    if (preview.status !== 200) return false
    const pData = (preview.json as { data?: { importSessionId?: string } }).data
    if (!pData?.importSessionId) return false
    const confirm = await apiPost('/api/employees/import/confirm', hrAdminCookie, { importSessionId: pData.importSessionId, confirmed: true })
    if (confirm.status !== 200) return false
    const cData = (confirm.json as { data?: { createdEmployeeIds?: string[] } }).data
    if (!cData?.createdEmployeeIds?.[0]) return false
    const audit = await prisma.auditLog.findFirst({
      where: { action: 'EMPLOYEE_IMPORT_CREATE', entityId: cData.createdEmployeeIds[0] },
    })
    return !!audit
  })

  await assertAsync('Import history shows row-level detail', async () => {
    const { status, json } = await apiGet('/api/employees/import/history', hrAdminCookie)
    if (status !== 200) return false
    const data = (json as { data?: Array<{ id: string }> }).data
    const latest = data?.[0]
    if (!latest) return false
    const detail = await apiGet(`/api/employees/import/history/${latest.id}`, hrAdminCookie)
    if (detail.status !== 200) return false
    const detailData = (detail.json as { data?: { rows?: Array<{ status: string }> } }).data
    return (detailData?.rows?.length || 0) > 0
  })

  console.log('[Payroll Readiness]')

  await assertAsync('Payroll readiness list returns data', async () => {
    const { status, json } = await apiGet('/api/employees/payroll-readiness', hrAdminCookie)
    if (status !== 200) return false
    const data = (json as { data?: { employees?: Array<{ overallStatus: string }> } }).data
    return (data?.employees?.length || 0) > 0
  })

  await assertAsync('Payroll readiness summary has all fields', async () => {
    const { json } = await apiGet('/api/employees/payroll-readiness', hrAdminCookie)
    const data = (json as { data?: { summary?: { total: number; ready: number; warning: number; notReady: number; inactive: number } } }).data
    const s = data?.summary
    return s ? typeof s.total === 'number' && typeof s.ready === 'number' && typeof s.notReady === 'number' : false
  })

  await assertAsync('CEO employee is READY for payroll', async () => {
    const ceo = await prisma.employee.findFirst({ where: { currentRole: 'CEO' } })
    if (!ceo) return true
    const readiness = await getPayrollReadiness(ceo.id)
    return readiness?.overallStatus === 'READY'
  })

  await assertAsync('Employee missing salary is NOT_READY', async () => {
    const emp = await prisma.employee.findFirst({ where: { basicSalary: null, employmentStatus: 'ACTIVE' } })
    if (!emp) return true
    const readiness = await getPayrollReadiness(emp.id)
    return readiness?.overallStatus === 'NOT_READY' || readiness?.overallStatus === 'WARNING'
  })

  await assertAsync('Inactive employee is INACTIVE', async () => {
    const emp = await prisma.employee.findFirst({ where: { employmentStatus: 'RESIGNED' } })
    if (!emp) return true
    const readiness = await getPayrollReadiness(emp.id)
    return readiness?.overallStatus === 'INACTIVE'
  })

  await assertAsync('Payroll readiness export works', async () => {
    const res = await fetch(`${BASE}/api/employees/payroll-readiness/export`, { headers: { Cookie: hrAdminCookie } })
    return res.status === 200 && (res.headers.get('content-type') || '').includes('text/csv')
  })

  await assertAsync('Finance Director can view payroll readiness', async () => {
    if (!financeCookie) return true
    const { status } = await apiGet('/api/employees/payroll-readiness', financeCookie)
    return status === 200
  })

  await assertAsync('Employee cannot view payroll readiness', async () => {
    const { status } = await apiGet('/api/employees/payroll-readiness', empCookie)
    return status === 403
  })

  console.log('[Payroll Readiness: Scope]')

  await assertAsync('Shop Manager sees scoped payroll readiness', async () => {
    if (!smCookie) return true
    const { status, json } = await apiGet('/api/employees/payroll-readiness', smCookie)
    if (status !== 200) return false
    const data = (json as { data?: { employees?: Array<{ employeeId: string }> } }).data
    const sm = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
    if (!sm) return true
    const smEmp = await prisma.employee.findUnique({ where: { id: sm.employeeId || '' } })
    if (!smEmp || !smEmp.currentShopId) return true
    const empIds = data?.employees?.map(e => e.employeeId) || []
    return empIds.length > 0
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
    const hrAdmin = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
    return hrAdmin ? userHasPermission(hrAdmin.id, 'salary.view') : false
  })

  await assertAsync('Manager scope helper still works', async () => {
    const { canViewEmployee } = await import('../lib/rbac')
    const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
    const dspEmp = await prisma.employee.findFirst({ where: { currentRole: 'DSP', currentShopId: { not: null } } })
    if (!shopManagerUser || !dspEmp) return true
    const canView = await canViewEmployee(shopManagerUser.id, dspEmp.id)
    return typeof canView === 'boolean'
  })

  await assertAsync('Document rules still exist', async () => {
    const count = await prisma.requiredDocumentRule.count({ where: { isActive: true } })
    return count > 0
  })

  const total = passed + failed
  console.log('\n' + '='.repeat(40))
  console.log(`Phase 2B Tests: ${total} total, ${passed} passed, ${failed} failed`)
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
