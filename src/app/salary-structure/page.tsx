'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
export default function SalaryStructureDashboard() {
  const router = useRouter()
  const [perms, setPerms] = useState<string[]>([])
  const [stats, setStats] = useState({ components: 0, rules: 0, active: 0, draft: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])),
      fetch('/api/salary-structure/components').then(r => r.json()).then(j => {
        const components = j.data || []
        setStats(s => ({ ...s, components: components.length }))
        return components.length
      }),
      fetch('/api/salary-structure/rules').then(r => r.json()).then(j => {
        const rules = j.data || []
        setStats(s => ({ ...s, rules: rules.length, active: rules.filter((r: any) => r.status === 'ACTIVE').length, draft: rules.filter((r: any) => r.status === 'DRAFT').length }))
      }),
    ]).catch(() => router.push('/login')).finally(() => setLoading(false))
  }, [router])

  const has = (p: string) => perms.includes(p)

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ marginBottom: '1.5rem' }}>Salary Structure</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.components}</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Components</div>
        </div>
        <div style={{ background: '#f3f4f6', padding: '1rem', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{stats.rules}</div>
          <div style={{ fontSize: '0.8rem', color: '#666' }}>Total Rules</div>
        </div>
        <div style={{ background: '#d1fae5', padding: '1rem', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#065f46' }}>{stats.active}</div>
          <div style={{ fontSize: '0.8rem', color: '#065f46' }}>Active</div>
        </div>
        <div style={{ background: '#fef3c7', padding: '1rem', borderRadius: 6, textAlign: 'center' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#92400e' }}>{stats.draft}</div>
          <div style={{ fontSize: '0.8rem', color: '#92400e' }}>Draft</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {has('salaryStructure.view') && (
          <a href="/salary-structure/components" style={{ display: 'block', padding: '0.6rem 0.75rem', background: '#f3f4f6', borderRadius: 6, textDecoration: 'none', color: '#2563eb', fontWeight: 500, fontSize: '0.9rem' }}>Manage Pay Components</a>
        )}
        {has('salaryStructure.view') && (
          <a href="/salary-structure/rules" style={{ display: 'block', padding: '0.6rem 0.75rem', background: '#f3f4f6', borderRadius: 6, textDecoration: 'none', color: '#2563eb', fontWeight: 500, fontSize: '0.9rem' }}>Manage Pay Rules</a>
        )}
        {has('salaryStructure.preview') && (
          <a href="/salary-structure/preview" style={{ display: 'block', padding: '0.6rem 0.75rem', background: '#f3f4f6', borderRadius: 6, textDecoration: 'none', color: '#2563eb', fontWeight: 500, fontSize: '0.9rem' }}>Rule Preview Tool</a>
        )}
      </div>

      <div style={{ marginTop: '1rem' }}>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.9rem' }}>&larr; Back to Dashboard</a>
      </div>
    </div>
  )
}
