'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ResultsPage() {
  const params = useParams()
  const payId = params.payrollPeriodId as string

  const [period, setPeriod] = useState<any>(null)
  const [batch, setBatch] = useState<any>(null)
  const [rows, setRows] = useState<any[]>([])
  const [summary, setSummary] = useState<any>(null)
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const has = (p: string) => perms.includes(p)

  const fetchData = () => {
    setLoading(true)
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
  }

  useEffect(() => { fetchData() }, [payId])

  const handleStartReview = async () => {
    const r = await fetch(`/api/payroll-periods/${payId}/calculation/start-review`, { method: 'POST' })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Failed'); return }
    window.location.reload()
  }

  const handleValidate = async () => {
    const r = await fetch(`/api/payroll-periods/${payId}/calculation/validate`, { method: 'POST' })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Validation failed'); return }
    alert('Batch validated'); window.location.reload()
  }

  const handleApprove = async () => {
    if (!confirm('Approve this payroll calculation?')) return
    const r = await fetch(`/api/payroll-periods/${payId}/calculation/approve`, { method: 'POST' })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Approval failed'); return }
    alert('Approved!'); window.location.reload()
  }

  const handleReturn = async () => {
    const reason = prompt('Reason for return:')
    if (!reason) return
    const toInput = confirm('Return to Open for Input? Cancel = back to Ready for Calculation')
    const r = await fetch(`/api/payroll-periods/${payId}/calculation/return`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason, returnToInput: toInput }),
    })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Return failed'); return }
    alert('Returned'); window.location.reload()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <Link href={`/payroll-calculation/${payId}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Calculation Results</h1>
          <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
            {period?.periodName} — Batch v{batch?.version} ({batch?.status})
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {batch?.status === 'DRAFT' && period?.status === 'READY_FOR_REVIEW' && has('payrollCalculation.review') && (
            <ActionBtn onClick={handleStartReview} bg="#2563eb">Start Review</ActionBtn>
          )}
          {batch?.status === 'DRAFT' && period?.status === 'REVIEW_IN_PROGRESS' && has('payrollCalculation.validate') && (
            <ActionBtn onClick={handleValidate} bg="#2563eb">Complete Review</ActionBtn>
          )}
          {batch?.status === 'DRAFT' && period?.status === 'REVIEW_IN_PROGRESS' && has('payrollCalculation.return') && (
            <ActionBtn onClick={handleReturn} bg="#dc2626">Return</ActionBtn>
          )}
          {batch?.status === 'VALIDATED' && period?.status === 'REVIEW_IN_PROGRESS' && has('payrollCalculation.approve') && (
            <ActionBtn onClick={handleApprove} bg="#059669">Approve</ActionBtn>
          )}
          {has('payrollCalculation.export') && (
            <Link href={`/api/payroll-periods/${payId}/calculation/export`} target="_blank" style={{ ...actionBtnStyle, background: '#f3f4f6', color: '#374151', textDecoration: 'none' }}>Export CSV</Link>
          )}
          <button onClick={fetchData} style={actionBtnStyle}>Refresh</button>
        </div>
      </div>

      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <Card label="Employees" value={summary.totalEmployees} />
          <Card label="Gross Earnings" value={summary.grossEarningsTotal?.toLocaleString()} />
          <Card label="Taxable Income" value={summary.taxableIncomeTotal?.toLocaleString()} />
          <Card label="Emp Pension" value={summary.employeePensionTotal?.toLocaleString()} />
          <Card label="Empr Pension" value={summary.employerPensionTotal?.toLocaleString()} />
          <Card label="PAYE Tax" value={summary.payeTaxTotal?.toLocaleString()} />
          <Card label="Net Salary" value={summary.netSalaryTotal?.toLocaleString()} />
          <Card label="Employer Cost" value={summary.employerTotalCost?.toLocaleString()} />
          {summary.blockerCount > 0 && <Card label="Blockers" value={summary.blockerCount} color="#dc2626" />}
        </div>
      )}

      {rows.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                <th style={thStyle}>Code</th>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Role</th>
                <th style={thStyle}>Level</th>
                <th style={thStyle}>Basic</th>
                <th style={thStyle}>Gross</th>
                <th style={thStyle}>Taxable</th>
                <th style={thStyle}>Non-Taxable</th>
                <th style={thStyle}>Pensionable</th>
                <th style={thStyle}>Emp Pens</th>
                <th style={thStyle}>Empr Pens</th>
                <th style={thStyle}>PAYE</th>
                <th style={thStyle}>Pre Ded</th>
                <th style={thStyle}>Post Ded</th>
                <th style={thStyle}>Total Ded</th>
                <th style={thStyle}>Net</th>
                <th style={thStyle}>Cost</th>
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
                  <td style={tdStyle}>{r.level}</td>
                  <td style={tdStyle}>{Number(r.basicSalary || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.grossSalary || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.grossTaxableEarnings || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.grossNonTaxableEarnings || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.pensionableIncome || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.employeePension || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.employerPension || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.payeTax || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.preTaxDeductions || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.postTaxDeductions || 0).toLocaleString()}</td>
                  <td style={tdStyle}>{Number(r.totalDeductions || 0).toLocaleString()}</td>
                  <td style={tdStyle}><strong>{Number(r.netSalary || 0).toLocaleString()}</strong></td>
                  <td style={tdStyle}>{Number(r.employerTotalCost || 0).toLocaleString()}</td>
                  <td style={tdStyle}><StatusBadge status={r.readinessStatus} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Card({ label, value, color }: { label: string; value?: string | number; color?: string }) {
  return (
    <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '1rem', color: color || '#374151' }}>{value ?? '-'}</div>
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

function ActionBtn({ onClick, bg, children }: { onClick: () => void; bg: string; children: React.ReactNode }) {
  return (
    <button onClick={onClick} style={{
      padding: '0.5rem 1rem', borderRadius: 6, background: bg, color: '#fff',
      border: 'none', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 600,
    }}>{children}</button>
  )
}

const actionBtnStyle: React.CSSProperties = {
  padding: '0.5rem 1rem', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', color: '#374151', cursor: 'pointer', fontSize: '0.875rem', display: 'inline-block',
}

const thStyle: React.CSSProperties = { padding: '0.5rem 0.5rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '0.5rem 0.5rem', whiteSpace: 'nowrap' }
