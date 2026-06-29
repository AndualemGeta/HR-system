'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface ImportSession {
  id: string
  fileName: string
  importMode: string
  status: string
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  duplicateRows: number
  createdCount: number
  updatedCount: number
  skippedCount: number
  createdAt: string
  completedAt: string | null
  uploadedBy: { name: string; email: string } | null
}

export default function ImportHistoryPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<ImportSession[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(json => {
      const me = json.data || json
      if (!me.permissions?.includes('employee.importHistory')) { router.push('/employees'); return }
      fetch('/api/employees/import/history').then(r => r.json()).then(j => {
        setSessions((j.data || j) || [])
        setLoading(false)
      })
    }).catch(() => router.push('/login'))
  }, [router])

  const th: React.CSSProperties = { padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '0.8rem', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem' }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/employees" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Back</Link>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Import History</h1>
      </div>

      {loading ? <p>Loading...</p> : sessions.length === 0 ? (
        <p style={{ color: '#888' }}>No imports found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f9fafb' }}>
            <th style={th}>Date</th><th style={th}>File</th><th style={th}>Mode</th><th style={th}>Uploaded By</th><th style={th}>Total</th><th style={th}>Created</th><th style={th}>Updated</th><th style={th}>Skipped</th><th style={th}>Errors</th><th style={th}>Status</th>
          </tr></thead>
          <tbody>{sessions.map(s => (
            <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={td}>{new Date(s.createdAt).toLocaleString()}</td>
              <td style={td}>{s.fileName}</td>
              <td style={td}>{s.importMode}</td>
              <td style={td}>{s.uploadedBy?.name || '—'}</td>
              <td style={td}>{s.totalRows}</td>
              <td style={td}>{s.createdCount}</td>
              <td style={td}>{s.updatedCount}</td>
              <td style={td}>{s.skippedCount}</td>
              <td style={td}>{s.errorRows + s.duplicateRows}</td>
              <td style={td}><span style={{ padding: '0.15rem 0.4rem', borderRadius: 3, fontSize: '0.75rem', fontWeight: 600, background: s.status === 'COMPLETED' ? '#dcfce7' : s.status === 'FAILED' ? '#fee2e2' : '#fef3c7', color: s.status === 'COMPLETED' ? '#166534' : s.status === 'FAILED' ? '#991b1b' : '#92400e' }}>{s.status}</span></td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}
