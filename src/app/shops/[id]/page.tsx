'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ShopParent { id: string; name: string; code: string; type: string; parentId: string | null; parent: ShopParent | null }
interface ShopData {
  id: string; name: string; code: string; type: string; parentId: string | null; isActive: boolean; createdAt: string
  parent: ShopParent | null
  shopProfile: { corridorType: string; isIncentiveEligible: boolean; defaultShopManager: { id: string; employeeId: string; fullName: string; currentRole: string; employmentStatus: string } | null } | null
  currentCriteria: string
  criteriaHistory: { id: string; criteria: string; effectiveFrom: string; effectiveTo: string | null; reason: string | null; updatedBy: { name: string } | null; approvedBy: { name: string } | null }[]
  assignedEmployees: { id: string; employeeId: string; fullName: string; currentRole: string; employmentStatus: string }[]
}

export default function ShopDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [shop, setShop] = useState<ShopData | null>(null)
  const [loading, setLoading] = useState(true)
  const id = params.id as string

  useEffect(() => {
    fetch(`/api/shops/${id}`).then(r => r.json()).then(d => { setShop(d.data); setLoading(false) }).catch(() => setLoading(false))
  }, [id])

  if (loading) return <div className="p-6">Loading...</div>
  if (!shop) return <div className="p-6">Shop not found</div>
  const s = shop as NonNullable<typeof shop>

  const criteriaColors: Record<string, string> = { GOLD: '#f59e0b', SILVER: '#94a3b8', BRONZE: '#b45309', AT_RISK: '#ef4444', UNASSIGNED: '#6b7280' }

  function getHierarchy(): string {
    const parts: string[] = []
    const p = s.parent
    if (p?.parent?.parent) parts.push(`${p.parent.parent.name} (${p.parent.parent.type})`)
    if (p?.parent) parts.push(`${p.parent.name} (${p.parent.type})`)
    if (p) parts.push(`${p.name} (${p.type})`)
    return parts.join(' → ') || '-'
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">{s.name} ({s.code})</h1>
        <div className="flex gap-2">
          <button onClick={() => router.push(`/shops/${id}/edit`)} className="bg-blue-600 text-white px-4 py-2 rounded">Edit</button>
          <button onClick={() => router.push(`/shops/${id}/criteria`)} className="bg-purple-600 text-white px-4 py-2 rounded">Update Criteria</button>
          <button onClick={() => router.push('/shops')} className="px-4 py-2 border rounded">Back</button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Shop Profile</h2>
          <div className="space-y-1 text-sm">
            <p><span className="text-gray-500">Code:</span> {s.code}</p>
            <p><span className="text-gray-500">Status:</span> {s.isActive ? <span className="text-green-600 font-semibold">Active</span> : <span className="text-red-600 font-semibold">Inactive</span>}</p>
            <p><span className="text-gray-500">Hierarchy:</span> {getHierarchy()}</p>
            <p><span className="text-gray-500">Corridor:</span> {s.shopProfile?.corridorType || 'UNKNOWN'}</p>
            <p><span className="text-gray-500">Incentive Eligible:</span> {s.shopProfile?.isIncentiveEligible ? 'Yes' : 'No'}</p>
            <p><span className="text-gray-500">Current Criteria:</span> <span style={{ color: criteriaColors[s.currentCriteria] }} className="font-semibold">{s.currentCriteria}</span></p>
            <p><span className="text-gray-500">Created:</span> {new Date(s.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="border rounded p-4">
          <h2 className="font-semibold mb-2">Shop Manager</h2>
          {s.shopProfile?.defaultShopManager ? (
            <div className="text-sm">
              <p className="font-medium">{s.shopProfile.defaultShopManager.fullName}</p>
              <p className="text-gray-500">{s.shopProfile.defaultShopManager.employeeId}</p>
              <p className="text-gray-500">Role: {s.shopProfile.defaultShopManager.currentRole}</p>
              <p className="text-gray-500">Status: {s.shopProfile.defaultShopManager.employmentStatus}</p>
            </div>
          ) : <p className="text-sm text-gray-400">No manager assigned</p>}
        </div>
      </div>

      <div className="border rounded p-4 mb-6">
        <h2 className="font-semibold mb-2">Criteria History</h2>
        {s.criteriaHistory.length === 0 ? <p className="text-sm text-gray-400">No history.</p> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">Criteria</th><th className="border p-2 text-left">Effective From</th><th className="border p-2 text-left">Effective To</th><th className="border p-2 text-left">Reason</th><th className="border p-2 text-left">Updated By</th></tr></thead>
            <tbody>
              {s.criteriaHistory.map(h => (
                <tr key={h.id}>
                  <td className="border p-2"><span style={{ color: criteriaColors[h.criteria] }} className="font-semibold">{h.criteria}</span></td>
                  <td className="border p-2">{new Date(h.effectiveFrom).toLocaleDateString()}</td>
                  <td className="border p-2">{h.effectiveTo ? new Date(h.effectiveTo).toLocaleDateString() : 'Current'}</td>
                  <td className="border p-2">{h.reason || '-'}</td>
                  <td className="border p-2">{h.updatedBy?.name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="border rounded p-4">
        <h2 className="font-semibold mb-2">Assigned Employees ({s.assignedEmployees.length})</h2>
        {s.assignedEmployees.length === 0 ? <p className="text-sm text-gray-400">No employees assigned.</p> : (
          <table className="w-full text-sm border-collapse">
            <thead><tr className="bg-gray-100"><th className="border p-2 text-left">ID</th><th className="border p-2 text-left">Name</th><th className="border p-2 text-left">Role</th><th className="border p-2 text-left">Status</th></tr></thead>
            <tbody>
              {s.assignedEmployees.map(e => (
                <tr key={e.id}>
                  <td className="border p-2 font-mono">{e.employeeId}</td>
                  <td className="border p-2">{e.fullName}</td>
                  <td className="border p-2">{e.currentRole}</td>
                  <td className="border p-2">{e.employmentStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
