import path from 'path'

export const WORKSHEET_NAMES = [
  'HO,A.A SHOP',
  'DSA',
  'EBU Department',
  'Aleletu',
  'Chacha',
  'Legetafo',
  'Hmariam',
  'Sirti',
  'Mendida',
  'Sendafa',
  'Sheno',
] as const

export const SUMMARY_SHEET = 'Performance Summary'
export const OVERTIME_SHEET = 'Overtime'

export const ALL_REQUIRED_SHEETS = [...WORKSHEET_NAMES, SUMMARY_SHEET, OVERTIME_SHEET] as const

export const PAYROLL_SHEETS_MAP: Record<string, string> = {
  HO_AA_SHOP: 'HO,A.A SHOP',
  DSA: 'DSA',
  EBU_DEPARTMENT: 'EBU Department',
  ALELETU: 'Aleletu',
  CHACHA: 'Chacha',
  LEGETAFO: 'Legetafo',
  HMARIAM: 'Hmariam',
  SIRTI: 'Sirti',
  MENDIDA: 'Mendida',
  SENDAFA: 'Sendafa',
  SHENO: 'Sheno',
}

export const COLUMN_HEADERS_A_S = [
  'No.',
  'Name of Employees',
  'Position',
  'Shop Name / Work Place',
  'Working days',
  'Basic Salary',
  'Monthly Salary',
  'Commiss. / OT',
  'KPI',
  'Gross Salary',
  'Taxable Income',
  'Income Tax',
  'Pension 7%',
  'Pension 11%',
  'Shortage / Loan',
  'Total Deduction',
  'Transport & Other Allowance',
  'Net Pay',
  'Sign',
] as const

export const EXPORT_DIR_ENV = 'PAYROLL_EXPORT_DIR'

export function getExportDir(): string {
  const envDir = process.env[EXPORT_DIR_ENV]
  if (envDir) return path.resolve(envDir)
  return path.join(process.cwd(), 'uploads', 'payroll-exports')
}

export const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'payroll', 'Salary_June_2026_reference.xlsx')
export const TEMPLATE_VERSION = '1.0'
