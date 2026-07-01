'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'

export default function PreparationSummaryPage() {
  const params = useParams()
  const id = params.id as string
  const [summary, setSummary] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/payroll-periods/${id}/preparation-summary`).then(r => r.json())
      setSummary(res.data)
      setLoading(false)
    }
    load()
  }, [id])

  if (loading) return <div className="p-6"><p>Loading summary...</p></div>
  if (!summary) return <div className="p-6"><p>Summary not found</p></div>

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>Preparation Summary</h1>
        <a href={`/api/payroll-periods/${id}/preparation-summary/export`} style={{ padding: '8px 16px', background: '#3b82f6', color: 'white', borderRadius: '4px', textDecoration: 'none' }}>Export CSV</a>
      </div>
      <p style={{ color: '#666', marginBottom: '16px' }}>{summary.periodDetails?.periodName} &mdash; Status: <strong>{summary.reviewStatus}</strong></p>

      <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '24px' }}>
        <SummaryCard label="Selected Employees" value={summary.selectedEmployeeCount} />
        <SummaryCard label="Ready" value={summary.readyEmployeeCount} color="#10b981" />
        <SummaryCard label="Not Ready" value={summary.notReadyEmployeeCount} color={summary.notReadyEmployeeCount > 0 ? '#ef4444' : undefined} />
        <SummaryCard label="Total Inputs" value={summary.inputStatusSummary?.total || 0} />
        <SummaryCard label="Locked" value={summary.lockedInputSummary?.locked || 0} />
        <SummaryCard label="Unlocked" value={summary.lockedInputSummary?.unlocked || 0} />
        <SummaryCard label="Missing (Blocker)" value={summary.missingInputSummary?.blockers || 0} color={(summary.missingInputSummary?.blockers || 0) > 0 ? '#ef4444' : '#10b981'} />
      </div>

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px' }}>Input Status</h2>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '8px' }}>
        <thead><tr style={{ background: '#f3f4f6' }}><th style={s}>Status</th><th style={s}>Count</th></tr></thead>
        <tbody>
          {summary.inputStatusSummary?.byStatus && Object.entries(summary.inputStatusSummary.byStatus).map(([status, count]) => (
            <tr key={status}><td style={s}>{status}</td><td style={s}>{(count as number)}</td></tr>
          ))}
        </tbody>
      </table>

      <h2 style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '16px' }}>Ready for Calculation Checklist</h2>
      <div style={{ marginTop: '8px' }}>
        <p>Missing Required: {summary.readyForCalculationChecklist?.missingRequiredInputs || 0}</p>
        <p>Rejected: {summary.readyForCalculationChecklist?.rejectedInputs || 0}</p>
        <p>Returned: {summary.readyForCalculationChecklist?.returnedInputs || 0}</p>
        <p>Unlocked Accepted: {summary.readyForCalculationChecklist?.unlockedAcceptedInputs || 0}</p>
        <p><strong>Ready: {summary.readyForCalculationChecklist?.isReady ? 'YES' : 'NO'}</strong></p>
      </div>
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: number | string; color?: string }) {
  return (
    <div style={{ border: '1px solid #ddd', borderRadius: '8px', padding: '12px 20px', minWidth: '120px', textAlign: 'center' }}>
      <div style={{ fontSize: '12px', color: '#666', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: color || '#333' }}>{value}</div>
    </div>
  )
}

const s: React.CSSProperties = { border: '1px solid #ddd', padding: '8px', textAlign: 'left', fontSize: '13px' }
