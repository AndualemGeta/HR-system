'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, EyeOff } from 'lucide-react'

interface Requirement {
  id: string
  inputTypeId: string
  role: string | null
  employeeCategory: string | null
  departmentId: string | null
  regionId: string | null
  areaId: string | null
  shopId: string | null
  employmentType: string | null
  isRequired: boolean
  severity: string
  isActive: boolean
  createdAt: string
  inputType: { id: string; code: string; name: string }
}

export default function PayrollInputRequirementsPage() {
  const [requirements, setRequirements] = useState<Requirement[]>([])
  const [showForm, setShowForm] = useState(false)
  const router = useRouter()

  useEffect(() => {
    fetch('/api/payroll-input-requirements').then(r => r.json()).then(d => setRequirements(d.data || []))
  }, [])

  async function handleDeactivate(id: string) {
    await fetch(`/api/payroll-input-requirements/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ isActive: false }) })
    setRequirements(prev => prev.map(r => r.id === id ? { ...r, isActive: false } : r))
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Payroll Input Requirements</h1>
        <button onClick={() => setShowForm(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded"><Plus size={16} /> New Requirement</button>
      </div>

      <table className="w-full border-collapse border">
        <thead>
          <tr className="bg-gray-100">
            <th className="border p-2 text-left">Input Type</th>
            <th className="border p-2 text-left">Role</th>
            <th className="border p-2 text-left">Category</th>
            <th className="border p-2 text-left">Severity</th>
            <th className="border p-2 text-left">Active</th>
            <th className="border p-2 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {requirements.map(r => (
            <tr key={r.id} className={r.isActive ? '' : 'text-gray-400'}>
              <td className="border p-2">{r.inputType?.name || r.inputTypeId}</td>
              <td className="border p-2">{r.role || '-'}</td>
              <td className="border p-2">{r.employeeCategory || '-'}</td>
              <td className="border p-2"><span className={`px-2 py-0.5 rounded text-xs ${r.severity === 'BLOCKER' ? 'bg-red-100 text-red-700' : r.severity === 'WARNING' ? 'bg-yellow-100 text-yellow-700' : 'bg-blue-100 text-blue-700'}`}>{r.severity}</span></td>
              <td className="border p-2">{r.isActive ? 'Yes' : 'No'}</td>
              <td className="border p-2">{r.isActive && <button onClick={() => handleDeactivate(r.id)} className="text-red-600 flex items-center gap-1"><EyeOff size={14} /> Deactivate</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {showForm && <CreateRequirementForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); router.refresh() }} />}
    </div>
  )
}

function CreateRequirementForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [inputTypeId, setInputTypeId] = useState('')
  const [role, setRole] = useState('')
  const [severity, setSeverity] = useState('BLOCKER')
  const [inputTypes, setInputTypes] = useState<{ id: string; code: string; name: string }[]>([])

  useEffect(() => {
    fetch('/api/payroll-input-types').then(r => r.json()).then(d => setInputTypes(d.data || []))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    await fetch('/api/payroll-input-requirements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputTypeId, role: role || undefined, severity }),
    })
    onCreated()
    window.location.reload()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-white p-6 rounded shadow-lg w-96">
        <h2 className="text-lg font-bold mb-4">New Input Requirement</h2>
        <div className="mb-3">
          <label className="block text-sm font-medium">Input Type</label>
          <select value={inputTypeId} onChange={e => setInputTypeId(e.target.value)} required className="w-full border rounded p-2">
            <option value="">Select...</option>
            {inputTypes.map(it => <option key={it.id} value={it.id}>{it.name} ({it.code})</option>)}
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium">Role</label>
          <select value={role} onChange={e => setRole(e.target.value)} className="w-full border rounded p-2">
            <option value="">Any</option>
            <option value="DSA">DSA</option>
            <option value="DSP">DSP</option>
            <option value="SHOP_MANAGER">SHOP_MANAGER</option>
            <option value="SHOP_ACCOUNTANT">SHOP_ACCOUNTANT</option>
            <option value="SALES_HEAD">SALES_HEAD</option>
            <option value="ASM">ASM</option>
          </select>
        </div>
        <div className="mb-3">
          <label className="block text-sm font-medium">Severity</label>
          <select value={severity} onChange={e => setSeverity(e.target.value)} className="w-full border rounded p-2">
            <option value="BLOCKER">BLOCKER</option>
            <option value="WARNING">WARNING</option>
            <option value="INFO">INFO</option>
          </select>
        </div>
        <div className="flex gap-2 justify-end">
          <button type="button" onClick={onClose} className="px-4 py-2 border rounded">Cancel</button>
          <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded">Create</button>
        </div>
      </form>
    </div>
  )
}
