'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PreviewPage() {
  const params = useParams()
  const payId = params.payrollPeriodId as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  const runPreview = () => {
    setLoading(true); setError('')
    fetch(`/api/payroll-periods/${payId}/calculation-preview`, { method: 'POST' })
      .then(r => r.json()).then(j => {
        if (j.error) setError(j.error)
        else setData(j.data)
      }).catch(() => setError('Preview failed')).finally(() => setLoading(false))
  }

  useEffect(() => { runPreview() }, [payId])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading preview...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Link href={`/payroll-calculation/${payId}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Calculation Preview</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={runPreview} style={{
            padding: '0.375rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db',
            background: '#fff', cursor: 'pointer', fontSize: '0.875rem',
          }}>Refresh</button>
          {data && data.blockerCount === 0 && (
            <button onClick={async () => {
              if (!confirm('Run final calculation?')) return
              setRunning(true)
              const r = await fetch(`/api/payroll-periods/${payId}/calculate`, { method: 'POST' })
              const j = await r.json()
              setRunning(false)
              if (!r.ok) { alert(j.error || 'Failed'); return }
              if (j.data?.blocked) { alert('Blocked'); return }
              alert(`Calculation complete! v${j.data.version}`)
              window.location.href = `/payroll-calculation/${payId}/results`
            }} style={{
              padding: '0.5rem 1rem', borderRadius: 6, background: '#059669', color: '#fff',
              border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
            }}>{running ? 'Calculating...' : 'Run Final Calculation'}</button>
          )}
        </div>
      </div>

      {error && <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: 6, marginBottom: '1rem', color: '#991b1b' }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <SummaryCard label="Employees" value={data.totalEmployees} color={data.blockerCount > 0 ? '#dc2626' : '#374151'} />
            <SummaryCard label="Gross Total" value={data.grossEarningsTotal?.toLocaleString() ?? '-'} />
            <SummaryCard label="Taxable Income" value={data.taxableIncomeTotal?.toLocaleString() ?? '-'} />
            <SummaryCard label="Emp Pension" value={data.employeePensionTotal?.toLocaleString() ?? '-'} />
            <SummaryCard label="PAYE" value={data.payeTaxTotal?.toLocaleString() ?? '-'} />
            <SummaryCard label="Net Total" value={data.netSalaryTotal?.toLocaleString() ?? '-'} />
          </div>

          {data.rows?.length > 0 && (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Basic</th>
                  <th style={thStyle}>Gross</th>
                  <th style={thStyle}>Taxable</th>
                  <th style={thStyle}>Non-Taxable</th>
                  <th style={thStyle}>Emp Pension</th>
                  <th style={thStyle}>Empr Pension</th>
                  <th style={thStyle}>PAYE</th>
                  <th style={thStyle}>Pre-Tax Ded</th>
                  <th style={thStyle}>Total Ded</th>
                  <th style={thStyle}>Net</th>
                  <th style={thStyle}>Employer Cost</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r: any, i: number) => (
                  <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>{r.employeeCode}</td>
                    <td style={tdStyle}>{r.fullName}</td>
                    <td style={tdStyle}>{r.role}</td>
                    <td style={tdStyle}>{Number(r.basicSalary || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.grossSalary || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.grossTaxableEarnings || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.grossNonTaxableEarnings || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.employeePension || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.employerPension || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.payeTax || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.preTaxDeductions || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.totalDeductions || 0).toLocaleString()}</td>
                    <td style={tdStyle}><strong>{Number(r.netSalary || 0).toLocaleString()}</strong></td>
                    <td style={tdStyle}>{Number(r.employerTotalCost || 0).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <StatusBadge status={r.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {data.rows?.some((r: any) => r.blockers?.length > 0 || r.warnings?.length > 0) && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Issues</h3>
              {data.rows.filter((r: any) => r.blockers?.length > 0 || r.warnings?.length > 0).map((r: any, i: number) => (
                <div key={i} style={{ padding: '0.5rem', marginBottom: '0.5rem', background: '#f9fafb', borderRadius: 6, fontSize: '0.8rem' }}>
                  <strong>{r.fullName}</strong>
                  {r.blockers?.map((b: string, j: number) => <div key={j} style={{ color: '#dc2626' }}>⛔ {b}</div>)}
                  {r.warnings?.map((w: string, j: number) => <div key={j} style={{ color: '#d97706' }}>⚠ {w}</div>)}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function SummaryCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: color || '#374151' }}>{value}</div>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    READY: { bg: '#d1fae5', fg: '#065f46' },
    WARNING: { bg: '#fef3c7', fg: '#92400e' },
    BLOCKED: { bg: '#fee2e2', fg: '#991b1b' },
  }
  const c = colors[status] || { bg: '#e5e7eb', fg: '#374151' }
  return <span style={{ padding: '0.125rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.fg }}>{status}</span>
}

const thStyle: React.CSSProperties = { padding: '0.5rem 0.5rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }
