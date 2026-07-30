import { PrismaClient } from '@prisma/client'
import ExcelJS from 'exceljs'
import path from 'path'

const prisma = new PrismaClient()
const TEMPLATE_PATH = path.join(process.cwd(), 'templates', 'payroll', 'Salary_June_2026_reference.xlsx')
const WORKSHEET_NAMES = ['HO,A.A SHOP', 'DSA', 'EBU Department', 'Aleletu', 'Chacha', 'Legetafo', 'Hmariam', 'Sirti', 'Mendida', 'Sendafa', 'Sheno'] as const
const PAYROLL_GROUP_MAP: Record<string, string> = {
  'HO,A.A SHOP': 'HO_AA_SHOP', DSA: 'DSA', 'EBU Department': 'EBU_DEPARTMENT',
  Aleletu: 'ALELETU', Chacha: 'CHACHA', Legetafo: 'LEGETAFO',
  Hmariam: 'HMARIAM', Sirti: 'SIRTI', Mendida: 'MENDIDA',
  Sendafa: 'SENDAFA', Sheno: 'SHENO',
}

const POSITION_MAP: Record<string, string> = {
  'SM': 'SHOP_MANAGER',
  'Shop SV': 'SHOP_MANAGER',
  'ASM': 'ASM',
  'Area SV': 'ASM',
  'DSP': 'DSP',
  'DSA': 'DSA',
  'DSA Coordinator': 'DSA',
  'BA Coordinator': 'BA_COORDINATOR',
  'BA coordinator': 'BA_COORDINATOR',
  'Ba Coordinator': 'BA_COORDINATOR',
  'BA coordinator/Ebu Sales': 'EBU_TECHNICAL_SALES_LEAD',
  'Business Development mgt': 'BUSINESS_DEVELOPMENT_MANAGER',
  'Outdoor Sales': 'EBU_FTTH_SALES',
  'FTTH TeamLeader': 'EBU_FTTH_SUPERVISOR',
  'FTTH teamleader': 'EBU_FTTH_SUPERVISOR',
  'FTTH Mgr': 'EBU_FTTH_SUPERVISOR',
  'S.Accountant': 'SHOP_ACCOUNTANT',
  'Cleaner': 'CLEANING_STAFF',
  'Security': 'SECURITY_STAFF',
  'Driver': 'OTHER',
  'Technician': 'OTHER',
  'Device SV': 'OTHER',
  'Accountant': 'ACCOUNTANT',
  'Finance': 'FINANCIAL_CONTROL_REPORTING_MANAGER',
  'Finance Director': 'FINANCE_DIRECTOR',
  'Finance mgr': 'FINANCIAL_CONTROL_REPORTING_MANAGER',
  'HR MANAGER': 'HR_MANAGER',
  'HR OFFICER': 'HR_OFFICER',
  'GM': 'CEO',
  'CEO coordinator': 'CEO_COORDINATOR',
  'Distribution MGR': 'DISTRIBUTION_MANAGER',
  'Distribution Officer': 'DISTRIBUTION_OFFICER',
  'sales operation': 'OTHER',
  'clurk': 'OTHER',
  'IT': 'TECHNOLOGY_MANAGER',
}

function mapPosition(pos: string): string {
  return POSITION_MAP[pos.trim()] || 'OTHER'
}

function parseName(fullName: string): { firstName: string; middleName: string | null; lastName: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length === 1) return { firstName: parts[0], middleName: null, lastName: '' }
  if (parts.length === 2) return { firstName: parts[0], middleName: null, lastName: parts[1] }
  return { firstName: parts[0], middleName: parts.slice(1, -1).join(' '), lastName: parts[parts.length - 1] }
}

async function getNextEmpId(): Promise<string> {
  const last = await prisma.employee.findFirst({ orderBy: { employeeId: 'desc' }, select: { employeeId: true } })
  if (!last) return 'LSTA_0001'
  const num = parseInt(last.employeeId.split('_')[1], 10)
  return `LSTA_${String(num + 1).padStart(4, '0')}`
}

async function getOrCreateShop(name: string): Promise<string | null> {
  const trimmed = name.trim()
  if (!trimmed) return null

  const existing = await prisma.location.findFirst({ where: { name: { equals: trimmed, mode: 'insensitive' }, type: 'SHOP' }, select: { id: true } })
  if (existing) return existing.id

  const code = `SHOP_${trimmed.toUpperCase().replace(/[^A-Z0-9]/g, '_').substring(0, 10)}`
  const loc = await prisma.location.create({
    data: { name: trimmed, code, type: 'SHOP', isActive: true },
  })

  await prisma.shopProfile.create({
    data: { shopLocationId: loc.id, corridorType: 'UNKNOWN', isIncentiveEligible: false },
  }).catch(() => {})

  return loc.id
}

interface TemplateEmployee {
  name: string; position: string; shop: string; basicSalary: number; payrollGroup: string
}

function parseTemplate(wb: ExcelJS.Workbook): TemplateEmployee[] {
  const result: TemplateEmployee[] = []
  for (const ws of wb.worksheets) {
    const wsName = ws.name
    if (!WORKSHEET_NAMES.includes(wsName as typeof WORKSHEET_NAMES[number])) continue

    let headerRow = 0
    for (let r = 1; r <= (ws.rowCount || 200); r++) {
      const c1 = String(ws.getRow(r).getCell(1).value || '').trim().toLowerCase()
      if (c1 === 'no.' || c1 === 'no' || c1 === 'no:') { headerRow = r; break }
    }
    if (!headerRow) { console.log(`  Skipping "${wsName}": no header row`); continue }

    for (let r = headerRow + 1; r <= (ws.rowCount || 200); r++) {
      const row = ws.getRow(r)
      const c2 = String(row.getCell(2).value || '').trim()
      const noVal = Number(row.getCell(1).value)
      if (!noVal || !c2) continue
      const c1 = String(row.getCell(1).value || '').trim().toLowerCase()
      if (c2.toLowerCase().startsWith('total') || c1.startsWith('total')) break

      result.push({
        name: c2,
        position: String(row.getCell(3).value || '').trim(),
        shop: String(row.getCell(4).value || '').trim(),
        basicSalary: Number(row.getCell(6).value) || 0,
        payrollGroup: PAYROLL_GROUP_MAP[wsName],
      })
    }
  }
  return result
}

async function main() {
  console.log('Reading template...')
  const wb = await new ExcelJS.Workbook().xlsx.readFile(TEMPLATE_PATH)
  const employees = parseTemplate(wb)
  console.log(`Found ${employees.length} employees in template`)

  // Create shops
  const uniqueShops = [...new Set(employees.map(e => e.shop).filter(Boolean))]
  console.log(`\nCreating ${uniqueShops.length} shops...`)
  const shopIds = new Map<string, string>()
  for (const shop of uniqueShops) {
    const id = await getOrCreateShop(shop)
    if (id) shopIds.set(shop, id)
    console.log(`  ${shop} -> ${id ? id.substring(0, 8) + '...' : 'null'}`)
  }

  // Track duplicate names to skip
  const existingNames = new Set(
    (await prisma.employee.findMany({ select: { fullName: true } })).map(e => e.fullName.toLowerCase().trim())
  )

  let created = 0, skipped = 0
  console.log(`\nCreating ${employees.length} employees...`)
  for (const emp of employees) {
    const nameKey = emp.name.toLowerCase().trim()
    if (existingNames.has(nameKey)) { skipped++; continue }

    const nameParts = parseName(emp.name)
    const role = mapPosition(emp.position)
    const nextId = await getNextEmpId()

    await prisma.employee.create({
      data: {
        employeeId: nextId,
        firstName: nameParts.firstName,
        middleName: nameParts.middleName,
        lastName: nameParts.lastName,
        fullName: emp.name,
        gender: 'NOT_SPECIFIED',
        currentRole: role as any,
        currentLevel: 'TO_BE_DEFINED',
        employmentStatus: 'ACTIVE',
        employmentType: 'FULL_TIME',
        employeeCategory: 'SHOP_FIELD',
        basicSalary: emp.basicSalary || 0,
        currentShopId: shopIds.get(emp.shop) || null,
        payrollProfile: {
          create: { payrollGroup: emp.payrollGroup as any },
        },
      },
    })

    existingNames.add(nameKey)
    created++
    if (created % 20 === 0) console.log(`  Created ${created}...`)
  }

  console.log(`\nDone. Created ${created}, skipped ${skipped} (duplicates)`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
