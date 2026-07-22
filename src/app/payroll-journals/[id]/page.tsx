'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface JournalEntry {
  id: string
  accountCode: string
  accountName: string
  debitAmount: number
  creditAmount: number
  description: string | null
}

interface PayrollJournal {
  id: string
  journalNumber: string
  periodName: string
  status: string
  totalDebit: string
  totalCredit: string
  approvedAt: string | null
  approvedBy: string | null
  createdAt: string
  notes: string | null
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
}

export default function PayrollJournalDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [journal, setJournal] = useState<PayrollJournal | null>(null)
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [actionLoading, setActionLoading] = useState('')

  const has = (p: string) => perms.includes(p)

  const fetchAuth = useCallback(() => {
    return fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {})
  }, [])

  const fetchJournal = useCallback(() => {
    return fetch(`/api/payroll-journals/${id}`).then(r => r.json()).then(j => {
      if (!j.data) { setError('Journal not found'); return }
      setJournal(j.data)
    })
  }, [id])

  const fetchEntries = useCallback(() => {
    return fetch(`/api/payroll-journals/${id}/entries`).then(r => r.json()).then(j => setEntries(j.data || []))
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAuth(), fetchJournal(), fetchEntries()]).finally(() => setLoading(false))
  }, [fetchAuth, fetchJournal, fetchEntries])

  const handleAction = async (action: string, body?: unknown) => {
    if (actionLoading) return
    setActionLoading(action)
    setError('')
    const res = await fetch(`/api/payroll-journals/${id}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); setActionLoading(''); return }
    await Promise.all([fetchJournal(), fetchEntries()])
    setActionLoading('')
  }

  const handleExport = () => {
    window.open(`/api/payroll-journals/${id}/export`, '_blank')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!journal && !error) return null
  if (!journal) return <div style={{ padding: '2rem', textAlign: 'center' }}>Journal not found</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/payroll-journals" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Journals</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {journal.journalNumber}
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[journal.status] || statusStyles.DRAFT }}>
                {journal.status.replace(/_/g, ' ')}
              </span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
              {journal.periodName} &middot; Created {new Date(journal.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {journal.status === 'DRAFT' && has('payrollJournal.approve') && (
              <button onClick={() => handleAction('approve')} disabled={!!actionLoading} style={{ background: '#16a34a', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'approve' ? '...' : 'Approve'}
              </button>
            )}
            {has('payrollJournal.export') && (
              <button onClick={handleExport} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Export CSV
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{Number(journal.totalDebit).toLocaleString()}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Total Debit</div>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{Number(journal.totalCredit).toLocaleString()}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Total Credit</div>
        </div>
      </div>

      {journal.approvedAt && (
        <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Approved by {journal.approvedBy || 'Unknown'} on {new Date(journal.approvedAt).toLocaleString()}
        </div>
      )}
      {journal.notes && (
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Notes: {journal.notes}
        </div>
      )}

      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Journal Entries ({entries.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Account Code</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Account Name</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Debit</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Credit</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Description</th>
          </tr>
        </thead>
        <tbody>
          {entries.map(e => (
            <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>{e.accountCode}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{e.accountName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{e.debitAmount > 0 ? e.debitAmount.toLocaleString() : '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{e.creditAmount > 0 ? e.creditAmount.toLocaleString() : '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }}>{e.description || '-'}</td>
            </tr>
          ))}
          {entries.length === 0 && (
            <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No journal entries found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
