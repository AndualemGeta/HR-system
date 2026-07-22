import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, internalError } from '@/lib/api'

export async function GET(req: NextRequest) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      include: { roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } },
    })
    if (!user) return unauthorized()

    const perms = user.roles.flatMap(r => r.role.permissions.map(p => p.permission.key))
    const { searchParams } = new URL(req.url)
    const outputPackageId = searchParams.get('outputPackageId')

    const where: Record<string, unknown> = {}
    if (outputPackageId) where.outputPackageId = outputPackageId

    if (!perms.includes('payslip.viewAll')) {
      if (perms.includes('payslip.viewOwn')) {
        const employee = await prisma.employee.findFirst({ where: { employeeId: user.email } }).catch(() => null)
        if (employee) where.employeeId = employee.id
        else return forbidden()
      } else {
        return forbidden()
      }
    }

    const snapshots = await prisma.payslipSnapshot.findMany({
      where,
      orderBy: { generatedAt: 'desc' },
      select: {
        id: true, employeeCode: true, fullName: true, grossSalary: true,
        netSalary: true, documentHash: true, publishedAt: true, generatedAt: true,
      },
    })
    return success(snapshots)
  } catch (e) { console.error(e); return internalError() }
}
