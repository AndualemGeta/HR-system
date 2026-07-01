'use client'

import { useEffect, useState } from 'react'

interface ChecklistItem {
  id: string; section: string; item: string; status: string; comment: string | null
  updatedById: string | null; updatedAt: string | null
}

export default function PhaseControlPage() {
  const [items, setItems] = useState<ChecklistItem[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = () => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/phase-control').then(r => r.json()).then(j => setItems(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const has = (p: string) => perms.includes(p)

  const handleInit = async () => {
    setError('')
    const res = await fetch('/api/phase-control/init', { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Init failed'); return }
    fetchData()
  }

  const handleUpdate = async (id: string, status: string, comment: string | null) => {
    setError('')
    const res = await fetch('/api/phase-control', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status, comment }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Update failed'); return }
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const statusBadge: Record<string, React.CSSProperties> = {
    NOT_STARTED: { background: '#e5e7eb', color: '#374151' },
    IN_PROGRESS: { background: '#dbeafe', color: '#1e40af' },
    COMPLETED: { background: '#d1fae5', color: '#065f46' },
    BLOCKED: { background: '#fee2e2', color: '#991b1b' },
    N_A: { background: '#f3f4f6', color: '#6b7280' },
  }

  const sections = [...new Set(items.map(i => i.section))]

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Phase Control</h1>
        {has('phaseControl.update') && (
          <button onClick={handleInit} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Initialize Checklist</button>
        )}
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {items.length === 0 && (
        <p style={{ color: '#666' }}>No checklist items found. Click &quot;Initialize Checklist&quot; to create them.</p>
      )}

      {sections.map(section => (
        <div key={section} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1rem', color: '#374151', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.25rem', marginBottom: '0.5rem' }}>{section}</h2>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Item</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Comment</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.filter(i => i.section === section).map(item => (
                <ChecklistRow key={item.id} item={item} canEdit={has('phaseControl.update')} statusBadge={statusBadge} onUpdate={handleUpdate} />
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

function ChecklistRow({ item, canEdit, statusBadge, onUpdate }: {
  item: ChecklistItem; canEdit: boolean; statusBadge: Record<string, React.CSSProperties>
  onUpdate: (id: string, status: string, comment: string | null) => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [statusVal, setStatusVal] = useState(item.status)
  const [commentVal, setCommentVal] = useState(item.comment || '')

  const handleSave = () => {
    onUpdate(item.id, statusVal, commentVal || null)
    setEditing(false)
  }

  if (editing) {
    return (
      <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
        <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{item.item}</td>
        <td style={{ padding: '0.5rem' }}>
          <select value={statusVal} onChange={e => setStatusVal(e.target.value)} style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.85rem' }}>
            <option value="NOT_STARTED">Not Started</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="COMPLETED">Completed</option>
            <option value="BLOCKED">Blocked</option>
            <option value="N_A">N/A</option>
          </select>
        </td>
        <td style={{ padding: '0.5rem' }}>
          <input value={commentVal} onChange={e => setCommentVal(e.target.value)} placeholder="Comment" style={{ padding: '0.25rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }} />
        </td>
        <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
          <button onClick={handleSave} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Save</button>
          <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>Cancel</button>
        </td>
      </tr>
    )
  }

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{item.item}</td>
      <td style={{ padding: '0.5rem' }}>
        <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...(statusBadge[item.status] || statusBadge.NOT_STARTED) }}>{item.status.replace('_', ' ')}</span>
      </td>
      <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }}>{item.comment || '-'}</td>
      <td style={{ padding: '0.5rem' }}>
        {canEdit && (
          <button onClick={() => { setStatusVal(item.status); setCommentVal(item.comment || ''); setEditing(true) }} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>Edit</button>
        )}
      </td>
    </tr>
  )
}
