'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useParams } from 'next/navigation'

interface PreviewRow {
  rowNumber: number
  employeeId: string
  inputTypeCode: string
  value: string | null
  amount: number | null
  status: 'VALID' | 'ERROR' | 'DUPLICATE'
  errors: string[]
}

interface ImportResult {
  imported: number
  skipped: number
  errors: number
  details: Array<{ employeeId: string; inputTypeCode: string; status: string; error?: string }>
}

export default function InputImportPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const fileRef = useRef<HTMLInputElement>(null)

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [preview, setPreview] = useState<PreviewRow[]>([])
  const [validRows, setValidRows] = useState<Array<{ employeeId: string; inputTypeCode: string; value: string | null; amount: number | null }> | null>(null)
  const [importMode, setImportMode] = useState<'CREATE_ONLY' | 'UPDATE_DRAFT_ONLY' | 'SKIP_EXISTING'>('CREATE_ONLY')
  const [, setFileName] = useState('')
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const [parsing, setParsing] = useState(false)

  useEffect(() => {
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(j => {
        const p = j.data?.permissions || []
        if (!p.includes('payrollInput.import')) router.push(`/payroll-periods/${id}`)
      })
      .catch(() => router.push('/login'))
      .finally(() => setLoading(false))
  }, [router, id])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setResult(null)
    setError('')

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (ext !== 'csv') {
      setError('Please upload a CSV file')
      return
    }

    setParsing(true)

    try {
      const text = await file.text()
      const Papa = await import('papaparse')
      const parsed = Papa.default.parse(text, { header: true, skipEmptyLines: true })
      const rows = parsed.data as Record<string, string>[]
      const payload = rows.map((r: Record<string, string>, i: number) => ({
        rowNumber: i + 1,
        employeeId: r.employeeId || r.EmployeeId || r.employee_id || '',
        inputTypeCode: r.inputTypeCode || r.InputTypeCode || r.input_type_code || '',
        value: r.value || r.Value || null,
        amount: r.amount || r.Amount ? Number(r.amount || r.Amount) : null,
      }))
      await sendPreview(payload)
    } catch (err: any) {
      setError('Failed to parse CSV: ' + (err.message || 'Unknown error'))
    }

    setParsing(false)
  }

  const sendPreview = async (rows: { rowNumber: number; employeeId: string; inputTypeCode: string; value: string | null; amount: number | null }[]) => {
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/inputs/import/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows, importMode }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Preview failed'); setPreview([]); return }
    setPreview(json.data?.rows || [])
    setValidRows(json.data?.validRows || null)
  }

  const handleConfirm = async () => {
    if (!validRows || validRows.length === 0) {
      setError('No valid rows to import')
      return
    }
    setImporting(true)
    setError('')
    const res = await fetch(`/api/payroll-periods/${id}/inputs/import/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows: validRows, importMode }),
    })
    const json = await res.json()
    setImporting(false)
    if (!res.ok) { setError(json.error || 'Import failed'); return }
    setResult(json.data || { imported: 0, skipped: 0, errors: 0, details: [] })
    setPreview([])
    setValidRows(null)
  }

  const hasErrors = preview.some(r => r.status === 'ERROR')

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 1000, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href={`/payroll-periods/${id}`} style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Period</a>
      <h1 style={{ margin: '0 0 1.5rem' }}>Import Inputs</h1>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {!result && (
        <div>
          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Import Mode</label>
            <select value={importMode} onChange={e => setImportMode(e.target.value as any)} style={{ padding: '0.35rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }}>
              <option value="CREATE_ONLY">Create Only</option>
              <option value="UPDATE_DRAFT_ONLY">Update Draft Only</option>
              <option value="SKIP_EXISTING">Skip Existing</option>
            </select>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 500, marginBottom: '0.25rem' }}>Upload CSV File</label>
            <input ref={fileRef} type="file" accept=".csv" onChange={handleFile} style={{ fontSize: '0.85rem' }} />
            {parsing && <span style={{ color: '#666', fontSize: '0.85rem', marginLeft: '0.5rem' }}>Parsing...</span>}
          </div>

          {preview.length > 0 && (
            <div>
              <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '0.95rem' }}>Preview ({preview.length} rows)</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>#</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Employee ID</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Input Type</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Value</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Amount</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Status</th>
                    <th style={{ padding: '0.4rem', fontSize: '0.85rem' }}>Errors</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map(r => (
                    <tr key={r.rowNumber} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.rowNumber}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.employeeId}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.inputTypeCode}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.value || '-'}</td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem' }}>{r.amount !== null ? r.amount : '-'}</td>
                      <td style={{ padding: '0.4rem' }}>
                        <span style={{ padding: '0.1rem 0.4rem', borderRadius: 4, fontSize: '0.7rem', fontWeight: 600, background: r.status === 'VALID' ? '#d1fae5' : r.status === 'ERROR' ? '#fee2e2' : '#fef3c7', color: r.status === 'VALID' ? '#065f46' : r.status === 'ERROR' ? '#991b1b' : '#92400e' }}>
                          {r.status}
                        </span>
                      </td>
                      <td style={{ padding: '0.4rem', fontSize: '0.85rem', color: '#dc2626' }}>{r.errors.length > 0 ? r.errors.join('; ') : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <button onClick={handleConfirm} disabled={hasErrors || importing || !validRows} style={{ background: hasErrors || importing || !validRows ? '#999' : '#2563eb', color: '#fff', padding: '0.4rem 1.25rem', border: 'none', borderRadius: 4, cursor: hasErrors || importing || !validRows ? 'not-allowed' : 'pointer', fontSize: '0.9rem' }}>
                {importing ? 'Importing...' : 'Confirm Import'}
              </button>
              {hasErrors && <p style={{ color: 'red', fontSize: '0.85rem', marginTop: '0.35rem' }}>Fix errors before confirming import</p>}
            </div>
          )}
        </div>
      )}

      {result && (
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1.5rem' }}>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Import Result</h3>
          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Imported: <strong>{result.imported}</strong></p>
          <p style={{ margin: '0.25rem 0', fontSize: '0.9rem' }}>Skipped: <strong>{result.skipped}</strong></p>
          {result.details?.filter(d => d.status === 'ERROR').map((d, i) => (
            <p key={i} style={{ margin: '0.25rem 0', fontSize: '0.85rem', color: '#dc2626' }}>{d.employeeId} / {d.inputTypeCode}: {d.error}</p>
          ))}
          <button onClick={() => { setResult(null); setPreview([]); setValidRows(null); setFileName(''); if (fileRef.current) fileRef.current.value = '' }} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem', marginTop: '1rem' }}>Import Another File</button>
        </div>
      )}
    </div>
  )
}
