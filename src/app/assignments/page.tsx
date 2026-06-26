'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Assignment {
  id: string
  employeeId: string
  role: string
  level: string
  departmentId: string | null
  startDate: string
  endDate: string | null
  reason: string | null
  employee: { employeeId: string; fullName: string }
}

export default function AssignmentsPage() {
  const router = useRouter()
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/assignments')
      .then(res => {
        if (!res.ok) throw new Error('Failed')
        return res.json()
      })
      .then(json => setAssignments(json.data))
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Assignments</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>
      {assignments.length === 0 ? (
        <p style={{ color: '#666' }}>No assignments found.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem' }}>Employee</th>
              <th style={{ padding: '0.5rem' }}>Role</th>
              <th style={{ padding: '0.5rem' }}>Level</th>
              <th style={{ padding: '0.5rem' }}>Start Date</th>
              <th style={{ padding: '0.5rem' }}>End Date</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                <td style={{ padding: '0.5rem' }}>{a.employee.fullName} ({a.employee.employeeId})</td>
                <td style={{ padding: '0.5rem' }}>{a.role}</td>
                <td style={{ padding: '0.5rem' }}>{a.level}</td>
                <td style={{ padding: '0.5rem' }}>{new Date(a.startDate).toLocaleDateString()}</td>
                <td style={{ padding: '0.5rem' }}>{a.endDate ? new Date(a.endDate).toLocaleDateString() : 'Active'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
