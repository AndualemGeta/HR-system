'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Employee {
  id: string; employeeId: string; fullName: string; email: string | null
  currentRole: string; employmentStatus: string; employeeCategory: string | null
}

export default function EmployeesPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<Employee[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')

  useEffect(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' })
    if (search) params.set('search', search)
    if (categoryFilter) params.set('category', categoryFilter)

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
  }, [page, search, categoryFilter, router])

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>Employees</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/employees/new" style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>+ Register Employee</Link>
          <Link href="/dashboard" style={{ color: '#2563eb', padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}>Dashboard</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <input
          type="text" placeholder="Search by name, ID, or email..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.9rem' }}
        />
        <select value={categoryFilter} onChange={e => { setCategoryFilter(e.target.value); setPage(1) }}
          style={{ padding: '0.5rem', border: '1px solid #ccc', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}
        >
          <option value="">All Categories</option>
          <option value="HEAD_OFFICE">Head Office</option>
          <option value="SHOP_FIELD">Shop / Field</option>
        </select>
      </div>

      {loading ? (
        <p>Loading...</p>
      ) : (
        <>
          <p style={{ color: '#666', marginBottom: '0.5rem', fontSize: '0.9rem' }}>{total} employee{total !== 1 ? 's' : ''} found</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>ID</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Name</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Email</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Role</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Category</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map(emp => (
                <tr key={emp.id} style={{ borderBottom: '1px solid #e5e7eb', cursor: 'pointer' }} onClick={() => router.push(`/employees/${emp.id}`)}>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{emp.employeeId}</td>
                  <td style={{ padding: '0.5rem', color: '#2563eb', textDecoration: 'underline', fontSize: '0.9rem' }}>{emp.fullName}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{emp.email || '-'}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{emp.currentRole}</td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>
                    {emp.employeeCategory === 'HEAD_OFFICE' ? <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#dbeafe', color: '#1e40af' }}>HO</span> : emp.employeeCategory === 'SHOP_FIELD' ? <span style={{ padding: '0.15rem 0.4rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: '#fef3c7', color: '#92400e' }}>Field</span> : '—'}
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem' }}>{emp.employmentStatus}</td>
                </tr>
              ))}
              {employees.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No employees found</td></tr>
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
