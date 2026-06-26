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

export default function DashboardPage() {
  const router = useRouter()
  const [user, setUser] = useState<UserData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) throw new Error('Not authenticated')
        return res.json()
      })
      .then(json => setUser(json.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!user) return null

  const hasPermission = (p: PermissionKey) => user.permissions.includes(p)

  const links: { label: string; href: string; permission?: PermissionKey }[] = [
    { label: 'Employees', href: '/employees', permission: 'employee.view' },
    { label: 'Organisation Chart', href: '/org-chart', permission: 'org.view' },
    { label: 'Departments', href: '/departments', permission: 'org.view' },
  ]

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ margin: 0 }}>Dashboard</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <span>{user.name} ({user.email})</span>
          <button onClick={handleLogout} style={{ padding: '0.25rem 0.75rem', cursor: 'pointer' }}>Logout</button>
        </div>
      </div>

      {user.permissions.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {links.filter(l => !l.permission || hasPermission(l.permission)).map(link => (
            <a
              key={link.href}
              href={link.href}
              style={{
                display: 'block',
                padding: '0.75rem 1rem',
                background: '#f3f4f6',
                borderRadius: 6,
                textDecoration: 'none',
                color: '#2563eb',
                fontWeight: 500,
              }}
            >
              {link.label}
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
