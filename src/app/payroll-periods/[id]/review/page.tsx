'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

interface Period { id: string; periodName: string; status: string; periodStart: string; periodEnd: string }
interface InputRecord { id: string; employeeId: string; employee: { employeeId: string; fullName: string; currentRole: string }; inputType: { code: string; name: string }; value: number | null; amount: number | null; status: string; source: string; note: string | null; isLocked: boolean; submittedById: string | null; submittedAt: string | null; submittedBy: { name: string } | null }
interface MissingInput { employeeId: string; employeeName: string; role: string; department: string | null; shop: string | null; missingInputTypeCode: string; missingInputTypeName: string; severity: string; suggestedAction: string }

export default function PayrollReviewPage() {
  const params = useParams()
  const id = params.id as string
  const [period, setPeriod] = useState<Period | null>(null)
  const [inputs, setInputs] = useState<InputRecord[]>([])
  const [missing, setMissing] = useState<{ blockers: MissingInput[]; warnings: MissingInput[]; infos: MissingInput[] }>({ blockers: [], warnings: [], infos: [] })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const [periodRes, inputsRes, missingRes] = await Promise.all([
        fetch(`/api/payroll-periods/${id}`).then(r => r.json()),
        fetch(`/api/payroll-periods/${id}/inputs`).then(r => r.json()),
        fetch(`/api/payroll-periods/${id}/missing-inputs`).then(r => r.json()),
      ])
      setPeriod(periodRes.data)
      setInputs(inputsRes.data || [])
      setMissing(missingRes.data || { blockers: [], warnings: [], infos: [] })
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6"><p>Loading review dashboard...</p></div>
  if (!period) return <div className="p-6"><p>Period not found</p></div>

  const draftCount = inputs.filter(i => i.status === 'DRAFT').length
  const submittedCount = inputs.filter(i => i.status === 'SUBMITTED').length
  const returnedCount = inputs.filter(i => i.status === 'RETURNED').length
  const acceptedCount = inputs.filter(i => i.status === 'ACCEPTED').length
  const rejectedCount = inputs.filter(i => i.status === 'REJECTED').length
  const lockedCount = inputs.filter(i => i.isLocked).length
  const unlockedCount = inputs.filter(i => !i.isLocked).length
  const totalMissing = missing.blockers.length + missing.warnings.length + missing.infos.length

  const cards = [
    { label: 'Total Inputs', value: inputs.length },
    { label: 'Draft', value: draftCount, color: '#f59e0b' },
    { label: 'Submitted', value: submittedCount, color: '#3b82f6' },
    { label: 'Returned', value: returnedCount, color: '#8b5cf6' },
    { label: 'Accepted', value: acceptedCount, color: '#10b981' },
    { label: 'Rejected', value: rejectedCount, color: '#ef4444' },
    { label: 'Missing Inputs', value: totalMissing, color: totalMissing > 0 ? '#ef4444' : '#10b981' },
    { label: 'Locked', value: lockedCount, color: '#6366f1' },
    { label: 'Unlocked', value: unlockedCount },
    { label: 'Ready for Calc', value: period.status === 'READY_FOR_CALCULATION' ? 'Yes' : 'No', color: period.status === 'READY_FOR_CALCULATION' ? '#10b981' : '#ef4444' },
  ]

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '8px' }}>Review Dashboard</h1>
      <p style={{ color: '#666', marginBottom: '16px' }}>{period.periodName} &mdash; <strong>{period.status}</strong></p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        {cards.map(c => (
          <div key={c.label} style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px 20px', minWidth: '120px', textAlign: 'center' }}>
            <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{c.label}</div>
            <div style={{ fontSize: '24px', fontWeight: 'bold', color: c.color || '#333' }}>{c.value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '8px' }}>Missing Inputs</h2>
      {missing.blockers.length > 0 && (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '16px' }}>
          <thead><tr style={{ background: '#fee2e2' }}><th style={thStyle}>Employee</th><th style={thStyle}>Role</th><th style={thStyle}>Missing Type</th><th style={thStyle}>Severity</th><th style={thStyle}>Action</th></tr></thead>
          <tbody>
            {missing.blockers.map((m, i) => (
              <tr key={i}><td style={tdStyle}>{m.employeeName} ({m.employeeId})</td><td style={tdStyle}>{m.role}</td><td style={tdStyle}>{m.missingInputTypeName}</td><td style={tdStyle}><span style={{ color: '#ef4444', fontWeight: 'bold' }}>{m.severity}</span></td><td style={tdStyle}>{m.suggestedAction}</td></tr>
            ))}
          </tbody>
        </table>
      )}
      {missing.blockers.length === 0 && <p style={{ color: '#10b981' }}>No missing required inputs.</p>}

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '24px', marginBottom: '8px' }}>Input Review List</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr style={{ background: '#f3f4f6' }}><th style={thStyle}>Employee</th><th style={thStyle}>Input Type</th><th style={thStyle}>Value</th><th style={thStyle}>Amount</th><th style={thStyle}>Status</th><th style={thStyle}>Source</th><th style={thStyle}>Locked</th></tr></thead>
        <tbody>
          {inputs.slice(0, 50).map(inp => (
            <tr key={inp.id}>
              <td style={tdStyle}>{inp.employee?.fullName || inp.employeeId}</td>
              <td style={tdStyle}>{inp.inputType?.name || '-'}</td>
              <td style={tdStyle}>{inp.value ?? '-'}</td>
              <td style={tdStyle}>{inp.amount ?? '-'}</td>
              <td style={tdStyle}><StatusBadge status={inp.status} /></td>
              <td style={tdStyle}>{inp.source}</td>
              <td style={tdStyle}>{inp.isLocked ? 'Locked' : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {inputs.length === 0 && <p style={{ color: '#999' }}>No input records yet.</p>}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = { DRAFT: '#f59e0b', SUBMITTED: '#3b82f6', RETURNED: '#8b5cf6', ACCEPTED: '#10b981', REJECTED: '#ef4444' }
  return <span style={{ color: colors[status] || '#666', fontWeight: 'bold' }}>{status}</span>
}

const thStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', textAlign: 'left', fontSize: '13px' }
const tdStyle: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', fontSize: '13px' }
