'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const SYSTEM_FIELDS = [
  { key: 'employeeId', label: 'Employee ID', required: false, category: 'core' },
  { key: 'firstName', label: 'First Name', required: true, category: 'core' },
  { key: 'middleName', label: 'Middle Name', required: false, category: 'core' },
  { key: 'lastName', label: 'Last Name', required: false, category: 'core' },
  { key: 'fullName', label: 'Full Name', required: false, category: 'core' },
  { key: 'gender', label: 'Gender', required: true, category: 'core' },
  { key: 'phoneNumber', label: 'Phone Number', required: false, category: 'core' },
  { key: 'email', label: 'Email', required: false, category: 'core' },
  { key: 'dateOfBirth', label: 'Date of Birth', required: false, category: 'core' },
  { key: 'hireDate', label: 'Hire Date', required: false, category: 'core' },
  { key: 'employmentType', label: 'Employment Type', required: false, category: 'core' },
  { key: 'employmentStatus', label: 'Employment Status', required: true, category: 'core' },
  { key: 'employeeCategory', label: 'Employee Category', required: true, category: 'core' },
  { key: 'department', label: 'Department', required: false, category: 'organization' },
  { key: 'division', label: 'Division', required: false, category: 'organization' },
  { key: 'region', label: 'Region', required: false, category: 'organization' },
  { key: 'area', label: 'Area', required: false, category: 'organization' },
  { key: 'shop', label: 'Shop', required: false, category: 'organization' },
  { key: 'cluster', label: 'Cluster', required: false, category: 'organization' },
  { key: 'role', label: 'Role', required: true, category: 'organization' },
  { key: 'level', label: 'Level', required: false, category: 'organization' },
  { key: 'directManagerEmployeeId', label: 'Manager Employee ID', required: false, category: 'organization' },
  { key: 'directManagerName', label: 'Manager Name', required: false, category: 'organization' },
  { key: 'accountingReportingManagerEmployeeId', label: 'Accounting Manager ID', required: false, category: 'organization' },
  { key: 'accountingReportingManagerName', label: 'Accounting Manager Name', required: false, category: 'organization' },
  { key: 'basicSalary', label: 'Basic Salary', required: false, category: 'payroll' },
  { key: 'salaryEffectiveDate', label: 'Salary Effective Date', required: false, category: 'payroll' },
  { key: 'paymentMethod', label: 'Payment Method', required: false, category: 'payroll' },
  { key: 'bankName', label: 'Bank Name', required: false, category: 'payroll' },
  { key: 'bankAccountNumber', label: 'Bank Account Number', required: false, category: 'payroll' },
  { key: 'mpesaAccount', label: 'M-PESA Account', required: false, category: 'payroll' },
  { key: 'taxId', label: 'Tax ID', required: false, category: 'payroll' },
  { key: 'pensionId', label: 'Pension ID', required: false, category: 'payroll' },
  { key: 'costCenter', label: 'Cost Center', required: false, category: 'payroll' },
  { key: 'address', label: 'Address', required: false, category: 'optional' },
  { key: 'notes', label: 'Notes', required: false, category: 'optional' },
]

interface PreviewResult {
  importSessionId: string
  totalRows: number
  validRows: number
  warningRows: number
  errorRows: number
  duplicateRows: number
  previewRows: Array<{
    rowNumber: number
    status: string
    errors: string[]
    warnings: string[]
    matchedEmployeeId: string | null
    data: Record<string, unknown>
  }>
  detectedColumns: string[]
  suggestedMappings: Record<string, string | null>
}

export default function EmployeeImportPage() {
  const router = useRouter()
  const [perms, setPerms] = useState<string[]>([])
  const [step, setStep] = useState<'upload' | 'mapping' | 'preview' | 'result'>('upload')
  const [file, setFile] = useState<File | null>(null)
  const [importMode, setImportMode] = useState('CREATE_OR_UPDATE')
  const [detectedColumns, setDetectedColumns] = useState<string[]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState<PreviewResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmResult, setConfirmResult] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    fetch('/api/auth/me').then(r => r.json()).then(json => {
      const me = json.data || json
      setPerms(me.permissions || [])
      if (!me.permissions?.includes('employee.import')) {
        router.push('/employees')
      }
    }).catch(() => router.push('/login'))
  }, [router])

  async function handleUpload() {
    if (!file) return
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('importMode', importMode)
      const res = await fetch('/api/employees/import/preview', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Upload failed'); setLoading(false); return }
      const data = json.data || json
      setDetectedColumns(data.detectedColumns || [])
      const initialMapping: Record<string, string> = {}
      for (const col of data.detectedColumns || []) {
        initialMapping[col] = data.suggestedMappings?.[col] || ''
      }
      setMapping(initialMapping)
      setPreview(data)
      setStep('mapping')
    } catch { setError('Upload failed') }
    setLoading(false)
  }

  async function handlePreview() {
    setLoading(true)
    setError('')
    try {
      const formData = new FormData()
      if (file) formData.append('file', file)
      formData.append('importMode', importMode)
      const backendMapping: Record<string, string> = {}
      for (const [col, sysField] of Object.entries(mapping)) {
        if (sysField) backendMapping[sysField] = col
      }
      formData.append('mapping', JSON.stringify(backendMapping))
      const res = await fetch('/api/employees/import/preview', { method: 'POST', body: formData })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Preview failed'); setLoading(false); return }
      setPreview(json.data || json)
      setStep('preview')
    } catch { setError('Preview failed') }
    setLoading(false)
  }

  async function handleConfirm() {
    if (!preview?.importSessionId) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/employees/import/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importSessionId: preview.importSessionId, confirmed: true }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Confirm failed'); setLoading(false); return }
      setConfirmResult(json.data || json)
      setStep('result')
    } catch { setError('Confirm failed') }
    setLoading(false)
  }

  function downloadErrorReport() {
    if (!preview) return
    const errorRows = preview.previewRows.filter(r => r.status === 'ERROR' || r.status === 'DUPLICATE')
    const csv = [['Row', 'Status', 'Errors', 'Warnings'].join(','),
      ...errorRows.map(r => [r.rowNumber, r.status, `"${r.errors.join('; ')}"`, `"${r.warnings.join('; ')}"`].join(',')),
    ].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'import-errors.csv'; a.click()
  }

  const th: React.CSSProperties = { padding: '0.5rem', textAlign: 'left', borderBottom: '2px solid #e5e7eb', fontSize: '0.8rem', fontWeight: 600 }
  const td: React.CSSProperties = { padding: '0.4rem 0.5rem', borderBottom: '1px solid #e5e7eb', fontSize: '0.8rem' }

  if (!perms.includes('employee.import')) return <div style={{ padding: '2rem' }}>Access denied</div>

  return (
    <div style={{ padding: '1.5rem', maxWidth: 1200, margin: '0 auto' }}>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <Link href="/employees" style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.9rem' }}>&larr; Back</Link>
        <h1 style={{ margin: 0, fontSize: '1.25rem' }}>Employee Import</h1>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {['upload', 'mapping', 'preview', 'result'].map((s, i) => (
          <div key={s} style={{ padding: '0.3rem 0.8rem', borderRadius: 4, fontSize: '0.8rem', fontWeight: 600, background: step === s ? '#2563eb' : i < ['upload', 'mapping', 'preview', 'result'].indexOf(step) ? '#16a34a' : '#e5e7eb', color: step === s || i < ['upload', 'mapping', 'preview', 'result'].indexOf(step) ? '#fff' : '#666' }}>
            {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
          </div>
        ))}
      </div>

      {error && <div style={{ padding: '0.75rem', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 4, marginBottom: '1rem', color: '#dc2626', fontSize: '0.85rem' }}>{error}</div>}

      {step === 'upload' && (
        <div style={{ background: '#f9fafb', padding: '1.5rem', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Upload Employee File</h3>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>Import Mode</label>
            <select value={importMode} onChange={e => setImportMode(e.target.value)} style={{ padding: '0.4rem', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.9rem', width: 300 }}>
              <option value="CREATE_OR_UPDATE">Create or Update (Default)</option>
              <option value="CREATE_ONLY">Create New Only</option>
              <option value="UPDATE_ONLY">Update Existing Only</option>
            </select>
          </div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.3rem', fontSize: '0.85rem', fontWeight: 500 }}>File (CSV or XLSX, max 10 MB)</label>
            <input type="file" accept=".csv,.xlsx,.xls" onChange={e => setFile(e.target.files?.[0] || null)} style={{ fontSize: '0.9rem' }} />
          </div>
          <button onClick={handleUpload} disabled={!file || loading} style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: file ? 'pointer' : 'not-allowed', fontSize: '0.9rem', opacity: file ? 1 : 0.5 }}>
            {loading ? 'Processing...' : 'Upload & Detect Columns'}
          </button>
        </div>
      )}

      {step === 'mapping' && (
        <div>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem' }}>Map Columns ({detectedColumns.length} columns detected)</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1rem' }}>Map uploaded columns to system fields. Required fields are marked with *.</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }}>
            {detectedColumns.map(col => (
              <div key={col} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ flex: 1, fontSize: '0.85rem', fontWeight: 500, background: '#f3f4f6', padding: '0.3rem 0.5rem', borderRadius: 3 }}>{col}</span>
                <span style={{ fontSize: '0.8rem', color: '#888' }}>&rarr;</span>
                <select value={mapping[col] || ''} onChange={e => setMapping({ ...mapping, [col]: e.target.value })} style={{ flex: 1, padding: '0.3rem', borderRadius: 4, border: '1px solid #d1d5db', fontSize: '0.85rem' }}>
                  <option value="">-- Skip --</option>
                  {SYSTEM_FIELDS.map(f => (
                    <option key={f.key} value={f.key}>{f.label}{f.required ? ' *' : ''}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setStep('upload')} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Back</button>
            <button onClick={handlePreview} disabled={loading} style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
              {loading ? 'Validating...' : 'Preview Validation'}
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && preview && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.75rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total', value: preview.totalRows, color: '#1e40af' },
              { label: 'Valid', value: preview.validRows, color: '#16a34a' },
              { label: 'Warnings', value: preview.warningRows, color: '#f59e0b' },
              { label: 'Errors', value: preview.errorRows, color: '#dc2626' },
              { label: 'Duplicates', value: preview.duplicateRows, color: '#8b5cf6' },
            ].map(s => (
              <div key={s.label} style={{ background: '#f9fafb', padding: '0.75rem', borderRadius: 6, textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <button onClick={() => setStep('mapping')} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>Edit Mapping</button>
            <button onClick={downloadErrorReport} disabled={preview.errorRows === 0 && preview.duplicateRows === 0} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', opacity: preview.errorRows === 0 ? 0.5 : 1 }}>Download Error Report</button>
          </div>

          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                <th style={th}>Row</th><th style={th}>Status</th><th style={th}>Name</th><th style={th}>Category</th><th style={th}>Role</th><th style={th}>Department/Shop</th><th style={th}>Salary</th><th style={th}>Errors</th><th style={th}>Warnings</th><th style={th}>Match</th>
              </tr></thead>
              <tbody>{preview.previewRows.map(r => (
                <tr key={r.rowNumber} style={{ background: r.status === 'ERROR' ? '#fef2f2' : r.status === 'WARNING' ? '#fffbeb' : r.status === 'DUPLICATE' ? '#f5f3ff' : '#fff' }}>
                  <td style={td}>{r.rowNumber}</td>
                  <td style={td}><span style={{ padding: '0.15rem 0.4rem', borderRadius: 3, fontSize: '0.75rem', fontWeight: 600, background: r.status === 'VALID' ? '#dcfce7' : r.status === 'WARNING' ? '#fef3c7' : r.status === 'ERROR' ? '#fee2e2' : '#ede9fe', color: r.status === 'VALID' ? '#166534' : r.status === 'WARNING' ? '#92400e' : r.status === 'ERROR' ? '#991b1b' : '#5b21b6' }}>{r.status}</span></td>
                  <td style={td}>{String(r.data.fullName || [r.data.firstName, r.data.lastName].filter(Boolean).join(' ') || '')}</td>
                  <td style={td}>{String(r.data.employeeCategory || '')}</td>
                  <td style={td}>{String(r.data.role || '')}</td>
                  <td style={td}>{String(r.data.department || r.data.shop || '')}</td>
                  <td style={td}>{r.data.basicSalary ? Number(r.data.basicSalary).toLocaleString() : ''}</td>
                  <td style={td}>{r.errors.length > 0 && <span style={{ color: '#dc2626' }}>{r.errors.join('; ')}</span>}</td>
                  <td style={td}>{r.warnings.length > 0 && <span style={{ color: '#d97706' }}>{r.warnings.join('; ')}</span>}</td>
                  <td style={td}>{r.matchedEmployeeId ? <span style={{ color: '#2563eb' }}>Existing</span> : 'New'}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => setStep('mapping')} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>Back</button>
            <button onClick={handleConfirm} disabled={loading || preview.validRows === 0} style={{ background: '#16a34a', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem', opacity: preview.validRows === 0 ? 0.5 : 1 }}>
              {loading ? 'Importing...' : `Confirm Import (${preview.validRows + preview.warningRows} rows)`}
            </button>
          </div>
        </div>
      )}

      {step === 'result' && confirmResult && (
        <div style={{ background: '#f0fdf4', padding: '1.5rem', borderRadius: 8 }}>
          <h3 style={{ margin: '0 0 1rem', fontSize: '1rem', color: '#166534' }}>Import Complete</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Created', value: (confirmResult as Record<string, number>).createdCount || 0, color: '#16a34a' },
              { label: 'Updated', value: (confirmResult as Record<string, number>).updatedCount || 0, color: '#2563eb' },
              { label: 'Skipped', value: (confirmResult as Record<string, number>).skippedCount || 0, color: '#f59e0b' },
              { label: 'Errors', value: ((confirmResult as Record<string, number>).errorRows || 0) + ((confirmResult as Record<string, number>).duplicateRows || 0), color: '#dc2626' },
            ].map(s => (
              <div key={s.label} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, color: s.color }}>{s.value}</div>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <Link href="/employees/import/history" style={{ background: '#2563eb', color: '#fff', padding: '0.5rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>View Import History</Link>
            <Link href="/employees/payroll-readiness" style={{ background: '#7c3aed', color: '#fff', padding: '0.5rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>Payroll Readiness</Link>
            <Link href="/employees" style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>View Employees</Link>
          </div>
        </div>
      )}
    </div>
  )
}
