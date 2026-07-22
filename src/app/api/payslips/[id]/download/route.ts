import { NextRequest } from 'next/server'
import { getSession } from '@/lib/session'
import { success, unauthorized, notFound, internalError } from '@/lib/api'
import { createAuditLog } from '@/lib/audit'
import { getPayslipForUser, renderPayslipHtml } from '@/lib/payroll/payslip'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await getSession()
    if (!session) return unauthorized()

    const { id } = await params
    const result = await getPayslipForUser(id, session.userId)
    if (result.error) {
      if (result.status === 404) return notFound()
      return new Response(JSON.stringify({ error: result.error }), { status: 403, headers: { 'Content-Type': 'application/json' } })
    }

    await createAuditLog({
      userId: session.userId, action: 'PAYSLIP_DOWNLOAD' as never,
      entityType: 'PayslipSnapshot', entityId: id,
      newValue: { employeeCode: result.data!.employeeCode },
    })

    const html = renderPayslipHtml(result.data!.snapshot)
    return new Response(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html', 'Content-Disposition': `attachment; filename="payslip-${result.data!.employeeCode}.html"` },
    })
  } catch (e) { console.error(e); return internalError() }
}
