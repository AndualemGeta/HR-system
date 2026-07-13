'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface PeriodDetail {
  id: string; name: string; month: number; year: number; status: string; notes: string | null
  createdBy: { id: string; name: string; email: string } | null
  payrollPeriod: { id: string; periodName: string; periodStart: string; periodEnd: string; status: string } | null
  _count: { inputs: number; calculations: number }
  createdAt: string; updatedAt: string
}

interface Dashboard {
  totalShops: number; readyShops: number; incompleteShops: number; atRiskShops: number
  calculatedShops: number; staleCalculations: number
  salesInputsComplete: number; distributionInputsComplete: number; ebuInputsComplete: number
  totalIncentive: number; averageIncentive: number; highestIncentive: number
  hasCalculations: boolean; payrollHandoffReady: boolean; periodStatus: string
  componentTotals: Record<string, number>
}

const statusColors: Record<string, string> = {
  DRAFT: '#6b7280', OPEN: '#3b82f6', CALCULATED: '#22c55e', CANCELLED: '#ef4444',
}
const statusLabels: Record<string, string> = {
  DRAFT: 'Draft', OPEN: 'Open', CALCULATED: 'Calculated', CANCELLED: 'Cancelled',
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
  const d = dashboard

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

      {d && d.staleCalculations > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4 text-sm text-yellow-800">
          <strong>Recalculation Required:</strong> {d.staleCalculations} shop(s) have inputs changed after last calculation. Please recalculate.
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold">{d?.totalShops ?? '-'}</p><p className="text-xs text-gray-500">Total Shops</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold text-green-600">{d?.readyShops ?? '-'}</p><p className="text-xs text-gray-500">Ready</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold text-orange-600">{d?.incompleteShops ?? '-'}</p><p className="text-xs text-gray-500">Incomplete</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold text-red-600">{d?.atRiskShops ?? '-'}</p><p className="text-xs text-gray-500">At-risk</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold">{d?.calculatedShops ?? '-'}</p><p className="text-xs text-gray-500">Calculated</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold text-yellow-600">{d?.staleCalculations ?? 0}</p><p className="text-xs text-gray-500">Stale</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold">{d?.totalIncentive?.toLocaleString() ?? '-'}</p><p className="text-xs text-gray-500">Total Incentive</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold">{d?.averageIncentive?.toLocaleString() ?? '-'}</p><p className="text-xs text-gray-500">Average</p></div>
        <div className="border rounded p-4 text-center"><p className="text-2xl font-bold">{d?.highestIncentive?.toLocaleString() ?? '-'}</p><p className="text-xs text-gray-500">Highest</p></div>
        <div className={`border rounded p-4 text-center ${d?.payrollHandoffReady ? 'bg-green-50' : ''}`}>
          <p className="text-2xl font-bold">{d?.payrollHandoffReady ? 'Yes' : 'No'}</p>
          <p className="text-xs text-gray-500">Payroll Ready</p>
        </div>
      </div>

      {d && (d.salesInputsComplete > 0 || d.distributionInputsComplete > 0 || d.ebuInputsComplete > 0) && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="border rounded p-3 text-center"><p className="font-bold text-blue-600">{d.salesInputsComplete}/{d.totalShops - d.atRiskShops}</p><p className="text-xs text-gray-500">Sales Inputs Complete</p></div>
          <div className="border rounded p-3 text-center"><p className="font-bold text-green-600">{d.distributionInputsComplete}/{d.totalShops - d.atRiskShops}</p><p className="text-xs text-gray-500">Distribution Inputs Complete</p></div>
          <div className="border rounded p-3 text-center"><p className="font-bold text-yellow-600">{d.ebuInputsComplete}/{d.totalShops - d.atRiskShops}</p><p className="text-xs text-gray-500">EBU Inputs Complete</p></div>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {s === 'DRAFT' && (
          <>
            <button onClick={() => handleAction('open', 'open')} disabled={actionLoading} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Open</button>
            <button onClick={() => handleAction('cancel', 'cancel')} disabled={actionLoading} className="bg-red-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Cancel</button>
          </>
        )}
        {(s === 'OPEN' || s === 'OPEN_FOR_INPUT') && (
          <button onClick={() => handleAction('calculate', 'calculate')} disabled={actionLoading} className="bg-yellow-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Calculate</button>
        )}
        {s === 'CALCULATED' && (
          <>
            <button onClick={() => handleAction('send to payroll inputs', 'send-to-payroll-inputs')} disabled={actionLoading} className={`px-4 py-2 rounded text-sm disabled:opacity-50 ${d?.payrollHandoffReady ? 'bg-indigo-600 text-white' : 'bg-gray-400 text-white'}`} title={!d?.payrollHandoffReady ? 'Resolve incomplete or stale shops first' : ''}>
              Send to Payroll
            </button>
            <button onClick={() => window.open(`/api/shop-manager-incentives/periods/${id}/export`, '_blank')} className="bg-green-600 text-white px-4 py-2 rounded text-sm">Export CSV</button>
          </>
        )}
      </div>

      <div className="flex gap-3 mb-6 flex-wrap">
        {s !== 'CANCELLED' && (
          <button onClick={() => router.push(`/shop-manager-incentives/${id}/inputs`)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Inputs</button>
        )}
        {(s === 'CALCULATED' || s === 'OPEN') && (
          <button onClick={() => router.push(`/shop-manager-incentives/${id}/calculations`)} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Calculations</button>
        )}
        <button onClick={() => router.push('/shop-manager-incentives/input-configuration')} className="px-4 py-2 border rounded text-sm hover:bg-gray-50">Input Configuration</button>
      </div>

      {d && d.totalIncentive > 0 && (
        <div className="border rounded p-4 mb-6">
          <h2 className="font-semibold mb-2">Component Totals (Audit Only)</h2>
          <div className="grid grid-cols-3 md:grid-cols-5 gap-2 text-sm">
            {Object.entries(d.componentTotals || {}).map(([key, val]) => (
              <div key={key} className="bg-gray-50 rounded p-2">
                <span className="text-gray-500">{key.replace(/([A-Z])/g, ' $1').trim()}:</span> {Number(val).toLocaleString()}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Period Details</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <p><span className="text-gray-500">Status:</span> {statusLabels[s] || s}</p>
          <p><span className="text-gray-500">Month/Year:</span> {period.month}/{period.year}</p>
          <p><span className="text-gray-500">Payroll Period:</span> {period.payrollPeriod?.periodName || '-'}</p>
          <p><span className="text-gray-500">Payroll Status:</span> {period.payrollPeriod?.status || '-'}</p>
          <p><span className="text-gray-500">Created By:</span> {period.createdBy?.name || '-'}</p>
          <p><span className="text-gray-500">Inputs:</span> {period._count.inputs}</p>
        </div>
      </div>
    </div>
  )
}
