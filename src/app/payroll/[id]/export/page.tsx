'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface ExportRecord {
  id: string; fileName: string; format: string
  rowCount: number; totalGross: number | null; totalDeductions: number | null; totalNet: number | null
  checksum: string | null; templateVersion: string | null; generatedAt: string
  downloadedCount: number
}

export default function PayrollExportPage() {
  const params = useParams()
  const router = useRouter()
  const [exports, setExports] = useState<ExportRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    if (!params.id) return
    fetch(`/api/payroll/${params.id}/exports`)
      .then(r => { if (!r.ok) throw new Error(); return r.json() })
      .then(j => setExports(j.data || []))
      .catch(() => router.push('/payroll'))
      .finally(() => setLoading(false))
  }, [params.id, router])

  async function handleGenerate() {
    setExporting(true)
    const res = await fetch(`/api/payroll/${params.id}/generate-excel`, { method: 'POST' })
    const json = await res.json()
    setExporting(false)
    if (!res.ok) { alert(json.error || 'Failed to generate'); return }
    window.open(json.data.downloadUrl, '_blank')
    setExports(prev => [json.data.export, ...prev])
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <a href={`/payroll/${params.id}`} style={{ color: '#2563eb', fontSize: '0.85rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Period</a>
      <h1 style={{ margin: '0 0 1.5rem' }}>Payroll Exports</h1>

      <button onClick={handleGenerate} disabled={exporting}
        style={{ padding: '0.5rem 1rem', background: exporting ? '#999' : '#059669', color: '#fff', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
        {exporting ? 'Generating...' : 'Generate Excel'}
      </button>

      {exports.length === 0 ? (
        <p style={{ color: '#888' }}>No exports generated yet.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {exports.map(exp => (
            <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f9fafb', borderRadius: 6, border: '1px solid #e5e7eb' }}>
              <div>
                <strong>{exp.fileName}</strong>
                <div style={{ fontSize: '0.85rem', color: '#666' }}>
                  {exp.rowCount} rows · ETB {exp.totalNet?.toLocaleString()} net · {exp.format}
                  <br />
                  Generated {new Date(exp.generatedAt).toLocaleString()} · {exp.downloadedCount} downloads
                </div>
              </div>
              <a href={`/api/payroll/${params.id}/download-excel?file=${exp.fileName}`}
                style={{ padding: '0.4rem 0.75rem', background: '#2563eb', color: '#fff', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
