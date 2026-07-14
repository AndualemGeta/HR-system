'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface BatchSummary {
  batchId: string | null
  version: number | null
  status: string | null
  grossEarningsTotal: number | null
  payeTaxTotal: number | null
  employeePensionTotal: number | null
  netSalaryTotal: number | null
  employeeCount: number | null
  blockerCount: number | null
}

interface PeriodWithCalc {
  id: string
  periodName: string
  periodStart: string
  periodEnd: string
  payDate: string
  status: string
  batch: BatchSummary | null
}

const statusColors: Record<string, string> = {
  DRAFT: '#e5e7eb',
  OPEN_FOR_INPUT: '#dbeafe',
  INPUT_COLLECTION_CLOSED: '#fef3c7',
  READY_FOR_REVIEW: '#d1fae5',
  REVIEW_IN_PROGRESS: '#fef3c7',
  READY_FOR_CALCULATION: '#dbeafe',
  APPROVED: '#d1fae5',
  CANCELLED: '#fee2e2',
}

const batchStatusColors: Record<string, string> = {
  DRAFT: '#fef3c7',
  VALIDATED: '#dbeafe',
  APPROVED: '#d1fae5',
  CANCELLED: '#fee2e2',
}

export default function PayrollCalculationPage() {
  const [periods, setPeriods] = useState<PeriodWithCalc[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  const has = (p: string) => perms.includes(p)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/payroll-periods').then(r => r.json()).then(async (j) => {
        const list: PeriodWithCalc[] = []
        for (const p of (j.data || [])) {
          let batch = null
          try {
            const b = await fetch(`/api/payroll-periods/${p.id}/calculation`).then(r => r.json())
            batch = b.data?.batch || null
          } catch {}
          list.push({ ...p, batch })
        }
        setPeriods(list)
      }),
    ]).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const calcPages = ['DRAFT', 'OPEN_FOR_INPUT', 'INPUT_COLLECTION_CLOSED']
  const readyStatuses = ['READY_FOR_CALCULATION', 'READY_FOR_REVIEW', 'REVIEW_IN_PROGRESS', 'APPROVED']

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Payroll Calculation</h1>
      </div>

      {periods.filter(p => readyStatuses.includes(p.status) || (p.batch && p.batch.batchId)).length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          No payroll periods with calculations yet. Open a period, collect inputs, and mark it ready for calculation.
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {periods
            .filter(p => readyStatuses.includes(p.status) || (p.batch && p.batch.batchId))
            .sort((a, b) => new Date(b.periodEnd).getTime() - new Date(a.periodEnd).getTime())
            .map(p => {
              const canCalc = p.status === 'READY_FOR_CALCULATION' && has('payrollCalculation.calculate')
              const canReview = p.status === 'READY_FOR_REVIEW' && has('payrollCalculation.review')
              const canView = has('payrollCalculation.view')
              return (
                <div key={p.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem', background: '#fff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <Link href={`/payroll-calculation/${p.id}`} style={{ fontSize: '1.125rem', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}>
                        {p.periodName}
                      </Link>
                      <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                        {new Date(p.periodStart).toLocaleDateString()} – {new Date(p.periodEnd).toLocaleDateString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: statusColors[p.status] || '#e5e7eb', color: '#374151' }}>
                        {p.status}
                      </span>
                      {p.batch && (
                        <span style={{ padding: '0.25rem 0.75rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: batchStatusColors[p.batch.status || ''] || '#e5e7eb' }}>
                          v{p.batch.version} {p.batch.status}
                        </span>
                      )}
                    </div>
                  </div>

                  {p.batch && (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '0.75rem', marginTop: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6 }}>
                      <div><div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Employees</div><div style={{ fontWeight: 600 }}>{p.batch.employeeCount ?? '-'}</div></div>
                      <div><div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Gross</div><div style={{ fontWeight: 600 }}>{p.batch.grossEarningsTotal?.toLocaleString() ?? '-'}</div></div>
                      <div><div style={{ fontSize: '0.75rem', color: '#6b7280' }}>PAYE</div><div style={{ fontWeight: 600 }}>{p.batch.payeTaxTotal?.toLocaleString() ?? '-'}</div></div>
                      <div><div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Pension (Emp)</div><div style={{ fontWeight: 600 }}>{p.batch.employeePensionTotal?.toLocaleString() ?? '-'}</div></div>
                      <div><div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Net</div><div style={{ fontWeight: 600 }}>{p.batch.netSalaryTotal?.toLocaleString() ?? '-'}</div></div>
                      {p.batch.blockerCount != null && p.batch.blockerCount > 0 && (
                        <div><div style={{ fontSize: '0.75rem', color: '#dc2626' }}>Blockers</div><div style={{ fontWeight: 600, color: '#dc2626' }}>{p.batch.blockerCount}</div></div>
                      )}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', flexWrap: 'wrap' }}>
                    {canView && <Link href={`/payroll-calculation/${p.id}`} style={btnStyle}>View</Link>}
                    {p.status === 'READY_FOR_CALCULATION' && has('payrollCalculation.readiness') && (
                      <Link href={`/payroll-calculation/${p.id}/readiness`} style={btnStyle}>Readiness</Link>
                    )}
                    {p.status === 'READY_FOR_CALCULATION' && has('payrollCalculation.preview') && (
                      <Link href={`/payroll-calculation/${p.id}/preview`} style={btnStyle}>Preview</Link>
                    )}
                    {canCalc && (
                      <button onClick={async () => {
                        if (!confirm('Calculate payroll for this period?')) return
                        const r = await fetch(`/api/payroll-periods/${p.id}/calculate`, { method: 'POST' })
                        const j = await r.json()
                        if (!r.ok) { alert(j.error || 'Calculation failed'); return }
                        if (j.data?.blocked) { alert('Calculation blocked. Check readiness.'); return }
                        alert(`Calculation complete! Batch: ${j.data.batchId}, v${j.data.version}`)
                        window.location.reload()
                      }} style={{ ...btnStyle, background: '#059669', color: '#fff' }}>Calculate</button>
                    )}
                    {canReview && (
                      <Link href={`/payroll-calculation/${p.id}/results`} style={{ ...btnStyle, background: '#2563eb', color: '#fff' }}>Review</Link>
                    )}
                  </div>
                </div>
              )
            })}
        </div>
      )}
    </div>
  )
}

const btnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem',
  borderRadius: 6,
  border: '1px solid #d1d5db',
  background: '#fff',
  color: '#374151',
  cursor: 'pointer',
  fontSize: '0.875rem',
  textDecoration: 'none',
  display: 'inline-block',
}
