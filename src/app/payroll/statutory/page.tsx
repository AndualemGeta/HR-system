'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function StatutoryPage() {
  const [perms, setPerms] = useState<string[]>([])
  const [payeCount, setPayeCount] = useState(0)
  const [pensionCount, setPensionCount] = useState(0)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/payroll/statutory/paye-brackets').then(r => r.json()).then(j => {
        if (j.data) setPayeCount(Array.isArray(j.data) ? j.data.length : 0)
      }).catch(() => {}),
      fetch('/api/payroll/statutory/pension-rules').then(r => r.json()).then(j => {
        if (j.data) setPensionCount(Array.isArray(j.data) ? j.data.length : 0)
      }).catch(() => {}),
    ])
  }, [])

  const has = (p: string) => perms.includes(p)

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Dashboard</a>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1.5rem' }}>Statutory Configuration</h1>

      <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
        <Link href="/payroll/statutory/paye" style={{
          display: 'block', padding: '1.5rem', borderRadius: 8, border: '1px solid #e5e7eb',
          background: '#fff', textDecoration: 'none', color: 'inherit',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>PAYE Brackets</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            {payeCount} bracket(s) configured. Manage tax brackets, effective dates, and approval status.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: payeCount > 0 ? '#059669' : '#dc2626' }}>
            {payeCount > 0 ? `${payeCount} bracket(s) in system` : 'No brackets configured'}
          </div>
        </Link>

        <Link href="/payroll/statutory/pension" style={{
          display: 'block', padding: '1.5rem', borderRadius: 8, border: '1px solid #e5e7eb',
          background: '#fff', textDecoration: 'none', color: 'inherit',
        }}>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 600, margin: '0 0 0.5rem' }}>Pension Rules</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            {pensionCount} rule(s) configured. Manage pension rates, bases, and applicability.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', color: pensionCount > 0 ? '#059669' : '#dc2626' }}>
            {pensionCount > 0 ? `${pensionCount} rule(s) in system` : 'No rules configured'}
          </div>
        </Link>
      </div>
    </div>
  )
}
