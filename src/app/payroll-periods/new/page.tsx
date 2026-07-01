'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function NewPayrollPeriodPage() {
  const router = useRouter()
  const [, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const [periodName, setPeriodName] = useState('')
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [payDate, setPayDate] = useState('')
  const [validationErrors, setValidationErrors] = useState<string[]>([])
  const [payDateWarning, setPayDateWarning] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(j => {
        const p = j.data?.permissions || []
        setPerms(p)
        if (!p.includes('payrollPeriod.create')) router.push('/payroll-periods')
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  useEffect(() => {
    if (periodStart && periodEnd && periodEnd < periodStart) {
      setValidationErrors(['End date must be on or after start date'])
    } else {
      setValidationErrors([])
    }
    if (periodEnd && payDate && payDate < periodEnd) {
      setPayDateWarning(true)
    } else {
      setPayDateWarning(false)
    }
  }, [periodStart, periodEnd, payDate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!periodName || !periodStart || !periodEnd || !payDate) {
      setError('All fields are required')
      return
    }
    if (periodEnd < periodStart) {
      setError('End date must be on or after start date')
      return
    }

    setSubmitting(true)
    const res = await fetch('/api/payroll-periods', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ periodName, periodStart, periodEnd, payDate }),
    })
    const json = await res.json()
    setSubmitting(false)

    if (!res.ok) { setError(json.error || 'Failed to create period'); return }
    router.push(`/payroll-periods/${json.data.id}`)
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href="/payroll-periods" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '1rem' }}>&larr; Back to Payroll Periods</a>
      <h1 style={{ margin: '0 0 1.5rem' }}>New Payroll Period</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}
      {validationErrors.map((v, i) => (
        <p key={i} style={{ color: 'red', margin: '0 0 0.25rem', fontSize: '0.85rem' }}>{v}</p>
      ))}
      {payDateWarning && (
        <p style={{ color: '#92400e', margin: '0 0 0.5rem', fontSize: '0.85rem', background: '#fef3c7', padding: '0.35rem 0.5rem', borderRadius: 4 }}>
          Warning: Pay date is before the period end date.
        </p>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Period Name</label>
          <input value={periodName} onChange={e => setPeriodName(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Period Start</label>
          <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Period End</label>
          <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Pay Date</label>
          <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} style={{ padding: '0.4rem 0.5rem', border: '1px solid #d1d5db', borderRadius: 4, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <button type="submit" disabled={submitting} style={{ background: submitting ? '#999' : '#2563eb', color: '#fff', padding: '0.4rem 1.25rem', border: 'none', borderRadius: 4, cursor: submitting ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
          {submitting ? 'Creating...' : 'Create Period'}
        </button>
      </form>
    </div>
  )
}
