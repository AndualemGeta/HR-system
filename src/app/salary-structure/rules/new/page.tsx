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
    departmentId: '', regionId: '', areaId: '', shopId: '', employmentType: '',
    ruleType: 'FIXED_AMOUNT', calculationMethod: '', baseAmount: '', percentageRate: '',
    maxAmount: '', minAmount: '', thresholdValue: '', thresholdMetric: 'SALES_ACHIEVEMENT_PERCENT',
    tierConfigJson: '', formulaJson: '', requiresManualInput: false, requiresApproval: false,
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
      departmentId: form.departmentId || undefined,
      regionId: form.regionId || undefined,
      areaId: form.areaId || undefined,
      shopId: form.shopId || undefined,
      employmentType: form.employmentType || undefined,
      ruleType: form.ruleType,
      calculationMethod: form.calculationMethod || form.ruleType,
      baseAmount: form.baseAmount ? Number(form.baseAmount) : undefined,
      percentageRate: form.percentageRate ? Number(form.percentageRate) : undefined,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : undefined,
      minAmount: form.minAmount ? Number(form.minAmount) : undefined,
      thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : undefined,
      thresholdMetric: form.thresholdMetric || undefined,
      tierConfigJson: form.tierConfigJson || undefined,
      formulaJson: form.formulaJson || undefined,
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

  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: 2 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }
  const sectionLabel: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', gridColumn: '1/-1', display: 'block' }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href="/salary-structure/rules" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Rules</a>
      <h1 style={{ marginBottom: '1.5rem' }}>New Pay Rule</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
          <div>
            <label style={labelStyle}>Component *</label>
            <select value={form.componentId} onChange={e => setForm(f => ({ ...f, componentId: e.target.value }))} required style={inputStyle}>
              <option value="">Select...</option>
              {components.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
              <option value="DRAFT">Draft</option>
            </select>
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Name *</label>
            <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required style={inputStyle} />
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} />
          </div>

          <span style={sectionLabel}>Geographic & Role Scope</span>
          <div>
            <label style={labelStyle}>Employee Category</label>
            <select value={form.employeeCategory} onChange={e => setForm(f => ({ ...f, employeeCategory: e.target.value }))} style={inputStyle}>
              <option value="">All</option>
              <option value="HEAD_OFFICE">Head Office</option>
              <option value="SHOP_FIELD">Shop / Field</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Role</label>
            <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} style={inputStyle}>
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
            <label style={labelStyle}>Employment Type</label>
            <select value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))} style={inputStyle}>
              <option value="">All</option>
              <option value="FULL_TIME">Full Time</option>
              <option value="PART_TIME">Part Time</option>
              <option value="CONTRACT">Contract</option>
              <option value="COMMISSION_BASED">Commission Based</option>
            </select>
          </div>
          <div></div>
          <div>
            <label style={labelStyle}>Department ID</label>
            <input value={form.departmentId} onChange={e => setForm(f => ({ ...f, departmentId: e.target.value }))} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Region ID</label>
            <input value={form.regionId} onChange={e => setForm(f => ({ ...f, regionId: e.target.value }))} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Area ID</label>
            <input value={form.areaId} onChange={e => setForm(f => ({ ...f, areaId: e.target.value }))} placeholder="Optional" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Shop ID</label>
            <input value={form.shopId} onChange={e => setForm(f => ({ ...f, shopId: e.target.value }))} placeholder="Optional" style={inputStyle} />
          </div>

          <span style={sectionLabel}>Calculation Settings</span>
          <div>
            <label style={labelStyle}>Rule Type</label>
            <select value={form.ruleType} onChange={e => setForm(f => ({ ...f, ruleType: e.target.value, calculationMethod: e.target.value }))} style={inputStyle}>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="THRESHOLD">Threshold</option>
              <option value="TIERED">Tiered</option>
              <option value="MANUAL_INPUT">Manual Input</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Calculation Method</label>
            <select value={form.calculationMethod} onChange={e => setForm(f => ({ ...f, calculationMethod: e.target.value }))} style={inputStyle}>
              <option value="FIXED_AMOUNT">Fixed Amount</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="THRESHOLD">Threshold</option>
              <option value="TIERED">Tiered</option>
              <option value="MANUAL_INPUT">Manual Input</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Base Amount</label>
            <input type="number" step="0.01" value={form.baseAmount} onChange={e => setForm(f => ({ ...f, baseAmount: e.target.value }))} style={inputStyle} />
          </div>
          {['PERCENTAGE', 'THRESHOLD'].includes(form.calculationMethod || form.ruleType) && (
            <div>
              <label style={labelStyle}>Percentage Rate (%)</label>
              <input type="number" step="0.01" value={form.percentageRate} onChange={e => setForm(f => ({ ...f, percentageRate: e.target.value }))} style={inputStyle} />
            </div>
          )}
          {form.ruleType === 'THRESHOLD' && (
            <div>
              <label style={labelStyle}>Threshold Value</label>
              <input type="number" step="0.01" value={form.thresholdValue} onChange={e => setForm(f => ({ ...f, thresholdValue: e.target.value }))} style={inputStyle} />
            </div>
          )}
          <div>
            <label style={labelStyle}>Min Amount</label>
            <input type="number" step="0.01" value={form.minAmount} onChange={e => setForm(f => ({ ...f, minAmount: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Max Amount</label>
            <input type="number" step="0.01" value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))} style={inputStyle} />
          </div>
          {['TIERED'].includes(form.ruleType) && (
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Tier Config (JSON array)</label>
              <textarea value={form.tierConfigJson} onChange={e => setForm(f => ({ ...f, tierConfigJson: e.target.value }))} placeholder='[{"min":60,"amount":2000},{"min":40,"amount":1000},{"min":0,"amount":0}]' style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
          )}
          <div style={{ gridColumn: '1/-1' }}>
            <label style={labelStyle}>Formula JSON</label>
            <textarea value={form.formulaJson} onChange={e => setForm(f => ({ ...f, formulaJson: e.target.value }))} placeholder="Optional custom formula (JSON)" style={{ ...inputStyle, minHeight: 60, fontFamily: 'monospace', fontSize: '0.85rem' }} />
          </div>

          <span style={sectionLabel}>Effective Dates & Flags</span>
          <div>
            <label style={labelStyle}>Effective From *</label>
            <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Effective To</label>
            <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Priority</label>
            <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle} />
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
