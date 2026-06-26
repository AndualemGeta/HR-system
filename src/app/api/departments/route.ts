import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'

export const GET = withAuth(async () => {
  const departments = await prisma.department.findMany({
    orderBy: { name: 'asc' },
  })
  return success(departments)
}, 'org.view')
