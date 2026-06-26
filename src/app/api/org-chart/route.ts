import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'

export const GET = withAuth(async () => {
  const departments = await prisma.department.findMany({
    include: {
      head: { select: { id: true, fullName: true, employeeId: true } },
    },
    orderBy: { name: 'asc' },
  })

  const locations = await prisma.location.findMany({
    include: {
      manager: { select: { id: true, fullName: true, employeeId: true } },
    },
    orderBy: { name: 'asc' },
  })

  const rootDepts = departments.filter(d => !d.parentId)
  const childDepts = departments.filter(d => d.parentId)

  return success({ rootDepts, childDepts, locations })
}, 'org.view')
