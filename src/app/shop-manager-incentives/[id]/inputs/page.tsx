'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ShopLocation { id: string; name: string; code: string }
interface ShopManager { id: string; fullName: string; employeeId: string }
interface AuditUser { id: string; name: string; email: string }

interface PerformanceInput {
  id: string; incentivePeriodId: string; shopLocationId: string; inputStatus: string
  shopCriteria: string | null; corridorType: string | null
  qgaAchievementPercent: number | null; qgaCount: number | null
  evdAchievementPercent: number | null; evdReconciled: boolean | null
  baSiteRequirementMet: boolean | null
  mpesaFloatSold: number | null; mpesaTargetAchieved: boolean | null; mpesaReconciled: boolean | null
  dsaAirtimeAchievementPercent: number | null
  mmQoTargetPercent: number | null
  ebuTargetAchieved: boolean | null; ebuRevenue: number | null
  ebuAverageTopup: number | null; ebuFirstMonthLeapfrogRevenue: number | null
  notes: string | null
  shopLocation: ShopLocation; shopManager: ShopManager | null
  createdBy: AuditUser | null; submittedBy: AuditUser | null; reviewedBy: AuditUser | null
  createdAt: string; updatedAt: string
}

const inputStatusColors: Record<string, string> = {
  DRAFT: '#6b7280', SUBMITTED: '#3b82f6', ACCEPTED: '#22c55e',
  REJECTED: '#ef4444', RETURNED: '#eab308', LOCKED: '#1f2937',
}

export default function InputsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [inputs, setInputs] = useState<PerformanceInput[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormData, setAddFormData] = useState<Record<string, string>>({})
  const [addFormError, setAddFormError] = useState('')

  useEffect(() => { fetchInputs() }, [id, statusFilter])

  async function fetchInputs() {
    setLoading(true); setError(null)
    try {
      const url = statusFilter ? `/api/shop-manager-incentives/periods/${id}/inputs?inputStatus=${statusFilter}` : `/api/shop-manager-incentives/periods/${id}/inputs`
      const res = await fetch(url)
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load inputs') }
      else setInputs(json.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  async function handleAction(inputId: string, action: string) {
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inputId}/${action}`, { method: 'POST' })
      if (res.ok) fetchInputs()
      else { const j = await res.json(); alert(j.error || `Failed to ${action}`) }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  function startEdit(input: PerformanceInput) {
    setEditingId(input.id)
    const data: Record<string, string> = {}
    data.qgaAchievementPercent = input.qgaAchievementPercent?.toString() ?? ''
    data.qgaCount = input.qgaCount?.toString() ?? ''
    data.evdAchievementPercent = input.evdAchievementPercent?.toString() ?? ''
    data.evdReconciled = input.evdReconciled === null ? '' : input.evdReconciled ? 'true' : 'false'
    data.baSiteRequirementMet = input.baSiteRequirementMet === null ? '' : input.baSiteRequirementMet ? 'true' : 'false'
    data.mpesaFloatSold = input.mpesaFloatSold?.toString() ?? ''
    data.mpesaTargetAchieved = input.mpesaTargetAchieved === null ? '' : input.mpesaTargetAchieved ? 'true' : 'false'
    data.mpesaReconciled = input.mpesaReconciled === null ? '' : input.mpesaReconciled ? 'true' : 'false'
    data.dsaAirtimeAchievementPercent = input.dsaAirtimeAchievementPercent?.toString() ?? ''
    data.mmQoTargetPercent = input.mmQoTargetPercent?.toString() ?? ''
    data.ebuTargetAchieved = input.ebuTargetAchieved === null ? '' : input.ebuTargetAchieved ? 'true' : 'false'
    data.ebuRevenue = input.ebuRevenue?.toString() ?? ''
    data.ebuAverageTopup = input.ebuAverageTopup?.toString() ?? ''
    data.ebuFirstMonthLeapfrogRevenue = input.ebuFirstMonthLeapfrogRevenue?.toString() ?? ''
    data.notes = input.notes ?? ''
    setEditData(data)
  }

  function cancelEdit() { setEditingId(null); setEditData({}) }

  async function saveEdit(input: PerformanceInput) {
    const body: Record<string, unknown> = {}
    if (editData.qgaAchievementPercent !== '') body.qgaAchievementPercent = parseFloat(editData.qgaAchievementPercent)
    if (editData.qgaCount !== '') body.qgaCount = parseInt(editData.qgaCount, 10)
    if (editData.evdAchievementPercent !== '') body.evdAchievementPercent = parseFloat(editData.evdAchievementPercent)
    if (editData.evdReconciled !== '') body.evdReconciled = editData.evdReconciled === 'true'
    if (editData.baSiteRequirementMet !== '') body.baSiteRequirementMet = editData.baSiteRequirementMet === 'true'
    if (editData.mpesaFloatSold !== '') body.mpesaFloatSold = parseFloat(editData.mpesaFloatSold)
    if (editData.mpesaTargetAchieved !== '') body.mpesaTargetAchieved = editData.mpesaTargetAchieved === 'true'
    if (editData.mpesaReconciled !== '') body.mpesaReconciled = editData.mpesaReconciled === 'true'
    if (editData.dsaAirtimeAchievementPercent !== '') body.dsaAirtimeAchievementPercent = parseFloat(editData.dsaAirtimeAchievementPercent)
    if (editData.mmQoTargetPercent !== '') body.mmQoTargetPercent = parseFloat(editData.mmQoTargetPercent)
    if (editData.ebuTargetAchieved !== '') body.ebuTargetAchieved = editData.ebuTargetAchieved === 'true'
    if (editData.ebuRevenue !== '') body.ebuRevenue = parseFloat(editData.ebuRevenue)
    if (editData.ebuAverageTopup !== '') body.ebuAverageTopup = parseFloat(editData.ebuAverageTopup)
    if (editData.ebuFirstMonthLeapfrogRevenue !== '') body.ebuFirstMonthLeapfrogRevenue = parseFloat(editData.ebuFirstMonthLeapfrogRevenue)
    body.notes = editData.notes || null

    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${input.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); setEditData({}); fetchInputs() }
      else { const j = await res.json(); alert(j.error || 'Failed to update') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleAddInput(e: React.FormEvent) {
    e.preventDefault()
    setAddFormError('')
    if (!addFormData.shopLocationId) { setAddFormError('Shop is required'); return }
    setActionLoading(true)
    try {
      const body: Record<string, unknown> = { shopLocationId: addFormData.shopLocationId }
      if (addFormData.qgaAchievementPercent) body.qgaAchievementPercent = parseFloat(addFormData.qgaAchievementPercent)
      if (addFormData.qgaCount) body.qgaCount = parseInt(addFormData.qgaCount, 10)
      if (addFormData.evdAchievementPercent) body.evdAchievementPercent = parseFloat(addFormData.evdAchievementPercent)
      if (addFormData.evdReconciled === 'true') body.evdReconciled = true
      if (addFormData.baSiteRequirementMet === 'true') body.baSiteRequirementMet = true
      if (addFormData.mpesaFloatSold) body.mpesaFloatSold = parseFloat(addFormData.mpesaFloatSold)
      if (addFormData.mpesaTargetAchieved === 'true') body.mpesaTargetAchieved = true
      if (addFormData.mpesaReconciled === 'true') body.mpesaReconciled = true
      if (addFormData.dsaAirtimeAchievementPercent) body.dsaAirtimeAchievementPercent = parseFloat(addFormData.dsaAirtimeAchievementPercent)
      if (addFormData.mmQoTargetPercent) body.mmQoTargetPercent = parseFloat(addFormData.mmQoTargetPercent)
      if (addFormData.ebuTargetAchieved === 'true') body.ebuTargetAchieved = true
      if (addFormData.ebuRevenue) body.ebuRevenue = parseFloat(addFormData.ebuRevenue)
      if (addFormData.ebuAverageTopup) body.ebuAverageTopup = parseFloat(addFormData.ebuAverageTopup)
      if (addFormData.ebuFirstMonthLeapfrogRevenue) body.ebuFirstMonthLeapfrogRevenue = parseFloat(addFormData.ebuFirstMonthLeapfrogRevenue)
      if (addFormData.notes) body.notes = addFormData.notes

      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) { setShowAddForm(false); setAddFormData({}); fetchInputs() }
      else { const j = await res.json(); setAddFormError(j.error || 'Failed to add input') }
    } catch { setAddFormError('Network error') }
    finally { setActionLoading(false) }
  }

  const canEdit = (s: string) => s === 'DRAFT' || s === 'RETURNED'
  const canSubmit = (s: string) => s === 'DRAFT' || s === 'RETURNED'
  const canReview = (s: string) => s === 'SUBMITTED' || s === 'RETURNED'

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Inputs</h1>
          <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option value="">All Statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="ACCEPTED">Accepted</option>
            <option value="REJECTED">Rejected</option>
            <option value="RETURNED">Returned</option>
            <option value="LOCKED">Locked</option>
          </select>
          <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">+ Add Input</button>
        </div>
      </div>

      {showAddForm && (
        <div className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Add New Input</h3>
          {addFormError && <p className="text-red-500 text-sm mb-2">{addFormError}</p>}
          <form onSubmit={handleAddInput} className="grid grid-cols-3 gap-2 text-sm">
            <input name="shopLocationId" placeholder="Shop Location ID" value={addFormData.shopLocationId || ''} onChange={e => setAddFormData(f => ({ ...f, shopLocationId: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="qgaAchievementPercent" placeholder="QGA %" value={addFormData.qgaAchievementPercent || ''} onChange={e => setAddFormData(f => ({ ...f, qgaAchievementPercent: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="qgaCount" placeholder="QGA Count" value={addFormData.qgaCount || ''} onChange={e => setAddFormData(f => ({ ...f, qgaCount: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="evdAchievementPercent" placeholder="EVD %" value={addFormData.evdAchievementPercent || ''} onChange={e => setAddFormData(f => ({ ...f, evdAchievementPercent: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="mpesaFloatSold" placeholder="M-PESA Float" value={addFormData.mpesaFloatSold || ''} onChange={e => setAddFormData(f => ({ ...f, mpesaFloatSold: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="dsaAirtimeAchievementPercent" placeholder="DSA %" value={addFormData.dsaAirtimeAchievementPercent || ''} onChange={e => setAddFormData(f => ({ ...f, dsaAirtimeAchievementPercent: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="mmQoTargetPercent" placeholder="MM QO %" value={addFormData.mmQoTargetPercent || ''} onChange={e => setAddFormData(f => ({ ...f, mmQoTargetPercent: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="ebuRevenue" placeholder="EBU Revenue" value={addFormData.ebuRevenue || ''} onChange={e => setAddFormData(f => ({ ...f, ebuRevenue: e.target.value }))} className="border rounded px-2 py-1" />
            <input name="ebuAverageTopup" placeholder="EBU Avg Top-Up" value={addFormData.ebuAverageTopup || ''} onChange={e => setAddFormData(f => ({ ...f, ebuAverageTopup: e.target.value }))} className="border rounded px-2 py-1" />
            <textarea name="notes" placeholder="Notes" value={addFormData.notes || ''} onChange={e => setAddFormData(f => ({ ...f, notes: e.target.value }))} className="border rounded px-2 py-1 col-span-2" rows={1} />
            <div className="flex gap-2 items-end">
              <button type="submit" disabled={actionLoading} className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50">Save</button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddFormError('') }} className="px-3 py-1 border rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {loading ? <p>Loading inputs...</p> : error ? <p className="text-red-600">{error}<button onClick={fetchInputs} className="text-blue-600 underline ml-2">Retry</button></p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left">Shop Code</th>
                <th className="border p-1 text-left">Shop Name</th>
                <th className="border p-1 text-left">Manager</th>
                <th className="border p-1 text-left">Criteria</th>
                <th className="border p-1 text-left">Corridor</th>
                <th className="border p-1 text-left">QGA %</th>
                <th className="border p-1 text-left">QGA Cnt</th>
                <th className="border p-1 text-left">EVD %</th>
                <th className="border p-1 text-left">EVD Rec</th>
                <th className="border p-1 text-left">BA/Site</th>
                <th className="border p-1 text-left">M-PESA</th>
                <th className="border p-1 text-left">M-PESA Tgt</th>
                <th className="border p-1 text-left">M-PESA Rec</th>
                <th className="border p-1 text-left">DSA %</th>
                <th className="border p-1 text-left">MM QO %</th>
                <th className="border p-1 text-left">EBU Tgt</th>
                <th className="border p-1 text-left">EBU Rev</th>
                <th className="border p-1 text-left">EBU TopUp</th>
                <th className="border p-1 text-left">EBU 1stMo</th>
                <th className="border p-1 text-left">Status</th>
                <th className="border p-1 text-left">Notes</th>
                <th className="border p-1 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map(inp => (
                <tr key={inp.id} className="hover:bg-gray-50">
                  <td className="border p-1 font-mono">{inp.shopLocation?.code || '-'}</td>
                  <td className="border p-1">{inp.shopLocation?.name || '-'}</td>
                  <td className="border p-1">{inp.shopManager?.fullName || '-'}</td>
                  <td className="border p-1">{inp.shopCriteria || '-'}</td>
                  <td className="border p-1">{inp.corridorType || '-'}</td>
                  {editingId === inp.id ? (
                    <>
                      <td className="border p-1"><input name="qgaAchievementPercent" value={editData.qgaAchievementPercent || ''} onChange={e => setEditData(f => ({ ...f, qgaAchievementPercent: e.target.value }))} className="w-12 border rounded px-1" /></td>
                      <td className="border p-1"><input name="qgaCount" value={editData.qgaCount || ''} onChange={e => setEditData(f => ({ ...f, qgaCount: e.target.value }))} className="w-12 border rounded px-1" /></td>
                      <td className="border p-1"><input name="evdAchievementPercent" value={editData.evdAchievementPercent || ''} onChange={e => setEditData(f => ({ ...f, evdAchievementPercent: e.target.value }))} className="w-12 border rounded px-1" /></td>
                      <td className="border p-1"><select name="evdReconciled" value={editData.evdReconciled || ''} onChange={e => setEditData(f => ({ ...f, evdReconciled: e.target.value }))} className="w-14 border rounded"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                      <td className="border p-1"><select name="baSiteRequirementMet" value={editData.baSiteRequirementMet || ''} onChange={e => setEditData(f => ({ ...f, baSiteRequirementMet: e.target.value }))} className="w-14 border rounded"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                      <td className="border p-1"><input name="mpesaFloatSold" value={editData.mpesaFloatSold || ''} onChange={e => setEditData(f => ({ ...f, mpesaFloatSold: e.target.value }))} className="w-14 border rounded px-1" /></td>
                      <td className="border p-1"><select name="mpesaTargetAchieved" value={editData.mpesaTargetAchieved || ''} onChange={e => setEditData(f => ({ ...f, mpesaTargetAchieved: e.target.value }))} className="w-14 border rounded"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                      <td className="border p-1"><select name="mpesaReconciled" value={editData.mpesaReconciled || ''} onChange={e => setEditData(f => ({ ...f, mpesaReconciled: e.target.value }))} className="w-14 border rounded"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                      <td className="border p-1"><input name="dsaAirtimeAchievementPercent" value={editData.dsaAirtimeAchievementPercent || ''} onChange={e => setEditData(f => ({ ...f, dsaAirtimeAchievementPercent: e.target.value }))} className="w-12 border rounded px-1" /></td>
                      <td className="border p-1"><input name="mmQoTargetPercent" value={editData.mmQoTargetPercent || ''} onChange={e => setEditData(f => ({ ...f, mmQoTargetPercent: e.target.value }))} className="w-12 border rounded px-1" /></td>
                      <td className="border p-1"><select name="ebuTargetAchieved" value={editData.ebuTargetAchieved || ''} onChange={e => setEditData(f => ({ ...f, ebuTargetAchieved: e.target.value }))} className="w-14 border rounded"><option value="">-</option><option value="true">Yes</option><option value="false">No</option></select></td>
                      <td className="border p-1"><input name="ebuRevenue" value={editData.ebuRevenue || ''} onChange={e => setEditData(f => ({ ...f, ebuRevenue: e.target.value }))} className="w-14 border rounded px-1" /></td>
                      <td className="border p-1"><input name="ebuAverageTopup" value={editData.ebuAverageTopup || ''} onChange={e => setEditData(f => ({ ...f, ebuAverageTopup: e.target.value }))} className="w-14 border rounded px-1" /></td>
                      <td className="border p-1"><input name="ebuFirstMonthLeapfrogRevenue" value={editData.ebuFirstMonthLeapfrogRevenue || ''} onChange={e => setEditData(f => ({ ...f, ebuFirstMonthLeapfrogRevenue: e.target.value }))} className="w-14 border rounded px-1" /></td>
                      <td className="border p-1"><span style={{ backgroundColor: inputStatusColors[inp.inputStatus] || '#6b7280', color: '#fff' }} className="px-1 rounded text-xs">{inp.inputStatus}</span></td>
                      <td className="border p-1"><input name="notes" value={editData.notes || ''} onChange={e => setEditData(f => ({ ...f, notes: e.target.value }))} className="w-20 border rounded px-1" /></td>
                      <td className="border p-1">
                        <div className="flex gap-1">
                          <button onClick={() => saveEdit(inp)} disabled={actionLoading} className="text-green-600 text-xs underline">Save</button>
                          <button onClick={cancelEdit} className="text-gray-500 text-xs underline">Cancel</button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="border p-1">{inp.qgaAchievementPercent ?? '-'}</td>
                      <td className="border p-1">{inp.qgaCount ?? '-'}</td>
                      <td className="border p-1">{inp.evdAchievementPercent ?? '-'}</td>
                      <td className="border p-1">{inp.evdReconciled === null ? '-' : inp.evdReconciled ? 'Yes' : 'No'}</td>
                      <td className="border p-1">{inp.baSiteRequirementMet === null ? '-' : inp.baSiteRequirementMet ? 'Yes' : 'No'}</td>
                      <td className="border p-1">{inp.mpesaFloatSold ?? '-'}</td>
                      <td className="border p-1">{inp.mpesaTargetAchieved === null ? '-' : inp.mpesaTargetAchieved ? 'Yes' : 'No'}</td>
                      <td className="border p-1">{inp.mpesaReconciled === null ? '-' : inp.mpesaReconciled ? 'Yes' : 'No'}</td>
                      <td className="border p-1">{inp.dsaAirtimeAchievementPercent ?? '-'}</td>
                      <td className="border p-1">{inp.mmQoTargetPercent ?? '-'}</td>
                      <td className="border p-1">{inp.ebuTargetAchieved === null ? '-' : inp.ebuTargetAchieved ? 'Yes' : 'No'}</td>
                      <td className="border p-1">{inp.ebuRevenue ?? '-'}</td>
                      <td className="border p-1">{inp.ebuAverageTopup ?? '-'}</td>
                      <td className="border p-1">{inp.ebuFirstMonthLeapfrogRevenue ?? '-'}</td>
                      <td className="border p-1">
                        <span style={{ backgroundColor: inputStatusColors[inp.inputStatus] || '#6b7280', color: '#fff' }} className="px-1 rounded text-xs">{inp.inputStatus}</span>
                      </td>
                      <td className="border p-1 text-xs max-w-[80px] truncate">{inp.notes || '-'}</td>
                      <td className="border p-1">
                        <div className="flex gap-1 flex-wrap">
                          {canEdit(inp.inputStatus) && <button onClick={() => startEdit(inp)} disabled={actionLoading} className="text-blue-600 text-xs underline">Edit</button>}
                          {canSubmit(inp.inputStatus) && <button onClick={() => handleAction(inp.id, 'submit')} disabled={actionLoading} className="text-green-600 text-xs underline">Submit</button>}
                          {canReview(inp.inputStatus) && <button onClick={() => handleAction(inp.id, 'accept')} disabled={actionLoading} className="text-green-600 text-xs underline">Accept</button>}
                          {canReview(inp.inputStatus) && <button onClick={() => handleAction(inp.id, 'return')} disabled={actionLoading} className="text-yellow-600 text-xs underline">Return</button>}
                          {canReview(inp.inputStatus) && <button onClick={() => handleAction(inp.id, 'reject')} disabled={actionLoading} className="text-red-600 text-xs underline">Reject</button>}
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {inputs.length === 0 && <p className="text-center text-gray-400 mt-4">No inputs found.</p>}
        </div>
      )}
    </div>
  )
}
