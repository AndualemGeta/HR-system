'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Period {
  id: string; periodName: string; month: number; year: number
  status: string; employeeCount: number
  createdAt: string
  _count: { rows: number }
}

export default function PayrollListPage() {
  const router = useRouter()
  const [periods, setPeriods] = useState<Period[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [perms, setPerms] = useState<string[]>([])

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(j => {
      setPerms((j.data || j).permissions || [])
    }).catch(() => {})
  }, [])

  useEffect(() => {
    fetch(`/api/payroll?page=${page}&limit=20`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(j => { setPeriods(j.data.items); setTotal(j.data.total) })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [page, router])

  const canCreate = perms.includes('payrollPeriod.create')
  const statusColor: Record<string, string> = {
    DRAFT: '#fef3c7', READY: '#dbeafe', LOCKED: '#d1fae5', CANCELLED: '#fee2e2',
  }
  const statusText: Record<string, string> = {
    DRAFT: 'Draft', READY: 'Ready', LOCKED: 'Locked', CANCELLED: 'Cancelled',
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Dashboard</a>
          <h1 style={{ margin: 0 }}>Payroll Periods</h1>
        </div>
        {canCreate && <Link href="/payroll/new" style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: 4, textDecoration: 'none' }}>New Period</Link>}
      </div>

      {periods.length === 0 ? (
        <p style={{ color: '#888' }}>No payroll periods yet. Create your first period to get started.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {periods.map(p => (
            <Link key={p.id} href={`/payroll/${p.id}`} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '1rem', background: '#f9fafb', borderRadius: 6, textDecoration: 'none', color: 'inherit',
              border: '1px solid #e5e7eb',
            }}>
              <div>
                <strong>{p.periodName}</strong>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {p._count?.rows ?? 0} employee(s)
                </div>
              </div>
              <span style={{
                padding: '0.2rem 0.6rem', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600,
                background: statusColor[p.status] || '#f3f4f6',
              }}>{statusText[p.status] || p.status}</span>
            </Link>
          ))}
        </div>
      )}

      {total > 20 && (
        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'center', marginTop: '1.5rem' }}>
          <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
            style={{ padding: '0.3rem 0.75rem', background: page <= 1 ? '#f3f4f6' : '#2563eb', color: page <= 1 ? '#999' : '#fff', border: 'none', borderRadius: 4, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>
            Previous
          </button>
          <span style={{ padding: '0.3rem 0.75rem', fontSize: '0.9rem' }}>Page {page} of {Math.ceil(total / 20)}</span>
          <button disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}
            style={{ padding: '0.3rem 0.75rem', background: page >= Math.ceil(total / 20) ? '#f3f4f6' : '#2563eb', color: page >= Math.ceil(total / 20) ? '#999' : '#fff', border: 'none', borderRadius: 4, cursor: page >= Math.ceil(total / 20) ? 'not-allowed' : 'pointer' }}>
            Next
          </button>
        </div>
      )}
    </div>
  )
}
