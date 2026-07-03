import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'
import { getSession } from '@/lib/session'
import { userHasPermission } from '@/lib/rbac'
import { success, badRequest, unauthorized, forbidden, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { shopInUserScope } from '@/lib/incentive-scope'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; inputId: string }> }) {
  try {
    const { id, inputId } = await params
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'shopManagerIncentive.review'))) return forbidden()

    const input = await prisma.shopManagerPerformanceInput.findUnique({
      where: { id: inputId },
    })
    if (!input) return notFound('Performance input not found')
    if (input.incentivePeriodId !== id) return notFound('Performance input not found in this period')

    if (input.inputStatus !== 'SUBMITTED' && input.inputStatus !== 'RETURNED') {
      return badRequest('Only inputs in SUBMITTED or RETURNED status can be rejected')
    }

    if (!(await shopInUserScope(session.userId, input.shopLocationId))) return forbidden()

    const oldStatus = input.inputStatus

    const updated = await prisma.shopManagerPerformanceInput.update({
      where: { id: inputId },
      data: {
        inputStatus: 'REJECTED',
        reviewedById: session.userId,
        reviewedAt: new Date(),
      },
    })

    await createAuditLog({
      userId: session.userId,
      action: 'SHOP_MANAGER_INCENTIVE_INPUT_REJECT',
      entityType: 'ShopManagerPerformanceInput',
      entityId: inputId,
      oldValue: { inputStatus: oldStatus },
      newValue: { inputStatus: 'REJECTED', reviewedById: session.userId, reviewedAt: updated.reviewedAt },
    })

    return success(updated)
  } catch (err) { console.error(err); return internalError() }
}
