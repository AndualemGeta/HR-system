'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ChecklistItem {
  id: string
  key: string
  label: string
  completed: boolean
  completedAt: string | null
}

interface Checklist {
  id: string
  employeeId: string
  status: string
  completedAt: string | null
  items: ChecklistItem[]
}

export default function OnboardingPage() {
  const router = useRouter()
  const [checklists, setChecklists] = useState<Checklist[]>([])
  const [employees, setEmployees] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      const [clRes, empRes] = await Promise.all([
        fetch('/api/onboarding'),
        fetch('/api/employees?limit=200'),
      ])
      if (!clRes.ok || !empRes.ok) throw new Error('Failed')
      const clJson = await clRes.json()
      const empJson = await empRes.json()
      const empMap: Record<string, string> = {}
      for (const e of empJson.data.items) {
        empMap[e.id] = `${e.fullName} (${e.employeeId})`
      }
      setChecklists(clJson.data)
      setEmployees(empMap)
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [router])

  async function toggleItem(employeeId: string, itemId: string, currentCompleted: boolean) {
    setError('')
    try {
      const res = await fetch(`/api/onboarding/${employeeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, completed: !currentCompleted }),
      })
      if (!res.ok) throw new Error('Failed')
      await load()
    } catch {
      setError('Failed to update checklist item')
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Onboarding Checklists</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {checklists.length === 0 ? (
        <p style={{ color: '#666' }}>No onboarding checklists found.</p>
      ) : (
        checklists.map(cl => (
          <div key={cl.id} style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.5rem' }}>
              {employees[cl.employeeId] || cl.employeeId} — Status: {cl.status}
            </div>
            {cl.items.map(item => (
              <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={item.completed}
                  onChange={() => toggleItem(cl.employeeId, item.id, item.completed)}
                />
                <span style={{ textDecoration: item.completed ? 'line-through' : 'none', color: item.completed ? '#666' : '#000' }}>
                  {item.label}
                </span>
              </label>
            ))}
          </div>
        ))
      )}
    </div>
  )
}
