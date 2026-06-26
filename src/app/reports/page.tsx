'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface ReportsData {
  totalEmployees: number
  activeEmployees: number
  onboardingPending: number
  onProbation: number
  missingManager: number
  missingEmploymentType: number
  salaryReady: number
  byDept: Array<{ currentDepartmentId: string | null; _count: number }>
  byRole: Array<{ currentRole: string; _count: number }>
  byType: Array<{ employmentType: string | null; _count: number }>
  recentlyAdded: Array<{ id: string; employeeId: string; fullName: string; createdAt: string }>
}

export default function ReportsPage() {
  const router = useRouter()
  const [data, setData] = useState<ReportsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/reports')
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(json => setData(json.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!data) return null

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Reports</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
        <Card label="Total Employees" value={data.totalEmployees} />
        <Card label="Active Employees" value={data.activeEmployees} />
        <Card label="Onboarding Pending" value={data.onboardingPending} />
        <Card label="On Probation" value={data.onProbation} />
        <Card label="Missing Manager" value={data.missingManager} />
        <Card label="No Employment Type" value={data.missingEmploymentType} />
        <Card label="Salary Ready" value={data.salaryReady} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Section title="By Department">
          {data.byDept.map(d => (
            <Row key={d.currentDepartmentId || 'null'} label={d.currentDepartmentId || 'Unassigned'} value={d._count} />
          ))}
        </Section>
        <Section title="By Role">
          {data.byRole.map(r => (
            <Row key={r.currentRole} label={r.currentRole} value={r._count} />
          ))}
        </Section>
        <Section title="By Employment Type">
          {data.byType.map(t => (
            <Row key={t.employmentType || 'null'} label={t.employmentType || 'Not set'} value={t._count} />
          ))}
        </Section>
        <Section title="Recently Added (30 days)">
          {data.recentlyAdded.map(emp => (
            <div key={emp.id} style={{ padding: '0.25rem 0', fontSize: '0.85rem' }}>
              {emp.employeeId} — {emp.fullName} <span style={{ color: '#666' }}>({new Date(emp.createdAt).toLocaleDateString()})</span>
            </div>
          ))}
        </Section>
      </div>
    </div>
  )
}

function Card({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ padding: '1rem', background: '#f3f4f6', borderRadius: 6, textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.85rem', color: '#666' }}>{label}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '1rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>{title}</h3>
      {children}
    </div>
  )
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0.25rem 0', fontSize: '0.85rem', borderBottom: '1px solid #e5e7eb' }}>
      <span>{label}</span>
      <span style={{ fontWeight: 600 }}>{value}</span>
    </div>
  )
}
