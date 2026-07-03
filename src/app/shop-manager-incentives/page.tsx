'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Eye, XCircle } from 'lucide-react'

interface CreatedBy { id: string; name: string; email: string }
interface PayrollPeriod { id: string; periodName: string }
interface Period {
  id: string; name: string; month: number; year: number; status: string; notes: string | null
  totalShops: number; totalCalculatedAmount: number; totalApprovedAmount: number
  createdBy: CreatedBy; payrollPeriod: PayrollPeriod; createdAt: string; updatedAt: string
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

export default function ShopManagerIncentivesPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchPeriods() }, [])

  async function fetchPeriods() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/shop-manager-incentives/periods')
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); setPeriods([]) }
      else setPeriods(json.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this incentive period?')) return
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/cancel`, { method: 'POST' })
      if (res.ok) fetchPeriods()
      else { const j = await res.json(); alert(j.error || 'Failed to cancel') }
    } catch { alert('Network error') }
  }

  if (loading) return <div className="p-6"><p>Loading incentive periods...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">Error: {error}</p><button onClick={fetchPeriods} className="text-blue-600 underline mt-2">Retry</button></div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Shop Manager Incentives</h1>
        <button onClick={() => router.push('/shop-manager-incentives/new')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
          <Plus size={16} /> New Period
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Period Name</th>
              <th className="border p-2 text-left">Payroll Period</th>
              <th className="border p-2 text-left">Month</th>
              <th className="border p-2 text-left">Year</th>
              <th className="border p-2 text-left">Status</th>
              <th className="border p-2 text-left">Total Shops</th>
              <th className="border p-2 text-left">Total Calculated</th>
              <th className="border p-2 text-left">Total Approved</th>
              <th className="border p-2 text-left">Created By</th>
              <th className="border p-2 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {periods.map(p => (
              <tr key={p.id} className="hover:bg-gray-50">
                <td className="border p-2 font-medium">{p.name}</td>
                <td className="border p-2">{p.payrollPeriod?.periodName || '-'}</td>
                <td className="border p-2">{p.month}</td>
                <td className="border p-2">{p.year}</td>
                <td className="border p-2">
                  <span style={{ backgroundColor: statusColors[p.status] || '#6b7280', color: '#fff' }} className="px-2 py-0.5 rounded text-xs font-semibold">
                    {statusLabels[p.status] || p.status}
                  </span>
                </td>
                <td className="border p-2">{p.totalShops}</td>
                <td className="border p-2">{p.totalCalculatedAmount.toLocaleString()}</td>
                <td className="border p-2">{p.totalApprovedAmount.toLocaleString()}</td>
                <td className="border p-2">{p.createdBy?.name || '-'}</td>
                <td className="border p-2">
                  <div className="flex gap-1">
                    <button onClick={() => router.push(`/shop-manager-incentives/${p.id}`)} className="p-1 text-blue-600" title="View"><Eye size={16} /></button>
                    {p.status === 'DRAFT' && (
                      <button onClick={() => handleCancel(p.id)} className="p-1 text-red-600" title="Cancel"><XCircle size={16} /></button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {periods.length === 0 && <p className="text-center text-gray-400 mt-4">No incentive periods found.</p>}
      </div>
    </div>
  )
}
