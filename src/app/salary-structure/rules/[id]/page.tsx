'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PayRule {
  id: string; componentId: string; name: string; description: string | null
  employeeCategory: string | null; role: string | null
  ruleType: string; calculationMethod: string
  baseAmount: number | null; percentageRate: number | null
  maxAmount: number | null; minAmount: number | null
  thresholdValue: number | null; thresholdMetric: string | null
  tierConfigJson: string | null; formulaJson: string | null
  requiresManualInput: boolean; requiresApproval: boolean
  effectiveFrom: string; effectiveTo: string | null
  status: string; priority: number
  createdAt: string; updatedAt: string
}

export default function RuleDetailPage() {
  const params = useParams()
  const id = params?.id as string
  const [perms, setPerms] = useState<string[]>([])
  const [rule, setRule] = useState<PayRule | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!id) return
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/salary-structure/rules/${id}`).then(r => r.json()).then(j => {
        const r = j.data
        if (r) {
          setRule(r)
          setForm({
            name: r.name, description: r.description || '',
            employeeCategory: r.employeeCategory || '', role: r.role || '',
            ruleType: r.ruleType, calculationMethod: r.calculationMethod,
            baseAmount: r.baseAmount?.toString() || '',
            percentageRate: r.percentageRate?.toString() || '',
            maxAmount: r.maxAmount?.toString() || '',
            minAmount: r.minAmount?.toString() || '',
            thresholdValue: r.thresholdValue?.toString() || '',
            thresholdMetric: r.thresholdMetric || '',
            tierConfigJson: r.tierConfigJson || '',
            requiresManualInput: r.requiresManualInput ? 'true' : 'false',
            requiresApproval: r.requiresApproval ? 'true' : 'false',
            effectiveFrom: r.effectiveFrom?.split('T')[0] || '',
            effectiveTo: r.effectiveTo?.split('T')[0] || '',
            status: r.status, priority: r.priority.toString(),
          })
        }
      }),
    ]).finally(() => setLoading(false))
  }, [id])

  const has = (p: string) => perms.includes(p)

  const handleSave = async () => {
    setError('')
    const body: Record<string, unknown> = {
      name: form.name,
      description: form.description || undefined,
      employeeCategory: form.employeeCategory || undefined,
      role: form.role || undefined,
      ruleType: form.ruleType,
      calculationMethod: form.calculationMethod || form.ruleType,
      baseAmount: form.baseAmount ? Number(form.baseAmount) : null,
      percentageRate: form.percentageRate ? Number(form.percentageRate) : null,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
      minAmount: form.minAmount ? Number(form.minAmount) : null,
      thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : null,
      thresholdMetric: form.thresholdMetric || null,
      tierConfigJson: form.tierConfigJson || null,
      requiresManualInput: form.requiresManualInput === 'true',
      requiresApproval: form.requiresApproval === 'true',
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      status: form.status,
      priority: Number(form.priority),
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })
    if (body.effectiveTo === null) delete body.effectiveTo

    const res = await fetch(`/api/salary-structure/rules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Update failed'); return }
    setRule(json.data)
    setEditing(false)
  }

  const handleActivate = async () => {
    setError('')
    const res = await fetch(`/api/salary-structure/rules/${id}/activate`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Activation failed'); return }
    setRule(json.data)
    setForm(f => ({ ...f, status: json.data.status }))
  }

  const handleDeactivate = async () => {
    setError('')
    const res = await fetch(`/api/salary-structure/rules/${id}/deactivate`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Deactivation failed'); return }
    setRule(json.data)
    setForm(f => ({ ...f, status: json.data.status }))
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!rule) return <div style={{ padding: '2rem', textAlign: 'center' }}>Rule not found</div>

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{rule.name}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {rule.status === 'DRAFT' && has('salaryStructure.activateRule') && (
            <button onClick={handleActivate} style={{ background: '#059669', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Activate</button>
          )}
          {rule.status === 'ACTIVE' && has('salaryStructure.deactivateRule') && (
            <button onClick={handleDeactivate} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Deactivate</button>
          )}
          {has('salaryStructure.manageRules') && !editing && (
            <button onClick={() => setEditing(true)} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', minHeight: 60 }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Priority</label>
              <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Effective From</label>
              <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={handleSave} style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Save</button>
            <button onClick={() => setEditing(false)} style={{ padding: '0.5rem 1rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      ) : (
        <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: 6 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', fontSize: '0.9rem' }}>
            <div><strong>Status:</strong> {rule.status}</div>
            <div><strong>Rule Type:</strong> {rule.ruleType}</div>
            <div><strong>Method:</strong> {rule.calculationMethod}</div>
            <div><strong>Priority:</strong> {rule.priority}</div>
            <div><strong>Role:</strong> {rule.role || '-'}</div>
            <div><strong>Category:</strong> {rule.employeeCategory || '-'}</div>
            {rule.baseAmount !== null && <div><strong>Base Amount:</strong> {rule.baseAmount}</div>}
            {rule.percentageRate !== null && <div><strong>Rate:</strong> {rule.percentageRate}%</div>}
            {rule.maxAmount !== null && <div><strong>Max:</strong> {rule.maxAmount}</div>}
            {rule.minAmount !== null && <div><strong>Min:</strong> {rule.minAmount}</div>}
            {rule.thresholdValue !== null && <div><strong>Threshold:</strong> {rule.thresholdValue}</div>}
            {rule.thresholdMetric && <div><strong>Metric:</strong> {rule.thresholdMetric}</div>}
            <div><strong>Effective:</strong> {new Date(rule.effectiveFrom).toLocaleDateString()}{rule.effectiveTo ? ` - ${new Date(rule.effectiveTo).toLocaleDateString()}` : ''}</div>
            <div><strong>Manual Input:</strong> {rule.requiresManualInput ? 'Yes' : 'No'}</div>
            <div><strong>Requires Approval:</strong> {rule.requiresApproval ? 'Yes' : 'No'}</div>
          </div>
          {rule.description && <p style={{ marginTop: '0.5rem', color: '#666', fontSize: '0.9rem' }}>{rule.description}</p>}
          {rule.tierConfigJson && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>Tier Config:</strong>
              <pre style={{ background: '#1f2937', color: '#d1fae5', padding: '0.75rem', borderRadius: 4, fontSize: '0.8rem', overflow: 'auto', marginTop: '0.25rem' }}>{rule.tierConfigJson}</pre>
            </div>
          )}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <a href="/salary-structure/rules" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Rules</a>
      </div>
    </div>
  )
}
