'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Eye, Edit3, Activity, Ban, CheckCircle, Filter } from 'lucide-react'

interface ShopManager { id: string; employeeId: string; fullName: string }
interface ShopParent { id: string; name: string; code: string; type: string; parentId?: string | null; parent?: ShopParent | null }
interface ShopProfile { corridorType: string; isIncentiveEligible: boolean; defaultShopManager: ShopManager | null }
interface Shop { id: string; name: string; code: string; type: string; parentId: string | null; isActive: boolean; parent: ShopParent | null; shopProfile: ShopProfile | null; currentCriteria: string }

export default function ShopsPage() {
  const router = useRouter()
  const [shops, setShops] = useState<Shop[]>([])
  const [loading, setLoading] = useState(true)
  const [regionFilter, setRegionFilter] = useState('')
  const [areaFilter, setAreaFilter] = useState('')
  const [criteriaFilter, setCriteriaFilter] = useState('')
  const [corridorFilter, setCorridorFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState('')
  const [incentiveFilter, setIncentiveFilter] = useState('')

  useEffect(() => { loadShops() }, [])

  async function loadShops() {
    setLoading(true)
    const res = await fetch('/api/shops')
    const json = await res.json()
    setShops(json.data || [])
    setLoading(false)
  }

  function getRegion(shop: Shop): string {
    const p = shop.parent
    if (!p) return '-'
    if (p.type === 'REGION') return p.name
    if (p.parent?.type === 'REGION') return p.parent.name
    if (p.parent?.parent?.type === 'REGION') return p.parent.parent.name
    return p.name
  }

  function getArea(shop: Shop): string {
    const p = shop.parent
    if (!p) return '-'
    if (p.type === 'AREA') return p.name
    if (p.parent?.type === 'AREA') return p.parent.name
    return '-'
  }

  function getCluster(shop: Shop): string {
    const p = shop.parent
    if (!p) return '-'
    if (p.type === 'CLUSTER') return p.name
    return '-'
  }

  const filteredShops = shops.filter(s => {
    if (regionFilter && !getRegion(s).toLowerCase().includes(regionFilter.toLowerCase())) return false
    if (areaFilter && !getArea(s).toLowerCase().includes(areaFilter.toLowerCase())) return false
    if (criteriaFilter && s.currentCriteria !== criteriaFilter) return false
    if (corridorFilter && s.shopProfile?.corridorType !== corridorFilter) return false
    if (activeFilter === 'active' && !s.isActive) return false
    if (activeFilter === 'inactive' && s.isActive) return false
    if (incentiveFilter === 'eligible' && !s.shopProfile?.isIncentiveEligible) return false
    if (incentiveFilter === 'not-eligible' && s.shopProfile?.isIncentiveEligible) return false
    return true
  })

  const criteriaColors: Record<string, string> = { GOLD: '#f59e0b', SILVER: '#94a3b8', BRONZE: '#b45309', AT_RISK: '#ef4444', UNASSIGNED: '#6b7280' }

  async function handleDeactivate(id: string) {
    await fetch(`/api/shops/${id}/deactivate`, { method: 'POST' })
    loadShops()
  }

  async function handleReactivate(id: string) {
    await fetch(`/api/shops/${id}/reactivate`, { method: 'POST' })
    loadShops()
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Shops</h1>
        <button onClick={() => router.push('/shops/new')} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded">
          <Plus size={16} /> New Shop
        </button>
      </div>

      <div className="flex gap-3 mb-4 flex-wrap items-center text-sm">
        <Filter size={16} className="text-gray-400" />
        <input placeholder="Region" value={regionFilter} onChange={e => setRegionFilter(e.target.value)} className="border rounded px-2 py-1 w-32" />
        <input placeholder="Area" value={areaFilter} onChange={e => setAreaFilter(e.target.value)} className="border rounded px-2 py-1 w-32" />
        <select value={criteriaFilter} onChange={e => setCriteriaFilter(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All Criteria</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
          <option value="BRONZE">Bronze</option>
          <option value="AT_RISK">At Risk</option>
          <option value="UNASSIGNED">Unassigned</option>
        </select>
        <select value={corridorFilter} onChange={e => setCorridorFilter(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All Corridor</option>
          <option value="CORRIDOR">Corridor</option>
          <option value="NON_CORRIDOR">Non-Corridor</option>
          <option value="UNKNOWN">Unknown</option>
        </select>
        <select value={activeFilter} onChange={e => setActiveFilter(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <select value={incentiveFilter} onChange={e => setIncentiveFilter(e.target.value)} className="border rounded px-2 py-1">
          <option value="">All Incentive</option>
          <option value="eligible">Eligible</option>
          <option value="not-eligible">Not Eligible</option>
        </select>
      </div>

      {loading ? <p>Loading shops...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-sm">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Code</th>
                <th className="border p-2 text-left">Name</th>
                <th className="border p-2 text-left">Region</th>
                <th className="border p-2 text-left">Area</th>
                <th className="border p-2 text-left">Cluster</th>
                <th className="border p-2 text-left">Manager</th>
                <th className="border p-2 text-left">Corridor</th>
                <th className="border p-2 text-left">Criteria</th>
                <th className="border p-2 text-left">Incentive</th>
                <th className="border p-2 text-left">Active</th>
                <th className="border p-2 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredShops.map(s => (
                <tr key={s.id} className={s.isActive ? '' : 'text-gray-400'}>
                  <td className="border p-2 font-mono">{s.code}</td>
                  <td className="border p-2">{s.name}</td>
                  <td className="border p-2">{getRegion(s)}</td>
                  <td className="border p-2">{getArea(s)}</td>
                  <td className="border p-2">{getCluster(s)}</td>
                  <td className="border p-2">{s.shopProfile?.defaultShopManager?.fullName || '-'}</td>
                  <td className="border p-2">{s.shopProfile?.corridorType || 'UNKNOWN'}</td>
                  <td className="border p-2">
                    <span style={{ color: criteriaColors[s.currentCriteria] || '#000' }} className="font-semibold">
                      {s.currentCriteria}
                    </span>
                  </td>
                  <td className="border p-2">{s.shopProfile?.isIncentiveEligible ? 'Yes' : 'No'}</td>
                  <td className="border p-2">{s.isActive ? 'Active' : 'Inactive'}</td>
                  <td className="border p-2">
                    <div className="flex gap-1">
                      <button onClick={() => router.push(`/shops/${s.id}`)} className="p-1 text-blue-600" title="View"><Eye size={16} /></button>
                      <button onClick={() => router.push(`/shops/${s.id}/edit`)} className="p-1 text-green-600" title="Edit"><Edit3 size={16} /></button>
                      <button onClick={() => router.push(`/shops/${s.id}/criteria`)} className="p-1 text-purple-600" title="Update Criteria"><Activity size={16} /></button>
                      {s.isActive ? (
                        <button onClick={() => handleDeactivate(s.id)} className="p-1 text-red-600" title="Deactivate"><Ban size={16} /></button>
                      ) : (
                        <button onClick={() => handleReactivate(s.id)} className="p-1 text-green-600" title="Reactivate"><CheckCircle size={16} /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredShops.length === 0 && <p className="text-center text-gray-400 mt-4">No shops found.</p>}
        </div>
      )}
    </div>
  )
}
