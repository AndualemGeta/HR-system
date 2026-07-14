'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function ReadinessPage() {
  const params = useParams()
  const payId = params.payrollPeriodId as string
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchReadiness = () => {
    setLoading(true)
    fetch(`/api/payroll-periods/${payId}/calculation-readiness`)
      .then(r => r.json()).then(j => {
        if (j.error) setError(j.error)
        else setData(j.data)
      }).catch(() => setError('Failed to load')).finally(() => setLoading(false))
  }

  useEffect(() => { fetchReadiness() }, [payId])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <Link href={`/payroll-calculation/${payId}`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Calculation Readiness</h1>
        <button onClick={fetchReadiness} style={{
          padding: '0.375rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db',
          background: '#fff', cursor: 'pointer', fontSize: '0.875rem',
        }}>Refresh</button>
      </div>

      {error && <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: 6, marginBottom: '1rem', color: '#991b1b' }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderRadius: 8, background: '#d1fae5' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#065f46' }}>{data.readyEmployees}</div>
              <div style={{ fontSize: '0.875rem', color: '#065f46' }}>Ready</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderRadius: 8, background: '#fef3c7' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#92400e' }}>{data.warningEmployees}</div>
              <div style={{ fontSize: '0.875rem', color: '#92400e' }}>Warnings</div>
            </div>
            <div style={{ flex: 1, textAlign: 'center', padding: '1rem', borderRadius: 8, background: '#fee2e2' }}>
              <div style={{ fontSize: '2rem', fontWeight: 700, color: '#991b1b' }}>{data.blockedEmployees}</div>
              <div style={{ fontSize: '0.875rem', color: '#991b1b' }}>Blocked</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Selected Employees</div>
              <div style={{ fontWeight: 700 }}>{data.selectedEmployees}</div>
            </div>
            <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Accepted Inputs</div>
              <div style={{ fontWeight: 700 }}>{data.acceptedInputCount}</div>
            </div>
            <div style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>Unlocked Acc. Inputs</div>
              <div style={{ fontWeight: 700, color: data.unlockedInputCount > 0 ? '#dc2626' : '#374151' }}>{data.unlockedInputCount}</div>
            </div>
          </div>

          {data.readyForCalculation && (
            <div style={{ padding: '0.75rem', background: '#d1fae5', borderRadius: 6, marginBottom: '1rem', color: '#065f46', fontWeight: 600 }}>
              Ready for calculation
            </div>
          )}

          {data.employeeIssues && Object.keys(data.employeeIssues).length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Employee Details</h3>
              {Object.entries(data.employeeIssues as Record<string, any>).map(([empId, info]: [string, any]) => {
                const hasBlockers = info.blockers && info.blockers.length > 0
                const hasWarnings = info.warnings && info.warnings.length > 0
                return (
                  <div key={empId} style={{
                    padding: '0.75rem', marginBottom: '0.5rem', borderRadius: 6,
                    border: `1px solid ${hasBlockers ? '#fecaca' : hasWarnings ? '#fde68a' : '#d1fae5'}`,
                    background: hasBlockers ? '#fef2f2' : hasWarnings ? '#fffbeb' : '#f0fdf4',
                  }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{info.employeeCode || empId}</div>
                    {info.blockers?.map((b: string, i: number) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: '0.25rem' }}>⛔ {b}</div>
                    ))}
                    {info.warnings?.map((w: string, i: number) => (
                      <div key={i} style={{ fontSize: '0.8rem', color: '#d97706', marginTop: '0.25rem' }}>⚠ {w}</div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
            <Link href={`/payroll-calculation/${payId}/preview`} style={{
              padding: '0.5rem 1rem', borderRadius: 6, background: '#2563eb', color: '#fff',
              textDecoration: 'none', fontSize: '0.875rem',
            }}>Go to Preview</Link>
          </div>
        </>
      )}
    </div>
  )
}
