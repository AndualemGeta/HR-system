'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface PayrollInput {
  id: string
  employeeId: string
  employeeName: string
  department: string
  inputTypeId: string
  inputTypeCode: string
  inputTypeName: string
  value: string | null
  amount: number | null
  note: string | null
  status: string
}

interface InputType {
  id: string; code: string; name: string
}

interface PayrollPeriod {
  id: string; periodName: string; status: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  SUBMITTED: { background: '#dbeafe', color: '#1e40af' },
  ACCEPTED: { background: '#d1fae5', color: '#065f46' },
  REJECTED: { background: '#fee2e2', color: '#991b1b' },
  RETURNED: { background: '#fef3c7', color: '#92400e' },
}

export default function PayrollInputsPage() {
  const params = useParams()
  const id = params.id as string

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [inputs, setInputs] = useState<PayrollInput[]>([])
  const [inputTypes, setInputTypes] = useState<InputType[]>([])

  const [filterDept, setFilterDept] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingValues, setEditingValues] = useState<{ value: string; amount: string; note: string }>({ value: '', amount: '', note: '' })

  const [newInputEmployee, setNewInputEmployee] = useState('')
  const [newInputType, setNewInputType] = useState('')
  const [newInputValue, setNewInputValue] = useState('')
  const [newInputAmount, setNewInputAmount] = useState('')
  const [newInputNote, setNewInputNote] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)

  const [reviewNote, setReviewNote] = useState('')
  const [reviewAction, setReviewAction] = useState<{ id: string; action: string } | null>(null)

  const has = (p: string) => perms.includes(p)

  const fetchData = useCallback(() => {
    const query = new URLSearchParams()
    if (filterDept) query.set('department', filterDept)
    if (filterType) query.set('inputType', filterType)
    if (filterStatus) query.set('status', filterStatus)
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payroll-periods/${id}`).then(r => r.json()).then(j => setPeriod(j.data || null)),
      fetch(`/api/payroll-periods/${id}/inputs?${query.toString()}`).then(r => r.json()).then(j => setInputs(j.data || [])),
      fetch('/api/payroll-input-types').then(r => r.json()).then(j => setInputTypes(j.data || [])),
    ]).finally(() => setLoading(false))
  }, [id, filterDept, filterType, filterStatus])

  useEffect(() => { fetchData() }, [fetchData])

  const handleAdd = async () => {
    if (!newInputEmployee || !newInputType) return
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/inputs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId: newInputEmployee, inputTypeId: newInputType, value: newInputValue || null, amount: newInputAmount ? Number(newInputAmount) : null, note: newInputNote || null }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create input'); return }
    setShowNewForm(false)
    setNewInputEmployee('')
    setNewInputType('')
    setNewInputValue('')
    setNewInputAmount('')
    setNewInputNote('')
    fetchData()
  }

  const handleEditSave = async (inputId: string) => {
    setError('')
    const body: Record<string, any> = {}
    if (editingValues.value !== undefined) body.value = editingValues.value || null
    if (editingValues.amount !== undefined) body.amount = editingValues.amount ? Number(editingValues.amount) : null
    if (editingValues.note !== undefined) body.note = editingValues.note || null
    const res = await fetch(`/api/payroll-periods/${id}/inputs/${inputId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to update input'); return }
    setEditingId(null)
    fetchData()
  }

  const handleSubmit = async (inputId: string) => {
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/inputs/${inputId}/submit`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Submit failed'); return }
    fetchData()
  }

  const handleReviewAction = async () => {
    if (!reviewAction || !reviewNote) return
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/inputs/${reviewAction.id}/${reviewAction.action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: reviewNote }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Review action failed'); return }
    setReviewAction(null)
    setReviewNote('')
    fetchData()
  }

  const startEdit = (inp: PayrollInput) => {
    setEditingId(inp.id)
    setEditingValues({ value: inp.value || '', amount: inp.amount !== null ? String(inp.amount) : '', note: inp.note || '' })
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href={`/payroll-periods/${id}`} style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Period</a>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Monthly Inputs{period ? ` — ${period.periodName}` : ''}</h1>
        {has('payrollInput.create') && (
          <button onClick={() => setShowNewForm(!showNewForm)} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
            {showNewForm ? 'Cancel' : '+ Add Input'}
          </button>
        )}
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showNewForm && (
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>New Input Record</h3>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Employee ID</label>
              <input value={newInputEmployee} onChange={e => setNewInputEmployee(e.target.value)} placeholder="Employee ID" style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: 130, fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Input Type</label>
              <select value={newInputType} onChange={e => setNewInputType(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}>
                <option value="">Select...</option>
                {inputTypes.map(t => <option key={t.id} value={t.id}>{t.code} — {t.name}</option>)}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Value</label>
              <input value={newInputValue} onChange={e => setNewInputValue(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: 100, fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Amount</label>
              <input type="number" value={newInputAmount} onChange={e => setNewInputAmount(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: 100, fontSize: '0.85rem' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', marginBottom: '0.2rem' }}>Note</label>
              <input value={newInputNote} onChange={e => setNewInputNote(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, width: 130, fontSize: '0.85rem' }} />
            </div>
            <button onClick={handleAdd} disabled={!newInputEmployee || !newInputType} style={{ background: (!newInputEmployee || !newInputType) ? '#999' : '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: (!newInputEmployee || !newInputType) ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>Add</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
        <input placeholder="Filter department" value={filterDept} onChange={e => setFilterDept(e.target.value)} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 150 }} />
        <select value={filterType} onChange={e => setFilterType(e.target.value)} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}>
          <option value="">All Types</option>
          {inputTypes.map(t => <option key={t.id} value={t.code}>{t.code}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="SUBMITTED">Submitted</option>
          <option value="ACCEPTED">Accepted</option>
          <option value="REJECTED">Rejected</option>
          <option value="RETURNED">Returned</option>
        </select>
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Department</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Input Type</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Value</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Amount</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Note</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {inputs.map(inp => (
            <tr key={inp.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{inp.employeeName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{inp.department}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{inp.inputTypeCode}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {editingId === inp.id ? (
                  <input value={editingValues.value} onChange={e => setEditingValues(v => ({ ...v, value: e.target.value }))} style={{ padding: '0.2rem', border: '1px solid #d1d5db', borderRadius: 4, width: 80, fontSize: '0.85rem' }} />
                ) : inp.value || '-'}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {editingId === inp.id ? (
                  <input type="number" value={editingValues.amount} onChange={e => setEditingValues(v => ({ ...v, amount: e.target.value }))} style={{ padding: '0.2rem', border: '1px solid #d1d5db', borderRadius: 4, width: 80, fontSize: '0.85rem' }} />
                ) : inp.amount !== null ? inp.amount : '-'}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                {editingId === inp.id ? (
                  <input value={editingValues.note} onChange={e => setEditingValues(v => ({ ...v, note: e.target.value }))} style={{ padding: '0.2rem', border: '1px solid #d1d5db', borderRadius: 4, width: 100, fontSize: '0.85rem' }} />
                ) : inp.note || '-'}
              </td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[inp.status] || statusStyles.DRAFT }}>
                  {inp.status}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {(inp.status === 'DRAFT' || inp.status === 'RETURNED') && (
                  <>
                    {editingId === inp.id ? (
                      <>
                        <button onClick={() => handleEditSave(inp.id)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', marginRight: '0.25rem' }}>Save</button>
                        <button onClick={() => setEditingId(null)} style={{ background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem', marginRight: '0.25rem' }}>Cancel</button>
                      </>
                    ) : (
                      <button onClick={() => startEdit(inp)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Edit</button>
                    )}
                    {has('payrollInput.submit') && (
                      <button onClick={() => handleSubmit(inp.id)} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Submit</button>
                    )}
                  </>
                )}
                {inp.status === 'SUBMITTED' && has('payrollInput.review') && (
                  <>
                    <button onClick={() => setReviewAction({ id: inp.id, action: 'accept' })} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Accept</button>
                    <button onClick={() => { setReviewAction({ id: inp.id, action: 'reject' }); setReviewNote('') }} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.35rem' }}>Reject</button>
                    <button onClick={() => { setReviewAction({ id: inp.id, action: 'return' }); setReviewNote('') }} style={{ background: 'none', border: 'none', color: '#92400e', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>Return</button>
                  </>
                )}
              </td>
            </tr>
          ))}
          {inputs.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No input records found</td></tr>
          )}
        </tbody>
      </table>

      {reviewAction && (
        <div style={{ marginTop: '1rem', background: '#f9fafb', padding: '1rem', borderRadius: 6, border: '1px solid #d1d5db' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {reviewAction.action === 'accept' ? 'Accept' : reviewAction.action === 'reject' ? 'Reject' : 'Return'} — provide a note
          </p>
          <textarea value={reviewNote} onChange={e => setReviewNote(e.target.value)} placeholder="Enter note..." style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', minHeight: 60, fontSize: '0.9rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={handleReviewAction} disabled={!reviewNote} style={{ background: reviewNote ? '#2563eb' : '#999', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: reviewNote ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>
              {reviewAction.action === 'accept' ? 'Accept' : reviewAction.action === 'reject' ? 'Reject' : 'Return'}
            </button>
            <button onClick={() => { setReviewAction(null); setReviewNote('') }} style={{ padding: '0.35rem 1rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
