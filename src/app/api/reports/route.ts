import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'

export const GET = withAuth(async () => {
  const totalEmployees = await prisma.employee.count()
  const activeEmployees = await prisma.employee.count({ where: { employmentStatus: 'ACTIVE' } })
  const onboardingPending = await prisma.employee.count({ where: { employmentStatus: 'ONBOARDING' } })
  const onProbation = await prisma.employee.count({ where: { employmentStatus: 'ON_PROBATION' } })
  const missingManager = await prisma.employee.count({ where: { directManagerId: null, employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } } })
  const missingEmploymentType = await prisma.employee.count({ where: { employmentType: null, employmentStatus: { not: 'DRAFT' } } })
  const salaryReady = await prisma.employee.count({ where: { basicSalary: { not: null }, employmentStatus: 'ACTIVE' } })

  const byDept = await prisma.employee.groupBy({
    by: ['currentDepartmentId'],
    _count: true,
    where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
  })

  const byRole = await prisma.employee.groupBy({
    by: ['currentRole'],
    _count: true,
    where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
  })

  const byType = await prisma.employee.groupBy({
    by: ['employmentType'],
    _count: true,
    where: { employmentStatus: { in: ['ACTIVE', 'ON_PROBATION'] } },
  })

  const recentlyAdded = await prisma.employee.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { id: true, employeeId: true, fullName: true, createdAt: true },
  })

  return success({
    totalEmployees,
    activeEmployees,
    onboardingPending,
    onProbation,
    missingManager,
    missingEmploymentType,
    salaryReady,
    byDept,
    byRole,
    byType,
    recentlyAdded,
  })
}, 'reports.view')
