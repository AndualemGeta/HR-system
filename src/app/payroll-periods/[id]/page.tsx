'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useSearchParams } from 'next/navigation'

interface PayrollPeriod {
  id: string; periodName: string; periodStart: string; periodEnd: string; payDate: string; status: string
}

interface DashboardData {
  totalSelectedEmployees: number
  totalInputRecords: number
  draftInputs: number
  submittedInputs: number
  acceptedInputs: number
  rejectedInputs: number
  missingInputs: number
  departments: { department: string; submitted: number; total: number; percentage: number }[]
  shops: { shop: string; submitted: number; total: number; percentage: number }[]
  recentSubmissions: { employeeName: string; inputType: string; submittedAt: string }[]
  rejectedItems: { employeeName: string; inputType: string; note: string; rejectedAt: string }[]
}

interface EligibleEmployee {
  id: string; name: string; employeeId: string; department: string; role: string; payrollReady: boolean
}

interface SelectedEmployee {
  id: string; employeeId: string; name: string; department: string; role: string
}

interface SubmissionGroup {
  department: string; status: string; count: number
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  OPEN_FOR_INPUT: { background: '#dbeafe', color: '#1e40af' },
  INPUT_COLLECTION_CLOSED: { background: '#fef3c7', color: '#92400e' },
  READY_FOR_REVIEW: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

const submissionStatusStyles: Record<string, React.CSSProperties> = {
  NOT_STARTED: { background: '#e5e7eb', color: '#374151' },
  IN_PROGRESS: { background: '#dbeafe', color: '#1e40af' },
  PARTIALLY_SUBMITTED: { background: '#fef3c7', color: '#92400e' },
  SUBMITTED: { background: '#d1fae5', color: '#065f46' },
  ACCEPTED: { background: '#d1fae5', color: '#065f46' },
}

export default function PayrollPeriodDetailPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const tabParam = searchParams.get('tab') || 'dashboard'

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [activeTab, setActiveTab] = useState(tabParam === 'edit' ? 'dashboard' : tabParam)

  const [period, setPeriod] = useState<PayrollPeriod | null>(null)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)

  const [eligible, setEligible] = useState<EligibleEmployee[]>([])
  const [selected, setSelected] = useState<SelectedEmployee[]>([])
  const [eligibleFilter, setEligibleFilter] = useState({ department: '', region: '', area: '', shop: '', role: '', search: '' })
  const [submissionGroups, setSubmissionGroups] = useState<SubmissionGroup[]>([])

  const has = (p: string) => perms.includes(p)

  const fetchAuth = useCallback(() => {
    return fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {})
  }, [])

  const fetchPeriod = useCallback(() => {
    return fetch(`/api/payroll-periods/${id}`).then(r => r.json()).then(j => setPeriod(j.data || null))
  }, [id])

  const fetchDashboard = useCallback(() => {
    return fetch(`/api/payroll-periods/${id}/dashboard`).then(r => r.json()).then(j => setDashboard(j.data || null))
  }, [id])

  const fetchEligible = useCallback(() => {
    const q = new URLSearchParams()
    Object.entries(eligibleFilter).forEach(([k, v]) => { if (v) q.set(k, v) })
    return fetch(`/api/payroll-periods/${id}/eligible-employees?${q.toString()}`).then(r => r.json()).then(j => {
      const raw = j.data || []
      setEligible(raw.map((e: { id: string; employeeId: string; fullName: string; currentRole: string; currentDepartmentId: string | null; payrollReadiness: { overallStatus: string } | null }) => ({
        id: e.id,
        employeeId: e.employeeId,
        name: e.fullName,
        role: e.currentRole,
        department: e.currentDepartmentId || '',
        payrollReady: e.payrollReadiness?.overallStatus === 'READY',
      })))
    })
  }, [id, eligibleFilter])

  const fetchSelected = useCallback(() => {
    return fetch(`/api/payroll-periods/${id}/employees?isSelected=true`).then(r => r.json()).then(j => {
      const raw = j.data || []
      setSelected(raw.map((r: { employee: { fullName: string; employeeId: string; currentRole: string; currentDepartmentId: string | null } }) => ({
        id: r.employee.id,
        employeeId: r.employee.employeeId,
        name: r.employee.fullName,
        role: r.employee.currentRole,
        department: r.employee.currentDepartmentId || '',
      })))
    })
  }, [id])

  const fetchSubmissionGroups = useCallback(() => {
    return fetch(`/api/payroll-periods/${id}/inputs`).then(r => r.json()).then(j => {
      const inputs = j.data || []
      const deptMap: Record<string, { total: number; submitted: number }> = {}
      inputs.forEach((inp: any) => {
        const d = inp.employee?.department || 'Unknown'
        if (!deptMap[d]) deptMap[d] = { total: 0, submitted: 0 }
        deptMap[d].total++
        if (inp.status === 'SUBMITTED' || inp.status === 'ACCEPTED') deptMap[d].submitted++
      })
      const groups: SubmissionGroup[] = Object.entries(deptMap).map(([department, v]) => {
        let status = 'NOT_STARTED'
        if (v.submitted > 0 && v.submitted < v.total) status = 'PARTIALLY_SUBMITTED'
        else if (v.submitted === v.total && v.total > 0) status = 'SUBMITTED'
        else if (v.submitted > 0) status = 'IN_PROGRESS'
        return { department, status, count: v.total }
      })
      setSubmissionGroups(groups)
    })
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAuth(), fetchPeriod()]).finally(() => setLoading(false))
  }, [fetchAuth, fetchPeriod])

  useEffect(() => {
    if (!activeTab || !period) return
    if (activeTab === 'dashboard' && has('payrollPeriod.view')) {
      fetchDashboard()
    }
    if (activeTab === 'employees' && (has('payrollPeriod.view') || has('payrollPeriod.update'))) {
      fetchEligible(); fetchSelected()
    }
    if (activeTab === 'submissions' && has('payrollInput.view')) {
      fetchSubmissionGroups()
    }
  }, [activeTab, period, perms])

  const handleAction = async (action: string) => {
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/${action}`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); return }
    fetchPeriod().then(() => { if (action === 'dashboard') fetchDashboard() })
  }

  const handleAddEmployee = async (employeeId: string) => {
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/employees`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeIds: [employeeId] }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to add employee'); return }
    fetchEligible(); fetchSelected()
  }

  const handleRemoveEmployee = async (employeeId: string) => {
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/employees`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeIds: [employeeId] }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Failed to remove employee'); return }
    fetchEligible(); fetchSelected()
  }

  const tabs = [
    { key: 'dashboard', label: 'Dashboard', permission: 'payrollPeriod.view' },
    { key: 'employees', label: 'Employee Selection', permission: 'payrollPeriod.view' },
    { key: 'submissions', label: 'Submission Tracking', permission: 'payrollInput.view' },
  ]

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!period) return <div style={{ padding: '2rem', textAlign: 'center' }}>Period not found</div>

  const canModify = period.status === 'DRAFT' || period.status === 'OPEN_FOR_INPUT'

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/payroll-periods" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Payroll Periods</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {period.periodName}
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[period.status] || statusStyles.DRAFT }}>
                {period.status.replace(/_/g, ' ')}
              </span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
              {new Date(period.periodStart).toLocaleDateString()} &mdash; {new Date(period.periodEnd).toLocaleDateString()} &middot; Pay: {new Date(period.payDate).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {period.status === 'DRAFT' && has('payrollPeriod.open') && (
              <button onClick={() => handleAction('open')} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Open</button>
            )}
            {period.status === 'OPEN_FOR_INPUT' && has('payrollPeriod.close') && (
              <button onClick={() => handleAction('close')} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Close</button>
            )}
            {(period.status === 'DRAFT' || period.status === 'OPEN_FOR_INPUT') && has('payrollPeriod.cancel') && (
              <button onClick={() => handleAction('cancel')} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            )}
            {has('payrollInput.view') && (
              <a href={`/payroll-periods/${id}/inputs`} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>Inputs</a>
            )}
            {has('payrollInput.import') && (
              <a href={`/payroll-periods/${id}/inputs/import`} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>Import</a>
            )}
            {has('payrollPeriod.review') && (
              <a href={`/payroll-periods/${id}/review`} style={{ background: '#8b5cf6', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>Review</a>
            )}
            {has('payrollPreparationSummary.view') && (
              <a href={`/payroll-periods/${id}/preparation-summary`} style={{ background: '#8b5cf6', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>Summary</a>
            )}
            {has('salary.view') && (
              <a href={`/payroll-periods/${id}/kpi-inputs`} style={{ background: '#f59e0b', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>KPI %</a>
            )}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
        {tabs.filter(t => has(t.permission)).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: '0.5rem 1rem',
              background: 'none',
              border: 'none',
              borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
              color: activeTab === tab.key ? '#2563eb' : '#666',
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              fontSize: '0.9rem',
              marginBottom: '-2px',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'dashboard' && dashboard && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.totalSelectedEmployees}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Selected Employees</div>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.totalInputRecords}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Total Records</div>
            </div>
            <div style={{ background: '#e5e7eb', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.draftInputs}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Draft</div>
            </div>
            <div style={{ background: '#dbeafe', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.submittedInputs}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Submitted</div>
            </div>
            <div style={{ background: '#d1fae5', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.acceptedInputs}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Accepted</div>
            </div>
            <div style={{ background: '#fee2e2', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.rejectedInputs}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Rejected</div>
            </div>
            <div style={{ background: '#fef3c7', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{dashboard.missingInputs}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Missing</div>
            </div>
          </div>

          <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Departments Submitted</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Department</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Submitted</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Total</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.departments || []).map(d => (
                <tr key={d.department} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{d.department}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{d.submitted}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{d.total}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{d.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Shops Submitted</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Shop</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Submitted</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Total</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>%</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.shops || []).map(s => (
                <tr key={s.shop} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.shop}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.submitted}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.total}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.percentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Recent Submissions</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Employee</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Input Type</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Submitted At</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.recentSubmissions || []).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.employeeName}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.inputType}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{new Date(r.submittedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Rejected / Returned</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Employee</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Input Type</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Note</th>
                <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Rejected At</th>
              </tr>
            </thead>
            <tbody>
              {(dashboard.rejectedItems || []).map((r, i) => (
                <tr key={i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.employeeName}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.inputType}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.note || '-'}</td>
                  <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{new Date(r.rejectedAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'employees' && (
        <div>
          <div style={{ marginBottom: '0.75rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Filter Eligible Employees</h3>
            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <input placeholder="Search name/ID" value={eligibleFilter.search} onChange={e => setEligibleFilter(f => ({ ...f, search: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }} />
              <input placeholder="Department" value={eligibleFilter.department} onChange={e => setEligibleFilter(f => ({ ...f, department: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 130 }} />
              <input placeholder="Region" value={eligibleFilter.region} onChange={e => setEligibleFilter(f => ({ ...f, region: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 100 }} />
              <input placeholder="Area" value={eligibleFilter.area} onChange={e => setEligibleFilter(f => ({ ...f, area: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 100 }} />
              <input placeholder="Shop" value={eligibleFilter.shop} onChange={e => setEligibleFilter(f => ({ ...f, shop: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 100 }} />
              <input placeholder="Role" value={eligibleFilter.role} onChange={e => setEligibleFilter(f => ({ ...f, role: e.target.value }))} style={{ padding: '0.3rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', width: 100 }} />
              <button onClick={() => fetchEligible()} style={{ background: '#2563eb', color: '#fff', padding: '0.3rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Search</button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Eligible Employees ({eligible.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Name</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>ID</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Department</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Role</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Ready</th>
                    {canModify && has('payrollPeriod.update') && <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {eligible.map(e => (
                    <tr key={e.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{e.name}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{e.employeeId}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{e.department}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{e.role}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>
                        <span style={{ padding: '0.1rem 0.35rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: e.payrollReady ? '#d1fae5' : '#fee2e2', color: e.payrollReady ? '#065f46' : '#991b1b' }}>
                          {e.payrollReady ? 'Ready' : 'Not Ready'}
                        </span>
                      </td>
                      {canModify && has('payrollPeriod.update') && (
                        <td style={{ padding: '0.4rem' }}>
                          <button onClick={() => handleAddEmployee(e.employeeId)} style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>Add</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {eligible.length === 0 && (
                    <tr><td colSpan={canModify && has('payrollPeriod.update') ? 6 : 5} style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>No eligible employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>

            <div>
              <h3 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem' }}>Selected Employees ({selected.length})</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Name</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>ID</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Department</th>
                    {canModify && has('payrollPeriod.update') && <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}></th>}
                  </tr>
                </thead>
                <tbody>
                  {selected.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.name}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.employeeId}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{s.department}</td>
                      {canModify && has('payrollPeriod.update') && (
                        <td style={{ padding: '0.4rem' }}>
                          <button onClick={() => handleRemoveEmployee(s.employeeId)} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.5rem', cursor: 'pointer', fontSize: '0.8rem' }}>Remove</button>
                        </td>
                      )}
                    </tr>
                  ))}
                  {selected.length === 0 && (
                    <tr><td colSpan={canModify && has('payrollPeriod.update') ? 4 : 3} style={{ padding: '1rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>No selected employees</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Department Submission Status</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Department</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
                <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Records</th>
              </tr>
            </thead>
            <tbody>
              {submissionGroups.map(g => (
                <tr key={g.department} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '0.5rem', fontSize: '0.9rem', fontWeight: 500 }}>{g.department}</td>
                  <td style={{ padding: '0.5rem' }}>
                    <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...submissionStatusStyles[g.status] || submissionStatusStyles.NOT_STARTED }}>
                      {g.status.replace(/_/g, ' ')}
                    </span>
                  </td>
                  <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{g.count}</td>
                </tr>
              ))}
              {submissionGroups.length === 0 && (
                <tr><td colSpan={3} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No submission data available</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
