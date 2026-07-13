'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ShopLocation { id: string; name: string; code: string }
interface ShopManager { id: string; fullName: string; employeeId: string }

interface PerformanceInput {
  id: string; incentivePeriodId: string; shopLocationId: string
  shopCriteria: string | null; corridorStatus: boolean | null
  qgaAbove90: boolean | null; qgaQuantity: number | null
  mmQoAbove90: boolean | null; dsaAirtimeAchievementPercent: number | null
  evdAbove100AndReconciled: boolean | null
  mpesaTargetAndReconciled: boolean | null; mpesaFloatSold: number | null
  baSite: boolean | null
  ebuTargetAchieved: boolean | null; ebuRevenueMade: boolean | null
  ebuAverageTopupAbove500: boolean | null; ebuFirstMonthLfRevenue: number | null
  responsibleRemarks: string | null
  shopLocation: ShopLocation; shopManager: ShopManager | null
}

export default function InputsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [inputs, setInputs] = useState<PerformanceInput[]>([])
  const [shops, setShops] = useState<ShopLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormData, setAddFormData] = useState<Record<string, string>>({})
  const [addFormError, setAddFormError] = useState('')

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const [inputRes, shopRes] = await Promise.all([
        fetch(`/api/shop-manager-incentives/periods/${id}/inputs`),
        fetch('/api/shops?pageSize=500'),
      ])
      const inputJson = await inputRes.json()
      const shopJson = await shopRes.json()
      if (!inputRes.ok) { setError(inputJson.error || 'Failed to load inputs') }
      else setInputs(inputJson.data || [])
      if (shopRes.ok) setShops(shopJson.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  function startEdit(inp: PerformanceInput) {
    setEditingId(inp.id)
    const data: Record<string, string> = {}
    data.shopCriteria = inp.shopCriteria ?? ''
    data.shopManagerId = inp.shopManager?.id ?? ''
    data.corridorStatus = inp.corridorStatus === null ? '' : inp.corridorStatus ? 'true' : 'false'
    data.qgaAbove90 = inp.qgaAbove90 === null ? '' : inp.qgaAbove90 ? 'true' : 'false'
    data.qgaQuantity = inp.qgaQuantity?.toString() ?? ''
    data.mmQoAbove90 = inp.mmQoAbove90 === null ? '' : inp.mmQoAbove90 ? 'true' : 'false'
    data.dsaAirtimeAchievementPercent = inp.dsaAirtimeAchievementPercent?.toString() ?? ''
    data.evdAbove100AndReconciled = inp.evdAbove100AndReconciled === null ? '' : inp.evdAbove100AndReconciled ? 'true' : 'false'
    data.mpesaTargetAndReconciled = inp.mpesaTargetAndReconciled === null ? '' : inp.mpesaTargetAndReconciled ? 'true' : 'false'
    data.mpesaFloatSold = inp.mpesaFloatSold?.toString() ?? ''
    data.baSite = inp.baSite === null ? '' : inp.baSite ? 'true' : 'false'
    data.ebuTargetAchieved = inp.ebuTargetAchieved === null ? '' : inp.ebuTargetAchieved ? 'true' : 'false'
    data.ebuRevenueMade = inp.ebuRevenueMade === null ? '' : inp.ebuRevenueMade ? 'true' : 'false'
    data.ebuAverageTopupAbove500 = inp.ebuAverageTopupAbove500 === null ? '' : inp.ebuAverageTopupAbove500 ? 'true' : 'false'
    data.ebuFirstMonthLfRevenue = inp.ebuFirstMonthLfRevenue?.toString() ?? ''
    data.responsibleRemarks = inp.responsibleRemarks ?? ''
    setEditData(data)
  }

  function cancelEdit() { setEditingId(null); setEditData({}) }

  function boolVal(v: string): boolean | undefined {
    if (v === 'true') return true
    if (v === 'false') return false
    return undefined
  }

  function floatVal(v: string): number | undefined {
    if (v === '' || v === undefined || v === null) return undefined
    const n = parseFloat(v)
    return isNaN(n) ? undefined : n
  }

  function intVal(v: string): number | undefined {
    if (v === '' || v === undefined || v === null) return undefined
    const n = parseInt(v, 10)
    return isNaN(n) ? undefined : n
  }

  function buildUpdateBody(data: Record<string, string>): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    if (data.shopCriteria) body.shopCriteria = data.shopCriteria
    if (data.shopManagerId) body.shopManagerId = data.shopManagerId
    const cb = boolVal(data.corridorStatus); if (cb !== undefined) body.corridorStatus = cb
    const qga = boolVal(data.qgaAbove90); if (qga !== undefined) body.qgaAbove90 = qga
    const qq = intVal(data.qgaQuantity); if (qq !== undefined) body.qgaQuantity = qq
    const mm = boolVal(data.mmQoAbove90); if (mm !== undefined) body.mmQoAbove90 = mm
    const dsa = floatVal(data.dsaAirtimeAchievementPercent); if (dsa !== undefined) body.dsaAirtimeAchievementPercent = dsa
    const evd = boolVal(data.evdAbove100AndReconciled); if (evd !== undefined) body.evdAbove100AndReconciled = evd
    const mpesaTgt = boolVal(data.mpesaTargetAndReconciled); if (mpesaTgt !== undefined) body.mpesaTargetAndReconciled = mpesaTgt
    const mpesaFlt = floatVal(data.mpesaFloatSold); if (mpesaFlt !== undefined) body.mpesaFloatSold = mpesaFlt
    const ba = boolVal(data.baSite); if (ba !== undefined) body.baSite = ba
    const ebuTgt = boolVal(data.ebuTargetAchieved); if (ebuTgt !== undefined) body.ebuTargetAchieved = ebuTgt
    const ebuRev = boolVal(data.ebuRevenueMade); if (ebuRev !== undefined) body.ebuRevenueMade = ebuRev
    const ebuAvg = boolVal(data.ebuAverageTopupAbove500); if (ebuAvg !== undefined) body.ebuAverageTopupAbove500 = ebuAvg
    const ebu1st = floatVal(data.ebuFirstMonthLfRevenue); if (ebu1st !== undefined) body.ebuFirstMonthLfRevenue = ebu1st
    body.responsibleRemarks = data.responsibleRemarks || null
    return body
  }

  async function saveEdit(inp: PerformanceInput) {
    const body = buildUpdateBody(editData)
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); setEditData({}); fetchData() }
      else { const j = await res.json(); alert(j.error || 'Failed to update') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleDelete(inputId: string) {
    if (!confirm('Delete this input?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inputId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
      else { const j = await res.json(); alert(j.error || 'Failed to delete') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleAddInput(e: React.FormEvent) {
    e.preventDefault()
    setAddFormError('')
    if (!addFormData.shopLocationId) { setAddFormError('Shop is required'); return }
    const body = buildUpdateBody(addFormData)
    body.shopLocationId = addFormData.shopLocationId
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowAddForm(false); setAddFormData({}); fetchData() }
      else { const j = await res.json(); setAddFormError(j.error || 'Failed to add input') }
    } catch { setAddFormError('Network error') }
    finally { setActionLoading(false) }
  }

  function renderBool(v: boolean | null): string {
    if (v === null) return '-'
    return v ? 'Yes' : 'No'
  }

  function isAtRisk(inp: PerformanceInput): boolean {
    return inp.shopCriteria === 'AT_RISK'
  }

  if (loading) return <div className="p-6"><p>Loading inputs...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">{error}<button onClick={fetchData} className="text-blue-600 underline ml-2">Retry</button></p></div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Inputs</h1>
          <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">+ Add Input</button>
      </div>

      {showAddForm && (
        <div className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Add New Input</h3>
          {addFormError && <p className="text-red-500 text-sm mb-2">{addFormError}</p>}
          <form onSubmit={handleAddInput} className="space-y-2 text-sm">
            <div className="grid grid-cols-4 gap-2">
              <select value={addFormData.shopLocationId || ''} onChange={e => setAddFormData(f => ({ ...f, shopLocationId: e.target.value }))} className="border rounded px-2 py-1">
                <option value="">Select Shop...</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
              <select value={addFormData.shopCriteria || ''} onChange={e => setAddFormData(f => ({ ...f, shopCriteria: e.target.value }))} className="border rounded px-2 py-1">
                <option value="">Criteria</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
                <option value="AT_RISK">At-Risk</option>
              </select>
              <input placeholder="Manager ID" value={addFormData.shopManagerId || ''} onChange={e => setAddFormData(f => ({ ...f, shopManagerId: e.target.value }))} className="border rounded px-2 py-1" />
              <input placeholder="Remarks" value={addFormData.responsibleRemarks || ''} onChange={e => setAddFormData(f => ({ ...f, responsibleRemarks: e.target.value }))} className="border rounded px-2 py-1" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={actionLoading} className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50">Save</button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddFormError('') }} className="px-3 py-1 border rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {inputs.length === 0 ? <p className="text-gray-400 text-center mt-4">No inputs found.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left" rowSpan={2}>No</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop / Cluster</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop Manager Name</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop Criteria</th>
                <th className="border p-1 text-center bg-blue-50" colSpan={4}>Sales Head Inputs</th>
                <th className="border p-1 text-center bg-green-50" colSpan={5}>Distribution Head Inputs</th>
                <th className="border p-1 text-center bg-yellow-50" colSpan={4}>EBU Head Inputs</th>
                <th className="border p-1 text-left" rowSpan={2}>Responsible Remarks</th>
                <th className="border p-1 text-left" rowSpan={2}>Actions</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border p-1 text-left text-[10px]">QGA &gt;90%?</th>
                <th className="border p-1 text-left text-[10px]">QGA Quantity</th>
                <th className="border p-1 text-left text-[10px]">MM QO &gt;90%?</th>
                <th className="border p-1 text-left text-[10px]">DSA Airtime %</th>
                <th className="border p-1 text-left text-[10px]">Corridor</th>
                <th className="border p-1 text-left text-[10px]">EVD &gt;100%</th>
                <th className="border p-1 text-left text-[10px]">M-PESA Tgt</th>
                <th className="border p-1 text-left text-[10px]">M-PESA Float</th>
                <th className="border p-1 text-left text-[10px]">BA/Site</th>
                <th className="border p-1 text-left text-[10px]">EBU Tgt</th>
                <th className="border p-1 text-left text-[10px]">EBU Rev</th>
                <th className="border p-1 text-left text-[10px]">EBU TopUp &gt;500?</th>
                <th className="border p-1 text-left text-[10px]">EBU 1st Mo LF</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((inp, idx) => {
                const atRisk = isAtRisk(inp)
                return (
                  <tr key={inp.id} className={`hover:bg-gray-50 ${atRisk ? 'bg-gray-100 text-gray-400' : ''}`}>
                    <td className="border p-1">{idx + 1}</td>
                    <td className="border p-1 font-mono">{inp.shopLocation?.code || '-'}<br /><span className="text-gray-400">{inp.shopLocation?.name || ''}</span></td>
                    <td className="border p-1">{inp.shopManager?.fullName || '-'}</td>
                    <td className="border p-1">
                      <span style={{ color: atRisk ? '#ef4444' : '#000' }} className="font-semibold">{inp.shopCriteria || '-'}</span>
                      {atRisk && <div className="text-red-500 text-[10px] mt-1">At-risk: all incentive components are zero.</div>}
                    </td>
                    {editingId === inp.id ? (
                      <>
                        <td className="border p-1"><select value={editData.qgaAbove90 || ''} onChange={e => setEditData(f => ({ ...f, qgaAbove90: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><input value={editData.qgaQuantity || ''} onChange={e => setEditData(f => ({ ...f, qgaQuantity: e.target.value }))} className="w-14 border rounded px-1" disabled={atRisk} /></td>
                        <td className="border p-1"><select value={editData.mmQoAbove90 || ''} onChange={e => setEditData(f => ({ ...f, mmQoAbove90: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><input value={editData.dsaAirtimeAchievementPercent || ''} onChange={e => setEditData(f => ({ ...f, dsaAirtimeAchievementPercent: e.target.value }))} className="w-14 border rounded px-1" disabled={atRisk} /></td>
                        <td className="border p-1"><select value={editData.corridorStatus || ''} onChange={e => setEditData(f => ({ ...f, corridorStatus: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><select value={editData.evdAbove100AndReconciled || ''} onChange={e => setEditData(f => ({ ...f, evdAbove100AndReconciled: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><select value={editData.mpesaTargetAndReconciled || ''} onChange={e => setEditData(f => ({ ...f, mpesaTargetAndReconciled: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><input value={editData.mpesaFloatSold || ''} onChange={e => setEditData(f => ({ ...f, mpesaFloatSold: e.target.value }))} className="w-14 border rounded px-1" disabled={atRisk} /></td>
                        <td className="border p-1"><select value={editData.baSite || ''} onChange={e => setEditData(f => ({ ...f, baSite: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><select value={editData.ebuTargetAchieved || ''} onChange={e => setEditData(f => ({ ...f, ebuTargetAchieved: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><select value={editData.ebuRevenueMade || ''} onChange={e => setEditData(f => ({ ...f, ebuRevenueMade: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><select value={editData.ebuAverageTopupAbove500 || ''} onChange={e => setEditData(f => ({ ...f, ebuAverageTopupAbove500: e.target.value }))} className="w-14 border rounded" disabled={atRisk}><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                        <td className="border p-1"><input value={editData.ebuFirstMonthLfRevenue || ''} onChange={e => setEditData(f => ({ ...f, ebuFirstMonthLfRevenue: e.target.value }))} className="w-14 border rounded px-1" disabled={atRisk} /></td>
                        <td className="border p-1"><input value={editData.responsibleRemarks || ''} onChange={e => setEditData(f => ({ ...f, responsibleRemarks: e.target.value }))} className="w-24 border rounded px-1" /></td>
                        <td className="border p-1">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(inp)} disabled={actionLoading} className="text-green-600 text-xs underline">Save</button>
                            <button onClick={cancelEdit} className="text-gray-500 text-xs underline">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border p-1">{renderBool(inp.qgaAbove90)}</td>
                        <td className="border p-1">{inp.qgaQuantity ?? '-'}</td>
                        <td className="border p-1">{renderBool(inp.mmQoAbove90)}</td>
                        <td className="border p-1">{inp.dsaAirtimeAchievementPercent ?? '-'}</td>
                        <td className="border p-1">{renderBool(inp.corridorStatus)}</td>
                        <td className="border p-1">{renderBool(inp.evdAbove100AndReconciled)}</td>
                        <td className="border p-1">{renderBool(inp.mpesaTargetAndReconciled)}</td>
                        <td className="border p-1">{inp.mpesaFloatSold ?? '-'}</td>
                        <td className="border p-1">{renderBool(inp.baSite)}</td>
                        <td className="border p-1">{renderBool(inp.ebuTargetAchieved)}</td>
                        <td className="border p-1">{renderBool(inp.ebuRevenueMade)}</td>
                        <td className="border p-1">{renderBool(inp.ebuAverageTopupAbove500)}</td>
                        <td className="border p-1">{inp.ebuFirstMonthLfRevenue ?? '-'}</td>
                        <td className="border p-1 max-w-[100px] truncate">{inp.responsibleRemarks || '-'}</td>
                        <td className="border p-1">
                          <div className="flex gap-1">
                            {!atRisk && <button onClick={() => startEdit(inp)} disabled={actionLoading} className="text-blue-600 text-xs underline">Edit</button>}
                            <button onClick={() => handleDelete(inp.id)} disabled={actionLoading} className="text-red-600 text-xs underline">Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
