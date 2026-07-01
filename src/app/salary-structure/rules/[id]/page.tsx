'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface PayRule {
  id: string; componentId: string; component?: { code: string; name: string }
  name: string; description: string | null
  employeeCategory: string | null; role: string | null
  departmentId: string | null; regionId: string | null; areaId: string | null; shopId: string | null
  employmentType: string | null
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

  const emptyForm: Record<string, string> = {
    name: '', description: '', employeeCategory: '', role: '',
    departmentId: '', regionId: '', areaId: '', shopId: '', employmentType: '',
    ruleType: 'FIXED_AMOUNT', calculationMethod: 'FIXED_AMOUNT',
    baseAmount: '', percentageRate: '', maxAmount: '', minAmount: '',
    thresholdValue: '', thresholdMetric: '',
    tierConfigJson: '', formulaJson: '',
    requiresManualInput: 'false', requiresApproval: 'false',
    effectiveFrom: '', effectiveTo: '', status: 'DRAFT', priority: '0',
  }
  const [form, setForm] = useState<Record<string, string>>(emptyForm)

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
            departmentId: r.departmentId || '', regionId: r.regionId || '', areaId: r.areaId || '', shopId: r.shopId || '',
            employmentType: r.employmentType || '',
            ruleType: r.ruleType, calculationMethod: r.calculationMethod,
            baseAmount: r.baseAmount?.toString() || '',
            percentageRate: r.percentageRate?.toString() || '',
            maxAmount: r.maxAmount?.toString() || '',
            minAmount: r.minAmount?.toString() || '',
            thresholdValue: r.thresholdValue?.toString() || '',
            thresholdMetric: r.thresholdMetric || '',
            tierConfigJson: r.tierConfigJson || '',
            formulaJson: r.formulaJson || '',
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
      departmentId: form.departmentId || undefined,
      regionId: form.regionId || undefined,
      areaId: form.areaId || undefined,
      shopId: form.shopId || undefined,
      employmentType: form.employmentType || undefined,
      ruleType: form.ruleType,
      calculationMethod: form.calculationMethod || form.ruleType,
      baseAmount: form.baseAmount ? Number(form.baseAmount) : null,
      percentageRate: form.percentageRate ? Number(form.percentageRate) : null,
      maxAmount: form.maxAmount ? Number(form.maxAmount) : null,
      minAmount: form.minAmount ? Number(form.minAmount) : null,
      thresholdValue: form.thresholdValue ? Number(form.thresholdValue) : null,
      thresholdMetric: form.thresholdMetric || null,
      tierConfigJson: form.tierConfigJson || null,
      formulaJson: form.formulaJson || null,
      requiresManualInput: form.requiresManualInput === 'true',
      requiresApproval: form.requiresApproval === 'true',
      effectiveFrom: form.effectiveFrom,
      effectiveTo: form.effectiveTo || null,
      status: form.status,
      priority: Number(form.priority),
    }
    Object.keys(body).forEach(k => { if (body[k] === undefined) delete body[k] })

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

  const [reason, setReason] = useState('')
  const [showReasonPrompt, setShowReasonPrompt] = useState<'activate' | 'deactivate' | null>(null)

  const handleRequestActivation = async () => {
    setError('')
    if (!reason) { setError('Reason is required to request activation'); return }
    const res = await fetch(`/api/salary-structure/rules/${id}/request-activation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Request failed'); return }
    setReason('')
    setShowReasonPrompt(null)
    alert('Activation request submitted for approval')
  }

  const handleRequestDeactivation = async () => {
    setError('')
    if (!reason) { setError('Reason is required to request deactivation'); return }
    const res = await fetch(`/api/salary-structure/rules/${id}/request-deactivation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reason }) })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Request failed'); return }
    setReason('')
    setShowReasonPrompt(null)
    alert('Deactivation request submitted for approval')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!rule) return <div style={{ padding: '2rem', textAlign: 'center' }}>Rule not found</div>

  const labelStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 500, display: 'block', marginBottom: 2 }
  const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }
  const sectionLabel: React.CSSProperties = { fontSize: '0.8rem', fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', marginBottom: '0.5rem', display: 'block' }

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{rule.name}</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {rule.status === 'DRAFT' && has('salaryRuleApproval.request') && (
            <button onClick={() => { setReason(''); setShowReasonPrompt('activate') }} style={{ background: '#059669', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Request Activation</button>
          )}
          {rule.status === 'ACTIVE' && has('salaryRuleApproval.request') && (
            <button onClick={() => { setReason(''); setShowReasonPrompt('deactivate') }} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Request Deactivation</button>
          )}
          {has('salaryStructure.manageRules') && !editing && (
            <button onClick={() => setEditing(true)} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Edit</button>
          )}
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showReasonPrompt && (
        <div style={{ background: '#f9fafb', padding: '1rem', borderRadius: 6, marginBottom: '1rem', border: '1px solid #d1d5db' }}>
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{showReasonPrompt === 'activate' ? 'Request Activation' : 'Request Deactivation'}</p>
          <textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Reason for request..." style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', minHeight: 60, fontSize: '0.9rem' }} />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button onClick={showReasonPrompt === 'activate' ? handleRequestActivation : handleRequestDeactivation} disabled={!reason} style={{ background: reason ? '#2563eb' : '#999', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: reason ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>Submit</button>
            <button onClick={() => setShowReasonPrompt(null)} style={{ padding: '0.35rem 1rem', background: 'none', border: '1px solid #ccc', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Cancel</button>
          </div>
        </div>
      )}

      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Name</label>
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Description</label>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ ...inputStyle, minHeight: 60 }} />
            </div>

            <span style={sectionLabel}>Status & Priority</span>
            <div>
              <label style={labelStyle}>Status</label>
              <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} style={inputStyle}>
                <option value="DRAFT">Draft</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div>
              <label style={labelStyle}>Priority</label>
              <input type="number" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inputStyle} />
            </div>

            <span style={{ ...sectionLabel, gridColumn: '1/-1' }}>Geographic & Role Scope</span>
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

            <span style={{ ...sectionLabel, gridColumn: '1/-1' }}>Calculation Settings</span>
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
            <div>
              <label style={labelStyle}>Percentage Rate (%)</label>
              <input type="number" step="0.01" value={form.percentageRate} onChange={e => setForm(f => ({ ...f, percentageRate: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Min Amount</label>
              <input type="number" step="0.01" value={form.minAmount} onChange={e => setForm(f => ({ ...f, minAmount: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Max Amount</label>
              <input type="number" step="0.01" value={form.maxAmount} onChange={e => setForm(f => ({ ...f, maxAmount: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Threshold Value</label>
              <input type="number" step="0.01" value={form.thresholdValue} onChange={e => setForm(f => ({ ...f, thresholdValue: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Threshold Metric</label>
              <select value={form.thresholdMetric} onChange={e => setForm(f => ({ ...f, thresholdMetric: e.target.value }))} style={inputStyle}>
                <option value="">None</option>
                <option value="SALES_ACHIEVEMENT_PERCENT">Sales Achievement %</option>
                <option value="KPI_PERCENT">KPI %</option>
              </select>
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Tier Config (JSON array)</label>
              <textarea value={form.tierConfigJson} onChange={e => setForm(f => ({ ...f, tierConfigJson: e.target.value }))} placeholder='[{"min":60,"amount":2000},{"min":40,"amount":1000},{"min":0,"amount":0}]' style={{ ...inputStyle, minHeight: 80, fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={labelStyle}>Formula JSON</label>
              <textarea value={form.formulaJson} onChange={e => setForm(f => ({ ...f, formulaJson: e.target.value }))} placeholder="Optional custom formula (JSON)" style={{ ...inputStyle, minHeight: 60, fontFamily: 'monospace', fontSize: '0.85rem' }} />
            </div>

            <span style={{ ...sectionLabel, gridColumn: '1/-1' }}>Effective Dates & Flags</span>
            <div>
              <label style={labelStyle}>Effective From *</label>
              <input type="date" value={form.effectiveFrom} onChange={e => setForm(f => ({ ...f, effectiveFrom: e.target.value }))} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Effective To</label>
              <input type="date" value={form.effectiveTo} onChange={e => setForm(f => ({ ...f, effectiveTo: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.requiresManualInput === 'true'} onChange={e => setForm(f => ({ ...f, requiresManualInput: e.target.checked ? 'true' : 'false' }))} /> Requires Manual Input</label>
              <label style={{ fontSize: '0.9rem' }}><input type="checkbox" checked={form.requiresApproval === 'true'} onChange={e => setForm(f => ({ ...f, requiresApproval: e.target.checked ? 'true' : 'false' }))} /> Requires Approval</label>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
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
            <div><strong>Employment Type:</strong> {rule.employmentType || '-'}</div>
            <div><strong>Department:</strong> {rule.departmentId || '-'}</div>
            <div><strong>Region:</strong> {rule.regionId || '-'}</div>
            <div><strong>Area:</strong> {rule.areaId || '-'}</div>
            <div><strong>Shop:</strong> {rule.shopId || '-'}</div>
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
          {rule.formulaJson && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong style={{ fontSize: '0.85rem' }}>Formula JSON:</strong>
              <pre style={{ background: '#1f2937', color: '#93c5fd', padding: '0.75rem', borderRadius: 4, fontSize: '0.8rem', overflow: 'auto', marginTop: '0.25rem' }}>{rule.formulaJson}</pre>
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
