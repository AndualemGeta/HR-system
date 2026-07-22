'use client'

import { useEffect, useState } from 'react'

interface StatutoryReport {
  id: string
  reportType: string
  periodName: string
  status: string
  totalAmount: number
  employeeCount: number
  dueDate: string | null
  filedAt: string | null
  filingReference: string | null
  createdAt: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_REVIEW: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  FILED: { background: '#dbeafe', color: '#1e40af' },
}

export default function StatutoryReportsPage() {
  const [reports, setReports] = useState<StatutoryReport[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = () => {
    const params = new URLSearchParams()
    if (typeFilter) params.set('type', typeFilter)
    if (statusFilter) params.set('status', statusFilter)
    const q = params.toString() ? `?${params.toString()}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/statutory-reports${q}`).then(r => r.json()).then(j => setReports(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [typeFilter, statusFilter])

  const has = (p: string) => perms.includes(p)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Statutory Reports</h1>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Types</option>
          <option value="PAYE">PAYE</option>
          <option value="PENSION">Pension</option>
          <option value="WCF">WCF</option>
          <option value="NHIF">NHIF</option>
          <option value="NITA">NITA</option>
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="FILED">Filed</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Report Type</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Total Amount</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employees</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Due Date</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Filed</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {reports.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{r.reportType}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{r.periodName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{r.totalAmount.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{r.employeeCount}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[r.status] || statusStyles.DRAFT }}>
                  {r.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{r.dueDate ? new Date(r.dueDate).toLocaleDateString() : '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{r.filedAt ? new Date(r.filedAt).toLocaleDateString() : '-'}</td>
              <td style={{ padding: '0.5rem' }}>
                <a href={`/statutory-reports/${r.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>View</a>
              </td>
            </tr>
          ))}
          {reports.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No statutory reports found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
