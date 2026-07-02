'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface LocationOption { id: string; name: string; code: string; type: string; parentId: string | null }
interface EmployeeOption { id: string; employeeId: string; fullName: string }

export default function NewShopPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [regionId, setRegionId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [shopManagerId, setShopManagerId] = useState('')
  const [corridorType, setCorridorType] = useState('UNKNOWN')
  const [isIncentiveEligible, setIsIncentiveEligible] = useState(false)
  const [regions, setRegions] = useState<LocationOption[]>([])
  const [areas, setAreas] = useState<LocationOption[]>([])
  const [shopManagers, setShopManagers] = useState<EmployeeOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/locations?type=REGION').then(r => r.json()).then(d => setRegions(d.data || [])).catch(() => {})
    fetch('/api/employees?role=SHOP_MANAGER&status=ACTIVE').then(r => r.json()).then(d => setShopManagers(d.data?.items || [])).catch(() => {})
  }, [])

  useEffect(() => {
    if (regionId) {
      setAreaId('')
      fetch(`/api/locations?type=AREA&parentId=${regionId}`).then(r => r.json()).then(d => {
        if (d.data) setAreas(d.data)
        else if (d.error) setError(d.error)
      }).catch(() => setError('Failed to load areas'))
    }
  }, [regionId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = { name, code, regionId, corridorType, isIncentiveEligible }
    if (areaId) body.areaId = areaId
    if (shopManagerId) body.shopManagerId = shopManagerId

    const res = await fetch('/api/shops', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create shop'); setSaving(false); return }
    router.push('/shops')
  }

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Create Shop</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Shop Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Shop Code *</label>
          <input value={code} onChange={e => setCode(e.target.value)} required className="w-full border rounded p-2 font-mono" />
        </div>
        <div>
          <label className="block text-sm font-medium">Region</label>
          <select value={regionId} onChange={e => setRegionId(e.target.value)} className="w-full border rounded p-2">
            <option value="">Select region...</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name} ({r.code})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Area</label>
          <select value={areaId} onChange={e => setAreaId(e.target.value)} className="w-full border rounded p-2" disabled={!regionId}>
            <option value="">Select area...</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name} ({a.code})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Shop Manager</label>
          <select value={shopManagerId} onChange={e => setShopManagerId(e.target.value)} className="w-full border rounded p-2">
            <option value="">Select manager...</option>
            {shopManagers.map(m => <option key={m.id} value={m.id}>{m.fullName} ({m.employeeId})</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Corridor Type</label>
          <select value={corridorType} onChange={e => setCorridorType(e.target.value)} className="w-full border rounded p-2">
            <option value="UNKNOWN">Unknown</option>
            <option value="CORRIDOR">Corridor</option>
            <option value="NON_CORRIDOR">Non-Corridor</option>
          </select>
        </div>
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isIncentiveEligible} onChange={e => setIsIncentiveEligible(e.target.checked)} id="incentive" />
          <label htmlFor="incentive" className="text-sm">Incentive Eligible</label>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">{saving ? 'Creating...' : 'Create Shop'}</button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        </div>
      </form>
    </div>
  )
}
