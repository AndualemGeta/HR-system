'use client'

import { useEffect, useState } from 'react'

interface OutputPackage {
  id: string
  periodName: string
  periodStart: string
  periodEnd: string
  status: string
  totalEmployees: number
  grossPayTotal: number
  netPayTotal: number
  deductionTotal: number
  approvedAt: string | null
  createdAt: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_REVIEW: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

export default function OutputPackagesPage() {
  const [packages, setPackages] = useState<OutputPackage[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = () => {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payroll-output-packages${q}`).then(r => r.json()).then(j => setPackages(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [statusFilter])

  const has = (p: string) => perms.includes(p)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Payroll Output Packages</h1>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_REVIEW">Pending Review</option>
          <option value="APPROVED">Approved</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employees</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Gross Pay</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Net Pay</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Deductions</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Approved</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {packages.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <a href={`/payroll-output-packages/${p.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{p.periodName}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.totalEmployees}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.grossPayTotal.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.netPayTotal.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.deductionTotal.toLocaleString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[p.status] || statusStyles.DRAFT }}>
                  {p.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.approvedAt ? new Date(p.approvedAt).toLocaleDateString() : '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                <a href={`/payroll-output-packages/${p.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>View</a>
              </td>
            </tr>
          ))}
          {packages.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No output packages found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
