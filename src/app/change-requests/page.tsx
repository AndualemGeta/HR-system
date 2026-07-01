'use client'

import { useEffect, useState } from 'react'

interface CR {
  id: string; employeeId: string; requestedField: string
  oldValue: string | null; newValue: string; reason: string | null
  status: string; requestedById: string; reviewedById: string | null
  reviewComment: string | null; createdAt: string
}

export default function ChangeRequestsPage() {
  const [requests, setRequests] = useState<CR[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const fetchData = () => {
    const query = filter ? `?status=${filter}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/change-requests${query}`).then(r => r.json()).then(j => setRequests(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [filter])

  const has = (p: string) => perms.includes(p)

  const handleApprove = async (id: string) => {
    setError('')
    const res = await fetch(`/api/change-requests/${id}/approve`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Approval failed'); return }
    setReviewing(null)
    setComment('')
    fetchData()
  }

  const handleReject = async (id: string) => {
    if (!comment) return
    setError('')
    const res = await fetch(`/api/change-requests/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Rejection failed'); return }
    setReviewing(null)
    setComment('')
    fetchData()
  }

  const handleCancel = async (id: string) => {
    setError('')
    const res = await fetch(`/api/change-requests/${id}/cancel`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Cancel failed'); return }
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const badge: Record<string, React.CSSProperties> = {
    PENDING: { background: '#fef3c7', color: '#92400e' },
    APPROVED: { background: '#d1fae5', color: '#065f46' },
    REJECTED: { background: '#fee2e2', color: '#991b1b' },
    CANCELLED: { background: '#e5e7eb', color: '#374151' },
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Change Requests</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Field</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Old Value</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>New Value</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Reason</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Created</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {requests.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                <a href={`/employees/${r.employeeId}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{r.employeeId}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{r.requestedField}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.oldValue || '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.newValue}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 150 }}>{r.reason || '-'}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...badge[r.status] }}>{r.status}</span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(r.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {r.status === 'PENDING' && (
                  <>
                    {reviewing === r.id ? (
                      <span>
                        <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Rejection comment" style={{ padding: '0.2rem', border: '1px solid #ccc', borderRadius: 2, fontSize: '0.8rem', width: 130 }} />
                        <button onClick={() => handleApprove(r.id)} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Approve</button>
                        <button onClick={() => handleReject(r.id)} disabled={!comment} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Reject</button>
                        <button onClick={() => { setReviewing(null); setComment('') }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Cancel</button>
                      </span>
                    ) : (
                      <>
                        <button onClick={() => setReviewing(r.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Review</button>
                        {has('changeRequest.cancel') && (
                          <button onClick={() => handleCancel(r.id)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Cancel</button>
                        )}
                      </>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
          {requests.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No change requests found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
