'use client'

import { useEffect, useState } from 'react'

interface Payslip {
  id: string
  employeeName: string
  employeeCode: string
  periodName: string
  grossSalary: number
  netSalary: number
  totalDeductions: number
  status: string
  publishedAt: string | null
  createdAt: string
  isOwn: boolean
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const fetchData = () => {
    const q = search ? `?search=${encodeURIComponent(search)}` : ''
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch(`/api/payslips${q}`).then(r => r.json()).then(j => setPayslips(j.data || [])),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [search])

  const has = (p: string) => perms.includes(p)

  const handleDownload = async (id: string) => {
    window.open(`/api/payslips/${id}/download`, '_blank')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>
          {has('payslip.viewAll') ? 'All Payslips' : 'My Payslips'}
        </h1>
        <a href="/dashboard" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline' }}>&larr; Dashboard</a>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {has('payslip.viewAll') && (
        <div style={{ marginBottom: '0.75rem' }}>
          <input placeholder="Search employee name or code..." value={search} onChange={e => setSearch(e.target.value)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 300 }} />
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Code</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Period</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Gross</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Net Pay</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Deductions</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}></th>
          </tr>
        </thead>
        <tbody>
          {payslips.map(p => (
            <tr key={p.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{p.employeeName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.employeeCode}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.periodName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.grossSalary.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600 }}>{p.netSalary.toLocaleString()}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{p.totalDeductions.toLocaleString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: p.publishedAt ? '#d1fae5' : '#e5e7eb', color: p.publishedAt ? '#065f46' : '#374151' }}>
                  {p.publishedAt ? 'Published' : 'Draft'}
                </span>
              </td>
              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                {p.publishedAt && (
                  <button onClick={() => handleDownload(p.id)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>
                    Download
                  </button>
                )}
                {!p.publishedAt && <span style={{ fontSize: '0.75rem', color: '#9ca3af' }}>Not yet published</span>}
              </td>
            </tr>
          ))}
          {payslips.length === 0 && (
            <tr><td colSpan={8} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No payslips found</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
