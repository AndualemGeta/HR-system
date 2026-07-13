'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ShopLocation { id: string; name: string; code: string }
interface ShopManager { id: string; fullName: string; employeeId: string }

interface Calculation {
  id: string; incentivePeriodId: string; shopLocationId: string
  shopCriteria: string | null; calculationNote: string | null; calculatedAt: string | null
  qgaBonus: number; qgaSimCommission: number; evdBonus: number
  mpesaCommission: number; baSiteBonus: number; dsaAchievementBonus: number
  qoBonus: number; ebuActivationBonus: number; ebuRevenueShare: number
  totalIncentive: number
  shopLocation: ShopLocation | null
  shopManager: ShopManager | null
}

export default function CalculationsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [calculations, setCalculations] = useState<Calculation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/calculations`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); return }
      setCalculations(json.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  if (loading) return <div className="p-6"><p>Loading calculations...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">{error}<button onClick={fetchData} className="text-blue-600 underline ml-2">Retry</button></p></div>

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Calculations</h1>
        <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
      </div>

      {calculations.length === 0 ? <p className="text-gray-400">No calculations found for this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">No</th>
                <th className="border p-2 text-left">Shop / Cluster</th>
                <th className="border p-2 text-left">Shop Manager</th>
                <th className="border p-2 text-left">Criteria</th>
                <th className="border p-2 text-right">QGA Bonus</th>
                <th className="border p-2 text-right">QGA SIM</th>
                <th className="border p-2 text-right">EVD Bonus</th>
                <th className="border p-2 text-right">M-PESA Comm</th>
                <th className="border p-2 text-right">BA/Site</th>
                <th className="border p-2 text-right">DSA Bonus</th>
                <th className="border p-2 text-right">QO Bonus</th>
                <th className="border p-2 text-right">EBU Act</th>
                <th className="border p-2 text-right">EBU Rev Share</th>
                <th className="border p-2 text-right">Total</th>
                <th className="border p-2 text-left">Notes</th>
              </tr>
            </thead>
            <tbody>
              {calculations.map((c, idx) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="border p-2">{idx + 1}</td>
                  <td className="border p-2 font-mono">
                    {c.shopLocation?.code || '-'}
                    <br /><span className="text-xs text-gray-400">{c.shopLocation?.name || ''}</span>
                  </td>
                  <td className="border p-2">{c.shopManager?.fullName || '-'}</td>
                  <td className="border p-2">{c.shopCriteria || '-'}</td>
                  <td className="border p-2 text-right">{c.qgaBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.qgaSimCommission.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.evdBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.mpesaCommission.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.baSiteBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.dsaAchievementBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.qoBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.ebuActivationBonus.toLocaleString()}</td>
                  <td className="border p-2 text-right">{c.ebuRevenueShare.toLocaleString()}</td>
                  <td className="border p-2 text-right font-bold">{c.totalIncentive.toLocaleString()}</td>
                  <td className="border p-2 text-xs max-w-[120px] truncate">{c.calculationNote || '-'}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                <td className="border p-2" colSpan={4}>Total</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.qgaBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.qgaSimCommission, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.evdBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.mpesaCommission, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.baSiteBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.dsaAchievementBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.qoBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.ebuActivationBonus, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.ebuRevenueShare, 0).toLocaleString()}</td>
                <td className="border p-2 text-right">{calculations.reduce((s, c) => s + c.totalIncentive, 0).toLocaleString()}</td>
                <td className="border p-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
