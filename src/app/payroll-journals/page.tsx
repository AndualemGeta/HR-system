'use client'

import { useEffect, useState } from 'react'

interface PayrollJournal {
  id: string
  journalNumber: string
  periodName: string
  status: string
  totalDebit: number
  totalCredit: number
  entryCount: number
  approvedAt: string | null
  createdAt: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
}

export default function PayrollJournalsPage() {
  const [journals, setJournals] = useState<PayrollJournal[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = () => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/payroll-journals').then(r => r.json()).then(j => setJournals(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const has = (p: string) => perms.includes(p)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Payroll Journals</h1>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Journal #</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Total Debit</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Total Credit</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Entries</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Created</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {journals.map(j => (
            <tr key={j.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
                <a href={`/payroll-journals/${j.id}`} style={{ color: '#2563eb', textDecoration: 'underline' }}>{j.journalNumber}</a>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{j.periodName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{j.totalDebit.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{j.totalCredit.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{j.entryCount}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[j.status] || statusStyles.DRAFT }}>
                  {j.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(j.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <a href={`/payroll-journals/${j.id}`} style={{ color: '#2563eb', fontSize: '0.8rem', textDecoration: 'underline' }}>View</a>
              </td>
            </tr>
          ))}
          {journals.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No journals found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
