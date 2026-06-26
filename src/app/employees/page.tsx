'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface Employee {
  id: string
  employeeId: string
  fullName: string
  email: string | null
  currentRole: string
  currentLevel: string
  employmentStatus: string
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)

    fetch(`/api/employees?${params}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch')
        return res.json()
      })
      .then(json => {
        setEmployees(json.data.items)
        setTotal(json.data.total)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [page, search, router])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Employees</h1>
        <a href="/dashboard" style={{ color: '#2563eb' }}>Back to Dashboard</a>
      </div>

      <input
        type="text"
        placeholder="Search by name, ID, or email..."
        value={search}
        onChange={e => { setSearch(e.target.value); setPage(1) }}
        style={{ width: '100%', padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, marginBottom: '1rem', boxSizing: 'border-box' }}
      />

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <p style={{ color: '#666', marginBottom: '0.5rem' }}>{total} employee{total !== 1 ? 's' : ''} found</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }}>ID</th>
                <th style={{ padding: '0.5rem' }}>Name</th>
                <th style={{ padding: '0.5rem' }}>Email</th>
                <th style={{ padding: '0.5rem' }}>Role</th>
                <th style={{ padding: '0.5rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem' }}>{emp.employeeId}</td>
                  <td style={{ padding: '0.5rem' }}>{emp.fullName}</td>
                  <td style={{ padding: '0.5rem' }}>{emp.email || '-'}</td>
                  <td style={{ padding: '0.5rem' }}>{emp.currentRole}</td>
                  <td style={{ padding: '0.5rem' }}>{emp.employmentStatus}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No employees found</td></tr>
              )}
            </tbody>
          </table>
          {total > 20 && (
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} style={{ padding: '0.25rem 0.75rem', cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>Previous</button>
              <span style={{ padding: '0.25rem 0.5rem' }}>Page {page}</span>
              <button disabled={page * 20 >= total} onClick={() => setPage(p => p + 1)} style={{ padding: '0.25rem 0.75rem', cursor: page * 20 >= total ? 'not-allowed' : 'pointer' }}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
