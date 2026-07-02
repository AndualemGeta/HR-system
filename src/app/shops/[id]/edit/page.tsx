'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface LocationOption { id: string; name: string; code: string; type: string; parentId: string | null }
interface EmployeeOption { id: string; employeeId: string; fullName: string }

export default function EditShopPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [name, setName] = useState('')
  const [regionId, setRegionId] = useState('')
  const [areaId, setAreaId] = useState('')
  const [clusterId, setClusterId] = useState('')
  const [shopManagerId, setShopManagerId] = useState('')
  const [corridorType, setCorridorType] = useState('UNKNOWN')
  const [isIncentiveEligible, setIsIncentiveEligible] = useState(false)
  const [isActive, setIsActive] = useState(true)
  const [regions, setRegions] = useState<LocationOption[]>([])
  const [areas, setAreas] = useState<LocationOption[]>([])
  const [clusters, setClusters] = useState<LocationOption[]>([])
  const [shopManagers, setShopManagers] = useState<EmployeeOption[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/locations?type=REGION').then(r => r.json()),
      fetch('/api/employees?role=SHOP_MANAGER&status=ACTIVE').then(r => r.json()),
      fetch(`/api/shops/${id}`).then(r => r.json()),
    ]).then(([regionsRes, managersRes, shopRes]) => {
      setRegions(regionsRes.data || [])
      setShopManagers(managersRes.data || [])
      const shop = shopRes.data
      if (shop) {
        setName(shop.name)
        setCorridorType(shop.shopProfile?.corridorType || 'UNKNOWN')
        setIsIncentiveEligible(shop.shopProfile?.isIncentiveEligible || false)
        setIsActive(shop.isActive)
        setShopManagerId(shop.shopProfile?.defaultShopManager?.id || '')

        const p = shop.parent
        if (p?.type === 'CLUSTER') {
          setClusterId(p.id)
          fetch(`/api/locations?type=AREA&parentId=${p.parentId}`).then(r => r.json()).then(d => setAreas(d.data || []))
          fetch(`/api/locations?type=CLUSTER&parentId=${p.parentId}`).then(r => r.json()).then(d => setClusters(d.data || []))
          setAreaId(p.parentId || '')
          if (p.parent?.parentId) {
            setRegionId(p.parent.parentId)
          }
        } else if (p?.type === 'AREA') {
          setAreaId(p.id)
          fetch(`/api/locations?type=AREA&parentId=${p.parentId}`).then(r => r.json()).then(d => setAreas(d.data || []))
          fetch(`/api/locations?type=CLUSTER&parentId=${p.id}`).then(r => r.json()).then(d => setClusters(d.data || []))
          if (p.parentId) setRegionId(p.parentId)
        } else if (p?.type === 'REGION') {
          setRegionId(p.id)
          fetch(`/api/locations?type=AREA&parentId=${p.id}`).then(r => r.json()).then(d => setAreas(d.data || []))
        }
      }
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (regionId) {
      fetch(`/api/locations?type=AREA&parentId=${regionId}`).then(r => r.json()).then(d => setAreas(d.data || []))
    }
  }, [regionId])

  useEffect(() => {
    if (areaId) {
      fetch(`/api/locations?type=CLUSTER&parentId=${areaId}`).then(r => r.json()).then(d => setClusters(d.data || []))
    }
  }, [areaId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError('')
    const body: Record<string, unknown> = { name, regionId, corridorType, isIncentiveEligible, isActive, shopManagerId: shopManagerId || null }
    if (areaId) body.areaId = areaId
    if (clusterId) body.clusterId = clusterId

    const res = await fetch(`/api/shops/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to update shop'); setSaving(false); return }
    router.push(`/shops/${id}`)
  }

  if (loading) return <div className="p-6">Loading...</div>

  return (
    <div className="p-6 max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-4">Edit Shop</h1>
      {error && <div className="bg-red-100 text-red-700 p-3 rounded mb-4">{error}</div>}
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Shop Name *</label>
          <input value={name} onChange={e => setName(e.target.value)} required className="w-full border rounded p-2" />
        </div>
        <div>
          <label className="block text-sm font-medium">Region</label>
          <select value={regionId} onChange={e => { setRegionId(e.target.value); setAreaId(''); setClusterId('') }} className="w-full border rounded p-2">
            <option value="">Select region...</option>
            {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Area</label>
          <select value={areaId} onChange={e => { setAreaId(e.target.value); setClusterId('') }} className="w-full border rounded p-2">
            <option value="">Select area...</option>
            {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">Cluster</label>
          <select value={clusterId} onChange={e => setClusterId(e.target.value)} className="w-full border rounded p-2">
            <option value="">Select cluster...</option>
            {clusters.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
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
        <div className="flex items-center gap-2">
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} id="active" />
          <label htmlFor="active" className="text-sm">Active</label>
        </div>
        <div className="flex gap-2 pt-2">
          <button type="submit" disabled={saving} className="bg-blue-600 text-white px-4 py-2 rounded">{saving ? 'Saving...' : 'Save Changes'}</button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        </div>
      </form>
    </div>
  )
}
