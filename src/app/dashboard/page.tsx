'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PermissionKey } from '@/lib/rbac'

interface UserData {
  id: string
  email: string
  name: string
  employeeId: string | null
  permissions: PermissionKey[]
}

interface NavSection {
  title: string
  links: { label: string; href: string; permission?: PermissionKey }[]
}

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [mvpMode, setMvpMode] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/auth/me').then(r => { if (!r.ok) throw new Error(); return r.json() }),
      fetch('/api/mvp-mode').then(r => r.json()),
    ])
      .then(([userJson, modeJson]) => {
        setUser(userJson.data)
        setMvpMode(modeJson.mvpMode)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!user) return null

  const has = (p: PermissionKey) => user.permissions.includes(p)

  const mvpSections: NavSection[] = [
    {
      title: 'HR',
      links: [
        { label: 'Employees', href: '/employees', permission: 'employee.view' },
        { label: 'Employee Import', href: '/employees/import', permission: 'employee.import' },
      ],
    },
    {
      title: 'Payroll',
      links: [
        { label: 'Payroll Periods', href: '/payroll', permission: 'payrollPeriod.view' },
      ],
    },
    {
      title: 'Reports & Audit',
      links: [
        { label: 'Payroll History', href: '/payroll', permission: 'payrollPeriod.view' },
        { label: 'Audit Logs', href: '/audit-logs', permission: 'audit.view' },
      ],
    },
    {
      title: 'Administration',
      links: [
        { label: 'Users & Roles', href: '/users', permission: 'user.view' },
      ],
    },
  ]

  const fullSections: NavSection[] = [
    {
      title: 'HR',
      links: [
        { label: 'Employees', href: '/employees', permission: 'employee.view' },
        { label: 'Status History', href: '/status-history', permission: 'status.view' },
        { label: 'Organization Chart', href: '/org-chart', permission: 'organization.view' },
        { label: 'Employee Import', href: '/employees/import', permission: 'employee.import' },
      ],
    },
    {
      title: 'Finance',
      links: [
        { label: 'Salary Records', href: '/salary', permission: 'salary.view' },
      ],
    },
    {
      title: 'Payroll',
      links: [
        { label: 'Payroll Periods', href: '/payroll', permission: 'payrollPeriod.view' },
      ],
    },
    {
      title: 'Reports & Audit',
      links: [
        { label: 'Reports', href: '/reports', permission: 'reports.view' },
        { label: 'Audit Logs', href: '/audit-logs', permission: 'audit.view' },
      ],
    },
    {
      title: 'Administration',
      links: [
        { label: 'Users & Roles', href: '/users', permission: 'user.view' },
      ],
    },
  ]

  const sections = mvpMode ? mvpSections : fullSections
  const visibleSections = sections
    .map(s => ({ ...s, links: s.links.filter(l => !l.permission || has(l.permission)) }))
    .filter(s => s.links.length > 0)

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>
            Dashboard
            {mvpMode && <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', padding: '0.15rem 0.5rem', borderRadius: 4, background: '#dbeafe', color: '#1e40af', fontWeight: 600, verticalAlign: 'middle' }}>MVP</span>}
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            {user.name} &mdash; {user.email}
            {user.employeeId && <span> &mdash; Employee ID linked</span>}
          </p>
        </div>
        <button onClick={handleLogout} style={{ padding: '0.4rem 0.75rem', cursor: 'pointer' }}>Logout</button>
      </div>

      {visibleSections.map(section => (
        <div key={section.title} style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '0.85rem', textTransform: 'uppercase', color: '#666', margin: '0 0 0.5rem', letterSpacing: '0.05em' }}>
            {section.title}
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            {section.links.map(link => (
              <a
                key={link.href}
                href={link.href}
                style={{
                  display: 'block',
                  padding: '0.6rem 0.75rem',
                  background: '#f3f4f6',
                  borderRadius: 6,
                  textDecoration: 'none',
                  color: '#2563eb',
                  fontWeight: 500,
                  fontSize: '0.9rem',
                }}
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>
      ))}

      {visibleSections.length === 0 && (
        <p style={{ color: '#666' }}>You do not have access to any modules. Contact your administrator.</p>
      )}
    </div>
  )
}
