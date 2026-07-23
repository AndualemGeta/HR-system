import { z } from 'zod'
import { payrollGroupOptionalSchema } from '@/lib/payroll-group'

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(str: string): boolean {
  if (!DATE_REGEX.test(str)) return false
  const [y, m, d] = str.split('-').map(Number)
  if (y < 1900 || y > 2100) return false
  if (m < 1 || m > 12) return false
  if (d < 1) return false
  const daysInMonth = new Date(y, m, 0).getDate()
  return d <= daysInMonth
}

export const dateString = z.string().refine(isValidDate, { message: 'Invalid date — must be YYYY-MM-DD with a real calendar date' })

export const employeeCreateSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  middleName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  phoneNumber: z.string().optional(),
  gender: z.string().optional(),
  dateOfBirth: dateString.optional(),
  address: z.string().optional(),
  notes: z.string().optional(),
  hireDate: dateString.optional(),
  employmentType: z.string().optional(),
  employmentStatus: z.string().optional().default('DRAFT'),
  employeeCategory: z.string().optional(),
  currentRole: z.string().optional(),
  currentLevel: z.string().optional(),
  currentDepartmentId: z.string().optional(),
  currentDivisionId: z.string().optional(),
  currentRegionId: z.string().optional(),
  currentAreaId: z.string().optional(),
  currentShopId: z.string().optional(),
  currentClusterId: z.string().optional(),
  directManagerId: z.string().optional(),
  accountingReportingManagerId: z.string().optional(),
  basicSalary: z.number().positive().optional(),
  salaryEffectiveDate: dateString.optional(),
  kpiDefaultAmount: z.number().min(0).optional(),
  kpiEffectiveFrom: dateString.optional(),
  paymentMethod: z.string().optional(),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  mpesaAccount: z.string().optional(),
  taxId: z.string().optional(),
  pensionId: z.string().optional(),
  payrollGroup: payrollGroupOptionalSchema,
}).superRefine((data, ctx) => {
  if (data.basicSalary !== undefined && !data.salaryEffectiveDate) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'salaryEffectiveDate is required when basicSalary is supplied', path: ['salaryEffectiveDate'] })
  }
  if (data.salaryEffectiveDate !== undefined && data.basicSalary === undefined) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'basicSalary is required when salaryEffectiveDate is supplied', path: ['basicSalary'] })
  }
  if ((data.kpiDefaultAmount !== undefined) !== (data.kpiEffectiveFrom !== undefined)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'kpiDefaultAmount and kpiEffectiveFrom must be supplied together', path: ['kpiDefaultAmount'] })
  }
})

export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>
