'use client'

import { useEffect, useState } from 'react'

interface PayrollPeriod {
  id: string
  periodName: string
  periodStart: string
  periodEnd: string
  payDate: string
  status: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  OPEN_FOR_INPUT: { background: '#dbeafe', color: '#1e40af' },
  INPUT_COLLECTION_CLOSED: { background: '#fef3c7', color: '#92400e' },
  READY_FOR_REVIEW: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

export default function PayrollPeriodsPage() {
  const [periods, setPeriods] = useState<PayrollPeriod[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = () => {
    const query = statusFilter ? `?status=${statusFilter}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payroll-periods${query}`).then(r => r.json()).then(j => setPeriods(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [statusFilter])

  const has = (p: string) => perms.includes(p)

  const handleCancel = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this period?')) return
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/cancel`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Cancel failed'); return }
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
        <h1 style={{ margin: 0 }}>Payroll Periods</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {has('payrollPeriod.create') && (
            <a href="/payroll-periods/new" style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>+ New Period</a>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="OPEN_FOR_INPUT">Open for Input</option>
          <option value="INPUT_COLLECTION_CLOSED">Input Collection Closed</option>
          <option value="READY_FOR_REVIEW">Ready for Review</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period Name</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Start</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>End</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Pay Date</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {periods.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <a href={`/payroll-periods/${p.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{p.periodName}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(p.periodStart).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(p.periodEnd).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(p.payDate).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[p.status] || statusStyles.DRAFT }}>
                  {p.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                <a href={`/payroll-periods/${p.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.5rem' }}>View</a>
                {p.status === 'DRAFT' && has('payrollPeriod.update') && (
                  <a href={`/payroll-periods/${p.id}?tab=edit`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Edit</a>
                )}
                {(p.status === 'DRAFT' || p.status === 'OPEN_FOR_INPUT') && has('payrollPeriod.cancel') && (
                  <button onClick={() => handleCancel(p.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Cancel</button>
                )}
              </td>
            </tr>
          ))}
          {periods.length === 0 && (
            <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No payroll periods found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
