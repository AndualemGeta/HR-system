'use client'

import { useEffect, useState } from 'react'

interface PaymentBatch {
  id: string
  batchNumber: string
  periodName: string
  paymentMethod: string
  status: string
  totalAmount: number
  instructionCount: number
  createdAt: string
  reconciledAt: string | null
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_APPROVAL: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  RELEASED: { background: '#dbeafe', color: '#1e40af' },
  RECONCILED: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

export default function PaymentBatchesPage() {
  const [batches, setBatches] = useState<PaymentBatch[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const fetchData = () => {
    const q = statusFilter ? `?status=${statusFilter}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payment-batches${q}`).then(r => r.json()).then(j => setBatches(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [statusFilter])

  const has = (p: string) => perms.includes(p)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Payment Batches</h1>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PENDING_APPROVAL">Pending Approval</option>
          <option value="APPROVED">Approved</option>
          <option value="RELEASED">Released</option>
          <option value="RECONCILED">Reconciled</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Batch #</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Method</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Total Amount</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Instructions</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Created</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {batches.map(b => (
            <tr key={b.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <a href={`/payment-batches/${b.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{b.batchNumber}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{b.periodName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{b.paymentMethod}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{b.totalAmount.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{b.instructionCount}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[b.status] || statusStyles.DRAFT }}>
                  {b.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(b.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <a href={`/payment-batches/${b.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>View</a>
              </td>
            </tr>
          ))}
          {batches.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No payment batches found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
