'use client'

import { useEffect, useState } from 'react'

interface PayRule {
  id: string; name: string; description: string | null
  ruleType: string; calculationMethod: string; status: string
  role: string | null; employeeCategory: string | null
  baseAmount: number | null; percentageRate: number | null
  maxAmount: number | null; minAmount: number | null
  effectiveFrom: string; effectiveTo: string | null
  priority: number; component: { code: string; name: string }
}

export default function RulesPage() {
  const [rules, setRules] = useState<PayRule[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = () => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/salary-structure/rules').then(r => r.json()).then(j => setRules(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const has = (p: string) => perms.includes(p)

  const handleActivate = async (id: string) => {
    setError('')
    const res = await fetch(`/api/salary-structure/rules/${id}/activate`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Activation failed'); return }
    fetchData()
  }

  const handleDeactivate = async (id: string) => {
    setError('')
    await fetch(`/api/salary-structure/rules/${id}/deactivate`, { method: 'POST' })
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Pay Rules</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {has('salaryStructure.manageRules') && (
            <a href="/salary-structure/rules/new" style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>+ New Rule</a>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Name</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Component</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Method</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Role</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Effective</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <a href={`/salary-structure/rules/${r.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{r.name}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{r.component.code}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{r.calculationMethod}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{r.role || '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                {r.status === 'ACTIVE' ? <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>Active</span> :
                 r.status === 'DRAFT' ? <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>Draft</span> :
                 <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>{r.status}</span>}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(r.effectiveFrom).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', display: 'flex', gap: '0.35rem' }}>
                {r.status === 'DRAFT' && has('salaryStructure.activateRule') && (
                  <button onClick={() => handleActivate(r.id)} style={{ background: '#059669', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>Activate</button>
                )}
                {r.status === 'ACTIVE' && has('salaryStructure.deactivateRule') && (
                  <button onClick={() => handleDeactivate(r.id)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>Deactivate</button>
                )}
                {has('salaryStructure.manageRules') && (
                  <a href={`/salary-structure/rules/${r.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>Edit</a>
                )}
              </td>
            </tr>
          ))}
          {rules.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No rules found</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem' }}>
        <a href="/salary-structure" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Salary Structure</a>
      </div>
    </div>
  )
}
