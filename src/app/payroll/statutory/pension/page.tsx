'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

interface PensionRule {
  id: string
  name: string
  employeeRate: number
  employerRate: number
  pensionBaseType: string
  minimumBase: number | null
  maximumBase: number | null
  priority: number
  applicableRole: string | null
  applicableEmploymentType: string | null
  effectiveStartDate: string
  effectiveEndDate: string | null
  approvalStatus: string
  isActive: boolean
  isSample: boolean
}

export default function PensionRulesPage() {
  const [rules, setRules] = useState<PensionRule[]>([])
  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const has = (p: string) => perms.includes(p)

  const fetchData = () => {
    setLoading(true)
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {}),
      fetch('/api/payroll/statutory/pension-rules').then(r => r.json()).then(j => {
        if (j.error) setError(j.error)
        else setRules(j.data || [])
      }).catch(() => setError('Failed to load')),
    ]).finally(() => setLoading(false))
  }

  useEffect(() => { fetchData() }, [])

  const handleApprove = async (id: string) => {
    if (!confirm('Approve this pension rule?')) return
    const r = await fetch(`/api/payroll/statutory/pension-rules/${id}/approve`, { method: 'POST' })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Failed'); return }
    alert('Approved'); fetchData()
  }

  const handleDeactivate = async (id: string) => {
    if (!confirm('Deactivate this pension rule?')) return
    const r = await fetch(`/api/payroll/statutory/pension-rules/${id}/deactivate`, { method: 'POST' })
    if (!r.ok) { const j = await r.json(); alert(j.error || 'Failed'); return }
    alert('Deactivated'); fetchData()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const emptyRules = rules.filter(r => r.approvalStatus !== 'APPROVED')
  const approvedRules = rules.filter(r => r.approvalStatus === 'APPROVED')

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <Link href="/payroll/statutory" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back to Statutory
      </Link>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0.75rem 0 1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: 0 }}>Pension Rules</h1>
        <button onClick={fetchData} style={btnStyle}>Refresh</button>
      </div>

      {error && <div style={{ padding: '0.75rem', background: '#fee2e2', borderRadius: 6, marginBottom: '1rem' }}>{error}</div>}

      {rules.length === 0 && (
        <div style={{ textAlign: 'center', padding: '3rem', color: '#6b7280' }}>
          No pension rules configured. Seed data or create new rules.
        </div>
      )}

      {emptyRules.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Draft / Pending Approval</h3>
          <Table rules={emptyRules} hasManage={has('payrollStatutory.manage')} hasApprove={has('payrollStatutory.approve')} onApprove={handleApprove} onDeactivate={handleDeactivate} />
        </div>
      )}

      {approvedRules.length > 0 && (
        <div>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Approved / Active</h3>
          <Table rules={approvedRules} hasManage={has('payrollStatutory.manage')} hasApprove={has('payrollStatutory.approve')} onApprove={handleApprove} onDeactivate={handleDeactivate} />
        </div>
      )}

      <div style={{ marginTop: '1.5rem', padding: '1rem', background: '#f0fdf4', borderRadius: 6, border: '1px solid #d1fae5', fontSize: '0.8rem', color: '#065f46' }}>
        <strong>Selection logic:</strong> Role-specific rules override general rules. Employment-type specific rules apply when role matches.
        Equal-priority ambiguity blocks calculation. Only <strong>approved, active, non-sample</strong> rules are used in calculation.
      </div>
    </div>
  )
}

function Table({ rules, hasManage, hasApprove, onApprove, onDeactivate }: {
  rules: PensionRule[]
  hasManage: boolean
  hasApprove: boolean
  onApprove: (id: string) => void
  onDeactivate: (id: string) => void
}) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
        <thead>
          <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
            <th style={thStyle}>Name</th>
            <th style={thStyle}>Emp Rate</th>
            <th style={thStyle}>Empr Rate</th>
            <th style={thStyle}>Base Type</th>
            <th style={thStyle}>Min Base</th>
            <th style={thStyle}>Max Base</th>
            <th style={thStyle}>Priority</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Emp Type</th>
            <th style={thStyle}>Effective</th>
            <th style={thStyle}>Status</th>
            <th style={thStyle}>Sample</th>
            <th style={thStyle}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rules.map(r => (
            <tr key={r.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
              <td style={tdStyle}>{r.employeeRate}%</td>
              <td style={tdStyle}>{r.employerRate}%</td>
              <td style={tdStyle}>{r.pensionBaseType}</td>
              <td style={tdStyle}>{r.minimumBase != null ? Number(r.minimumBase).toLocaleString() : '-'}</td>
              <td style={tdStyle}>{r.maximumBase != null ? Number(r.maximumBase).toLocaleString() : '-'}</td>
              <td style={tdStyle}>{r.priority}</td>
              <td style={tdStyle}>{r.applicableRole || 'All'}</td>
              <td style={tdStyle}>{r.applicableEmploymentType || 'All'}</td>
              <td style={tdStyle}>{new Date(r.effectiveStartDate).toLocaleDateString()}</td>
              <td style={tdStyle}><StatusBadge status={r.approvalStatus} active={r.isActive} /></td>
              <td style={tdStyle}>{r.isSample ? '📋' : '-'}</td>
              <td style={tdStyle}>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  {r.approvalStatus !== 'APPROVED' && hasApprove && (
                    <button onClick={() => onApprove(r.id)} style={smallBtn}>Approve</button>
                  )}
                  {r.isActive && hasManage && (
                    <button onClick={() => onDeactivate(r.id)} style={{ ...smallBtn, color: '#dc2626' }}>Deactivate</button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function StatusBadge({ status, active }: { status: string; active: boolean }) {
  const colors: Record<string, { bg: string; fg: string }> = {
    DRAFT: { bg: '#e5e7eb', fg: '#374151' },
    PENDING: { bg: '#fef3c7', fg: '#92400e' },
    APPROVED: { bg: '#d1fae5', fg: '#065f46' },
    REJECTED: { bg: '#fee2e2', fg: '#991b1b' },
  }
  const c = colors[status] || { bg: '#e5e7eb', fg: '#374151' }
  const label = active ? status : `${status} (inactive)`
  return <span style={{ padding: '0.125rem 0.5rem', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: c.bg, color: c.fg }}>{label}</span>
}

const btnStyle: React.CSSProperties = {
  padding: '0.375rem 0.75rem', borderRadius: 6, border: '1px solid #d1d5db',
  background: '#fff', cursor: 'pointer', fontSize: '0.875rem',
}

const smallBtn: React.CSSProperties = {
  padding: '0.25rem 0.5rem', borderRadius: 4, border: '1px solid #d1d5db',
  background: '#fff', cursor: 'pointer', fontSize: '0.75rem',
}

const thStyle: React.CSSProperties = { padding: '0.5rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }
const tdStyle: React.CSSProperties = { padding: '0.5rem' }
