'use client'

import { useEffect, useState, useCallback } from 'react'

interface InputType {
  id: string; code: string; name: string; category: string
  valueType: string; defaultAmount: number | null; requiresApproval: boolean
  active: boolean; calculationMode: string
}

const CALCULATION_MODES = ['DIRECT_AMOUNT', 'METRIC_ONLY', 'RULE_DERIVED'] as const

const defaultForm = { code: '', name: '', category: 'ALLOWANCE', valueType: 'AMOUNT', defaultAmount: '', requiresApproval: false, calculationMode: 'DIRECT_AMOUNT' }

export default function PayrollInputTypesPage() {
  const [types, setTypes] = useState<InputType[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<InputType | null>(null)
  const [form, setForm] = useState(defaultForm)
  const [saving, setSaving] = useState(false)

  const has = (p: string) => perms.includes(p)

  const fetchData = useCallback(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/payroll-input-types').then(r => r.json()).then(j => setTypes(j.data || [])),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const openCreate = () => {
    setForm(defaultForm)
    setEditing(null)
    setShowModal(true)
  }

  const openEdit = (t: InputType) => {
    setForm({ code: t.code, name: t.name, category: t.category, valueType: t.valueType, defaultAmount: t.defaultAmount !== null ? String(t.defaultAmount) : '', requiresApproval: t.requiresApproval, calculationMode: t.calculationMode || 'DIRECT_AMOUNT' })
    setEditing(t)
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.code || !form.name) { setError('Code and Name are required'); return }
    setError('')
    setSaving(true)
    const body = {
      code: form.code,
      name: form.name,
      category: form.category,
      valueType: form.valueType,
      defaultAmount: form.defaultAmount ? Number(form.defaultAmount) : null,
      requiresApproval: form.requiresApproval,
      calculationMode: form.calculationMode,
    }
    const url = editing ? `/api/payroll-input-types/${editing.id}` : '/api/payroll-input-types'
    const method = editing ? 'PATCH' : 'POST'
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const json = await res.json()
    setSaving(false)
    if (!res.ok) { setError(json.error || 'Save failed'); return }
    setShowModal(false)
    fetchData()
  }

  const handleToggleActive = async (t: InputType) => {
    setError('')
    const res = await fetch(`/api/payroll-input-types/${t.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active: !t.active }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Toggle failed'); return }
    fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Payroll Input Types</h1>
        {has('payrollInputType.manage') && (
          <button onClick={openCreate} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>+ New Input Type</button>
        )}
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Code</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Name</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Category</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Value Type</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Calc Mode</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Default Amount</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Requires Approval</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Active</th>
            {has('payrollInputType.manage') && <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {types.map(t => (
            <tr key={t.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{t.code}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{t.name}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{t.category}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{t.valueType}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: t.calculationMode === 'DIRECT_AMOUNT' ? '#dbeafe' : t.calculationMode === 'METRIC_ONLY' ? '#fef3c7' : '#ede9fe', color: t.calculationMode === 'DIRECT_AMOUNT' ? '#1e40af' : t.calculationMode === 'METRIC_ONLY' ? '#92400e' : '#5b21b6' }}>
                  {t.calculationMode === 'DIRECT_AMOUNT' ? 'Amount' : t.calculationMode === 'METRIC_ONLY' ? 'Metric' : 'Rule'}
                </span>
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{t.defaultAmount !== null ? t.defaultAmount : '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: t.requiresApproval ? '#d1fae5' : '#e5e7eb', color: t.requiresApproval ? '#065f46' : '#374151' }}>
                  {t.requiresApproval ? 'Yes' : 'No'}
                </span>
              </td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: t.active ? '#d1fae5' : '#e5e7eb', color: t.active ? '#065f46' : '#374151' }}>
                  {t.active ? 'Active' : 'Inactive'}
                </span>
              </td>
              {has('payrollInputType.manage') && (
                <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                  <button onClick={() => openEdit(t)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Edit</button>
                  <button onClick={() => handleToggleActive(t)} style={{ background: 'none', border: 'none', color: t.active ? '#dc2626' : '#059669', cursor: 'pointer', fontSize: '0.8rem', textDecoration: 'underline' }}>
                    {t.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              )}
            </tr>
          ))}
          {types.length === 0 && (
            <tr><td colSpan={has('payrollInputType.manage') ? 9 : 8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No input types found</td></tr>
          )}
        </tbody>
      </table>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', width: 450, maxWidth: '90vw', boxShadow: '0 4px 12px rgba(0,0,0,0.2)' }}>
            <h2 style={{ margin: '0 0 1rem', fontSize: '1.05rem' }}>{editing ? 'Edit Input Type' : 'New Input Type'}</h2>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Code</label>
              <input value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} disabled={!!editing} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }}>
                <option value="ALLOWANCE">Allowance</option>
                <option value="DEDUCTION">Deduction</option>
                <option value="COMMISSION">Commission</option>
                <option value="KPI">KPI</option>
                <option value="TRANSPORT">Transport</option>
                <option value="OVERTIME">Overtime</option>
                <option value="BONUS">Bonus</option>
                <option value="ADJUSTMENT">Adjustment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Value Type</label>
              <select value={form.valueType} onChange={e => setForm(f => ({ ...f, valueType: e.target.value }))} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }}>
                <option value="AMOUNT">Amount</option>
                <option value="NUMBER">Number</option>
                <option value="PERCENTAGE">Percentage</option>
                <option value="BOOLEAN">Boolean</option>
                <option value="TEXT">Text</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Calculation Mode</label>
              <select value={form.calculationMode} onChange={e => setForm(f => ({ ...f, calculationMode: e.target.value }))} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }}>
                <option value="DIRECT_AMOUNT">Direct Amount</option>
                <option value="METRIC_ONLY">Metric Only</option>
                <option value="RULE_DERIVED">Rule Derived</option>
              </select>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Default Amount</label>
              <input type="number" value={form.defaultAmount} onChange={e => setForm(f => ({ ...f, defaultAmount: e.target.value }))} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box', fontSize: '0.9rem' }} />
            </div>
            <div style={{ marginBottom: '1rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                <input type="checkbox" checked={form.requiresApproval} onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))} style={{ marginRight: '0.5rem' }} />
                Requires Approval
              </label>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setShowModal(false)} style={{ padding: '0.35rem 1rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ background: saving ? '#999' : '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
