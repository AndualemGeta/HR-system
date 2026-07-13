'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface InputConfig {
  id: string
  inputCode: string
  inputLabel: string
  ownerDepartment: string
  ownerRole: string
  inputType: string
  allowedValues: string | null
  required: boolean
  blocksCalc: boolean
  blocksPayroll: boolean
  min: number | null
  max: number | null
  displayOrder: number
  isActive: boolean
  helpText: string | null
}

interface User {
  permissions: string[]
}

export default function InputConfigurationPage() {
  const router = useRouter()
  const [configs, setConfigs] = useState<InputConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Partial<InputConfig>>({})
  const [saving, setSaving] = useState(false)
  const [reorderMode, setReorderMode] = useState(false)
  const [reorderMap, setReorderMap] = useState<Record<string, number>>({})
  const [reorderSaving, setReorderSaving] = useState(false)

  const canManage = user?.permissions?.includes('shopManagerIncentive.manageInputConfig')

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetchConfigs(),
    ])
  }, [])

  async function fetchConfigs() {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/shop-manager-incentives/input-config')
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to load'); setConfigs([]) }
      else setConfigs(json.data || [])
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  function startEdit(c: InputConfig) {
    setEditingId(c.id)
    setEditForm({ ...c })
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm({})
  }

  async function handleSave(id: string) {
    setSaving(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/input-config/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      })
      const json = await res.json()
      if (!res.ok) { alert(json.error || 'Failed to save'); return }
      await fetchConfigs()
      cancelEdit()
    } catch { alert('Network error') }
    finally { setSaving(false) }
  }

  async function handleToggleActive(c: InputConfig) {
    const endpoint = c.isActive ? 'deactivate' : 'activate'
    try {
      const res = await fetch(`/api/shop-manager-incentives/input-config/${c.id}/${endpoint}`, { method: 'POST' })
      if (res.ok) await fetchConfigs()
      else { const json = await res.json(); alert(json.error || `Failed to ${endpoint}`) }
    } catch { alert('Network error') }
  }

  function enterReorder() {
    setReorderMode(true)
    const map: Record<string, number> = {}
    configs.forEach(c => { map[c.id] = c.displayOrder })
    setReorderMap(map)
  }

  function cancelReorder() {
    setReorderMode(false)
    setReorderMap({})
  }

  async function saveReorder() {
    setReorderSaving(true)
    try {
      const res = await fetch('/api/shop-manager-incentives/input-config/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orders: reorderMap }),
      })
      if (res.ok) { await fetchConfigs(); setReorderMode(false); setReorderMap({}) }
      else { const json = await res.json(); alert(json.error || 'Failed to reorder') }
    } catch { alert('Network error') }
    finally { setReorderSaving(false) }
  }

  if (loading) return <div className="p-6"><p>Loading input configuration...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">Error: {error}</p><button onClick={fetchConfigs} className="text-blue-600 underline mt-2">Retry</button></div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/shop-manager-incentives')} className="text-blue-600 underline text-sm">&larr; Back</button>
          <h1 className="text-2xl font-bold">Input Configuration</h1>
        </div>
        <div className="flex gap-2">
          {canManage && !reorderMode && (
            <button onClick={enterReorder} className="px-4 py-2 border rounded text-sm">Reorder</button>
          )}
          {canManage && reorderMode && (
            <>
              <button onClick={saveReorder} disabled={reorderSaving} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">Save Order</button>
              <button onClick={cancelReorder} className="px-4 py-2 border rounded text-sm">Cancel</button>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border p-2 text-left">Input Code</th>
              <th className="border p-2 text-left">Input Label</th>
              <th className="border p-2 text-left">Owner Department</th>
              <th className="border p-2 text-left">Owner Role</th>
              <th className="border p-2 text-left">Input Type</th>
              <th className="border p-2 text-left">Allowed Values</th>
              <th className="border p-2 text-left">Required</th>
              <th className="border p-2 text-left">Blocks Calc</th>
              <th className="border p-2 text-left">Blocks Payroll</th>
              <th className="border p-2 text-left">Min</th>
              <th className="border p-2 text-left">Max</th>
              <th className="border p-2 text-left">Display Order</th>
              <th className="border p-2 text-left">Active</th>
              <th className="border p-2 text-left">Help Text</th>
              {canManage && !reorderMode && <th className="border p-2 text-left">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {configs.map(c => editingId === c.id && !reorderMode ? (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.inputCode || ''} onChange={e => setEditForm(f => ({ ...f, inputCode: e.target.value }))} /></td>
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.inputLabel || ''} onChange={e => setEditForm(f => ({ ...f, inputLabel: e.target.value }))} /></td>
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.ownerDepartment || ''} onChange={e => setEditForm(f => ({ ...f, ownerDepartment: e.target.value }))} /></td>
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.ownerRole || ''} onChange={e => setEditForm(f => ({ ...f, ownerRole: e.target.value }))} /></td>
                <td className="border p-2">
                  <select className="border rounded px-1 py-0.5 text-sm" value={editForm.inputType || ''} onChange={e => setEditForm(f => ({ ...f, inputType: e.target.value }))}>
                    <option value="TEXT">TEXT</option>
                    <option value="NUMBER">NUMBER</option>
                    <option value="BOOLEAN">BOOLEAN</option>
                    <option value="SELECT">SELECT</option>
                    <option value="MULTI_SELECT">MULTI_SELECT</option>
                    <option value="DATE">DATE</option>
                  </select>
                </td>
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.allowedValues || ''} onChange={e => setEditForm(f => ({ ...f, allowedValues: e.target.value }))} /></td>
                <td className="border p-2 text-center"><input type="checkbox" checked={!!editForm.required} onChange={e => setEditForm(f => ({ ...f, required: e.target.checked }))} /></td>
                <td className="border p-2 text-center"><input type="checkbox" checked={!!editForm.blocksCalc} onChange={e => setEditForm(f => ({ ...f, blocksCalc: e.target.checked }))} /></td>
                <td className="border p-2 text-center"><input type="checkbox" checked={!!editForm.blocksPayroll} onChange={e => setEditForm(f => ({ ...f, blocksPayroll: e.target.checked }))} /></td>
                <td className="border p-2"><input type="number" className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.min ?? ''} onChange={e => setEditForm(f => ({ ...f, min: e.target.value === '' ? null : Number(e.target.value) }))} /></td>
                <td className="border p-2"><input type="number" className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.max ?? ''} onChange={e => setEditForm(f => ({ ...f, max: e.target.value === '' ? null : Number(e.target.value) }))} /></td>
                <td className="border p-2">{c.displayOrder}</td>
                <td className="border p-2 text-center"><input type="checkbox" checked={!!editForm.isActive} onChange={e => setEditForm(f => ({ ...f, isActive: e.target.checked }))} /></td>
                <td className="border p-2"><input className="w-full border rounded px-1 py-0.5 text-sm" value={editForm.helpText || ''} onChange={e => setEditForm(f => ({ ...f, helpText: e.target.value }))} /></td>
                <td className="border p-2">
                  <div className="flex gap-1">
                    <button onClick={() => handleSave(c.id)} disabled={saving} className="text-green-600 text-xs underline disabled:opacity-50">Save</button>
                    <button onClick={cancelEdit} className="text-red-600 text-xs underline">Cancel</button>
                  </div>
                </td>
              </tr>
            ) : (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="border p-2">{c.inputCode}</td>
                <td className="border p-2">{c.inputLabel}</td>
                <td className="border p-2">{c.ownerDepartment}</td>
                <td className="border p-2">{c.ownerRole}</td>
                <td className="border p-2">{c.inputType}</td>
                <td className="border p-2">{c.allowedValues || '-'}</td>
                <td className="border p-2 text-center">{c.required ? 'Yes' : 'No'}</td>
                <td className="border p-2 text-center">{c.blocksCalc ? 'Yes' : 'No'}</td>
                <td className="border p-2 text-center">{c.blocksPayroll ? 'Yes' : 'No'}</td>
                <td className="border p-2">{c.min ?? '-'}</td>
                <td className="border p-2">{c.max ?? '-'}</td>
                <td className="border p-2">
                  {reorderMode ? (
                    <input type="number" className="w-16 border rounded px-1 py-0.5 text-sm" value={reorderMap[c.id] ?? c.displayOrder} onChange={e => setReorderMap(m => ({ ...m, [c.id]: Number(e.target.value) }))} />
                  ) : (
                    c.displayOrder
                  )}
                </td>
                <td className="border p-2 text-center">{c.isActive ? 'Active' : 'Inactive'}</td>
                <td className="border p-2 max-w-xs truncate">{c.helpText || '-'}</td>
                {canManage && !reorderMode && (
                  <td className="border p-2">
                    <div className="flex gap-1">
                      <button onClick={() => startEdit(c)} className="text-blue-600 text-xs underline">Edit</button>
                      <button onClick={() => handleToggleActive(c)} className={`text-xs underline ${c.isActive ? 'text-orange-600' : 'text-green-600'}`}>
                        {c.isActive ? 'Deactivate' : 'Activate'}
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
        {configs.length === 0 && <p className="text-center text-gray-400 mt-4">No input configurations found.</p>}
      </div>
    </div>
  )
}
