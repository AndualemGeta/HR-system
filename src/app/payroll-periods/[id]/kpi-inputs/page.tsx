'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'

interface KpiRow {
  employeeId: string; employeeCode: string; fullName: string; role: string
  hasAssignment: boolean; defaultAmount: number; percentage: number | null
  calculatedAmount: number; inputId: string | null
  inputStatus: string | null; isLocked: boolean; note: string | null
}

export default function KpiInputsPage() {
  const params = useParams()
  const id = params.id as string
  const [rows, setRows] = useState<KpiRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState<Record<string, boolean>>({})
  const [editing, setEditing] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    fetch(`/api/payroll-periods/${id}/kpi-inputs`)
      .then(r => r.json())
      .then(j => { setRows(j.data?.rows || []); setLoading(false) })
      .catch(() => { setError('Failed to load'); setLoading(false) })
  }, [id])

  async function savePercentage(empId: string) {
    const val = editing[empId]
    if (val === undefined) return
    const pct = parseInt(val, 10)
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Percentage must be 0-100'); return }

    setSaving(s => ({ ...s, [empId]: true }))
    setError('')

    try {
      const row = rows.find(r => r.employeeId === empId)
      const body: Record<string, unknown> = { inputTypeCode: 'KPI_ACHIEVEMENT_PERCENT', value: pct }
      if (row?.note) body.note = row.note

      if (row?.inputId) {
        // Update existing input
        const res = await fetch(`/api/payroll-periods/${id}/inputs/${row.inputId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: pct }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Update failed') }
      } else {
        // Create new input
        body.inputTypeCode = 'KPI_ACHIEVEMENT_PERCENT'
        body.value = pct
        const res = await fetch(`/api/payroll-periods/${id}/inputs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: empId, inputTypeCode: 'KPI_ACHIEVEMENT_PERCENT', value: pct }),
        })
        if (!res.ok) { const j = await res.json(); throw new Error(j.error || 'Create failed') }
      }

      // Reload
      const res = await fetch(`/api/payroll-periods/${id}/kpi-inputs`)
      const j = await res.json()
      setRows(j.data?.rows || [])
      setEditing(e => { const n = { ...e }; delete n[empId]; return n })
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSaving(s => ({ ...s, [empId]: false }))
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const editableRows = rows.filter(r => r.hasAssignment)
  const noAssignmentRows = rows.filter(r => !r.hasAssignment)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href={`/payroll-periods/${id}`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Payroll Period</a>
        <h1 style={{ margin: '0.5rem 0 0' }}>KPI Percentage Inputs</h1>
        <p style={{ color: '#666', fontSize: '0.85rem' }}>
          Set KPI achievement percentage for employees with active KPI assignments.
          Missing percentage defaults to 100%.
        </p>
      </div>

      {error && <p style={{ color: 'red', background: '#fee', padding: '0.4rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.85rem' }}>{error}</p>}

      {editableRows.length === 0 ? (
        <p style={{ color: '#888' }}>No employees with active KPI assignments in this period.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb', background: '#f9fafb' }}>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Employee</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Role</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Default Amount</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>KPI %</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Calculated Amount</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>Status</th>
              <th style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}></th>
            </tr>
          </thead>
          <tbody>
            {editableRows.map(row => {
              const isEditing = editing[row.employeeId] !== undefined
              const isSaving = saving[row.employeeId]
              const percentage = editing[row.employeeId] !== undefined
                ? parseInt(editing[row.employeeId], 10)
                : row.percentage
              const calcAmt = Math.round(row.defaultAmount * (percentage ?? 100) / 100)
              const canEdit = !row.isLocked
              const inputStatus = row.inputStatus || (row.hasAssignment ? 'DEFAULT' : null)

              return (
                <tr key={row.employeeId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{row.fullName}<br /><span style={{ fontSize: '0.75rem', color: '#888' }}>{row.employeeCode}</span></td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem', color: '#666' }}>{row.role}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>ETB {row.defaultAmount.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <input
                          type="number" min="0" max="100"
                          value={editing[row.employeeId] ?? ''}
                          onChange={e => setEditing(s => ({ ...s, [row.employeeId]: e.target.value }))}
                          style={{ width: 70, padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}
                          disabled={isSaving}
                        />
                        <span style={{ fontSize: '0.85rem', color: '#666' }}>%</span>
                      </div>
                    ) : (
                      <span>{row.percentage !== null ? `${row.percentage}%` : <span style={{ color: '#888' }}>100% (default)</span>}</span>
                    )}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>ETB {calcAmt.toLocaleString()}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                    {inputStatus === 'ACCEPTED' && row.isLocked ? (
                      <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>Accepted & Locked</span>
                    ) : inputStatus === 'ACCEPTED' ? (
                      <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>Accepted</span>
                    ) : inputStatus === 'SUBMITTED' ? (
                      <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>Submitted</span>
                    ) : inputStatus === 'DRAFT' ? (
                      <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: '#e5e7eb', color: '#374151' }}>Draft</span>
                    ) : inputStatus === 'DEFAULT' ? (
                      <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: '#f3f4f6', color: '#6b7280' }}>Default (100%)</span>
                    ) : null}
                  </td>
                  <td style={{ padding: '0.5rem' }}>
                    {isEditing ? (
                      <div style={{ display: 'flex', gap: '0.25rem' }}>
                        <button onClick={() => savePercentage(row.employeeId)} disabled={isSaving} style={{ padding: '0.25rem 0.5rem', background: isSaving ? '#999' : '#2563eb', color: '#fff', border: 'none', borderRadius: 3, cursor: isSaving ? 'not-allowed' : 'pointer', fontSize: '0.8rem' }}>
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button onClick={() => setEditing(e => { const n = { ...e }; delete n[row.employeeId]; return n })} disabled={isSaving} style={{ padding: '0.25rem 0.5rem', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '0.8rem' }}>Cancel</button>
                      </div>
                    ) : canEdit ? (
                      <button onClick={() => setEditing(s => ({ ...s, [row.employeeId]: String(row.percentage ?? 100) }))} style={{ padding: '0.25rem 0.5rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 3, cursor: 'pointer', fontSize: '0.8rem' }}>
                        {row.percentage !== null && row.percentage !== 100 ? 'Edit' : 'Set %'}
                      </button>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: '#888' }}>Locked</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {noAssignmentRows.length > 0 && (
        <details style={{ marginTop: '1.5rem', fontSize: '0.85rem' }}>
          <summary style={{ cursor: 'pointer', color: '#6b7280' }}>Employees without KPI assignment ({noAssignmentRows.length})</summary>
          <p style={{ margin: '0.5rem 0 0', color: '#888', fontSize: '0.8rem' }}>
            These selected employees have no active KPI entitlement for this period and will not receive KPI payments.
          </p>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.4rem', fontSize: '0.8rem', textAlign: 'left' }}>Employee</th>
                <th style={{ padding: '0.4rem', fontSize: '0.8rem', textAlign: 'left' }}>Role</th>
              </tr>
            </thead>
            <tbody>
              {noAssignmentRows.map(row => (
                <tr key={row.employeeId} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{row.fullName} ({row.employeeCode})</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem', color: '#666' }}>{row.role}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </div>
  )
}
