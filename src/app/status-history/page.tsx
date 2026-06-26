'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface StatusEntry {
  id: string
  employeeId: string
  previousStatus: string | null
  newStatus: string
  reason: string
  effectiveDate: string
  createdAt: string
  employee: { employeeId: string; fullName: string }
}

export default function StatusHistoryPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<StatusEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/status-history')
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(json => setEntries(json.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Status History</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>
      {entries.length === 0 ? (
        <p style={{ color: '#666' }}>No status changes recorded.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem' }}>Employee</th>
              <th style={{ padding: '0.5rem' }}>Previous Status</th>
              <th style={{ padding: '0.5rem' }}>New Status</th>
              <th style={{ padding: '0.5rem' }}>Reason</th>
              <th style={{ padding: '0.5rem' }}>Date</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.5rem' }}>{e.employee.fullName} ({e.employee.employeeId})</td>
                <td style={{ padding: '0.5rem' }}>{e.previousStatus || '-'}</td>
                <td style={{ padding: '0.5rem' }}>{e.newStatus}</td>
                <td style={{ padding: '0.5rem' }}>{e.reason}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(e.effectiveDate).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
