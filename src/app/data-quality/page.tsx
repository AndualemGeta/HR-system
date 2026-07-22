'use client'

import { useEffect, useState } from 'react'

interface DQIssue {
  id: string; employeeId: string; field: string; issueType: string
  severity: string; status: string; description: string
  createdAt: string; resolvedAt: string | null; ignoredAt: string | null; ignoreReason: string | null
}

export default function DataQualityPage() {
  const [issues, setIssues] = useState<DQIssue[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('')
  const [ignoreId, setIgnoreId] = useState<string | null>(null)
  const [ignoreReason, setIgnoreReason] = useState('')

  const fetchData = () => {
    const query = filter ? `?status=${filter}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/data-quality${query}`).then(r => r.json()).then(j => setIssues(j.data?.issues || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [filter])

  const has = (p: string) => perms.includes(p)
  const counts = { total: issues.length, blockers: issues.filter(i => i.severity === 'BLOCKER').length, warnings: issues.filter(i => i.severity === 'WARNING').length, info: issues.filter(i => i.severity === 'INFO').length, open: issues.filter(i => i.status === 'OPEN').length, resolved: issues.filter(i => i.status === 'RESOLVED').length, ignored: issues.filter(i => i.status === 'IGNORED').length }

  const handleScan = async () => {
    setScanning(true)
    setError('')
    const res = await fetch('/api/data-quality/scan', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Scan failed') }
    setScanning(false)
    fetchData()
  }

  const handleResolve = async (id: string) => {
    setError('')
    const res = await fetch(`/api/data-quality/issues/${id}/resolve`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Resolve failed'); return }
    fetchData()
  }

  const handleIgnoreSubmit = async (id: string) => {
    if (!ignoreReason) return
    setError('')
    const res = await fetch(`/api/data-quality/issues/${id}/ignore`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: ignoreReason }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Ignore failed'); return }
    setIgnoreId(null)
    setIgnoreReason('')
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const badge: Record<string, React.CSSProperties> = {
    BLOCKER: { background: '#fee2e2', color: '#991b1b' },
    WARNING: { background: '#fef3c7', color: '#92400e' },
    INFO: { background: '#dbeafe', color: '#1e40af' },
    OPEN: { background: '#fef3c7', color: '#92400e' },
    RESOLVED: { background: '#d1fae5', color: '#065f46' },
    IGNORED: { background: '#e5e7eb', color: '#374151' },
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
        <h1 style={{ margin: 0 }}>Data Quality</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {has('dataQuality.manage') && (
            <button onClick={handleScan} disabled={scanning} style={{ background: scanning ? '#999' : '#059669', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: scanning ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
              {scanning ? 'Scanning...' : 'Run Scan'}
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <div style={{ padding: '0.75rem 1rem', background: '#fee2e2', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.blockers}</strong><div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Blockers</div></div>
        <div style={{ padding: '0.75rem 1rem', background: '#fef3c7', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.warnings}</strong><div style={{ fontSize: '0.75rem', color: '#92400e' }}>Warnings</div></div>
        <div style={{ padding: '0.75rem 1rem', background: '#dbeafe', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.info}</strong><div style={{ fontSize: '0.75rem', color: '#1e40af' }}>Info</div></div>
        <div style={{ padding: '0.75rem 1rem', background: '#fef3c7', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.open}</strong><div style={{ fontSize: '0.75rem', color: '#92400e' }}>Open</div></div>
        <div style={{ padding: '0.75rem 1rem', background: '#d1fae5', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.resolved}</strong><div style={{ fontSize: '0.75rem', color: '#065f46' }}>Resolved</div></div>
        <div style={{ padding: '0.75rem 1rem', background: '#e5e7eb', borderRadius: 6, minWidth: 120 }}><strong style={{ fontSize: '1.2rem' }}>{counts.ignored}</strong><div style={{ fontSize: '0.75rem', color: '#374151' }}>Ignored</div></div>
      </div>

      <div style={{ marginBottom: '0.75rem' }}>
        <select value={filter} onChange={e => setFilter(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Status</option>
          <option value="OPEN">Open</option>
          <option value="RESOLVED">Resolved</option>
          <option value="IGNORED">Ignored</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Field</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Issue</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Severity</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Description</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Found</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(i => (
            <tr key={i.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{i.field}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{i.issueType}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...badge[i.severity] }}>{i.severity}</span>
              </td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...badge[i.status] }}>{i.status}</span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.description}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{new Date(i.createdAt).toLocaleDateString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {i.status === 'OPEN' && has('dataQuality.manage') && (
                  <>
                    <button onClick={() => handleResolve(i.id)} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Resolve</button>
                    {ignoreId === i.id ? (
                      <span>
                        <input value={ignoreReason} onChange={e => setIgnoreReason(e.target.value)} placeholder="Reason" style={{ padding: '0.2rem', border: '1px solid #ccc', borderRadius: 2, fontSize: '0.8rem', width: 120 }} />
                        <button onClick={() => handleIgnoreSubmit(i.id)} disabled={!ignoreReason} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Confirm</button>
                        <button onClick={() => { setIgnoreId(null); setIgnoreReason('') }} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Cancel</button>
                      </span>
                    ) : (
                      <button onClick={() => setIgnoreId(i.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Ignore</button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
          {issues.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No issues found. Run a scan to check data quality.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
