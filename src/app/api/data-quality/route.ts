import { type NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth, success } from '@/lib/api'

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const where: Record<string, unknown> = {}
  if (searchParams.get('severity')) where.severity = searchParams.get('severity')
  if (searchParams.get('status')) where.status = searchParams.get('status')
  if (searchParams.get('employeeId')) where.employeeId = searchParams.get('employeeId')

  const issues = await prisma.dataQualityIssue.findMany({
    where: where as any,
    orderBy: [{ severity: 'asc' }, { createdAt: 'desc' }],
    take: 500,
  })

  const counts = {
    total: issues.length,
    blockers: issues.filter(i => i.severity === 'BLOCKER').length,
    warnings: issues.filter(i => i.severity === 'WARNING').length,
    info: issues.filter(i => i.severity === 'INFO').length,
    open: issues.filter(i => i.status === 'OPEN').length,
    resolved: issues.filter(i => i.status === 'RESOLVED').length,
    ignored: issues.filter(i => i.status === 'IGNORED').length,
  }

  return success({ issues, counts })
}, 'dataQuality.view')
