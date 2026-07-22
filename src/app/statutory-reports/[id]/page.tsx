'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface StatutoryReport {
  id: string
  reportType: string
  periodName: string
  periodStart: string
  periodEnd: string
  status: string
  totalAmount: string
  employeeCount: number
  dueDate: string | null
  filedAt: string | null
  filingReference: string | null
  approvedAt: string | null
  approvedBy: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  createdAt: string
  notes: string | null
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_REVIEW: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  FILED: { background: '#dbeafe', color: '#1e40af' },
}

const reportTypeNames: Record<string, string> = {
  PAYE: 'PAYE Tax',
  PENSION: 'Pension Contribution',
  WCF: 'Workers Compensation Fund',
  NHIF: 'National Hospital Insurance Fund',
  NITA: 'National Industrial Training Authority',
}

export default function StatutoryReportDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [report, setReport] = useState<StatutoryReport | null>(null)
  const [actionLoading, setActionLoading] = useState('')
  const [showFiled, setShowFiled] = useState(false)
  const [filingRef, setFilingRef] = useState('')

  const has = (p: string) => perms.includes(p)

  const fetchAuth = useCallback(() => {
    return fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {})
  }, [])

  const fetchReport = useCallback(() => {
    return fetch(`/api/statutory-reports/${id}`).then(r => r.json()).then(j => {
      if (!j.data) { setError('Report not found'); return }
      setReport(j.data)
    })
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAuth(), fetchReport()]).finally(() => setLoading(false))
  }, [fetchAuth, fetchReport])

  const handleAction = async (action: string, body?: unknown) => {
    if (actionLoading) return
    setActionLoading(action)
    setError('')
    const res = await fetch(`/api/statutory-reports/${id}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); setActionLoading(''); return }
    await fetchReport()
    setActionLoading('')
    setShowFiled(false)
    setFilingRef('')
  }

  const handleDownload = () => {
    window.open(`/api/statutory-reports/${id}/download`, '_blank')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!report && !error) return null
  if (!report) return <div style={{ padding: '2rem', textAlign: 'center' }}>Report not found</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/statutory-reports" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Statutory Reports</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {reportTypeNames[report.reportType] || report.reportType}
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[report.status] || statusStyles.DRAFT }}>
                {report.status.replace(/_/g, ' ')}
              </span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
              {report.periodName} &middot; {new Date(report.periodStart).toLocaleDateString()} &mdash; {new Date(report.periodEnd).toLocaleDateString()}
              {report.dueDate && <> &middot; Due: {new Date(report.dueDate).toLocaleDateString()}</>}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {report.status === 'DRAFT' && has('statutoryReport.review') && (
              <button onClick={() => handleAction('review')} disabled={!!actionLoading} style={{ background: '#f59e0b', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'review' ? '...' : 'Send for Review'}
              </button>
            )}
            {report.status === 'PENDING_REVIEW' && has('statutoryReport.approve') && (
              <button onClick={() => handleAction('approve')} disabled={!!actionLoading} style={{ background: '#16a34a', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'approve' ? '...' : 'Approve'}
              </button>
            )}
            {report.status === 'APPROVED' && has('statutoryReport.markFiled') && (
              <button onClick={() => setShowFiled(true)} disabled={!!actionLoading} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Mark Filed
              </button>
            )}
            {has('statutoryReport.export') && report.status !== 'DRAFT' && (
              <button onClick={handleDownload} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Download
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showFiled && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Mark as Filed</h3>
            <input value={filingRef} onChange={e => setFilingRef(e.target.value)} placeholder="Filing reference number" style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setShowFiled(false); setFilingRef('') }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}>Cancel</button>
              <button onClick={() => handleAction('mark-filed', { filingReference: filingRef })} disabled={!filingRef.trim() || !!actionLoading} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: filingRef.trim() ? 'pointer' : 'not-allowed', opacity: filingRef.trim() ? 1 : 0.6, fontSize: '0.85rem' }}>
                {actionLoading === 'mark-filed' ? '...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{report.employeeCount}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Employees</div>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{Number(report.totalAmount).toLocaleString()}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Total Amount</div>
        </div>
      </div>

      {report.approvedAt && (
        <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Approved by {report.approvedBy || 'Unknown'} on {new Date(report.approvedAt).toLocaleString()}
        </div>
      )}
      {report.reviewedAt && (
        <div style={{ background: '#fffbeb', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Reviewed on {new Date(report.reviewedAt).toLocaleString()}{report.reviewedBy ? ` by ${report.reviewedBy}` : ''}
        </div>
      )}
      {report.filedAt && (
        <div style={{ background: '#dbeafe', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Filed on {new Date(report.filedAt).toLocaleString()} &middot; Reference: {report.filingReference}
        </div>
      )}
      {report.notes && (
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Notes: {report.notes}
        </div>
      )}
    </div>
  )
}
