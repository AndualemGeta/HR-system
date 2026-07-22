'use client'

import { useState, useEffect, type FormEvent } from 'react'

interface Rule { id: string; name: string; documentType: string; applicableRole: string | null; applicableEmployeeCategory: string | null; applicableEmploymentType: string | null; isRequired: boolean; isActive: boolean; createdAt: string }

export default function DocumentRulesPage() {
  const [rules, setRules] = useState<Rule[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ name: '', documentType: '', applicableRole: '', applicableEmployeeCategory: '', applicableEmploymentType: '', isRequired: true })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/document-rules').then(r => r.json()).then(json => {
      setRules(json.data || [])
    }).catch(() => {}).finally(() => setLoading(false))
  }, [])

  function resetForm() { setForm({ name: '', documentType: '', applicableRole: '', applicableEmployeeCategory: '', applicableEmploymentType: '', isRequired: true }); setEditingId(null); setShowForm(false) }

  function startEdit(r: Rule) {
    setForm({ name: r.name, documentType: r.documentType, applicableRole: r.applicableRole || '', applicableEmployeeCategory: r.applicableEmployeeCategory || '', applicableEmploymentType: r.applicableEmploymentType || '', isRequired: r.isRequired })
    setEditingId(r.id)
    setShowForm(true)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)
    const payload: Record<string, unknown> = { name: form.name, documentType: form.documentType, isRequired: form.isRequired }
    if (form.applicableRole) payload.applicableRole = form.applicableRole
    if (form.applicableEmployeeCategory) payload.applicableEmployeeCategory = form.applicableEmployeeCategory
    if (form.applicableEmploymentType) payload.applicableEmploymentType = form.applicableEmploymentType

    try {
      const url = editingId ? `/api/document-rules/${editingId}` : '/api/document-rules'
      const method = editingId ? 'PUT' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to save'); return }
      resetForm()
      const updated = await fetch('/api/document-rules').then(r => r.json())
      setRules(updated.data || [])
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function deactivate(id: string) {
    if (!confirm('Deactivate this rule?')) return
    const res = await fetch(`/api/document-rules/${id}/deactivate`, { method: 'PATCH' })
    if (res.ok) {
      const updated = await fetch('/api/document-rules').then(r => r.json())
      setRules(updated.data || [])
    }
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Document Rules</h1>
        <button onClick={() => { resetForm(); setShowForm(true) }} style={{ background: '#2563eb', color: '#fff', padding: '0.4rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Add Rule</button>
      </div>

      {error && <p style={{ color: 'red', background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#f9fafb', borderRadius: 6, marginBottom: '1rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Rule Name *</label>
              <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Document Type *</label>
              <select value={form.documentType} onChange={e => setForm(p => ({ ...p, documentType: e.target.value }))} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
                <option value="">-- Select --</option>
                <option value="ID">ID</option><option value="CONTRACT">Contract</option><option value="CV">CV</option>
                <option value="CERTIFICATE">Certificate</option><option value="EMERGENCY_CONTACT">Emergency Contact</option>
                <option value="BANK_OR_PAYMENT_INFORMATION">Bank / Payment</option><option value="TAX_OR_PAYROLL_INFORMATION">Tax / Payroll</option>
                <option value="COMMISSION_AGREEMENT">Commission Agreement</option><option value="ASSIGNMENT_LETTER">Assignment Letter</option>
                <option value="RESPONSIBILITY_DOCUMENT">Responsibility Document</option><option value="CONFIDENTIALITY_DOCUMENT">Confidentiality</option>
                <option value="SALARY_DOCUMENT">Salary Document</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Applicable Role</label>
              <select value={form.applicableRole} onChange={e => setForm(p => ({ ...p, applicableRole: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
                <option value="">All Roles</option>
                <option value="CEO">CEO</option><option value="HR_MANAGER">HR Manager</option><option value="HR_OFFICER">HR Officer</option>
                <option value="FINANCE_DIRECTOR">Finance Director</option><option value="TREASURY_MANAGER">Treasury Manager</option>
                <option value="ACCOUNTANT">Accountant</option><option value="SALES_HEAD">Sales Head</option>
                <option value="ASM">ASM</option><option value="SHOP_MANAGER">Shop Manager</option>
                <option value="DSP">DSP</option><option value="DSA">DSA</option><option value="SHOP_ACCOUNTANT">Shop Accountant</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Employee Category</label>
              <select value={form.applicableEmployeeCategory} onChange={e => setForm(p => ({ ...p, applicableEmployeeCategory: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
                <option value="">All Categories</option>
                <option value="HEAD_OFFICE">Head Office</option><option value="SHOP_FIELD">Shop / Field</option>
              </select>
            </div>
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Employment Type</label>
              <select value={form.applicableEmploymentType} onChange={e => setForm(p => ({ ...p, applicableEmploymentType: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
                <option value="">All Types</option>
                <option value="FULL_TIME">Full Time</option><option value="PART_TIME">Part Time</option>
                <option value="CONTRACT">Contract</option><option value="COMMISSION_BASED">Commission Based</option>
                <option value="INTERN">Intern</option><option value="TEMPORARY">Temporary</option><option value="OTHER">Other</option>
              </select>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Required:</label>
              <input type="checkbox" checked={form.isRequired} onChange={e => setForm(p => ({ ...p, isRequired: e.target.checked }))} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={resetForm} style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer' }}>Cancel</button>
            <button type="submit" disabled={saving} style={{ padding: '0.4rem 1rem', background: saving ? '#999' : '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer' }}>{saving ? 'Saving...' : editingId ? 'Update' : 'Create'}</button>
          </div>
        </form>
      )}

      {rules.length === 0 ? <p style={{ color: '#888' }}>No document rules configured.</p> : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr style={{ background: '#f9fafb' }}>
            <th style={th}>Name</th><th style={th}>Document Type</th><th style={th}>Role</th><th style={th}>Category</th><th style={th}>Status</th><th style={th}>Actions</th>
          </tr></thead>
          <tbody>{rules.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={td}>{r.name}</td>
              <td style={td}>{r.documentType}</td>
              <td style={td}>{r.applicableRole || 'All'}</td>
              <td style={td}>{r.applicableEmployeeCategory || 'All'}</td>
              <td style={td}>{r.isActive ? <span style={{ color: '#16a34a' }}>Active</span> : <span style={{ color: '#888' }}>Inactive</span>}</td>
              <td style={td}>
                <button onClick={() => startEdit(r)} style={{ marginRight: '0.5rem', padding: '0.25rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 3, background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                {r.isActive && <button onClick={() => deactivate(r.id)} style={{ padding: '0.25rem 0.5rem', border: '1px solid #dc2626', borderRadius: 3, background: '#fff', color: '#dc2626', cursor: 'pointer', fontSize: '0.8rem' }}>Deactivate</button>}
              </td>
            </tr>
          ))}</tbody>
        </table>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }
const td: React.CSSProperties = { padding: '0.5rem', fontSize: '0.9rem' }
