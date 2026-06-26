'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface AuditEntry {
  id: string
  action: string
  entityType: string
  entityId: string | null
  oldValue: unknown
  newValue: unknown
  ipAddress: string | null
  createdAt: string
  user: { name: string; email: string } | null
}

export default function AuditLogsPage() {
  const router = useRouter()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/audit-logs?page=${page}&limit=50`)
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(json => {
        setEntries(json.data.items)
        setTotal(json.data.total)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [page, router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Audit Logs</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>
      {entries.length === 0 ? (
        <p style={{ color: '#666' }}>No audit logs found.</p>
      ) : (
        <>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>{total} entries</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }}>Date</th>
                <th style={{ padding: '0.5rem' }}>User</th>
                <th style={{ padding: '0.5rem' }}>Action</th>
                <th style={{ padding: '0.5rem' }}>Entity</th>
                <th style={{ padding: '0.5rem' }}>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map(e => (
                <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(e.createdAt).toLocaleString()}</td>
                  <td style={{ padding: '0.5rem' }}>{e.user?.name || e.user?.email || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{e.action}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{e.entityType}#{e.entityId?.slice(0, 8) || '-'}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{e.ipAddress || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {total > 50 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</button>
              <span>Page {page}</span>
              <button disabled={page * 50 >= total} onClick={() => setPage(p => p + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
