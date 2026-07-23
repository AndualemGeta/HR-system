import { prisma } from './prisma'
import { isValidPayrollGroup } from './payroll-group'
import type { EmployeeCategory, EmploymentStatus, EmploymentType, EmployeeRole, EmployeeLevel } from '@prisma/client'

export const SYSTEM_FIELDS = [
  { key: 'employeeId', label: 'Employee ID', required: false, category: 'core' },
  { key: 'firstName', label: 'First Name', required: true, category: 'core' },
  { key: 'middleName', label: 'Middle Name', required: false, category: 'core' },
  { key: 'lastName', label: 'Last Name', required: false, category: 'core' },
  { key: 'fullName', label: 'Full Name', required: false, category: 'core' },
  { key: 'gender', label: 'Gender', required: true, category: 'core' },
  { key: 'phoneNumber', label: 'Phone Number', required: false, category: 'core' },
  { key: 'email', label: 'Email', required: false, category: 'core' },
  { key: 'dateOfBirth', label: 'Date of Birth', required: false, category: 'core' },
  { key: 'hireDate', label: 'Hire Date', required: false, category: 'core' },
  { key: 'employmentType', label: 'Employment Type', required: false, category: 'core' },
  { key: 'employmentStatus', label: 'Employment Status', required: true, category: 'core' },
  { key: 'employeeCategory', label: 'Employee Category', required: true, category: 'core' },
  { key: 'department', label: 'Department', required: false, category: 'organization' },
  { key: 'division', label: 'Division', required: false, category: 'organization' },
  { key: 'region', label: 'Region', required: false, category: 'organization' },
  { key: 'area', label: 'Area', required: false, category: 'organization' },
  { key: 'shop', label: 'Shop', required: false, category: 'organization' },
  { key: 'cluster', label: 'Cluster', required: false, category: 'organization' },
  { key: 'role', label: 'Role', required: true, category: 'organization' },
  { key: 'level', label: 'Level', required: false, category: 'organization' },
  { key: 'directManagerEmployeeId', label: 'Manager Employee ID', required: false, category: 'organization' },
  { key: 'directManagerName', label: 'Manager Name', required: false, category: 'organization' },
  { key: 'accountingReportingManagerEmployeeId', label: 'Accounting Manager ID', required: false, category: 'organization' },
  { key: 'accountingReportingManagerName', label: 'Accounting Manager Name', required: false, category: 'organization' },
  { key: 'basicSalary', label: 'Basic Salary', required: false, category: 'payroll' },
  { key: 'salaryEffectiveDate', label: 'Salary Effective Date', required: false, category: 'payroll' },
  { key: 'paymentMethod', label: 'Payment Method', required: false, category: 'payroll' },
  { key: 'bankName', label: 'Bank Name', required: false, category: 'payroll' },
  { key: 'bankAccountNumber', label: 'Bank Account Number', required: false, category: 'payroll' },
  { key: 'mpesaAccount', label: 'M-PESA Account', required: false, category: 'payroll' },
  { key: 'taxId', label: 'Tax ID', required: false, category: 'payroll' },
  { key: 'pensionId', label: 'Pension ID', required: false, category: 'payroll' },
  { key: 'costCenter', label: 'Cost Center', required: false, category: 'payroll' },
  { key: 'payrollGroup', label: 'Payroll Group', required: false, category: 'payroll' },
  { key: 'address', label: 'Address', required: false, category: 'optional' },
  { key: 'notes', label: 'Notes', required: false, category: 'optional' },
  { key: 'emergencyContactName', label: 'Emergency Contact Name', required: false, category: 'optional' },
  { key: 'emergencyContactPhone', label: 'Emergency Contact Phone', required: false, category: 'optional' },
]

const FRIENDLY_MAP: Record<string, string> = {
  'employee name': 'fullName',
  'name': 'fullName',
  'full name': 'fullName',
  'first name': 'firstName',
  'last name': 'lastName',
  'middle name': 'middleName',
  'phone': 'phoneNumber',
  'phone number': 'phoneNumber',
  'mobile': 'phoneNumber',
  'mobile number': 'phoneNumber',
  'dept': 'department',
  'department name': 'department',
  'division name': 'division',
  'region name': 'region',
  'area name': 'area',
  'shop name': 'shop',
  'cluster name': 'cluster',
  'position': 'role',
  'job title': 'role',
  'job role': 'role',
  'title': 'role',
  'manager': 'directManagerName',
  'supervisor': 'directManagerName',
  'direct manager': 'directManagerName',
  'manager id': 'directManagerEmployeeId',
  'basic salary': 'basicSalary',
  'salary': 'basicSalary',
  'monthly salary': 'basicSalary',
  'pay': 'basicSalary',
  'payment method': 'paymentMethod',
  'payment': 'paymentMethod',
  'bank': 'bankName',
  'bank name': 'bankName',
  'bank account': 'bankAccountNumber',
  'bank account number': 'bankAccountNumber',
  'account number': 'bankAccountNumber',
  'mpesa': 'mpesaAccount',
  'm-pesa': 'mpesaAccount',
  'm-pesa account': 'mpesaAccount',
  'mpesa account': 'mpesaAccount',
  'tax id': 'taxId',
  'tin': 'taxId',
  'tin number': 'taxId',
  'tax number': 'taxId',
  'pension id': 'pensionId',
  'pension number': 'pensionId',
  'cost center': 'costCenter',
  'cc': 'costCenter',
  'payroll group': 'payrollGroup',
  'pay group': 'payrollGroup',
  'category': 'employeeCategory',
  'emp category': 'employeeCategory',
  'employment status': 'employmentStatus',
  'status': 'employmentStatus',
  'emp status': 'employmentStatus',
  'employment type': 'employmentType',
  'emp type': 'employmentType',
  'type': 'employmentType',
  'hire date': 'hireDate',
  'start date': 'hireDate',
  'joining date': 'hireDate',
  'dob': 'dateOfBirth',
  'birth date': 'dateOfBirth',
  'date of birth': 'dateOfBirth',
  'gender': 'gender',
  'sex': 'gender',
  'email': 'email',
  'e-mail': 'email',
  'employee id': 'employeeId',
  'emp id': 'employeeId',
  'staff id': 'employeeId',
  'level': 'level',
  'grade': 'level',
  'address': 'address',
  'location': 'address',
  'notes': 'notes',
  'remark': 'notes',
  'remarks': 'notes',
  'accounting manager': 'accountingReportingManagerName',
  'accounting manager id': 'accountingReportingManagerEmployeeId',
  'finance manager': 'accountingReportingManagerName',
}

export function suggestFieldMapping(columnName: string): string | null {
  const normalized = columnName.toLowerCase().trim()
  if (FRIENDLY_MAP[normalized]) return FRIENDLY_MAP[normalized]
  const stripped = normalized.replace(/[^a-z0-9]/g, '')
  if (FRIENDLY_MAP[stripped]) return FRIENDLY_MAP[stripped]
  for (const [key, value] of Object.entries(FRIENDLY_MAP)) {
    if (stripped.includes(key.replace(/[^a-z0-9]/g, '')) || key.replace(/[^a-z0-9]/g, '').includes(stripped)) {
      return value
    }
  }
  return null
}

export function normalizeString(value: unknown): string {
  if (value === null || value === undefined) return ''
  return String(value).trim().replace(/\s+/g, ' ')
}

export function normalizePhone(value: unknown): string {
  const raw = normalizeString(value)
  if (!raw) return ''
  let digits = raw.replace(/[\s\-()]/g, '')
  if (digits.startsWith('+251')) digits = '0' + digits.slice(4)
  if (digits.startsWith('251')) digits = '0' + digits.slice(3)
  if (!digits.startsWith('0')) digits = '0' + digits
  if (/^0(7|9)\d{8}$/.test(digits)) return digits
  return raw
}

export function normalizeSalary(value: unknown): number | null {
  if (value === null || value === undefined) return null
  const str = String(value).trim()
  if (!str) return null
  if (str.startsWith('-')) return null
  const cleaned = str.replace(/[^0-9.]/g, '')
  if (!cleaned) return null
  const num = parseFloat(cleaned)
  if (isNaN(num) || num < 0) return null
  return num
}

const STATUS_MAP: Record<string, EmploymentStatus> = {
  active: 'ACTIVE', onboarding: 'ONBOARDING', probation: 'ON_PROBATION',
  'on probation': 'ON_PROBATION', resigned: 'RESIGNED',
  terminated: 'TERMINATED', draft: 'DRAFT', suspended: 'SUSPENDED',
  'on leave': 'ON_LEAVE', transferred: 'TRANSFERRED', exited: 'EXITED',
}

export function normalizeStatus(value: unknown): EmploymentStatus | null {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return null
  const key = raw.replace(/_/g, ' ')
  return STATUS_MAP[key] || STATUS_MAP[raw] || null
}

const TYPE_MAP: Record<string, EmploymentType> = {
  'full time': 'FULL_TIME', 'full-time': 'FULL_TIME', fulltime: 'FULL_TIME',
  'part time': 'PART_TIME', 'part-time': 'PART_TIME', parttime: 'PART_TIME',
  contract: 'CONTRACT',
  'commission based': 'COMMISSION_BASED', 'commission-based': 'COMMISSION_BASED', commission: 'COMMISSION_BASED',
  temporary: 'TEMPORARY', temp: 'TEMPORARY',
  intern: 'INTERN', internship: 'INTERN',
}

export function normalizeEmploymentType(value: unknown): EmploymentType | null {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return null
  const key = raw.replace(/_/g, ' ')
  return TYPE_MAP[key] || TYPE_MAP[raw] || null
}

const CATEGORY_MAP: Record<string, EmployeeCategory> = {
  'head office': 'HEAD_OFFICE', ho: 'HEAD_OFFICE', office: 'HEAD_OFFICE',
  'shop field': 'SHOP_FIELD', 'shop/field': 'SHOP_FIELD', shop: 'SHOP_FIELD', field: 'SHOP_FIELD',
}

export function normalizeCategory(value: unknown): EmployeeCategory | null {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return null
  const key = raw.replace(/_/g, ' ')
  return CATEGORY_MAP[key] || CATEGORY_MAP[raw] || null
}

const ROLE_MAP: Record<string, EmployeeRole> = {
  ceo: 'CEO', 'area sales manager': 'ASM', asm: 'ASM',
  'shop manager': 'SHOP_MANAGER', sm: 'SHOP_MANAGER',
  dsp: 'DSP', 'indoor sales': 'DSP',
  dsa: 'DSA', 'outdoor sales': 'DSA',
  'shop accountant': 'SHOP_ACCOUNTANT', sa: 'SHOP_ACCOUNTANT',
  'sales head': 'SALES_HEAD', 'hr officer': 'HR_OFFICER',
  'hr manager': 'HR_MANAGER', 'finance director': 'FINANCE_DIRECTOR',
  'treasury manager': 'TREASURY_MANAGER', accountant: 'ACCOUNTANT',
  'distribution manager': 'DISTRIBUTION_MANAGER', 'technology manager': 'TECHNOLOGY_MANAGER',
  'business development manager': 'BUSINESS_DEVELOPMENT_MANAGER', 'bdm': 'BUSINESS_DEVELOPMENT_MANAGER',
  employee: 'EMPLOYEE', 'ebu supervisor': 'EBU_SUPERVISOR',
  'ba coordinator': 'BA_COORDINATOR', 'cleaning staff': 'CLEANING_STAFF',
  'security staff': 'SECURITY_STAFF', other: 'OTHER',
}

export function normalizeRole(value: unknown): EmployeeRole | null {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return null
  const key = raw.replace(/_/g, ' ')
  return ROLE_MAP[key] || ROLE_MAP[raw] || null
}

const LEVEL_MAP: Record<string, EmployeeLevel> = {
  junior: 'JUNIOR', mid: 'MID', senior: 'SENIOR', lead: 'LEAD',
  manager: 'MANAGER', director: 'DIRECTOR', executive: 'EXECUTIVE',
}

export function normalizeLevel(value: unknown): EmployeeLevel | null {
  const raw = normalizeString(value).toLowerCase()
  if (!raw) return null
  const key = raw.replace(/_/g, ' ')
  return LEVEL_MAP[key] || LEVEL_MAP[raw] || null
}

export function normalizeDate(value: unknown): Date | null {
  if (!value) return null
  if (value instanceof Date) return isNaN(value.getTime()) ? null : value
  const str = String(value).trim()
  if (!str) return null
  const d = new Date(str)
  if (isNaN(d.getTime())) return null
  return d
}

export function splitFullName(fullName: string): { firstName: string; middleName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 0) return { firstName: '', middleName: '', lastName: '' }
  if (parts.length === 1) return { firstName: parts[0], middleName: '', lastName: '' }
  if (parts.length === 2) return { firstName: parts[0], middleName: '', lastName: parts[1] }
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] }
}

export interface ImportRowData {
  employeeId?: string
  firstName?: string
  middleName?: string
  lastName?: string
  fullName?: string
  gender?: string
  phoneNumber?: string
  email?: string
  dateOfBirth?: Date | null
  hireDate?: Date | null
  employmentType?: EmploymentType | null
  employmentStatus?: EmploymentStatus | null
  employeeCategory?: EmployeeCategory | null
  department?: string
  division?: string
  region?: string
  area?: string
  shop?: string
  cluster?: string
  role?: EmployeeRole | null
  level?: EmployeeLevel | null
  directManagerEmployeeId?: string
  directManagerName?: string
  accountingReportingManagerEmployeeId?: string
  accountingReportingManagerName?: string
  basicSalary?: number | null
  salaryEffectiveDate?: Date | null
  paymentMethod?: string
  bankName?: string
  bankAccountNumber?: string
  mpesaAccount?: string
  taxId?: string
  pensionId?: string
  costCenter?: string
  payrollGroup?: string
  address?: string
  notes?: string
  emergencyContactName?: string
  emergencyContactPhone?: string
  [key: string]: unknown
}

export interface ValidationResult {
  status: 'VALID' | 'WARNING' | 'ERROR' | 'DUPLICATE' | 'SKIPPED'
  errors: string[]
  warnings: string[]
  matchedEmployeeId: string | null
  matchStatus?: string
}

export function parseRow(rawRow: Record<string, unknown>, mapping: Record<string, string>): ImportRowData {
  const parsed: ImportRowData = {}
  for (const [systemField, csvColumn] of Object.entries(mapping)) {
    const value = rawRow[csvColumn]
    if (value === undefined || value === null || String(value).trim() === '') continue
    switch (systemField) {
      case 'employeeId': parsed.employeeId = normalizeString(value); break
      case 'firstName': parsed.firstName = normalizeString(value); break
      case 'middleName': parsed.middleName = normalizeString(value); break
      case 'lastName': parsed.lastName = normalizeString(value); break
      case 'fullName': parsed.fullName = normalizeString(value); break
      case 'gender': parsed.gender = normalizeString(value).toUpperCase(); break
      case 'phoneNumber': parsed.phoneNumber = normalizePhone(value); break
      case 'email': parsed.email = normalizeString(value).toLowerCase(); break
      case 'dateOfBirth': parsed.dateOfBirth = normalizeDate(value); break
      case 'hireDate': parsed.hireDate = normalizeDate(value); break
      case 'employmentType': parsed.employmentType = normalizeEmploymentType(value); break
      case 'employmentStatus': parsed.employmentStatus = normalizeStatus(value); break
      case 'employeeCategory': parsed.employeeCategory = normalizeCategory(value); break
      case 'department': parsed.department = normalizeString(value); break
      case 'division': parsed.division = normalizeString(value); break
      case 'region': parsed.region = normalizeString(value); break
      case 'area': parsed.area = normalizeString(value); break
      case 'shop': parsed.shop = normalizeString(value); break
      case 'cluster': parsed.cluster = normalizeString(value); break
      case 'role': parsed.role = normalizeRole(value); break
      case 'level': parsed.level = normalizeLevel(value); break
      case 'directManagerEmployeeId': parsed.directManagerEmployeeId = normalizeString(value); break
      case 'directManagerName': parsed.directManagerName = normalizeString(value); break
      case 'accountingReportingManagerEmployeeId': parsed.accountingReportingManagerEmployeeId = normalizeString(value); break
      case 'accountingReportingManagerName': parsed.accountingReportingManagerName = normalizeString(value); break
      case 'basicSalary': parsed.basicSalary = normalizeSalary(value); break
      case 'salaryEffectiveDate': parsed.salaryEffectiveDate = normalizeDate(value); break
      case 'paymentMethod': parsed.paymentMethod = normalizeString(value); break
      case 'bankName': parsed.bankName = normalizeString(value); break
      case 'bankAccountNumber': parsed.bankAccountNumber = normalizeString(value); break
      case 'mpesaAccount': parsed.mpesaAccount = normalizeString(value); break
      case 'taxId': parsed.taxId = normalizeString(value); break
      case 'pensionId': parsed.pensionId = normalizeString(value); break
      case 'costCenter': parsed.costCenter = normalizeString(value); break
      case 'payrollGroup': parsed.payrollGroup = normalizeString(value); break
      case 'address': parsed.address = normalizeString(value); break
      case 'notes': parsed.notes = normalizeString(value); break
      case 'emergencyContactName': parsed.emergencyContactName = normalizeString(value); break
      case 'emergencyContactPhone': parsed.emergencyContactPhone = normalizePhone(value); break
    }
  }
  return parsed
}

export async function resolveOrganizationRefs(data: ImportRowData): Promise<{ departmentId?: string; regionId?: string; areaId?: string; shopId?: string; divisionId?: string; clusterId?: string }> {
  const refs: { departmentId?: string; regionId?: string; areaId?: string; shopId?: string; divisionId?: string; clusterId?: string } = {}
  if (data.department) {
    const dept = await prisma.department.findFirst({ where: { name: { contains: data.department, mode: 'insensitive' } } })
    if (dept) refs.departmentId = dept.id
  }
  if (data.region) {
    const loc = await prisma.location.findFirst({ where: { name: { contains: data.region, mode: 'insensitive' }, type: 'REGION' } })
    if (loc) refs.regionId = loc.id
  }
  if (data.area) {
    const loc = await prisma.location.findFirst({ where: { name: { contains: data.area, mode: 'insensitive' }, type: 'AREA' } })
    if (loc) refs.areaId = loc.id
  }
  if (data.shop) {
    const loc = await prisma.location.findFirst({ where: { name: { contains: data.shop, mode: 'insensitive' }, type: 'SHOP' } })
    if (loc) refs.shopId = loc.id
  }
  if (data.division) {
    const loc = await prisma.location.findFirst({ where: { name: { contains: data.division, mode: 'insensitive' }, type: 'DIVISION' } })
    if (loc) refs.divisionId = loc.id
  }
  if (data.cluster) {
    const loc = await prisma.location.findFirst({ where: { name: { contains: data.cluster, mode: 'insensitive' }, type: 'CLUSTER' } })
    if (loc) refs.clusterId = loc.id
  }
  return refs
}

export async function resolveManagerIds(data: ImportRowData): Promise<{ directManagerId?: string; accountingReportingManagerId?: string }> {
  const result: { directManagerId?: string; accountingReportingManagerId?: string } = {}

  if (data.directManagerEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { employeeId: data.directManagerEmployeeId } })
    if (emp) result.directManagerId = emp.id
  }
  if (!result.directManagerId && data.directManagerName) {
    const emp = await prisma.employee.findFirst({
      where: { fullName: { contains: data.directManagerName, mode: 'insensitive' } },
    })
    if (emp) result.directManagerId = emp.id
  }

  if (data.accountingReportingManagerEmployeeId) {
    const emp = await prisma.employee.findFirst({ where: { employeeId: data.accountingReportingManagerEmployeeId } })
    if (emp) result.accountingReportingManagerId = emp.id
  }
  if (!result.accountingReportingManagerId && data.accountingReportingManagerName) {
    const emp = await prisma.employee.findFirst({
      where: { fullName: { contains: data.accountingReportingManagerName, mode: 'insensitive' } },
    })
    if (emp) result.accountingReportingManagerId = emp.id
  }

  return result
}

export interface EmployeeMatchResult {
  status: 'NO_MATCH' | 'SINGLE_MATCH' | 'AMBIGUOUS_MATCH'
  employeeId: string | null
  candidates: string[]
}

export async function findExistingEmployee(data: ImportRowData): Promise<EmployeeMatchResult> {
  const found = new Map<string, string>() // key → employeeId

  if (data.employeeId) {
    const emp = await prisma.employee.findFirst({ where: { employeeId: data.employeeId } })
    if (emp) found.set('employeeId:' + emp.employeeId, emp.id)
  }
  if (data.email) {
    const emp = await prisma.employee.findFirst({ where: { email: data.email } })
    if (emp) found.set('email:' + data.email, emp.id)
  }
  if (data.phoneNumber) {
    const emp = await prisma.employee.findFirst({ where: { phoneNumber: data.phoneNumber } })
    if (emp) found.set('phone:' + data.phoneNumber, emp.id)
  }
  if (data.fullName && data.role) {
    const emps = await prisma.employee.findMany({
      where: {
        fullName: { contains: data.fullName, mode: 'insensitive' },
        currentRole: data.role,
      },
    })
    for (const emp of emps) {
      found.set('name+role:' + emp.id, emp.id)
    }
  }

  const uniqueIds = [...new Set(found.values())]
  if (uniqueIds.length === 0) return { status: 'NO_MATCH', employeeId: null, candidates: [] }
  if (uniqueIds.length === 1) return { status: 'SINGLE_MATCH', employeeId: uniqueIds[0], candidates: uniqueIds }
  return { status: 'AMBIGUOUS_MATCH', employeeId: null, candidates: uniqueIds }
}

export async function validateRow(data: ImportRowData, rowIndex: number, existingIds: Set<string>, existingEmails: Set<string>, existingPhones: Set<string>, importMode: string): Promise<ValidationResult> {
  const errors: string[] = []
  const warnings: string[] = []

  const fullName = data.fullName || [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
  if (!fullName) {
    errors.push('Full name is missing and cannot be derived from first/middle/last name')
  }

  if (!data.employeeCategory) errors.push('Employee category is missing')
  if (!data.role) errors.push('Role is missing')
  if (!data.employmentStatus) errors.push('Employment status is missing')

  if (data.employeeCategory === 'HEAD_OFFICE' && !data.department) {
    errors.push('Head Office employee must have a department')
  }
  if (data.employeeCategory === 'SHOP_FIELD') {
    if (!data.region && !data.area) errors.push('Shop/Field employee must have a region or area')
    if (['SHOP_MANAGER', 'DSP', 'DSA', 'SHOP_ACCOUNTANT'].includes(data.role || '') && !data.shop) {
      errors.push(`${data.role} must have a shop`)
    }
    if (data.role === 'SHOP_ACCOUNTANT' && !data.accountingReportingManagerEmployeeId && !data.accountingReportingManagerName) {
      errors.push('Shop Accountant must have an accounting reporting manager')
    }
  }

  if (data.basicSalary !== null && data.basicSalary !== undefined && data.basicSalary < 0) {
    errors.push('Basic salary cannot be negative')
  }

  const effectiveEmpId = data.employeeId
  if (effectiveEmpId && existingIds.has(effectiveEmpId) && importMode === 'CREATE_ONLY') {
    errors.push(`Duplicate employee ID: ${effectiveEmpId}`)
  }
  if (data.email && existingEmails.has(data.email) && importMode === 'CREATE_ONLY') {
    errors.push(`Duplicate email: ${data.email}`)
  }
  if (data.phoneNumber && existingPhones.has(data.phoneNumber) && importMode === 'CREATE_ONLY') {
    errors.push(`Duplicate phone: ${data.phoneNumber}`)
  }

  if (importMode === 'UPDATE_ONLY' && !effectiveEmpId && !data.email && !data.phoneNumber) {
    errors.push('No employee ID, email, or phone to match for update')
  }

  if (!data.email) warnings.push('Email is missing')
  if (!data.phoneNumber) warnings.push('Phone number is missing')
  if (data.basicSalary === null || data.basicSalary === undefined) warnings.push('Basic salary is missing')
  if (!data.salaryEffectiveDate) warnings.push('Salary effective date is missing')
  if (!data.paymentMethod) warnings.push('Payment method is missing')
  if (!data.bankAccountNumber && !data.mpesaAccount) warnings.push('Payment account (bank or M-PESA) is missing')
  if (!data.taxId) warnings.push('Tax ID is missing')
  if (!data.pensionId) warnings.push('Pension ID is missing')
  if (!data.costCenter) warnings.push('Cost center is missing')
  if (!data.hireDate) warnings.push('Hire date is missing')
  if (!data.level) warnings.push('Level is missing')

  if (data.payrollGroup && !isValidPayrollGroup(data.payrollGroup)) {
    errors.push(`Invalid payroll group: "${data.payrollGroup}". Accepted: HO_AA_SHOP, DSA, EBU_DEPARTMENT, ALELETU, CHACHA, LEGETAFO, HMARIAM, SIRTI, MENDIDA, SENDAFA, SHENO`)
  }

  let status: ValidationResult['status'] = 'VALID'
  if (errors.length > 0) status = 'ERROR'
  else if (warnings.length > 0) status = 'WARNING'

  return { status, errors, warnings, matchedEmployeeId: null }
}

export async function getNextEmployeeId(): Promise<string> {
  const last = await prisma.employee.findFirst({
    orderBy: { employeeId: 'desc' },
    select: { employeeId: true },
  })
  if (!last) return 'LSTA_0001'
  const num = parseInt(last.employeeId.split('_')[1], 10)
  return `LSTA_${String(num + 1).padStart(4, '0')}`
}

export async function createEmployeeFromImport(data: ImportRowData, userId: string): Promise<string | null> {
  const fullName = data.fullName || [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
  const nameParts = data.firstName ? { firstName: data.firstName, middleName: data.middleName || null, lastName: data.lastName || '' } : splitFullName(fullName)
  const employeeId = data.employeeId || await getNextEmployeeId()

  const refs = await resolveOrganizationRefs(data)
  const managers = await resolveManagerIds(data)

  const employee = await prisma.employee.create({
    data: {
      employeeId,
      firstName: nameParts.firstName,
      middleName: nameParts.middleName || null,
      lastName: nameParts.lastName,
      fullName,
      gender: data.gender || 'MALE',
      phoneNumber: data.phoneNumber || null,
      email: data.email || null,
      dateOfBirth: data.dateOfBirth || null,
      hireDate: data.hireDate || new Date(),
      employmentType: data.employmentType || 'FULL_TIME',
      employmentStatus: data.employmentStatus || 'DRAFT',
      employeeCategory: data.employeeCategory || null,
      currentDepartmentId: refs.departmentId || null,
      currentDivisionId: refs.divisionId || null,
      currentRegionId: refs.regionId || null,
      currentAreaId: refs.areaId || null,
      currentShopId: refs.shopId || null,
      currentClusterId: refs.clusterId || null,
      currentRole: data.role || 'EMPLOYEE',
      currentLevel: data.level || 'TO_BE_DEFINED',
      directManagerId: managers.directManagerId || null,
      accountingReportingManagerId: managers.accountingReportingManagerId || null,
      basicSalary: data.basicSalary || null,
      salaryEffectiveDate: data.salaryEffectiveDate || null,
      address: data.address || null,
      notes: data.notes || null,
      createdById: userId,
    },
  })

  await prisma.employeeAssignment.create({
    data: {
      employeeId: employee.id,
      employeeCategory: data.employeeCategory || null,
      departmentId: refs.departmentId || null,
      divisionId: refs.divisionId || null,
      regionId: refs.regionId || null,
      areaId: refs.areaId || null,
      shopId: refs.shopId || null,
      clusterId: refs.clusterId || null,
      role: data.role || 'EMPLOYEE',
      level: data.level || 'TO_BE_DEFINED',
      directManagerId: managers.directManagerId || null,
      accountingReportingManagerId: managers.accountingReportingManagerId || null,
      startDate: data.hireDate || new Date(),
      reason: 'Imported via employee import',
    },
  })

  if (data.basicSalary) {
    await prisma.employeeSalary.create({
      data: {
        employeeId: employee.id,
        basicSalary: data.basicSalary,
        effectiveDate: data.salaryEffectiveDate || new Date(),
        reason: 'Imported salary',
        createdById: userId,
      },
    })
  }

  if (data.paymentMethod || data.bankName || data.bankAccountNumber || data.mpesaAccount || data.taxId || data.pensionId || data.costCenter || data.payrollGroup) {
    await prisma.employeePayrollProfile.create({
      data: {
        employeeId: employee.id,
        paymentMethod: data.paymentMethod || null,
        bankName: data.bankName || null,
        bankAccountNumber: data.bankAccountNumber || null,
        mpesaAccount: data.mpesaAccount || null,
        taxId: data.taxId || null,
        pensionId: data.pensionId || null,
        costCenter: data.costCenter || null,
        payrollGroup: data.payrollGroup ? (data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup) : undefined,
        updatedById: userId,
      },
    })
  }

  return employee.id
}

export async function updateEmployeeFromImport(data: ImportRowData, employeeId: string, userId: string): Promise<boolean> {
  const refs = await resolveOrganizationRefs(data)
  const managers = await resolveManagerIds(data)

  const updateData: Record<string, unknown> = {}
  if (data.firstName) updateData.firstName = data.firstName
  if (data.middleName !== undefined) updateData.middleName = data.middleName || null
  if (data.lastName) updateData.lastName = data.lastName
  if (data.fullName || data.firstName) {
    updateData.fullName = data.fullName || [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ')
  }
  if (data.gender) updateData.gender = data.gender
  if (data.phoneNumber) updateData.phoneNumber = data.phoneNumber
  if (data.email) updateData.email = data.email
  if (data.dateOfBirth) updateData.dateOfBirth = data.dateOfBirth
  if (data.hireDate) updateData.hireDate = data.hireDate
  if (data.employmentType) updateData.employmentType = data.employmentType
  if (data.employmentStatus) updateData.employmentStatus = data.employmentStatus
  if (data.employeeCategory) updateData.employeeCategory = data.employeeCategory
  if (refs.departmentId) updateData.currentDepartmentId = refs.departmentId
  if (refs.divisionId) updateData.currentDivisionId = refs.divisionId
  if (refs.regionId) updateData.currentRegionId = refs.regionId
  if (refs.areaId) updateData.currentAreaId = refs.areaId
  if (refs.shopId) updateData.currentShopId = refs.shopId
  if (refs.clusterId) updateData.currentClusterId = refs.clusterId
  if (managers.directManagerId) updateData.directManagerId = managers.directManagerId
  if (managers.accountingReportingManagerId) updateData.accountingReportingManagerId = managers.accountingReportingManagerId
  if (data.role) updateData.currentRole = data.role
  if (data.level) updateData.currentLevel = data.level
  if (data.basicSalary !== null && data.basicSalary !== undefined) updateData.basicSalary = data.basicSalary
  if (data.salaryEffectiveDate) updateData.salaryEffectiveDate = data.salaryEffectiveDate
  if (data.address !== undefined) updateData.address = data.address || null
  if (data.notes !== undefined) updateData.notes = data.notes || null
  updateData.updatedById = userId

  await prisma.employee.update({ where: { id: employeeId }, data: updateData })

  if (data.basicSalary) {
    await prisma.employeeSalary.create({
      data: {
        employeeId,
        basicSalary: data.basicSalary,
        effectiveDate: data.salaryEffectiveDate || new Date(),
        reason: 'Updated via employee import',
        createdById: userId,
      },
    })
  }

  const existingProfile = await prisma.employeePayrollProfile.findUnique({ where: { employeeId } })
  if (data.paymentMethod || data.bankName || data.bankAccountNumber || data.mpesaAccount || data.taxId || data.pensionId || data.costCenter || data.payrollGroup) {
    if (existingProfile) {
      const profileUpdate: Record<string, unknown> = { updatedById: userId }
      if (data.paymentMethod) profileUpdate.paymentMethod = data.paymentMethod
      if (data.bankName !== undefined) profileUpdate.bankName = data.bankName || null
      if (data.bankAccountNumber !== undefined) profileUpdate.bankAccountNumber = data.bankAccountNumber || null
      if (data.mpesaAccount !== undefined) profileUpdate.mpesaAccount = data.mpesaAccount || null
      if (data.taxId !== undefined) profileUpdate.taxId = data.taxId || null
      if (data.pensionId !== undefined) profileUpdate.pensionId = data.pensionId || null
      if (data.costCenter !== undefined) profileUpdate.costCenter = data.costCenter || null
      if (data.payrollGroup !== undefined) profileUpdate.payrollGroup = data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup
      await prisma.employeePayrollProfile.update({ where: { employeeId }, data: profileUpdate })
    } else {
      await prisma.employeePayrollProfile.create({
        data: {
          employeeId,
          paymentMethod: data.paymentMethod || null,
          bankName: data.bankName || null,
          bankAccountNumber: data.bankAccountNumber || null,
          mpesaAccount: data.mpesaAccount || null,
          taxId: data.taxId || null,
          pensionId: data.pensionId || null,
          costCenter: data.costCenter || null,
          payrollGroup: data.payrollGroup ? (data.payrollGroup as import('@prisma/client').$Enums.PayrollGroup) : undefined,
          updatedById: userId,
        },
      })
    }
  }

  return true
}
