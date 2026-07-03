'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface PeriodDetail {
  id: string; name: string; month: number; year: number; status: string; notes: string | null
  createdBy: { id: string; name: string; email: string } | null
  reviewedBy: { id: string; name: string; email: string } | null
  approvedBy: { id: string; name: string; email: string } | null
  lockedBy: { id: string; name: string; email: string } | null
  payrollPeriod: { id: string; periodName: string; periodStart: string; periodEnd: string; status: string } | null
  _count: { performanceInputs: number; calculations: number; issues: number }
  createdAt: string; updatedAt: string
}

interface Dashboard {
  totalShops: number; eligibleShops: number; atRiskShops: number
  missingCriteria: number; missingManager: number
  totalCalculated: number; totalApproved: number
  issueCounts: { severity: string; count: number }[]
  recentAuditLogs: { id: string; action: string; createdAt: string; user: { name: string } | null }[]
}

const statusColors: Record<string, string> = {
  DRAFT: '#6b7280', OPEN_FOR_INPUT: '#3b82f6', READY_FOR_CALCULATION: '#eab308',
  CALCULATED: '#22c55e', UNDER_REVIEW: '#a855f7', APPROVED: '#6366f1',
  LOCKED: '#1f2937', CANCELLED: '#ef4444',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft', OPEN_FOR_INPUT: 'Open for Input', READY_FOR_CALCULATION: 'Ready for Calc',
  CALCULATED: 'Calculated', UNDER_REVIEW: 'Under Review', APPROVED: 'Approved',
  LOCKED: 'Locked', CANCELLED: 'Cancelled',
}

export default function IncentivePeriodDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [period, setPeriod] = useState<PeriodDetail | null>(null)
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  useEffect(() => { loadData() }, [id])

  async function loadData() {
    setLoading(true); setError(null)
    try {
      const [periodRes, dashRes] = await Promise.all([
        fetch(`/api/shop-manager-incentives/periods/${id}`),
        fetch(`/api/shop-manager-incentives/periods/${id}/dashboard`),
      ])
      const periodJson = await periodRes.json()
      const dashJson = await dashRes.json()
      if (!periodRes.ok) { setError(periodJson.error || 'Failed to load period'); return }
      setPeriod(periodJson.data)
      if (dashRes.ok) setDashboard(dashJson.data)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function handleAction(action: string, apiPath: string) {
    if (!confirm(`Are you sure you want to ${action} this period?`)) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/${apiPath}`, { method: 'POST' })
      if (res.ok) { await loadData() }
      else { const j = await res.json(); alert(j.error || `Failed to ${action}`) }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  if (loading) return <div className="p-6"><p>Loading period details...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">Error: {error}</p><button onClick={loadData} className="text-blue-600 underline mt-2">Retry</button></div>
  if (!period) return <div className="p-6"><p>Period not found</p></div>

  const s = period.status
  const navLinks = [
    { label: 'Inputs', path: `/shop-manager-incentives/${id}/inputs`, show: s !== 'DRAFT' && s !== 'CANCELLED' },
    { label: 'Calculations', path: `/shop-manager-incentives/${id}/calculations`, show: s === 'CALCULATED' || s === 'UNDER_REVIEW' || s === 'APPROVED' || s === 'LOCKED' },
    { label: 'Review', path: `/shop-manager-incentives/${id}/review`, show: s === 'UNDER_REVIEW' || s === 'APPROVED' },
    { label: 'Import', path: `/shop-manager-incentives/${id}/import`, show: s !== 'CANCELLED' },
  ]

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">{period.name}</h1>
          <p className="text-gray-500 text-sm">Period {period.month}/{period.year} - {period.payrollPeriod?.periodName || '-'}</p>
        </div>
        <div className="flex items-center gap-2">
          <span style={{ backgroundColor: statusColors[s] || '#6b7280', color: '#fff' }} className="px-3 py-1 rounded text-sm font-semibold">
            {statusLabels[s] || s}
          </span>
          <button onClick={() => router.push('/shop-manager-incentives')} className="px-4 py-2 border rounded text-sm">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold">{dashboard?.totalShops ?? '-'}</p>
          <p className="text-sm text-gray-500">Total Shops</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold text-green-600">{dashboard?.eligibleShops ?? '-'}</p>
          <p className="text-sm text-gray-500">Eligible</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold text-red-600">{dashboard?.atRiskShops ?? '-'}</p>
          <p className="text-sm text-gray-500">At-Risk</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold text-yellow-600">{dashboard?.missingCriteria ?? '-'}</p>
          <p className="text-sm text-gray-500">Missing Criteria</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold text-orange-600">{dashboard?.missingManager ?? '-'}</p>
          <p className="text-sm text-gray-500">Missing Manager</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold">{dashboard?.totalCalculated?.toLocaleString() ?? '-'}</p>
          <p className="text-sm text-gray-500">Total Calculated</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold text-indigo-600">{dashboard?.totalApproved?.toLocaleString() ?? '-'}</p>
          <p className="text-sm text-gray-500">Total Approved</p>
        </div>
        <div className="border rounded p-4 text-center">
          <p className="text-2xl font-bold">{period._count.issues}</p>
          <p className="text-sm text-gray-500">Issues</p>
        </div>
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {s === 'DRAFT' && (
          <button onClick={() => handleAction('open for input', 'open')} disabled={actionLoading} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Open for Input
          </button>
        )}
        {(s === 'OPEN_FOR_INPUT' || s === 'READY_FOR_CALCULATION') && (
          <button onClick={() => handleAction('calculate', 'calculate')} disabled={actionLoading} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Calculate
          </button>
        )}
        {s === 'CALCULATED' && (
          <button onClick={() => handleAction('start review', 'start-review')} disabled={actionLoading} className="bg-purple-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Start Review
          </button>
        )}
        {s === 'UNDER_REVIEW' && (
          <button onClick={() => handleAction('approve', 'approve')} disabled={actionLoading} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Approve
          </button>
        )}
        {(s === 'APPROVED' || s === 'LOCKED') && (
          <button onClick={() => handleAction('send to payroll inputs', 'send-to-payroll-inputs')} disabled={actionLoading} className="bg-indigo-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Send to Payroll Inputs
          </button>
        )}
        {s === 'APPROVED' && (
          <button onClick={() => handleAction('lock', 'lock')} disabled={actionLoading} className="bg-gray-800 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Lock
          </button>
        )}
        {s !== 'LOCKED' && s !== 'CANCELLED' && (
          <button onClick={() => handleAction('cancel', 'cancel')} disabled={actionLoading} className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
            Cancel
          </button>
        )}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {navLinks.filter(l => l.show).map(l => (
          <button key={l.path} onClick={() => router.push(l.path)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">
            {l.label}
          </button>
        ))}
      </div>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Period Details</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><span className="text-gray-500">Status:</span> {statusLabels[s] || s}</p>
          <p><span className="text-gray-500">Month/Year:</span> {period.month}/{period.year}</p>
          <p><span className="text-gray-500">Payroll Period:</span> {period.payrollPeriod?.periodName || '-'}</p>
          <p><span className="text-gray-500">Created By:</span> {period.createdBy?.name || '-'}</p>
          <p><span className="text-gray-500">Reviewed By:</span> {period.reviewedBy?.name || '-'}</p>
          <p><span className="text-gray-500">Approved By:</span> {period.approvedBy?.name || '-'}</p>
          <p><span className="text-gray-500">Locked By:</span> {period.lockedBy?.name || '-'}</p>
          <p><span className="text-gray-500">Notes:</span> {period.notes || '-'}</p>
          <p><span className="text-gray-500">Inputs:</span> {period._count.performanceInputs}</p>
          <p><span className="text-gray-500">Calculations:</span> {period._count.calculations}</p>
        </div>
      </div>

      {dashboard?.issueCounts && dashboard.issueCounts.length > 0 && (
        <div className="border rounded p-4 mb-6">
          <h2 className="font-semibold mb-2">Issue Summary</h2>
          <div className="flex gap-4">
            {dashboard.issueCounts.map(ic => (
              <div key={ic.severity} className="text-sm">
                <span className="font-medium">{ic.severity}:</span> {ic.count}
              </div>
            ))}
          </div>
        </div>
      )}

      {dashboard?.recentAuditLogs && dashboard.recentAuditLogs.length > 0 && (
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Recent Activity</h2>
          <div className="space-y-1 text-sm">
            {dashboard.recentAuditLogs.map(log => (
              <p key={log.id}><span className="text-gray-500">{new Date(log.createdAt).toLocaleString()}</span> - {log.user?.name || 'System'}: {log.action}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
