'use client'

import { useEffect, useState } from 'react'

interface SRA {
  id: string; ruleId: string; actionType: string; reason: string | null
  status: string; requestedById: string; reviewedById: string | null
  reviewComment: string | null; createdAt: string
  rule: { name: string; componentId: string; status: string }
}

export default function RuleApprovalsPage() {
  const [approvals, setApprovals] = useState<SRA[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [comment, setComment] = useState('')

  const fetchData = () => {
    const query = filter ? `?status=${filter}` : ''
    fetch(`/api/salary-structure/rule-approvals${query}`)
      .then(r => r.json()).then(j => setApprovals(j.data || []))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [filter])

  const handleApprove = async (id: string) => {
    setError('')
    const res = await fetch(`/api/salary-structure/rule-approvals/${id}/approve`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Approval failed'); return }
    setReviewing(null)
    setComment('')
    fetchData()
  }

  const handleReject = async (id: string) => {
    if (!comment) return
    setError('')
    const res = await fetch(`/api/salary-structure/rule-approvals/${id}/reject`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Rejection failed'); return }
    setReviewing(null)
    setComment('')
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const badge: Record<string, React.CSSProperties> = {
    PENDING: { background: '#fef3c7', color: '#92400e' },
    APPROVED: { background: '#d1fae5', color: '#065f46' },
    REJECTED: { background: '#fee2e2', color: '#991b1b' },
  }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Salary Rule Approvals</h1>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="PENDING">Pending</option>
          <option value="APPROVED">Approved</option>
          <option value="REJECTED">Rejected</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Rule</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Component</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Action</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Reason</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Created</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {approvals.map(a => (
            <tr key={a.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>
                <a href={`/salary-structure/rules/${a.ruleId}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{a.rule.name}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{a.rule.componentId}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{a.actionType === 'ACTIVATE' ? 'Activate' : 'Deactivate'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.reason || '-'}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...badge[a.status] }}>{a.status}</span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(a.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {a.status === 'PENDING' && (
                  <>
                    {reviewing === a.id ? (
                      <span>
                        <input value={comment} onChange={e => setComment(e.target.value)} placeholder="Rejection comment" style={{ padding: '0.2rem', border: '1px solid #ccc', borderRadius: 2, fontSize: '0.8rem', width: 130 }} />
                        <button onClick={() => handleApprove(a.id)} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Approve</button>
                        <button onClick={() => handleReject(a.id)} disabled={!comment} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Reject</button>
                        <button onClick={() => { setReviewing(null); setComment('') }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setReviewing(a.id)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Review</button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
          {approvals.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No rule approval requests found</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem' }}>
        <a href="/salary-structure" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Salary Structure</a>
      </div>
    </div>
  )
}
