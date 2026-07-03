'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ImportRow {
  rowIndex: number; shopCode: string; shopName: string
  isValid: boolean; errors: string[]; warnings: string[]
  data: Record<string, unknown> | null
}

export default function ImportPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [previewRows, setPreviewRows] = useState<ImportRow[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; total: number } | null>(null)
  const [jsonInput, setJsonInput] = useState('')
  const [mode, setMode] = useState<'csv' | 'json'>('csv')

  function handleDownloadTemplate() {
    window.open(`/api/shop-manager-incentives/periods/${id}/template`, '_blank')
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true); setError(null); setResult(null)

    try {
      const text = await file.text()
      const rows = parseCsv(text)
      await previewRows_(rows)
    } catch (err: any) {
      setError(err.message || 'Failed to parse CSV')
    } finally { setLoading(false) }
  }

  function parseCsv(text: string): Record<string, unknown>[] {
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    if (lines.length < 2) throw new Error('CSV must have a header row and at least one data row')
    const headers = lines[0].split(',').map(h => h.trim())
    const rows: Record<string, unknown>[] = []
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim())
      const row: Record<string, unknown> = {}
      headers.forEach((h, idx) => { row[h] = values[idx] || '' })
      rows.push(row)
    }
    return rows
  }

  async function handleJsonPreview() {
    setLoading(true); setError(null); setResult(null)
    try {
      let parsed: Record<string, unknown>[]
      try { parsed = JSON.parse(jsonInput) }
      catch { throw new Error('Invalid JSON') }
      if (!Array.isArray(parsed)) throw new Error('JSON must be an array')
      await previewRows_(parsed)
    } catch (err: any) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  async function previewRows_(rows: Record<string, unknown>[]) {
    const res = await fetch(`/api/shop-manager-incentives/periods/${id}/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows }),
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || 'Preview failed') }
    else { setPreviewRows(json.rows || []); setError(null) }
  }

  async function handleConfirmImport() {
    if (!previewRows) return
    const validRows = previewRows.filter(r => r.isValid && r.data)
    if (validRows.length === 0) { alert('No valid rows to import'); return }
    if (!confirm(`Import ${validRows.length} rows?`)) return

    setLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/import/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: validRows.map(r => ({ ...r.data })) }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Import failed') }
      else { setResult(json); setPreviewRows(null) }
    } catch (err: any) {
      setError(err.message || 'Network error')
    } finally { setLoading(false) }
  }

  function resetImport() {
    setPreviewRows(null); setResult(null); setError(null); setJsonInput('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">Import Performance Inputs</h1>
          <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
        </div>
        <button onClick={handleDownloadTemplate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Download Template</button>
      </div>

      {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{error}</div>}

      {result ? (
        <div className="border rounded p-6 bg-green-50">
          <h2 className="text-xl font-bold mb-4">Import Complete</h2>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div className="bg-white border rounded p-4">
              <p className="text-2xl font-bold text-green-600">{result.created}</p>
              <p className="text-sm text-gray-500">Created</p>
            </div>
            <div className="bg-white border rounded p-4">
              <p className="text-2xl font-bold text-blue-600">{result.updated}</p>
              <p className="text-sm text-gray-500">Updated</p>
            </div>
            <div className="bg-white border rounded p-4">
              <p className="text-2xl font-bold text-yellow-600">{result.skipped}</p>
              <p className="text-sm text-gray-500">Skipped</p>
            </div>
            <div className="bg-white border rounded p-4">
              <p className="text-2xl font-bold">{result.total}</p>
              <p className="text-sm text-gray-500">Total</p>
            </div>
          </div>
          <button onClick={resetImport} className="mt-4 bg-blue-600 text-white px-4 py-2 rounded text-sm">Import More</button>
        </div>
      ) : !previewRows ? (
        <div className="space-y-6">
          <div className="border rounded p-6">
            <h2 className="font-semibold mb-4">Upload CSV</h2>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileUpload} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100" />
          </div>

          <div className="border rounded p-6">
            <h2 className="font-semibold mb-4">Or Paste JSON</h2>
            <textarea value={jsonInput} onChange={e => setJsonInput(e.target.value)} rows={8} className="border rounded px-3 py-2 w-full font-mono text-sm" placeholder='[{"shopCode":"SHOP001","qgaAchievementPercent":85},...]' />
            <button onClick={handleJsonPreview} disabled={loading || !jsonInput.trim()} className="mt-2 bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
              Preview
            </button>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">
              Preview ({previewRows.filter(r => r.isValid).length} valid, {previewRows.filter(r => !r.isValid).length} invalid of {previewRows.length} total)
            </h2>
            <div className="flex gap-2">
              <button onClick={handleConfirmImport} disabled={loading || previewRows.filter(r => r.isValid).length === 0} className="bg-green-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
                {loading ? 'Importing...' : 'Confirm Import'}
              </button>
              <button onClick={resetImport} className="px-4 py-2 border rounded text-sm">Cancel</button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse border text-xs">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border p-1">#</th>
                  <th className="border p-1">Shop Code</th>
                  <th className="border p-1">Shop Name</th>
                  <th className="border p-1">QGA %</th>
                  <th className="border p-1">QGA Cnt</th>
                  <th className="border p-1">EVD %</th>
                  <th className="border p-1">EVD Rec</th>
                  <th className="border p-1">BA/Site</th>
                  <th className="border p-1">M-PESA</th>
                  <th className="border p-1">M-PESA Tgt</th>
                  <th className="border p-1">M-PESA Rec</th>
                  <th className="border p-1">DSA %</th>
                  <th className="border p-1">MM QO %</th>
                  <th className="border p-1">EBU Tgt</th>
                  <th className="border p-1">EBU Rev</th>
                  <th className="border p-1">EBU TopUp</th>
                  <th className="border p-1">EBU 1stMo</th>
                  <th className="border p-1">Status</th>
                  <th className="border p-1">Messages</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map(row => (
                  <tr key={row.rowIndex} className={row.isValid ? '' : 'bg-red-50'}>
                    <td className="border p-1">{row.rowIndex + 1}</td>
                    <td className="border p-1 font-mono">{row.shopCode}</td>
                    <td className="border p-1">{row.shopName || '-'}</td>
                    <td className="border p-1">{row.data?.qgaAchievementPercent?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.qgaCount?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.evdAchievementPercent?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.evdReconciled === true ? 'Yes' : row.data?.evdReconciled === false ? 'No' : '-'}</td>
                    <td className="border p-1">{row.data?.baSiteRequirementMet === true ? 'Yes' : row.data?.baSiteRequirementMet === false ? 'No' : '-'}</td>
                    <td className="border p-1">{row.data?.mpesaFloatSold?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.mpesaTargetAchieved === true ? 'Yes' : row.data?.mpesaTargetAchieved === false ? 'No' : '-'}</td>
                    <td className="border p-1">{row.data?.mpesaReconciled === true ? 'Yes' : row.data?.mpesaReconciled === false ? 'No' : '-'}</td>
                    <td className="border p-1">{row.data?.dsaAirtimeAchievementPercent?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.mmQoTargetPercent?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.ebuTargetAchieved === true ? 'Yes' : row.data?.ebuTargetAchieved === false ? 'No' : '-'}</td>
                    <td className="border p-1">{row.data?.ebuRevenue?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.ebuAverageTopup?.toString() ?? '-'}</td>
                    <td className="border p-1">{row.data?.ebuFirstMonthLeapfrogRevenue?.toString() ?? '-'}</td>
                    <td className="border p-1">
                      {row.isValid ? <span className="text-green-600 font-semibold">Valid</span> : <span className="text-red-600 font-semibold">Invalid</span>}
                    </td>
                    <td className="border p-1">
                      {row.errors.length > 0 && row.errors.map((e, i) => <p key={i} className="text-red-500 font-medium">{e}</p>)}
                      {row.warnings.length > 0 && row.warnings.map((w, i) => <p key={i} className="text-yellow-600">{w}</p>)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
