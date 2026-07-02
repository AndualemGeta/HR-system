'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function UpdateCriteriaPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [shopName, setShopName] = useState('')
  const [criteria, setCriteria] = useState('UNASSIGNED')
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split('T')[0])
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/shops/${id}`).then(r => r.json()).then(shopRes => {
      setShopName(shopRes.data?.name || 'Shop')
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!reason.trim()) { setError('Reason is required'); return }
    setSaving(true)
    setError('')

    const body: Record<string, unknown> = { criteria, effectiveFrom, reason }

    const res = await fetch(`/api/shops/${id}/criteria-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to update criteria'); setSaving(false); return }
    router.push(`/shops/${id}`)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-1">Update Shop Criteria</h1>
      <p className="text-gray-500 mb-4">{shopName}</p>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Criteria *</label>
          <select value={criteria} onChange={e => setCriteria(e.target.value)} className="w-full border rounded p-2">
            <option value="GOLD">Gold</option>
            <option value="SILVER">Silver</option>
            <option value="BRONZE">Bronze</option>
            <option value="AT_RISK">At Risk</option>
            <option value="UNASSIGNED">Unassigned</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Effective From *</label>
          <input type="date" value={effectiveFrom} onChange={e => setEffectiveFrom(e.target.value)} required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Reason *</label>
          <textarea value={reason} onChange={e => setReason(e.target.value)} required className="w-full border rounded p-2" rows={3} placeholder="Why is this criteria changing?" />
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="bg-purple-600 text-white px-4 py-2 rounded">{saving ? 'Updating...' : 'Update Criteria'}</button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        </div>
      </form>
    </div>
  )
}
