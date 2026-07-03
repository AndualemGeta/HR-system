'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface ComponentDetail {
  id: string; componentCode: string; inputValue: number | null
  conditionResult: string | null; formula: string | null; amount: number; note: string | null
}

interface Calculation {
  id: string; incentivePeriodId: string; shopLocationId: string; shopCriteria: string | null
  totalAmount: number; status: string; issues: { id: string; severity: string; message: string }[]
  components: ComponentDetail[]
  shopLocation: { id: string; name: string; code: string }
  shopManager: { id: string; fullName: string } | null
}

const statusColors: Record<string, string> = {
  DRAFT: '#6b7280', CALCULATED: '#22c55e', UNDER_REVIEW: '#a855f7',
  APPROVED: '#6366f1', LOCKED: '#1f2937',
}

const componentLabels: Record<string, string> = {
  QGA_BONUS: 'QGA Bonus', QGA_SIM_COMMISSION: 'QGA SIM', EVD_BONUS: 'EVD',
  BA_SITE_BONUS: 'BA/Site', MPESA_COMMISSION: 'M-PESA', DSA_ACHIEVEMENT_BONUS: 'DSA',
  QO_BONUS: 'QO', EBU_ACTIVATION_BONUS: 'EBU Activation', EBU_REVENUE_SHARE: 'EBU Revenue',
}

export default function CalculationsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [inputs, setInputs] = useState<any[]>([])
  const [calculations, setCalculations] = useState<Record<string, Calculation>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); return }
      const data = json.data || []
      setInputs(data)

      const calcMap: Record<string, Calculation> = {}
      for (const inp of data) {
        if (inp.calculation) calcMap[inp.shopLocationId] = inp.calculation
      }
      setCalculations(calcMap)
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  function toggleRow(shopLocationId: string) {
    setExpandedRows(prev => {
      const next = new Set(prev)
      if (next.has(shopLocationId)) next.delete(shopLocationId)
      else next.add(shopLocationId)
      return next
    })
  }

  function getComponentAmount(calc: Calculation | undefined, code: string): number {
    if (!calc) return 0
    const comp = calc.components.find(c => c.componentCode === code)
    return comp ? Number(comp.amount) : 0
  }

  if (loading) return <div className="p-6"><p>Loading calculations...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">{error}<button onClick={fetchData} className="text-blue-600 underline ml-2">Retry</button></p></div>

  return (
    <div className="p-6">
      <div className="mb-4">
        <h1 className="text-2xl font-bold">Calculations</h1>
        <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
      </div>

      {inputs.length === 0 ? <p className="text-gray-400">No inputs found for this period.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left w-6"></th>
                <th className="border p-2 text-left">Shop</th>
                <th className="border p-2 text-left">Manager</th>
                <th className="border p-2 text-left">Criteria</th>
                <th className="border p-2 text-left">QGA Bonus</th>
                <th className="border p-2 text-left">QGA SIM</th>
                <th className="border p-2 text-left">EVD</th>
                <th className="border p-2 text-left">BA/Site</th>
                <th className="border p-2 text-left">M-PESA</th>
                <th className="border p-2 text-left">DSA</th>
                <th className="border p-2 text-left">QO</th>
                <th className="border p-2 text-left">EBU Act</th>
                <th className="border p-2 text-left">EBU Rev</th>
                <th className="border p-2 text-left">Total</th>
                <th className="border p-2 text-left">Status</th>
                <th className="border p-2 text-left">Issues</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map(inp => {
                const calc = inp.shopLocationId ? calculations[inp.shopLocationId] : undefined
                const isExpanded = expandedRows.has(inp.shopLocationId)
                const issueCount = calc?.issues?.length || 0

                return (
                  <>
                    <tr key={inp.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleRow(inp.shopLocationId)}>
                      <td className="border p-2">{isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
                      <td className="border p-2">{inp.shopLocation?.code || '-'}<br /><span className="text-xs text-gray-400">{inp.shopLocation?.name || ''}</span></td>
                      <td className="border p-2">{inp.shopManager?.fullName || '-'}</td>
                      <td className="border p-2">{inp.shopCriteria || '-'}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'QGA_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'QGA_SIM_COMMISSION').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'EVD_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'BA_SITE_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'MPESA_COMMISSION').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'DSA_ACHIEVEMENT_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'QO_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'EBU_ACTIVATION_BONUS').toLocaleString()}</td>
                      <td className="border p-2 text-right">{getComponentAmount(calc, 'EBU_REVENUE_SHARE').toLocaleString()}</td>
                      <td className="border p-2 text-right font-semibold">{calc ? Number(calc.totalAmount).toLocaleString() : '-'}</td>
                      <td className="border p-2">
                        {calc ? (
                          <span style={{ backgroundColor: statusColors[calc.status] || '#6b7280', color: '#fff' }} className="px-2 py-0.5 rounded text-xs">{calc.status}</span>
                        ) : (
                          <span className="text-gray-400 text-xs">No calc</span>
                        )}
                      </td>
                      <td className="border p-2">
                        {issueCount > 0 ? (
                          <span className="text-red-600 text-xs font-medium">{issueCount} issue{issueCount > 1 ? 's' : ''}</span>
                        ) : <span className="text-green-600 text-xs">None</span>}
                      </td>
                    </tr>
                    {isExpanded && calc && (
                      <tr key={`${inp.id}-detail`}>
                        <td colSpan={16} className="border p-0">
                          <div className="bg-gray-50 p-3">
                            <h4 className="font-semibold mb-2 text-xs text-gray-600">Component Breakdown</h4>
                            <table className="w-full text-xs border-collapse">
                              <thead>
                                <tr className="bg-gray-200">
                                  <th className="border p-1 text-left">Component</th>
                                  <th className="border p-1 text-left">Input Value</th>
                                  <th className="border p-1 text-left">Condition</th>
                                  <th className="border p-1 text-left">Formula</th>
                                  <th className="border p-1 text-left">Amount</th>
                                  <th className="border p-1 text-left">Note</th>
                                </tr>
                              </thead>
                              <tbody>
                                {calc.components.map(comp => (
                                  <tr key={comp.id}>
                                    <td className="border p-1 font-medium">{componentLabels[comp.componentCode] || comp.componentCode}</td>
                                    <td className="border p-1">{comp.inputValue ?? '-'}</td>
                                    <td className="border p-1">{comp.conditionResult ?? '-'}</td>
                                    <td className="border p-1 font-mono text-xs">{comp.formula ?? '-'}</td>
                                    <td className="border p-1 text-right font-semibold">{Number(comp.amount).toLocaleString()}</td>
                                    <td className="border p-1">{comp.note || '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                            {calc.issues && calc.issues.length > 0 && (
                              <div className="mt-2">
                                <h4 className="font-semibold mb-1 text-xs text-gray-600">Issues</h4>
                                {calc.issues.map((iss: any) => (
                                  <p key={iss.id} className="text-xs text-red-600">{iss.severity}: {iss.message}</p>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
