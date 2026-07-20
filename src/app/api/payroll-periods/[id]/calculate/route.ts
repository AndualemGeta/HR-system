import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { userHasPermission } from '@/lib/rbac'
import { success, unauthorized, forbidden, notFound, badRequest, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import {
  buildCalculationContext,
  calculateEmployeePayroll,
  persistPayrollCalculation,
  evaluatePayrollPeriodReadiness,
} from '@/lib/payroll-calculation-engine'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()
    if (!(await userHasPermission(session.userId, 'payrollCalculation.calculate'))) return forbidden()

    const { id } = await params
    const period = await prisma.payrollPeriod.findUnique({ where: { id } })
    if (!period) return notFound()
    if (period.status !== 'READY_FOR_CALCULATION') return badRequest(`Period status is ${period.status}, expected READY_FOR_CALCULATION`)

    // Run readiness first — when blocked, write zero batches/rows/lines, do not change status
    const readiness = await evaluatePayrollPeriodReadiness({ payrollPeriodId: id, userId: session.userId, includeEmployeeDetails: false })
    if (!readiness.readyForCalculation) {
      await createAuditLog({
        userId: session.userId, action: 'PAYROLL_CALCULATION_BLOCKED',
        entityType: 'PayrollPeriod', entityId: id,
        newValue: {
          periodBlockers: readiness.periodBlockers,
          blockedEmployeeCount: readiness.blockedEmployeeCount,
        },
      })
      // Return readiness result — write zero batches, rows, lines; do not change status
      return success({
        blocked: true,
        readyForCalculation: false,
        periodBlockers: readiness.periodBlockers,
        periodWarnings: readiness.periodWarnings,
        selectedEmployeeCount: readiness.selectedEmployeeCount,
        readyEmployeeCount: readiness.readyEmployeeCount,
        warningEmployeeCount: readiness.warningEmployeeCount,
        blockedEmployeeCount: readiness.blockedEmployeeCount,
      })
    }

    const ctx = await buildCalculationContext(id)
    if (!ctx) return notFound()
    if (ctx.employees.length === 0) return badRequest('No selected employees')

    // Calculate
    const results: Awaited<ReturnType<typeof calculateEmployeePayroll>>[] = []
    let allBlocked = false
    for (const emp of ctx.employees) {
      const result = await calculateEmployeePayroll(ctx, emp)
      if (result.blockers.length > 0) allBlocked = true
      results.push(result)
    }

    if (allBlocked) {
      await createAuditLog({
        userId: session.userId, action: 'PAYROLL_CALCULATION_BLOCKED',
        entityType: 'PayrollPeriod', entityId: id,
        newValue: { blockedCount: results.filter(r => r.blockers.length > 0).length },
      })
      return success({ blocked: true, results: results.map(r => ({ employeeId: r.employeeId, blockers: r.blockers })) })
    }

    // Version
    const latestBatch = await prisma.payrollPreparationBatch.findFirst({
      where: { payrollPeriodId: id },
      orderBy: { version: 'desc' },
    })
    const version = (latestBatch?.version ?? 0) + 1

    // Persist
    const { batchId, totals } = await persistPayrollCalculation(ctx, results, session.userId, version)

    await createAuditLog({
      userId: session.userId, action: 'PAYROLL_CALCULATION_COMPLETE',
      entityType: 'PayrollPeriod', entityId: id,
      newValue: {
        batchId, version, employeeCount: results.length,
        ...totals,
        oldStatus: 'READY_FOR_CALCULATION', newStatus: 'READY_FOR_REVIEW',
      },
    })

    return success({ batchId, version, ...totals })
  } catch (e) { console.error(e); return internalError() }
}
