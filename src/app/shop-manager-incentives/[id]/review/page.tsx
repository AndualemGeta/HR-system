'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ComponentDetail {
  id: string; componentCode: string; inputValue: number | null
  conditionResult: string | null; formula: string | null; amount: number; note: string | null
}

interface Calculation {
  id: string; totalAmount: number; status: string
  components: ComponentDetail[]
  issues: { id: string; severity: string; message: string }[]
}

interface PerformanceInput {
  id: string; shopLocationId: string; inputStatus: string
  shopCriteria: string | null; corridorType: string | null
  shopLocation: { id: string; name: string; code: string }
  shopManager: { id: string; fullName: string; employeeId: string } | null
  calculation: Calculation | null
}

const componentLabels: Record<string, string> = {
  QGA_BONUS: 'QGA Bonus', QGA_SIM_COMMISSION: 'QGA SIM', EVD_BONUS: 'EVD',
  BA_SITE_BONUS: 'BA/Site', MPESA_COMMISSION: 'M-PESA', DSA_ACHIEVEMENT_BONUS: 'DSA',
  QO_BONUS: 'QO', EBU_ACTIVATION_BONUS: 'EBU Activation', EBU_REVENUE_SHARE: 'EBU Revenue',
}

export default function ReviewPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [inputs, setInputs] = useState<PerformanceInput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs`)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load') }
      else setInputs(json.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function handleInputAction(inputId: string, action: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inputId}/${action}`, { method: 'POST' })
      if (res.ok) fetchData()
      else { const j = await res.json(); alert(j.error || `Failed to ${action}`) }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleApproveAllClean() {
    if (!confirm('Approve all inputs without BLOCKER issues?')) return
    setActionLoading(true)
    for (const inp of inputs) {
      const hasBlocker = inp.calculation?.issues?.some(i => i.severity === 'BLOCKER')
      if (!hasBlocker && (inp.inputStatus === 'SUBMITTED' || inp.inputStatus === 'RETURNED')) {
        await handleInputAction(inp.id, 'accept')
      }
    }
    setActionLoading(false)
  }

  async function handleLockApproved() {
    if (!confirm('Lock all approved inputs?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/lock`, { method: 'POST' })
      if (res.ok) fetchData()
      else { const j = await res.json(); alert(j.error || 'Failed to lock') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function getComponentAmount(calc: Calculation | null, code: string): number {
    if (!calc) return 0
    const comp = calc.components.find(c => c.componentCode === code)
    return comp ? Number(comp.amount) : 0
  }

  const needsAction = (s: string) => s === 'SUBMITTED' || s === 'RETURNED'

  if (loading) return <div className="p-6"><p>Loading review data...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">{error}<button onClick={fetchData} className="text-blue-600 underline ml-2">Retry</button></p></div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Review</h1>
          <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
        </div>
        <div className="flex gap-2">
          <button onClick={handleApproveAllClean} disabled={actionLoading} className="bg-green-600 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            Approve All Clean
          </button>
          <button onClick={handleLockApproved} disabled={actionLoading} className="bg-gray-800 text-white px-3 py-1 rounded text-sm disabled:opacity-50">
            Lock Approved
          </button>
        </div>
      </div>

      {inputs.length === 0 ? <p className="text-gray-400">No inputs found.</p> : (
        <div className="space-y-4">
          {inputs.map(inp => {
            const calc = inp.calculation
            const hasBlocker = calc?.issues?.some(i => i.severity === 'BLOCKER')
            const hasWarning = calc?.issues?.some(i => i.severity === 'WARNING')
            const isExpanded = expanded.has(inp.id)

            return (
              <div key={inp.id} className={`border rounded ${inp.inputStatus === 'ACCEPTED' ? 'border-green-400 bg-green-50' : inp.inputStatus === 'REJECTED' ? 'border-red-400 bg-red-50' : ''}`}>
                <div className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold">{inp.shopLocation?.name} ({inp.shopLocation?.code})</h3>
                      <p className="text-sm text-gray-500">Manager: {inp.shopManager?.fullName || '-'} | Criteria: {inp.shopCriteria || '-'} | Status: {inp.inputStatus}</p>
                      {hasBlocker && <p className="text-red-600 text-sm font-medium mt-1">BLOCKER issues present</p>}
                      {hasWarning && !hasBlocker && <p className="text-yellow-600 text-sm mt-1">Warnings present</p>}
                    </div>
                    <div className="flex gap-2 items-center">
                      {needsAction(inp.inputStatus) && (
                        <>
                          <button onClick={() => handleInputAction(inp.id, 'accept')} disabled={actionLoading} className="bg-green-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50">Approve</button>
                          <button onClick={() => handleInputAction(inp.id, 'return')} disabled={actionLoading} className="bg-yellow-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50">Return</button>
                          <button onClick={() => handleInputAction(inp.id, 'reject')} disabled={actionLoading} className="bg-red-600 text-white px-3 py-1 rounded text-xs disabled:opacity-50">Reject</button>
                        </>
                      )}
                      {inp.inputStatus === 'ACCEPTED' && <span className="text-green-600 text-sm font-semibold">Approved</span>}
                      {inp.inputStatus === 'REJECTED' && <span className="text-red-600 text-sm font-semibold">Rejected</span>}
                      <button onClick={() => toggleExpand(inp.id)} className="text-blue-600 text-xs underline">{isExpanded ? 'Hide' : 'Show'} Details</button>
                    </div>
                  </div>
                </div>

                {isExpanded && calc && (
                  <div className="border-t p-4 bg-gray-50">
                    <h4 className="font-semibold text-sm mb-2">Calculation Breakdown</h4>
                    <div className="grid grid-cols-3 md:grid-cols-5 gap-2 mb-3">
                      {calc.components.map(comp => (
                        <div key={comp.id} className="bg-white border rounded p-2 text-xs">
                          <p className="font-medium text-gray-600">{componentLabels[comp.componentCode] || comp.componentCode}</p>
                          <p className="text-lg font-bold">{Number(comp.amount).toLocaleString()}</p>
                          {comp.inputValue !== null && <p className="text-gray-400">Input: {comp.inputValue}</p>}
                          {comp.conditionResult && <p className="text-gray-400">Cond: {comp.conditionResult}</p>}
                          {comp.formula && <p className="text-gray-400 font-mono text-[10px]">Formula: {comp.formula}</p>}
                          {comp.note && <p className="text-gray-400">Note: {comp.note}</p>}
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between items-center">
                      <p className="font-semibold">Total: {Number(calc.totalAmount).toLocaleString()}</p>
                      {calc.issues && calc.issues.length > 0 && (
                        <div className="text-xs">
                          {calc.issues.map((iss: any) => (
                            <p key={iss.id} className={`${iss.severity === 'BLOCKER' ? 'text-red-600' : 'text-yellow-600'}`}>
                              {iss.severity}: {iss.message}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {isExpanded && !calc && (
                  <div className="border-t p-4 bg-gray-50">
                    <p className="text-sm text-gray-400">No calculation data available for this shop.</p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
