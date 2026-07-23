import { z } from 'zod'

export const PAYROLL_GROUP_VALUES = [
  'HO_AA_SHOP',
  'DSA',
  'EBU_DEPARTMENT',
  'ALELETU',
  'CHACHA',
  'LEGETAFO',
  'HMARIAM',
  'SIRTI',
  'MENDIDA',
  'SENDAFA',
  'SHENO',
] as const

export type PayrollGroup = (typeof PAYROLL_GROUP_VALUES)[number]

export const payrollGroupSchema = z.enum(PAYROLL_GROUP_VALUES)

export const payrollGroupOptionalSchema = z.enum(PAYROLL_GROUP_VALUES).optional()

export function isValidPayrollGroup(v: string): v is PayrollGroup {
  return (PAYROLL_GROUP_VALUES as readonly string[]).includes(v)
}
