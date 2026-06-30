'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Component { id: string; code: string; name: string }

export default function NewRulePage() {
  const router = useRouter()
  const [components, setComponents] = useState<Component[]>([])
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    componentId: '', name: '', description: '', employeeCategory: '', role: '',
    ruleType: 'FIXED_AMOUNT', calculationMethod: '', baseAmount: '', percentageRate: '',
    maxAmount: '', minAmount: '', thresholdValue: '', thresholdMetric: 'SALES_ACHIEVEMENT_PERCENT',
    tierConfigJson: '', requiresManualInput: false, requiresApproval: false,
    effectiveFrom: new Date().toISOString().split('T')[0], effectiveTo: '', status: 'DRAFT', priority: '0',
  })

  useEffect(() => {
    fetch('/api/salary-structure/components').then(r => r.json()).then(j => {
      if (j.data) setComponents(j.data)
    })
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const body: Record<string, unknown> = {
      componentId: form.componentId,
      name: form.name,
      description: form.description || undefined,
      employeeCategory: form.employeeCategory || undefined,
      role: form.role || undefined,
      ruleType: form.ruleType,
      calculationMethod: form.calculationMethod || form.ruleType,
      baseAmount: form.baseAmount ? Number(form.baseAmount) : undefined,
      percentageRate: form.percentageRate ? Number(form.percentageRate) : undefined,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined,
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : undefined,
      thresholdMetric: form.thresholdMetric || undefined,
      tierConfigJson: form.tierConfigJson || undefined,
      requiresManualInput: form.requiresManualInput,
      requiresApproval: form.requiresApproval,
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || undefined,
      status: form.status,
      priority: Number(form.priority),
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })

    const res = await fetch('/api/salary-structure/rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to create'); return }
    router.push('/salary-structure/rules')
  }

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>New Pay Rule</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Component *</label>
            <select value={form.componentId} onChange={e => setForm(f => ({ ...f, componentId: e.target.value }))} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="">Select...</option>
              {components.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="DRAFT">Draft</option>
              <option value="ACTIVE">Active</option>
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', minHeight: 60 }} />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Employee Category</label>
            <select value={form.employeeCategory} onChange={e => setForm(f => ({ ...f, employeeCategory: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="">All</option>
              <option value="HEAD_OFFICE">Head Office</option>
              <option value="SHOP_FIELD">Shop / Field</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="">All</option>
              <option value="DSA">DSA</option>
              <option value="DSP">DSP</option>
              <option value="SHOP_MANAGER">Shop Manager</option>
              <option value="SHOP_ACCOUNTANT">Shop Accountant</option>
              <option value="ASM">ASM</option>
              <option value="SALES_HEAD">Sales Head</option>
              <option value="HR_OFFICER">HR Officer</option>
              <option value="HR_MANAGER">HR Manager</option>
              <option value="ACCOUNTANT">Accountant</option>
              <option value="TREASURY_MANAGER">Treasury Manager</option>
              <option value="FINANCE_DIRECTOR">Finance Director</option>
              <option value="CEO">CEO</option>
              <option value="EMPLOYEE">Employee</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Rule Type</label>
            <select value={form.ruleType} onChange={e => setForm(f => ({ ...f, ruleType: e.target.value, calculationMethod: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="THRESHOLD">Threshold</option>
              <option value="TIERED">Tiered</option>
              <option value="MANUAL_INPUT">Manual Input</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Calculation Method</label>
            <select value={form.calculationMethod} onChange={e => setForm(f => ({ ...f, calculationMethod: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="THRESHOLD">Threshold</option>
              <option value="TIERED">Tiered</option>
              <option value="MANUAL_INPUT">Manual Input</option>
            </select>
          </div>
          {['PERCENTAGE', 'THRESHOLD'].includes(form.calculationMethod || form.ruleType) && (
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Percentage Rate (%)</label>
              <input type="number" step="0.01" value={form.percentageRate} onChange={e => setForm(f => ({ ...f, percentageRate: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          )}
          {form.ruleType === 'THRESHOLD' && (
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Threshold Value</label>
              <input type="number" step="0.01" value={form.thresholdValue} onChange={e => setForm(f => ({ ...f, thresholdValue: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          )}
          {form.ruleType === 'FIXED_AMOUNT' && (
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Base Amount</label>
              <input type="number" step="0.01" value={form.baseAmount} onChange={e => setForm(f => ({ ...f, baseAmount: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          )}
          {['TIERED', 'THRESHOLD'].includes(form.ruleType) && (
            <div>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Max Amount</label>
              <input type="number" step="0.01" value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
            </div>
          )}
          {form.ruleType === 'TIERED' && (
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Tier Config (JSON array)</label>
              <textarea value={form.tierConfigJson} onChange={e => setForm(f => ({ ...f, tierConfigJson: e.target.value }))} placeholder='[{"min":80,"percent":60,"amount":2000},{"min":50,"percent":40,"amount":1000},{"min":0,"percent":0,"amount":0}]' style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', minHeight: 80, fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
          )}
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Effective From *</label>
            <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Effective To</label>
            <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Priority</label>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
            <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.requiresManualInput} onChange={e => setForm(f => ({ ...f, requiresManualInput: e.target.checked }))} /> Requires Manual Input</label>
            <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.requiresApproval} onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked }))} /> Requires Approval</label>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
          <button type="submit" style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Create Rule</button>
          <a href="/salary-structure/rules" style={{ padding: '0.5rem 1rem', color: '#666', textDecoration: 'none' }}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
