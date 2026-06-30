'use client'

import { useEffect, useState } from 'react'

interface Component { id: string; code: string; name: string; componentType: string }
interface PayRule {
  id: string; name: string; componentId: string; calculationMethod: string; ruleType: string
  employeeCategory: string | null; role: string | null
  thresholdMetric: string | null; maxAmount: number | null; minAmount: number | null
  [key: string]: unknown
}

interface PreviewResult {
  calculatedAmount: number
  explanation: string
  warnings: string[]
  component?: { code: string; name: string }
  ruleName?: string
  role?: string
  category?: string
  metric?: string
  inputValue?: number
  maxAmount?: number
  minAmount?: number
}

export default function PreviewPage() {
  const [components, setComponents] = useState<Component[]>([])
  const [rules, setRules] = useState<PayRule[]>([])
  const [selectedComponent, setSelectedComponent] = useState('')
  const [selectedRule, setSelectedRule] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [result, setResult] = useState<PreviewResult | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/salary-structure/components').then(r => r.json()).then(j => setComponents(j.data || [])),
      fetch('/api/salary-structure/rules').then(r => r.json()).then(j => setRules(j.data || [])),
    ]).finally(() => setLoading(false))
  }, [])

  const filteredRules = rules.filter(r => !selectedComponent || r.componentId === selectedComponent)

  const handlePreview = async () => {
    setError('')
    setResult(null)
    if (!selectedRule || !inputValue) { setError('Select a rule and enter a value'); return }
    const res = await fetch('/api/salary-structure/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruleId: selectedRule, inputValue: Number(inputValue) }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Preview failed'); return }
    const selectedRuleData = rules.find(r => r.id === selectedRule)
    const comp = selectedRuleData ? components.find(c => c.id === selectedRuleData.componentId) : undefined
    setResult({
      ...json.data,
      component: comp ? { code: comp.code, name: comp.name } : undefined,
      ruleName: selectedRuleData?.name,
      role: selectedRuleData?.role || undefined,
      category: selectedRuleData?.employeeCategory || undefined,
      metric: selectedRuleData?.thresholdMetric || undefined,
      inputValue: Number(inputValue),
      maxAmount: selectedRuleData?.maxAmount ?? undefined,
      minAmount: selectedRuleData?.minAmount ?? undefined,
    })
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const sel = rules.find(r => r.id === selectedRule)

  return (
    <div style={{ maxWidth: 640, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Rule Preview Tool</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Filter by Component</label>
          <select value={selectedComponent} onChange={e => { setSelectedComponent(e.target.value); setSelectedRule(''); setResult(null) }} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
            <option value="">All Components</option>
            {components.map(c => <option key={c.id} value={c.id}>{c.code} - {c.name}</option>)}
          </select>
        </div>

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Rule *</label>
          <select value={selectedRule} onChange={e => { setSelectedRule(e.target.value); setResult(null) }} style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4 }}>
            <option value="">Select a rule...</option>
            {filteredRules.map(r => <option key={r.id} value={r.id}>{r.name} ({r.calculationMethod}){r.role ? ` - ${r.role}` : ''}</option>)}
          </select>
        </div>

        {sel && (
          <div style={{ fontSize: '0.85rem', color: '#6b7280', background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: 4 }}>
            Component: {components.find(c => c.id === sel.componentId)?.code || '-'} |
            Role: {sel.role || 'Any'} |
            Category: {sel.employeeCategory || 'Any'}
            {sel.thresholdMetric && <> | Metric: {sel.thresholdMetric}</>}
          </div>
        )}

        <div>
          <label style={{ fontSize: '0.85rem', fontWeight: 500 }}>Input Value</label>
          <input type="number" step="0.01" value={inputValue} onChange={e => setInputValue(e.target.value)} placeholder="e.g. sales achievement % or amount" style={{ width: '100%', padding: '0.4rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box' }} />
        </div>

        <button onClick={handlePreview} style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Calculate Preview</button>
      </div>

      {result && (
        <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 6, padding: '1rem' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#166534' }}>Preview Result</h3>
          {result.component && (
            <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 0.25rem' }}>
              Component: <strong>{result.component.code}</strong> - {result.component.name}
            </p>
          )}
          {result.ruleName && (
            <p style={{ fontSize: '0.85rem', color: '#374151', margin: '0 0 0.25rem' }}>
              Rule: <strong>{result.ruleName}</strong>
            </p>
          )}
          <p style={{ fontSize: '1.25rem', fontWeight: 700, color: '#166534', margin: '0 0 0.25rem' }}>
            Calculated Amount: {result.calculatedAmount.toLocaleString()} ETB
          </p>
          {result.maxAmount !== undefined && (
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.25rem' }}>
              Max Cap: {result.maxAmount.toLocaleString()} ETB
            </p>
          )}
          {result.minAmount !== undefined && (
            <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: '0 0 0.25rem' }}>
              Min Floor: {result.minAmount.toLocaleString()} ETB
            </p>
          )}
          <p style={{ fontSize: '0.9rem', color: '#374151', margin: '0 0 0.5rem' }}>{result.explanation}</p>
          {result.warnings.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: '1rem', color: '#92400e', fontSize: '0.85rem' }}>
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          )}
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <a href="/salary-structure" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Salary Structure</a>
      </div>
    </div>
  )
}
