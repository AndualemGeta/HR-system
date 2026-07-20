import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

async function main() {
  console.log('Seeding Phase 5A demo data...')

  const adminUser = await prisma.user.findFirst({ where: { email: 'admin@leapfrog.com' } })
  if (!adminUser) { console.error('Run main seed first: npm run prisma:seed'); process.exit(1) }

  const adminId = adminUser.id

  const existingPeriod = await prisma.payrollPeriod.findFirst({ where: { periodName: 'Demo Jan 2025' } })
  if (existingPeriod) {
    console.log('  Demo payroll period already exists, skipping')
    process.exit(0)
  }

  const period = await prisma.payrollPeriod.create({
    data: {
      periodName: 'Demo Jan 2025',
      periodStart: new Date('2025-01-01'),
      periodEnd: new Date('2025-01-31'),
      payDate: new Date('2025-02-05'),
      status: 'OPEN_FOR_INPUT',
      createdById: adminId,
    },
  })
  console.log(`  Created payroll period: ${period.periodName}`)

  const activeEmployees = await prisma.employee.findMany({
    where: { employmentStatus: 'ACTIVE', currentRole: { in: ['DSA', 'DSP', 'SHOP_MANAGER'] } },
    take: 5,
  })
  for (const emp of activeEmployees) {
    await prisma.payrollPeriodEmployee.create({
      data: { payrollPeriodId: period.id, employeeId: emp.id, isSelected: true, addedById: adminId },
    })
  }
  console.log(`  Selected ${activeEmployees.length} employees`)

  const sampleBrackets = await prisma.payeTaxBracket.findMany({
    where: { isSample: true, approvalStatus: 'DRAFT', isActive: true },
  })
  if (sampleBrackets.length > 0) {
    await prisma.payeTaxBracket.updateMany({
      where: { id: { in: sampleBrackets.map(b => b.id) } },
      data: { approvalStatus: 'APPROVED', isSample: false },
    })
    console.log(`  Approved ${sampleBrackets.length} PAYE brackets`)
  }

  const samplePension = await prisma.pensionRule.findFirst({
    where: { isSample: true, approvalStatus: 'DRAFT', isActive: true },
  })
  if (samplePension) {
    await prisma.pensionRule.update({
      where: { id: samplePension.id },
      data: { approvalStatus: 'APPROVED', isSample: false },
    })
    console.log('  Approved sample pension rule')
  }

  const inputTypes = await prisma.payrollInputType.findMany({ select: { id: true, code: true } })
  const inputTypeMap = Object.fromEntries(inputTypes.map(i => [i.code, i.id]))

  for (const emp of activeEmployees) {
    if (emp.currentRole === 'DSA') {
      if (inputTypeMap['TRANSPORT_ALLOWANCE_INPUT']) {
        await prisma.payrollInput.upsert({
          where: {
            payrollPeriodId_employeeId_inputTypeId: {
              payrollPeriodId: period.id, employeeId: emp.id,
              inputTypeId: inputTypeMap['TRANSPORT_ALLOWANCE_INPUT'],
            },
          },
          update: { amount: 1500, value: 1500, status: 'ACCEPTED', isLocked: true, lockedAt: new Date(), lockedById: adminId },
          create: {
            payrollPeriodId: period.id, employeeId: emp.id,
            inputTypeId: inputTypeMap['TRANSPORT_ALLOWANCE_INPUT'],
            amount: 1500, value: 1500, status: 'ACCEPTED', isLocked: true,
            lockedAt: new Date(), lockedById: adminId,
          },
        })
      }
      if (inputTypeMap['KPI_ACHIEVEMENT_PERCENT']) {
        await prisma.payrollInput.upsert({
          where: {
            payrollPeriodId_employeeId_inputTypeId: {
              payrollPeriodId: period.id, employeeId: emp.id,
              inputTypeId: inputTypeMap['KPI_ACHIEVEMENT_PERCENT'],
            },
          },
          update: { value: 80, status: 'ACCEPTED', isLocked: true, lockedAt: new Date(), lockedById: adminId },
          create: {
            payrollPeriodId: period.id, employeeId: emp.id,
            inputTypeId: inputTypeMap['KPI_ACHIEVEMENT_PERCENT'],
            value: 80, status: 'ACCEPTED', isLocked: true,
            lockedAt: new Date(), lockedById: adminId,
          },
        })
      }
    }
  }
  console.log('  Created sample payroll inputs')

  await prisma.payrollPeriod.update({
    where: { id: period.id },
    data: { status: 'READY_FOR_CALCULATION' },
  })
  console.log('  Period marked READY_FOR_CALCULATION')
  console.log(`\nDemo payroll period ID: ${period.id}`)
  console.log('POST /api/payroll-periods/<id>/calculate to test calculation')
}

main().catch(e => { console.error('Seed error:', e); process.exit(1) }).finally(() => prisma.$disconnect())
