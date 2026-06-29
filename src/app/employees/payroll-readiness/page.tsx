'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface PayrollReadiness {
  employeeId: string
  employeeRecordId: string
  fullName: string
  role: string | null
  department: string | null
  shop: string | null
  employmentStatus: string | null
  employeeCategory: string | null
  basicSalaryStatus: string
  paymentInfoStatus: string
  taxInfoStatus: string
  pensionInfoStatus: string
  assignmentStatus: string
  managerStatus: string
  overallStatus: string
  readinessPercentage: number
  blockers: string[]
  warnings: string[]
}

interface Summary {
  total: number
  ready: number
  warning: number
  notReady: number
  inactive: number
}

export default function PayrollReadinessPage() {
  const router = useRouter()
  const [employees, setEmployees] = useState<PayrollReadiness[]>([])
  const [summary, setSummary] = useState<Summary>({ total: 0, ready: 0, warning: 0, notReady: 0, inactive: 0 })
  const [loading, setLoading] = useState(true)
  const [filterStatus, setFilterStatus] = useState('')
  const [filterRole, setFilterRole] = useState('')

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(json => {
      const me = json.data || json
      if (!me.permissions?.includes('employee.payrollReadiness.view')) { router.push('/employees'); return }
      loadData()
    }).catch(() => router.push('/login'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router])

  function loadData() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('readinessStatus', filterStatus)
    if (filterRole) params.set('role', filterRole)
    fetch(`/api/employees/payroll-readiness?${params}`).then(r => r.json()).then(j => {
      const data = j.data || j
      setEmployees(data.employees || [])
      setSummary(data.summary || { total: 0, ready: 0, warning: 0, notReady: 0, inactive: 0 })
      setLoading(false)
    })
  }

  function handleExport() {
    const params = new URLSearchParams()
    if (filterStatus) params.set('readinessStatus', filterStatus)
    if (filterRole) params.set('role', filterRole)
    window.open(`/api/employees/payroll-readiness/export?${params}`, '_blank')
  }

  const th: React.CSSProperties = { padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '0.8rem', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem' }

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link href="/employees" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Back</Link>
          <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Payroll Readiness</h1>
        </div>
        <button onClick={handleExport} style={{ background: '#7c3aed', color: '#fff', padding: '0.4rem 1rem', borderRadius: 4, border: 'none', cursor: 'pointer', fontSize: '0.85rem' }}>Export CSV</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Total', value: summary.total, color: '#1e40af', bg: '#eff6ff' },
          { label: 'Ready', value: summary.ready, color: '#16a34a', bg: '#f0fdf4' },
          { label: 'Warning', value: summary.warning, color: '#d97706', bg: '#fffbeb' },
          { label: 'Not Ready', value: summary.notReady, color: '#dc2626', bg: '#fef2f2' },
          { label: 'Inactive', value: summary.inactive, color: '#6b7280', bg: '#f9fafb' },
        ].map(s => (
          <div key={s.label} style={{ background: s.bg, padding: '0.75rem', borderRadius: 6, textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <select value={filterStatus} onChange={e => { setFilterStatus(e.target.value); setLoading(true) }} style={{ padding: '0.3rem', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
          <option value="">All Statuses</option>
          <option value="READY">Ready</option>
          <option value="WARNING">Warning</option>
          <option value="NOT_READY">Not Ready</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <select value={filterRole} onChange={e => { setFilterRole(e.target.value); setLoading(true) }} style={{ padding: '0.3rem', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
          <option value="">All Roles</option>
          <option value="CEO">CEO</option>
          <option value="HR_MANAGER">HR Manager</option>
          <option value="FINANCE_DIRECTOR">Finance Director</option>
          <option value="SALES_HEAD">Sales Head</option>
          <option value="ASM">ASM</option>
          <option value="SHOP_MANAGER">Shop Manager</option>
          <option value="DSP">DSP</option>
          <option value="DSA">DSA</option>
          <option value="SHOP_ACCOUNTANT">Shop Accountant</option>
        </select>
        <button onClick={() => { setLoading(true); loadData() }} style={{ padding: '0.3rem 0.8rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Filter</button>
      </div>

      {loading ? <p>Loading...</p> : employees.length === 0 ? (
        <p style={{ color: '#888' }}>No employees found.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ background: '#f9fafb' }}>
              <th style={th}>Emp ID</th><th style={th}>Name</th><th style={th}>Role</th><th style={th}>Dept</th><th style={th}>Shop</th><th style={th}>Status</th><th style={th}>Salary</th><th style={th}>Payment</th><th style={th}>Tax</th><th style={th}>Pension</th><th style={th}>Readiness</th><th style={th}>Overall</th><th style={th}>Blockers</th>
            </tr></thead>
            <tbody>{employees.map(e => (
              <tr key={e.employeeRecordId} style={{ background: e.overallStatus === 'NOT_READY' ? '#fef2f2' : e.overallStatus === 'WARNING' ? '#fffbeb' : e.overallStatus === 'INACTIVE' ? '#f9fafb' : '#fff' }}>
                <td style={td}>{e.employeeId}</td>
                <td style={td}><Link href={`/employees/${e.employeeRecordId}`} style={{ color: '#2563eb', textDecoration: 'none' }}>{e.fullName}</Link></td>
                <td style={td}>{e.role || '—'}</td>
                <td style={td}>{e.department || '—'}</td>
                <td style={td}>{e.shop || '—'}</td>
                <td style={td}>{e.employmentStatus || '—'}</td>
                <td style={td}>{e.basicSalaryStatus === 'COMPLETE' ? <span style={{ color: '#16a34a' }}>Yes</span> : <span style={{ color: '#dc2626' }}>Missing</span>}</td>
                <td style={td}>{e.paymentInfoStatus === 'COMPLETE' ? <span style={{ color: '#16a34a' }}>Yes</span> : <span style={{ color: '#dc2626' }}>Missing</span>}</td>
                <td style={td}>{e.taxInfoStatus === 'COMPLETE' ? <span style={{ color: '#16a34a' }}>Yes</span> : <span style={{ color: '#d97706' }}>Missing</span>}</td>
                <td style={td}>{e.pensionInfoStatus === 'COMPLETE' ? <span style={{ color: '#16a34a' }}>Yes</span> : <span style={{ color: '#d97706' }}>Missing</span>}</td>
                <td style={td}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <div style={{ width: 50, background: '#e5e7eb', height: 6, borderRadius: 3, overflow: 'hidden' }}>
                      <div style={{ background: e.readinessPercentage >= 80 ? '#16a34a' : e.readinessPercentage >= 50 ? '#f59e0b' : '#dc2626', height: '100%', width: `${e.readinessPercentage}%` }} />
                    </div>
                    <span style={{ fontSize: '0.75rem' }}>{e.readinessPercentage}%</span>
                  </div>
                </td>
                <td style={td}><span style={{ padding: '0.15rem 0.4rem', borderRadius: 3, fontSize: '0.75rem', fontWeight: 600, background: e.overallStatus === 'READY' ? '#dcfce7' : e.overallStatus === 'WARNING' ? '#fef3c7' : e.overallStatus === 'NOT_READY' ? '#fee2e2' : '#f3f4f6', color: e.overallStatus === 'READY' ? '#166534' : e.overallStatus === 'WARNING' ? '#92400e' : e.overallStatus === 'NOT_READY' ? '#991b1b' : '#6b7280' }}>{e.overallStatus}</span></td>
                <td style={td}>{e.blockers.length > 0 && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{e.blockers.length} issue(s)</span>}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}
