'use client'

import { useEffect, useState } from 'react'

interface PayComponent {
  id: string; code: string; name: string; description: string | null
  componentType: string; taxTreatment: string; isEarning: boolean
  isDeduction: boolean; isStatutory: boolean; isVariable: boolean; isActive: boolean
  isPensionable: boolean; taxablePercent: number; pensionablePercent: number
  affectsGross: boolean; affectsNet: boolean; affectsEmployerCost: boolean; calculationOrder: number
  createdAt: string
}

export default function ComponentsPage() {
  const [components, setComponents] = useState<PayComponent[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ code: '', name: '', description: '', componentType: 'ALLOWANCE', taxTreatment: 'TAXABLE', isEarning: 'true', isDeduction: 'false', isStatutory: 'false', isVariable: 'false', isPensionable: 'false', taxablePercent: '100', pensionablePercent: '100', affectsGross: 'true', affectsNet: 'true', affectsEmployerCost: 'false', calculationOrder: '0' })
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({ name: '', description: '', componentType: '', taxTreatment: '', isEarning: 'false', isDeduction: 'false', isStatutory: 'false', isVariable: 'false', isPensionable: 'false', taxablePercent: '0', pensionablePercent: '0', affectsGross: 'true', affectsNet: 'true', affectsEmployerCost: 'false', calculationOrder: '0' })
  const [error, setError] = useState('')

  const fetchData = () => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/salary-structure/components').then(r => r.json()).then(j => setComponents(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const has = (p: string) => perms.includes(p)

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const res = await fetch('/api/salary-structure/components', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, isEarning: form.isEarning === 'true', isDeduction: form.isDeduction === 'true', isStatutory: form.isStatutory === 'true', isVariable: form.isVariable === 'true', isPensionable: form.isPensionable === 'true', taxablePercent: parseFloat(form.taxablePercent) || 0, pensionablePercent: parseFloat(form.pensionablePercent) || 0, affectsGross: form.affectsGross === 'true', affectsNet: form.affectsNet === 'true', affectsEmployerCost: form.affectsEmployerCost === 'true', calculationOrder: parseInt(form.calculationOrder) || 0 }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create'); return }
    setShowForm(false)
    setForm({ code: '', name: '', description: '', componentType: 'ALLOWANCE', taxTreatment: 'TAXABLE', isEarning: 'true', isDeduction: 'false', isStatutory: 'false', isVariable: 'false', isPensionable: 'false', taxablePercent: '100', pensionablePercent: '100', affectsGross: 'true', affectsNet: 'true', affectsEmployerCost: 'false', calculationOrder: '0' })
    fetchData()
  }

  const handleEdit = (c: PayComponent) => {
    setEditingId(c.id)
    setEditForm({
      name: c.name, description: c.description || '',
      componentType: c.componentType, taxTreatment: c.taxTreatment,
      isEarning: c.isEarning ? 'true' : 'false',
      isDeduction: c.isDeduction ? 'true' : 'false',
      isStatutory: c.isStatutory ? 'true' : 'false',
      isVariable: c.isVariable ? 'true' : 'false',
      isPensionable: c.isPensionable ? 'true' : 'false',
      taxablePercent: String(c.taxablePercent ?? 0),
      pensionablePercent: String(c.pensionablePercent ?? 0),
      affectsGross: c.affectsGross ? 'true' : 'false',
      affectsNet: c.affectsNet ? 'true' : 'false',
      affectsEmployerCost: c.affectsEmployerCost ? 'true' : 'false',
      calculationOrder: String(c.calculationOrder ?? 0),
    })
  }

  const handleSaveEdit = async (id: string) => {
    setError('')
    const res = await fetch(`/api/salary-structure/components/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editForm.name,
        description: editForm.description || null,
        componentType: editForm.componentType,
        taxTreatment: editForm.taxTreatment,
        isEarning: editForm.isEarning === 'true',
        isDeduction: editForm.isDeduction === 'true',
        isStatutory: editForm.isStatutory === 'true',
        isVariable: editForm.isVariable === 'true',
        isPensionable: editForm.isPensionable === 'true',
        taxablePercent: parseFloat(editForm.taxablePercent) || 0,
        pensionablePercent: parseFloat(editForm.pensionablePercent) || 0,
        affectsGross: editForm.affectsGross === 'true',
        affectsNet: editForm.affectsNet === 'true',
        affectsEmployerCost: editForm.affectsEmployerCost === 'true',
        calculationOrder: parseInt(editForm.calculationOrder) || 0,
      }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Update failed'); return }
    setEditingId(null)
    fetchData()
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this component?')) return
    await fetch(`/api/salary-structure/components/${id}/deactivate`, { method: 'POST' })
    fetchData()
  }

  const toggleBool = (v: string) => v === 'true' ? 'false' : 'true'

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const inputSx: React.CSSProperties = { padding: '0.3rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.85rem', width: '100%', boxSizing: 'border-box' }
  const selSx: React.CSSProperties = { ...inputSx }

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Pay Components</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {has('salaryStructure.manageComponents') && (
            <button onClick={() => setShowForm(!showForm)} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.9rem' }}>
              {showForm ? 'Cancel' : '+ New Component'}
            </button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showForm && (
        <form onSubmit={handleCreate} style={{ background: '#f9fafb', padding: '1rem', borderRadius: 6, marginBottom: '1rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <input placeholder="Code *" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} required style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
          <input placeholder="Name *" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
          <input placeholder="Description" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, gridColumn: '1/-1' }} />
          <select value={form.componentType} onChange={e => setForm(f => ({ ...f, componentType: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
            <option value="BASIC_SALARY">Basic Salary</option>
            <option value="ALLOWANCE">Allowance</option>
            <option value="KPI">KPI</option>
            <option value="TRANSPORT">Transport</option>
            <option value="OVERTIME">Overtime</option>
            <option value="COMMISSION">Commission</option>
            <option value="BONUS">Bonus</option>
            <option value="ADJUSTMENT">Adjustment</option>
            <option value="DEDUCTION">Deduction</option>
            <option value="STATUTORY">Statutory</option>
            <option value="OTHER">Other</option>
          </select>
          <select value={form.taxTreatment} onChange={e => setForm(f => ({ ...f, taxTreatment: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
            <option value="TAXABLE">Taxable</option>
            <option value="NON_TAXABLE">Non-Taxable</option>
            <option value="PARTIALLY_TAXABLE">Partially Taxable</option>
            <option value="STATUTORY">Statutory</option>
            <option value="UNKNOWN">Unknown</option>
          </select>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.isEarning === 'true'} onChange={e => setForm(f => ({ ...f, isEarning: e.target.checked ? 'true' : 'false' }))} /> Is Earning</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.isDeduction === 'true'} onChange={e => setForm(f => ({ ...f, isDeduction: e.target.checked ? 'true' : 'false' }))} /> Is Deduction</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.isStatutory === 'true'} onChange={e => setForm(f => ({ ...f, isStatutory: e.target.checked ? 'true' : 'false' }))} /> Is Statutory</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.isVariable === 'true'} onChange={e => setForm(f => ({ ...f, isVariable: e.target.checked ? 'true' : 'false' }))} /> Is Variable</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.isPensionable === 'true'} onChange={e => setForm(f => ({ ...f, isPensionable: e.target.checked ? 'true' : 'false' }))} /> Is Pensionable</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.affectsGross === 'true'} onChange={e => setForm(f => ({ ...f, affectsGross: e.target.checked ? 'true' : 'false' }))} /> Affects Gross</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.affectsNet === 'true'} onChange={e => setForm(f => ({ ...f, affectsNet: e.target.checked ? 'true' : 'false' }))} /> Affects Net</label>
          <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.affectsEmployerCost === 'true'} onChange={e => setForm(f => ({ ...f, affectsEmployerCost: e.target.checked ? 'true' : 'false' }))} /> Affects Employer Cost</label>
          <input placeholder="Taxable %" type="number" min="0" max="100" value={form.taxablePercent} onChange={e => setForm(f => ({ ...f, taxablePercent: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
          <input placeholder="Pensionable %" type="number" min="0" max="100" value={form.pensionablePercent} onChange={e => setForm(f => ({ ...f, pensionablePercent: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
          <input placeholder="Calc Order" type="number" min="0" value={form.calculationOrder} onChange={e => setForm(f => ({ ...f, calculationOrder: e.target.value }))} style={{ padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }} />
          <button type="submit" style={{ gridColumn: '1/-1', background: '#059669', color: '#fff', padding: '0.4rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Create Component</button>
        </form>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Code</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Name</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Type</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Tax</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Earn/ Ded/ Stat/ Var</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {components.map(c => (
            <tr key={c.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 600 }}>{c.code}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                {editingId === c.id ? (
                  <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} style={inputSx} />
                ) : c.name}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                {editingId === c.id ? (
                  <select value={editForm.componentType} onChange={e => setEditForm(f => ({ ...f, componentType: e.target.value }))} style={selSx}>
                    <option value="BASIC_SALARY">Basic Salary</option>
                    <option value="ALLOWANCE">Allowance</option>
                    <option value="KPI">KPI</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="OVERTIME">Overtime</option>
                    <option value="COMMISSION">Commission</option>
                    <option value="BONUS">Bonus</option>
                    <option value="ADJUSTMENT">Adjustment</option>
                    <option value="DEDUCTION">Deduction</option>
                    <option value="STATUTORY">Statutory</option>
                    <option value="OTHER">Other</option>
                  </select>
                ) : c.componentType}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                {editingId === c.id ? (
                  <select value={editForm.taxTreatment} onChange={e => setEditForm(f => ({ ...f, taxTreatment: e.target.value }))} style={selSx}>
                    <option value="TAXABLE">Taxable</option>
                    <option value="NON_TAXABLE">Non-Taxable</option>
                    <option value="PARTIALLY_TAXABLE">Partially Taxable</option>
                    <option value="STATUTORY">Statutory</option>
                    <option value="UNKNOWN">Unknown</option>
                  </select>
                ) : c.taxTreatment}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                {editingId === c.id ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.isEarning === 'true'} onChange={() => setEditForm(f => ({ ...f, isEarning: toggleBool(f.isEarning) }))} /> Earn</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.isDeduction === 'true'} onChange={() => setEditForm(f => ({ ...f, isDeduction: toggleBool(f.isDeduction) }))} /> Ded</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.isStatutory === 'true'} onChange={() => setEditForm(f => ({ ...f, isStatutory: toggleBool(f.isStatutory) }))} /> Stat</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.isVariable === 'true'} onChange={() => setEditForm(f => ({ ...f, isVariable: toggleBool(f.isVariable) }))} /> Var</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.isPensionable === 'true'} onChange={() => setEditForm(f => ({ ...f, isPensionable: toggleBool(f.isPensionable) }))} /> Pen</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.affectsGross === 'true'} onChange={() => setEditForm(f => ({ ...f, affectsGross: toggleBool(f.affectsGross) }))} /> Grs</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.affectsNet === 'true'} onChange={() => setEditForm(f => ({ ...f, affectsNet: toggleBool(f.affectsNet) }))} /> Net</label>
                    <label style={{ fontSize: '0.75rem' }}><input type="checkbox" checked={editForm.affectsEmployerCost === 'true'} onChange={() => setEditForm(f => ({ ...f, affectsEmployerCost: toggleBool(f.affectsEmployerCost) }))} /> EC</label>
                    <input style={{ ...inputSx, fontSize: '0.75rem', width: 'auto' }} type="number" min="0" max="100" placeholder="Tx%" value={editForm.taxablePercent} onChange={e => setEditForm(f => ({ ...f, taxablePercent: e.target.value }))} />
                    <input style={{ ...inputSx, fontSize: '0.75rem', width: 'auto' }} type="number" min="0" max="100" placeholder="Pen%" value={editForm.pensionablePercent} onChange={e => setEditForm(f => ({ ...f, pensionablePercent: e.target.value }))} />
                    <input style={{ ...inputSx, fontSize: '0.75rem', width: 'auto' }} type="number" min="0" placeholder="Ord" value={editForm.calculationOrder} onChange={e => setEditForm(f => ({ ...f, calculationOrder: e.target.value }))} />
                  </div>
                ) : (
                  <span>{c.isEarning ? 'E' : '-'}/{c.isDeduction ? 'D' : '-'}/{c.isStatutory ? 'S' : '-'}/{c.isVariable ? 'V' : '-'}/{c.isPensionable ? 'P' : '-'}/{c.affectsGross ? 'G' : '-'}/{c.affectsNet ? 'N' : '-'}/{c.affectsEmployerCost ? 'EC' : '--'}:Tx{c.taxablePercent}%:Pen{c.pensionablePercent}%:O{c.calculationOrder}</span>
                )}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                {c.isActive ? <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#d1fae5', color: '#065f46' }}>Active</span> : <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#fee2e2', color: '#991b1b' }}>Inactive</span>}
              </td>
              <td style={{ padding: '0.5rem', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                {editingId === c.id ? (
                  <>
                    <button onClick={() => handleSaveEdit(c.id)} style={{ background: 'none', border: 'none', color: '#059669', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Save</button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>Cancel</button>
                  </>
                ) : (
                  <>
                    {has('salaryStructure.manageComponents') && (
                      <button onClick={() => handleEdit(c)} style={{ background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline', marginRight: '0.5rem' }}>Edit</button>
                    )}
                    {c.isActive && has('salaryStructure.manageComponents') && (
                      <button onClick={() => handleDeactivate(c.id)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>Deactivate</button>
                    )}
                  </>
                )}
              </td>
            </tr>
          ))}
          {components.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No components found</td></tr>
          )}
        </tbody>
      </table>

      <div style={{ marginTop: '1rem' }}>
        <a href="/salary-structure" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Salary Structure</a>
      </div>
    </div>
  )
}
