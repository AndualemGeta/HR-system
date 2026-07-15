import Excel from 'exceljs'
import { prisma } from './src/lib/prisma'

const ROLE_MAP: Record<string, string> = {
  CLEANING_STAFF: 'CLEANING_STAFF',
  SHOP_MANAGER: 'SHOP_MANAGER',
  SHOP_ACCOUNTANT: 'SHOP_ACCOUNTANT',
  DSA: 'DSA',
  DSP: 'DSP',
  ASM: 'ASM',
  BA_COORDINATOR: 'BA_COORDINATOR',
  SECURITY_STAFF: 'SECURITY_STAFF',
  SALES_HEAD: 'SALES_HEAD',
  DISTRIBUTION_OFFICER: 'DISTRIBUTION_OFFICER',
  DISTRIBUTION_MANAGER: 'DISTRIBUTION_MANAGER',
  EBU_SUPERVISOR: 'EBU_SUPERVISOR',
  EBU_FTTH_SUPERVISOR: 'EBU_FTTH_SUPERVISOR',
  EBU_TECHNICAL_SALES_LEAD: 'EBU_TECHNICAL_SALES_LEAD',
  EBU_FTTH_SALES: 'EBU_FTTH_SALES',
  BUSINESS_DEVELOPMENT_MANAGER: 'BUSINESS_DEVELOPMENT_MANAGER',
}

async function ensureShop(name: string | undefined | null): Promise<string | null> {
  if (!name || name === 'N/A') return null
  const code = `SHOP_${name.toUpperCase().replace(/\s+/g, '_')}`
  let loc = await prisma.location.findUnique({ where: { code } })
  if (!loc) {
    loc = await prisma.location.create({
      data: { name, code, type: 'SHOP' },
    })
  }
  return loc.id
}

async function main() {
  const wb = new Excel.Workbook()
  await wb.xlsx.readFile('C:/Users/NEW/Documents/leapfrog-payroll/Employee_Master_Data.xlsx')
  const ws = wb.worksheets[0]

  const superAdmin = await prisma.user.findFirst({ where: { email: 'superadmin@leapfrog.com' } })
  const adminId = superAdmin?.id

  let created = 0
  let skipped = 0
  let errors = 0

  // Map of fullName -> db id for manager resolution
  const nameToId = new Map<string, string>()

  // First pass: create employees
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const empId = row.getCell(1).value as string
    const fullName = row.getCell(2).value as string
    const division = row.getCell(3).value as string
    const region = row.getCell(4).value as string | null
    const shopName = row.getCell(5).value as string | null
    const roleRaw = row.getCell(7).value as string
    const basicSalary = row.getCell(11).value as number | null
    const employmentStatus = row.getCell(10).value as string | null
    const levelRaw = row.getCell(8).value as string | null

    if (!empId || !fullName) { skipped++; continue }

    const existing = await prisma.employee.findUnique({ where: { employeeId: empId } })
    if (existing) { nameToId.set(String(fullName).trim(), existing.id); skipped++; continue }

    const role = ROLE_MAP[roleRaw] || 'OTHER'
    const shopId = await ensureShop(shopName ?? undefined)
    const employmentType = division?.includes('HEAD') ? 'FULL_TIME' : 'FULL_TIME'
    const employeeCategory = division?.includes('SHOP') ? 'SHOP_FIELD' : 'HEAD_OFFICE'
  const nameStr = String(fullName || '').trim()
  if (!empId || !nameStr) { skipped++; continue }

  const nameParts = nameStr.split(/\s+/)
  const firstName = nameParts[0] || nameStr
  const middleName = nameParts.length > 1 ? nameParts.slice(1).join(' ') : null
  const empStatus = employmentStatus === 'ACTIVE' ? 'ACTIVE' : 'ACTIVE'
  const level = levelRaw && ['JUNIOR', 'MID', 'SENIOR', 'LEAD', 'MANAGER', 'DIRECTOR', 'EXECUTIVE'].includes(levelRaw.replace(/\s+/g, '_'))
    ? levelRaw.replace(/\s+/g, '_') : 'TO_BE_DEFINED'

  try {
    const emp = await prisma.employee.create({
      data: {
        employeeId: empId,
        firstName,
        middleName,
        fullName: nameStr,
        currentRole: role as any,
        currentShopId: shopId,
        currentDivisionId: division || undefined,
        currentRegionId: region || undefined,
        employmentType: 'FULL_TIME' as any,
        employeeCategory: employeeCategory as any,
        employmentStatus: empStatus as any,
        currentLevel: level as any,
        basicSalary: basicSalary || 0,
        ...(adminId ? { createdById: adminId } : {}),
      },
    })
      nameToId.set(nameStr, emp.id)
      created++
      if (created % 50 === 0) console.log(`  ${created} employees created...`)
    } catch (e) {
      console.error(`  Failed to create ${empId}:`, e)
      errors++
    }
  }

  // Second pass: link managers (matched by full name)
  console.log('\nLinking managers...')
  let mgrLinked = 0
  for (let i = 2; i <= ws.rowCount; i++) {
    const row = ws.getRow(i)
    const empName = String(row.getCell(2).value || '').trim()
    const mgrName = String(row.getCell(9).value || '').trim()

    if (!mgrName || mgrName === 'N/A' || mgrName === 'null') continue

    const empDbId = nameToId.get(empName)
    const mgrDbId = nameToId.get(mgrName)
    if (empDbId && mgrDbId) {
      await prisma.employee.update({
        where: { id: empDbId },
        data: { directManagerId: mgrDbId },
      })
      mgrLinked++
    }
  }

  console.log(`\nDone. Created: ${created}, Skipped: ${skipped}, Errors: ${errors}, Managers linked: ${mgrLinked}`)
  await prisma.$disconnect()
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
