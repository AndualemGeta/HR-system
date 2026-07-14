'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function PayrollCalculationDetailPage() {
  const params = useParams()
  const payId = params.payrollPeriodId as string

  const [period, setPeriod] = useState<any>(null)
  const [batch, setBatch] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('overview')

  const has = (p: string) => perms.includes(p)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payroll-periods/${payId}`).then(r => r.json()).then(j => setPeriod(j.data)),
      fetch(`/api/payroll-periods/${payId}/calculation`).then(r => r.json()).then(j => {
        if (j.data) {
          setBatch(j.data.batch)
          setRows(j.data.rows || [])
          setSummary(j.data.summary)
        }
      }),
    ]).finally(() => setLoading(false))
  }, [payId])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Link href="/payroll-calculation" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back to Calculations
      </Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.75rem 0' }}>
        {period?.periodName || 'Payroll Period'}
      </h1>

      {period && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', fontSize: '0.875rem', color: '#6b7280' }}>
          <span>Period: {new Date(period.periodStart).toLocaleDateString()} – {new Date(period.periodEnd).toLocaleDateString()}</span>
          <span>Pay Date: {new Date(period.payDate).toLocaleDateString()}</span>
          <span>Status: <strong>{period.status}</strong></span>
          {batch && <span>Version: <strong>v{batch.version}</strong></span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb', paddingBottom: '0.5rem' }}>
        {['overview', 'employees', 'actions'].map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              padding: '0.5rem 1rem', border: 'none', background: 'transparent', cursor: 'pointer',
              fontWeight: activeTab === tab ? 600 : 400, color: activeTab === tab ? '#2563eb' : '#6b7280',
              borderBottom: activeTab === tab ? '2px solid #2563eb' : '2px solid transparent', marginBottom: '-0.5rem',
            }}>
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          {!batch ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
              No calculation batch exists yet.
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}>
                {has('payrollCalculation.readiness') && <Link href={`/payroll-calculation/${payId}/readiness`} style={btnStyle}>Check Readiness</Link>}
                {has('payrollCalculation.preview') && <Link href={`/payroll-calculation/${payId}/preview`} style={btnStyle}>Preview</Link>}
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <SummaryCard label="Employees" value={summary?.totalEmployees ?? '-'} />
                <SummaryCard label="Gross Earnings" value={summary?.grossEarningsTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="Taxable Income" value={summary?.taxableIncomeTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="Employee Pension" value={summary?.employeePensionTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="Employer Pension" value={summary?.employerPensionTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="PAYE Tax" value={summary?.payeTaxTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="Net Salary" value={summary?.netSalaryTotal?.toLocaleString() ?? '-'} />
                <SummaryCard label="Employer Cost" value={summary?.employerTotalCost?.toLocaleString() ?? '-'} />
              </div>

              {summary?.blockerCount > 0 && (
                <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: 6, marginBottom: '1rem', color: '#991b1b', fontSize: '0.875rem' }}>
                  {summary.blockerCount} employee(s) have blockers
                </div>
              )}

              <Link href={`/payroll-calculation/${payId}/results`} style={{ ...btnStyle, background: '#2563eb', color: '#fff' }}>View Full Results</Link>
            </div>
          )}
        </>
      )}

      {activeTab === 'employees' && (
        <div>
          {rows.length === 0 ? (
            <div style={{ color: '#6b7280' }}>No employees in this batch.</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Code</th>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Gross</th>
                  <th style={thStyle}>Taxable</th>
                  <th style={thStyle}>Pension</th>
                  <th style={thStyle}>PAYE</th>
                  <th style={thStyle}>Net</th>
                  <th style={thStyle}>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r: any) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}>
                      <Link href={`/payroll-calculation/${payId}/employees/${r.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                        {r.employeeCode}
                      </Link>
                    </td>
                    <td style={tdStyle}>{r.fullName}</td>
                    <td style={tdStyle}>{r.role}</td>
                    <td style={tdStyle}>{Number(r.grossSalary || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.taxableIncome || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.employeePension || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.payeTax || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(r.netSalary || 0).toLocaleString()}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '0.125rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600,
                        background: r.readinessStatus === 'READY' ? '#d1fae5' : r.readinessStatus === 'WARNING' ? '#fef3c7' : '#fee2e2',
                        color: r.readinessStatus === 'READY' ? '#065f46' : r.readinessStatus === 'WARNING' ? '#92400e' : '#991b1b',
                      }}>
                        {r.readinessStatus}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {has('payrollCalculation.readiness') && period?.status === 'READY_FOR_CALCULATION' && (
            <Link href={`/payroll-calculation/${payId}/readiness`} style={{ ...actionBtn, background: '#dbeafe', color: '#1e40af' }}>Check Readiness</Link>
          )}
          {has('payrollCalculation.preview') && period?.status === 'READY_FOR_CALCULATION' && (
            <Link href={`/payroll-calculation/${payId}/preview`} style={{ ...actionBtn, background: '#fef3c7', color: '#92400e' }}>Preview Calculation</Link>
          )}
          {has('payrollCalculation.calculate') && period?.status === 'READY_FOR_CALCULATION' && (
            <button onClick={async () => {
              if (!confirm('Run final calculation?')) return
              const r = await fetch(`/api/payroll-periods/${payId}/calculate`, { method: 'POST' })
              const j = await r.json()
              if (!r.ok) { alert(j.error || 'Failed'); return }
              if (j.data?.blocked) { alert('Blocked: ' + (j.data.blockers?.join(', ') || 'check readiness')); return }
              alert(`Complete! v${j.data.version}`); window.location.reload()
            }} style={{ ...actionBtn, background: '#059669', color: '#fff', border: 'none' }}>Run Final Calculation</button>
          )}
          {batch?.status === 'DRAFT' && period?.status === 'READY_FOR_REVIEW' && has('payrollCalculation.review') && (
            <button onClick={async () => {
              const r = await fetch(`/api/payroll-periods/${payId}/calculation/start-review`, { method: 'POST' })
              if (!r.ok) { const j = await r.json(); alert(j.error || 'Failed'); return }
              window.location.reload()
            }} style={{ ...actionBtn, background: '#2563eb', color: '#fff', border: 'none' }}>Start Review</button>
          )}
          {batch?.status === 'DRAFT' && period?.status === 'REVIEW_IN_PROGRESS' && has('payrollCalculation.validate') && (
            <button onClick={async () => {
              const r = await fetch(`/api/payroll-periods/${payId}/calculation/validate`, { method: 'POST' })
              if (!r.ok) { const j = await r.json(); alert(j.error || 'Validation failed'); return }
              alert('Batch validated'); window.location.reload()
            }} style={{ ...actionBtn, background: '#2563eb', color: '#fff', border: 'none' }}>Complete Review (Validate)</button>
          )}
          {batch?.status === 'VALIDATED' && period?.status === 'REVIEW_IN_PROGRESS' && has('payrollCalculation.approve') && (
            <button onClick={async () => {
              if (!confirm('Approve this payroll calculation?')) return
              const r = await fetch(`/api/payroll-periods/${payId}/calculation/approve`, { method: 'POST' })
              if (!r.ok) { const j = await r.json(); alert(j.error || 'Approval failed'); return }
              alert('Approved!'); window.location.reload()
            }} style={{ ...actionBtn, background: '#059669', color: '#fff', border: 'none' }}>Approve</button>
          )}
          {(period?.status === 'REVIEW_IN_PROGRESS') && has('payrollCalculation.return') && (
            <button onClick={async () => {
              const reason = prompt('Reason for return:')
              if (!reason) return
              const target = confirm('Return to Open for Input? Cancel = back to Ready for Calculation')
              const r = await fetch(`/api/payroll-periods/${payId}/calculation/return`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason, returnToInput: target }),
              })
              if (!r.ok) { const j = await r.json(); alert(j.error || 'Return failed'); return }
              alert('Returned'); window.location.reload()
            }} style={{ ...actionBtn, background: '#dc2626', color: '#fff', border: 'none' }}>Return</button>
          )}
          {has('payrollCalculation.reopen') && ['APPROVED', 'READY_FOR_REVIEW', 'REVIEW_IN_PROGRESS'].includes(period?.status || '') && (
            <button onClick={async () => {
              const reason = prompt('Reason for reopening:')
              if (!reason) return
              const r = await fetch(`/api/payroll-periods/${payId}/reopen-calculation`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason }),
              })
              if (!r.ok) { const j = await r.json(); alert(j.error || 'Reopen failed'); return }
              alert('Reopened'); window.location.reload()
            }} style={{ ...actionBtn, background: '#dc2626', color: '#fff', border: 'none' }}>Reopen Calculation</button>
          )}
          {has('payrollCalculation.export') && batch && (
            <Link href={`/api/payroll-periods/${payId}/calculation/export`} target="_blank" style={{ ...actionBtn, background: '#f3f4f6', color: '#374151' }}>Export CSV</Link>
          )}
        </div>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280', marginBottom: '0.25rem' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{value}</div>
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.875rem',
  textDecoration: 'none', display: 'inline-block',
}

const actionBtn: React.CSSProperties = {
  ...btnStyle,
  textAlign: 'center' as const,
  fontWeight: 600,
  maxWidth: 300,
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb',
}

const tdStyle: React.CSSProperties = {
  padding: '0.5rem 0.75rem',
}
