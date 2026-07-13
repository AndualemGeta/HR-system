import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.manageInputConfig'))) return forbidden()

    const config = await prisma.shopManagerIncentiveInputConfig.findUnique({ where: { id } })
    if (!config) return notFound('Input config not found')
    if (!config.isActive) return badRequest('Input config is already deactivated')

    const updated = await prisma.shopManagerIncentiveInputConfig.update({
      where: { id },
      data: { isActive: false },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_CONFIG_DEACTIVATE',
      entityType: 'ShopManagerIncentiveInputConfig',
      entityId: id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
