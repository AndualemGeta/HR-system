'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface PayrollRow {
  id: string; employeeCode: string; employeeName: string
  department: string | null; role: string | null; location: string | null
  basicSalary: number | null; workingDays: number | null; monthlySalary: number | null
  allowance: number | null; overtime: number | null; incentive: number | null; commission: number | null
  grossSalary: number | null; taxableIncome: number | null
  employeePension: number | null; employerPension: number | null
  incomeTax: number | null; otherDeduction: number | null
  totalDeduction: number | null; netSalary: number | null
  paymentMethod: string | null; bankName: string | null
  bankAccountNumber: string | null; mpesaAccount: string | null
  hireDate: string | null; pensionEligible: boolean | null
  notes: string | null
  validationStatus: string; validationMessages: string | null
  snapshotJson: string | null; overrideReason: string | null
}

interface Period {
  id: string; periodName: string; month: number; year: number
  status: string; payDate: string
  readyById: string | null; lockedById: string | null
  reopenReason: string | null
}

export default function PayrollDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [period, setPeriod] = useState<Period | null>(null)
  const [rows, setRows] = useState<PayrollRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [successMsg, setSuccessMsg] = useState('')
  const [perms, setPerms] = useState<string[]>([])
  const [search, setSearch] = useState('')
  const [deptFilter, setDeptFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [snapshotLoading, setSnapshotLoading] = useState(false)
  const [validationResult, setValidationResult] = useState<{ blockerCount: number; warningCount: number } | null>(null)
  const [reopenModal, setReopenModal] = useState(false)
  const [reopenReason, setReopenReason] = useState('')
  const [reopenLoading, setReopenLoading] = useState(false)
  const [depts, setDepts] = useState<string[]>([])
  const [exporting, setExporting] = useState(false)
  const [bulkField, setBulkField] = useState('')
  const [bulkValue, setBulkValue] = useState('')
  const [bulkModal, setBulkModal] = useState(false)

  const loadData = useCallback(async () => {
    if (!params.id) return
    try {
      const [meRes, periodRes, rowsRes] = await Promise.all([
        fetch('/api/auth/me').then(r => r.json()),
        fetch(`/api/payroll/${params.id}`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
        fetch(`/api/payroll/${params.id}/rows`).then(r => { if (!r.ok) throw new Error(); return r.json() }),
      ])
      setPerms((meRes.data || meRes).permissions || [])
      setPeriod(periodRes.data)
      const rowData = rowsRes.data?.rows || []
      setRows(rowData)
      const uniqueDepts = [...new Set(rowData.map((r: PayrollRow) => r.department).filter(Boolean))] as string[]
      setDepts(uniqueDepts)
    } catch {
      router.push('/login')
    } finally {
      setLoading(false)
    }
  }, [params.id, router])

  useEffect(() => { loadData() }, [loadData])

  const has = (p: string) => perms.includes(p)
  const isDraft = period?.status === 'DRAFT'
  const isReady = period?.status === 'READY'
  const isLocked = period?.status === 'LOCKED'
  const canEdit = (isDraft || isReady) && has('payrollPeriod.update')

  const filteredRows = rows.filter(r => {
    if (search && !r.employeeName.toLowerCase().includes(search.toLowerCase()) && !r.employeeCode.toLowerCase().includes(search.toLowerCase())) return false
    if (deptFilter && r.department !== deptFilter) return false
    if (statusFilter && r.validationStatus !== statusFilter) return false
    return true
  })

  // Totals
  const totals = {
    basicSalary: rows.reduce((s, r) => s + Number(r.basicSalary || 0), 0),
    workingDays: rows.reduce((s, r) => s + Number(r.workingDays || 0), 0),
    monthlySalary: rows.reduce((s, r) => s + Number(r.monthlySalary || 0), 0),
    allowance: rows.reduce((s, r) => s + Number(r.allowance || 0), 0),
    overtime: rows.reduce((s, r) => s + Number(r.overtime || 0), 0),
    incentive: rows.reduce((s, r) => s + Number(r.incentive || 0), 0),
    commission: rows.reduce((s, r) => s + Number(r.commission || 0), 0),
    grossSalary: rows.reduce((s, r) => s + Number(r.grossSalary || 0), 0),
    taxableIncome: rows.reduce((s, r) => s + Number(r.taxableIncome || 0), 0),
    employeePension: rows.reduce((s, r) => s + Number(r.employeePension || 0), 0),
    employerPension: rows.reduce((s, r) => s + Number(r.employerPension || 0), 0),
    incomeTax: rows.reduce((s, r) => s + Number(r.incomeTax || 0), 0),
    otherDeduction: rows.reduce((s, r) => s + Number(r.otherDeduction || 0), 0),
    totalDeduction: rows.reduce((s, r) => s + Number(r.totalDeduction || 0), 0),
    netSalary: rows.reduce((s, r) => s + Number(r.netSalary || 0), 0),
  }

  async function handleSnapshot(confirmReSnapshot = false) {
    setSnapshotLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/snapshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: confirmReSnapshot }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Snapshot failed'); return }
      setSuccessMsg(`Snapshotted ${json.data.employeeCount} employees`)
      loadData()
    } catch { setError('Network error') }
    finally { setSnapshotLoading(false) }
  }

  async function handleCalculate() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/calculate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Calculation failed'); return }
      setRows(json.data.rows)
      setSuccessMsg(`Calculated ${json.data.calculated} rows`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleValidate() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/validate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Validation failed'); return }
      setRows(json.data.rows)
      setValidationResult({ blockerCount: json.data.blockerCount, warningCount: json.data.warningCount })
      setSuccessMsg(`Validation complete: ${json.data.blockerCount} blockers, ${json.data.warningCount} warnings`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleMarkReady() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/ready`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to mark ready'); return }
      setPeriod(json.data)
      setSuccessMsg('Period marked as READY')
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleLock() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/lock`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to lock'); return }
      setPeriod(json.data)
      setSuccessMsg('Period locked')
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  async function handleReopen() {
    if (!reopenReason.trim()) { setError('Reason is required'); return }
    setReopenLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reopenReason }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Failed to reopen'); setReopenLoading(false); return }
      setPeriod(json.data)
      setSuccessMsg('Period reopened')
      setReopenModal(false)
      setReopenReason('')
    } catch { setError('Network error') }
    finally { setReopenLoading(false) }
  }

  async function handleBulkUpdate(field: string, value: number | null) {
    if (!canEdit) return
    setSaving(true)
    setError('')
    try {
      const payload = rows.map(r => ({ id: r.id, [field]: value }))
      const res = await fetch(`/api/payroll/${params.id}/rows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: payload }),
      })
      if (!res.ok) { const j = await res.json(); setError(j.error || 'Update failed'); setSaving(false); return }
      setRows(prev => prev.map(r => ({ ...r, [field]: value })))
      setSuccessMsg(`Bulk updated ${field}`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  // Inline editing
  function updateRow(rowId: string, field: string, value: string | number | null) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, [field]: value } : r))
  }

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function handleCellChange(rowId: string, field: string, value: string) {
    const numValue = value === '' ? null : parseFloat(value)
    updateRow(rowId, field, numValue)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const row = rows.find(r => r.id === rowId)
      if (!row) return
      const res = await fetch(`/api/payroll/${params.id}/rows`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: [{ id: rowId, [field]: numValue }] }),
      })
      if (res.ok) setSuccessMsg('Saved')
    }, 800)
  }

  async function handleExport() {
    setExporting(true)
    setError('')
    try {
      const res = await fetch(`/api/payroll/${params.id}/generate-excel`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Export failed'); return }
      setSuccessMsg('Payroll Excel generated')
      window.open(json.data.downloadUrl, '_blank')
    } catch { setError('Network error') }
    finally { setExporting(false) }
  }

  const statusColor: Record<string, string> = {
    DRAFT: '#fef3c7', READY: '#dbeafe', LOCKED: '#d1fae5', CANCELLED: '#fee2e2',
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!period) return <div style={{ padding: '2rem', textAlign: 'center' }}>Period not found</div>

  const editableFields = ['workingDays', 'commission', 'overtime', 'incentive', 'otherDeduction', 'allowance']

  return (
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
        <div>
          <a href="/payroll" style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Payroll Periods</a>
          <h1 style={{ margin: 0 }}>{period.periodName}</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Pay date: {period.payDate ? new Date(period.payDate).toLocaleDateString() : 'Not set'}
            &nbsp;·&nbsp;
            <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: statusColor[period.status] }}>{period.status}</span>
            {period.reopenReason && <span style={{ marginLeft: '0.5rem', color: '#dc2626', fontSize: '0.8rem' }}>Reopened: {period.reopenReason}</span>}
          </p>
        </div>
      </div>

      {error && <div style={{ color: '#dc2626', background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</div>}
      {successMsg && <div style={{ color: '#16a34a', background: '#f0fdf4', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{successMsg}</div>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        {isDraft && rows.length === 0 && (
          <button onClick={() => { handleSnapshot(false).catch(() => {}) }} disabled={snapshotLoading}
            style={{ padding: '0.4rem 0.75rem', background: snapshotLoading ? '#999' : '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {snapshotLoading ? 'Snapshoting...' : 'Snapshot Active Employees'}
          </button>
        )}
        {isDraft && rows.length > 0 && (
          <button onClick={() => { if (window.confirm('Re-snapshot will DELETE all existing rows and re-create them from active employees. Continue?')) { handleSnapshot(true).catch(() => {}) } }} disabled={snapshotLoading}
            style={{ padding: '0.4rem 0.75rem', background: snapshotLoading ? '#999' : '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {snapshotLoading ? 'Re-snapshotting...' : 'Re-snapshot'}
          </button>
        )}
        {canEdit && rows.length > 0 && (
          <button onClick={handleCalculate} disabled={saving}
            style={{ padding: '0.4rem 0.75rem', background: saving ? '#999' : '#7c3aed', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            Calculate Gross/Net
          </button>
        )}
        {canEdit && rows.length > 0 && (
          <button onClick={handleValidate} disabled={saving}
            style={{ padding: '0.4rem 0.75rem', background: saving ? '#999' : '#0891b2', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            Validate Rows
          </button>
        )}
        {isDraft && rows.length > 0 && (
          <button onClick={handleMarkReady} disabled={saving}
            style={{ padding: '0.4rem 0.75rem', background: saving ? '#999' : '#16a34a', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            Mark Ready
          </button>
        )}
        {isReady && (
          <button onClick={handleLock} disabled={saving}
            style={{ padding: '0.4rem 0.75rem', background: saving ? '#999' : '#dc2626', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            Lock Period
          </button>
        )}
        {(isReady || isLocked) && (
          <button onClick={handleExport} disabled={exporting}
            style={{ padding: '0.4rem 0.75rem', background: exporting ? '#999' : '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            {exporting ? 'Exporting...' : 'Export Excel'}
          </button>
        )}
        {isLocked && has('payrollPeriod.update') && (
          <button onClick={() => setReopenModal(true)}
            style={{ padding: '0.4rem 0.75rem', background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
            Reopen
          </button>
        )}
      </div>

      {validationResult && (
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem', padding: '0.5rem', background: validationResult.blockerCount > 0 ? '#fee' : '#f0fdf4', borderRadius: 4 }}>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: validationResult.blockerCount > 0 ? '#dc2626' : '#16a34a' }}>
            Blockers: {validationResult.blockerCount}
          </span>
          <span style={{ fontSize: '0.9rem', fontWeight: 600, color: '#f59e0b' }}>
            Warnings: {validationResult.warningCount}
          </span>
        </div>
      )}

      {/* Filters */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input type="text" placeholder="Search employee..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', flex: 1, minWidth: 150 }} />
          <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
            style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', background: '#fff' }}>
            <option value="">All Departments</option>
            {depts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', background: '#fff' }}>
            <option value="">All Status</option>
            <option value="PENDING">Pending</option>
            <option value="VALID">Valid</option>
            <option value="WARNING">Warning</option>
            <option value="ERROR">Error</option>
          </select>
          <span style={{ fontSize: '0.85rem', color: '#666' }}>{filteredRows.length} of {rows.length} rows</span>
        </div>
      )}

      {/* Editable Table */}
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: 6 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: '#f3f4f6' }}>
                <th style={thStyle}>Code</th>
                <th style={{ ...thStyle, minWidth: 170 }}>Name</th>
                <th style={thStyle}>Position</th>
                <th style={thStyle}>Shop/Location</th>
                {editableFields.map(f => (
                  <th key={f} style={{ ...thStyle, minWidth: 85, position: 'relative' }}>
                    {f === 'workingDays' ? 'Days' : f === 'commission' ? 'Commission' : f === 'overtime' ? 'Overtime' : f === 'incentive' ? 'KPI' : f === 'otherDeduction' ? 'Loan' : f === 'allowance' ? 'Allow' : f}
                    {canEdit && isDraft && (
                      <button onClick={() => { setBulkField(f); setBulkValue(''); setBulkModal(true) }}
                        style={{ marginLeft: 2, padding: '0 4px', fontSize: '0.7rem', border: '1px solid #ccc', borderRadius: 2, background: '#fff', cursor: 'pointer' }}
                        title={`Bulk update ${f}`}>B</button>
                    )}
                  </th>
                ))}
                <th style={thStyle}>Monthly</th>
                <th style={thStyle}>Gross</th>
                <th style={thStyle}>Tax</th>
                <th style={thStyle}>Pension</th>
                <th style={thStyle}>Total Ded</th>
                <th style={thStyle}>Net</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(row => {
                const valStatus = row.validationStatus
                const statusBg = valStatus === 'ERROR' ? '#fee' : valStatus === 'WARNING' ? '#fef3c7' : valStatus === 'VALID' ? '#f0fdf4' : 'transparent'
                const monthlySalary = Number(row.monthlySalary || 0) || Math.round((Number(row.basicSalary || 0) / 30) * Number(row.workingDays || 30) * 100) / 100
                return (
                  <tr key={row.id} style={{ background: statusBg, borderBottom: '1px solid #f3f4f6' }}>
                    <td style={tdStyle}>{row.employeeCode}</td>
                    <td style={tdStyle}>{row.employeeName}</td>
                    <td style={tdStyle}>{row.role || '—'}</td>
                    <td style={tdStyle}>{row.location || row.department || '—'}</td>
                    {editableFields.map(f => {
                      const displayVal = (row as unknown as Record<string, unknown>)[f]
                      return (
                        <td key={f} style={tdStyle}>
                          {canEdit ? (
                            <input type="number" step="0.01"
                              value={String(displayVal ?? '')}
                              onChange={e => handleCellChange(row.id, f, e.target.value)}
                              style={{ width: '100%', padding: '2px 4px', border: '1px solid #d1d5db', borderRadius: 2, fontSize: '0.85rem', boxSizing: 'border-box', background: isLocked ? '#f3f4f6' : '#fff' }}
                              disabled={isLocked} />
                          ) : (
                            String(displayVal ?? '0')
                          )}
                        </td>
                      )
                    })}
                    <td style={tdStyle}>{monthlySalary.toLocaleString()}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{row.grossSalary?.toLocaleString() || '—'}</td>
                    <td style={tdStyle}>{row.incomeTax?.toLocaleString() || '—'}</td>
                    <td style={tdStyle}>
                      {row.pensionEligible === false
                        ? <span style={{ color: '#9ca3af', fontSize: '0.8rem' }}>Not yet eligible</span>
                        : Number(row.employeePension || 0).toLocaleString()}
                    </td>
                    <td style={tdStyle}>{row.totalDeduction?.toLocaleString() || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600, color: (row.netSalary || 0) >= 0 ? '#16a34a' : '#dc2626' }}>{row.netSalary?.toLocaleString() || '—'}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '2px 6px', borderRadius: 3, fontSize: '0.75rem', fontWeight: 600,
                        background: valStatus === 'ERROR' ? '#fee' : valStatus === 'WARNING' ? '#fef3c7' : valStatus === 'VALID' ? '#f0fdf4' : '#f3f4f6',
                      }}>{valStatus}</span>
                    </td>
                    <td style={tdStyle}>{row.notes || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr style={{ background: '#f0fdf4', fontWeight: 600 }}>
                <td style={tdStyle}></td>
                <td style={tdStyle}><strong>Totals ({rows.length} rows)</strong></td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
                {editableFields.map(f => {
                  return <td key={f} style={tdStyle}>{Number(totals[f as keyof typeof totals] || 0).toLocaleString()}</td>
                })}
                <td style={tdStyle}>{totals.monthlySalary.toLocaleString()}</td>
                <td style={tdStyle}>{totals.grossSalary.toLocaleString()}</td>
                <td style={tdStyle}>{totals.incomeTax.toLocaleString()}</td>
                <td style={tdStyle}>{totals.employeePension.toLocaleString()}</td>
                <td style={tdStyle}>{totals.totalDeduction.toLocaleString()}</td>
                <td style={tdStyle}>{totals.netSalary.toLocaleString()}</td>
                <td style={tdStyle}></td>
                <td style={tdStyle}></td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Bulk Update Modal */}
      {bulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 350, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Bulk Update: {bulkField}</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.5rem' }}>Set value for all {rows.length} rows (leave empty to clear).</p>
            <input type="number" step="0.01" value={bulkValue} onChange={e => setBulkValue(e.target.value)}
              placeholder="Amount"
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => setBulkModal(false)}
                style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={() => { const num = bulkValue === '' ? null : parseFloat(bulkValue); if (num !== null && !isNaN(num)) handleBulkUpdate(bulkField, num); else if (bulkValue === '') handleBulkUpdate(bulkField, null); setBulkModal(false) }}
                style={{ padding: '0.4rem 0.75rem', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reopen Modal */}
      {reopenModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Reopen Payroll Period</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>This will unlock the period and allow editing. A reason is required.</p>
            <textarea value={reopenReason} onChange={e => setReopenReason(e.target.value)} rows={3}
              placeholder="Reason for reopening..."
              style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setReopenModal(false); setReopenReason('') }}
                style={{ padding: '0.4rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
              <button onClick={handleReopen} disabled={reopenLoading}
                style={{ padding: '0.4rem 0.75rem', background: reopenLoading ? '#999' : '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {reopenLoading ? 'Reopening...' : 'Confirm Reopen'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exports list */}
      {period.status !== 'DRAFT' && (
        <div style={{ marginTop: '1.5rem' }}>
          <Link href={`/payroll/${params.id}/export`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>
            View Export History &rarr;
          </Link>
        </div>
      )}
    </div>
  )
}

const thStyle: React.CSSProperties = {
  padding: '0.5rem', textAlign: 'left', fontSize: '0.8rem', fontWeight: 600,
  borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: '#f3f4f6',
}

const tdStyle: React.CSSProperties = {
  padding: '0.35rem 0.5rem', borderBottom: '1px solid #f3f4f6', whiteSpace: 'nowrap',
}
