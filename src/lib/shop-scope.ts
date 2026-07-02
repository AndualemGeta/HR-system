import { prisma } from './prisma'

export async function buildShopScopeWhere(userId: string): Promise<Record<string, unknown>> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { roles: { include: { role: true } } },
  })
  if (!user) return { id: null }

  const roleNames = user.roles.map(r => r.role.name)

  if (roleNames.some(r => ['SUPER_ADMIN', 'HR_ADMIN', 'FINANCE_DIRECTOR', 'FINANCE_PAYROLL', 'AUDITOR'].includes(r))) {
    return {}
  }

  if (roleNames.includes('SALES_HEAD')) {
    return { type: 'SHOP' }
  }

  if (roleNames.includes('ASM')) {
    const empRecord = user.employeeId ? await prisma.employee.findUnique({ where: { id: user.employeeId } }) : null
    if (!empRecord || !empRecord.currentAreaId) return { id: null }
    const areaLocations = await prisma.location.findMany({
      where: {
        OR: [
          { id: empRecord.currentAreaId },
          { parentId: empRecord.currentAreaId, type: 'CLUSTER' },
        ],
      },
      select: { id: true },
    })
    const locationIds = areaLocations.map(l => l.id)
    return {
      type: 'SHOP',
      parentId: { in: locationIds },
    }
  }

  if (roleNames.includes('SHOP_MANAGER')) {
    const empRecord = user.employeeId ? await prisma.employee.findUnique({ where: { id: user.employeeId } }) : null
    if (!empRecord || !empRecord.currentShopId) return { id: null }
    return { id: empRecord.currentShopId }
  }

  return { id: null }
}

export async function shopInUserScope(userId: string, shopLocationId: string): Promise<boolean> {
  const scopeWhere = await buildShopScopeWhere(userId)
  if (Object.keys(scopeWhere).length === 0) return true
  if (scopeWhere.id === null) return false
  if (typeof scopeWhere.id === 'string') return scopeWhere.id === shopLocationId
  const count = await prisma.location.count({ where: { ...scopeWhere, id: shopLocationId } })
  return count > 0
}
