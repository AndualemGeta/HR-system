'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface OutputPackage {
  id: string
  periodName: string
  periodStart: string
  periodEnd: string
  status: string
  totalEmployees: number
  grossPayTotal: string
  netPayTotal: string
  deductionTotal: string
  employeePensionTotal: string
  employerPensionTotal: string
  payeTotal: string
  approvedAt: string | null
  approvedBy: string | null
  reviewedAt: string | null
  reviewedBy: string | null
  cancellationReason: string | null
  createdAt: string
  snapshotHash: string
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_REVIEW: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

export default function OutputPackageDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [pkg, setPkg] = useState<OutputPackage | null>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [actionLoading, setActionLoading] = useState('')
  const [cancelReason, setCancelReason] = useState('')
  const [showCancelDialog, setShowCancelDialog] = useState(false)

  const has = (p: string) => perms.includes(p)

  const fetchAuth = useCallback(() => {
    return fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {})
  }, [])

  const fetchPackage = useCallback(() => {
    return fetch(`/api/payroll-output-packages/${id}`).then(r => r.json()).then(j => {
      if (!j.data) { setError('Package not found'); return }
      setPkg(j.data)
    })
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAuth(), fetchPackage()]).finally(() => setLoading(false))
  }, [fetchAuth, fetchPackage])

  const handleAction = async (action: string, body?: unknown) => {
    if (actionLoading) return
    setActionLoading(action)
    setError('')
    const res = await fetch(`/api/payroll-output-packages/${id}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); setActionLoading(''); return }
    await fetchPackage()
    setActionLoading('')
    setShowCancelDialog(false)
    setCancelReason('')
  }

  const tabs = [
    { key: 'overview', label: 'Overview', permission: 'payrollFinalization.view' },
    { key: 'payment', label: 'Payment', permission: 'paymentBatch.view' },
    { key: 'reports', label: 'Statutory Reports', permission: 'statutoryReport.view' },
    { key: 'journal', label: 'Journal', permission: 'payrollJournal.view' },
  ]

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!pkg && !error) return null
  if (!pkg) return <div style={{ padding: '2rem', textAlign: 'center' }}>Package not found</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/payroll-output-packages" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Output Packages</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {pkg.periodName}
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[pkg.status] || statusStyles.DRAFT }}>
                {pkg.status.replace(/_/g, ' ')}
              </span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
              {new Date(pkg.periodStart).toLocaleDateString()} &mdash; {new Date(pkg.periodEnd).toLocaleDateString()} &middot; Created {new Date(pkg.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {pkg.status === 'DRAFT' && has('payrollFinalization.review') && (
              <button onClick={() => handleAction('review')} disabled={!!actionLoading} style={{ background: '#f59e0b', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'review' ? '...' : 'Send for Review'}
              </button>
            )}
            {pkg.status === 'PENDING_REVIEW' && has('payrollFinalization.approve') && (
              <button onClick={() => handleAction('approve')} disabled={!!actionLoading} style={{ background: '#16a34a', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'approve' ? '...' : 'Approve'}
              </button>
            )}
            {(pkg.status === 'DRAFT' || pkg.status === 'PENDING_REVIEW') && has('payrollFinalization.cancel') && (
              <button onClick={() => setShowCancelDialog(true)} disabled={!!actionLoading} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Cancel
              </button>
            )}
            {has('paymentBatch.create') && pkg.status === 'APPROVED' && (
              <a href={`/payroll-output-packages/${id}/payment-readiness`} style={{ background: '#7c3aed', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem' }}>
                Payment Batches
              </a>
            )}
            {pkg.status === 'APPROVED' && has('payslip.publish') && (
              <button onClick={() => handleAction('publish-payslips')} disabled={!!actionLoading} style={{ background: '#0891b2', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'publish-payslips' ? '...' : 'Publish Payslips'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showCancelDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Cancel Output Package</h3>
            <p style={{ fontSize: '0.85rem', color: '#666', margin: '0 0 0.75rem' }}>Provide a reason for cancellation:</p>
            <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={3} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setShowCancelDialog(false); setCancelReason('') }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}>Back</button>
              <button onClick={() => handleAction('cancel', { reason: cancelReason })} disabled={!cancelReason.trim() || !!actionLoading} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: cancelReason.trim() ? 'pointer' : 'not-allowed', opacity: cancelReason.trim() ? 1 : 0.6, fontSize: '0.85rem' }}>
                {actionLoading === 'cancel' ? '...' : 'Confirm Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 0, marginBottom: '1.5rem', borderBottom: '2px solid #e5e7eb' }}>
        {tabs.filter(t => has(t.permission)).map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{
            padding: '0.5rem 1rem', background: 'none', border: 'none',
            borderBottom: activeTab === tab.key ? '2px solid #2563eb' : '2px solid transparent',
            color: activeTab === tab.key ? '#2563eb' : '#666',
            fontWeight: activeTab === tab.key ? 600 : 400, cursor: 'pointer', fontSize: '0.9rem', marginBottom: '-2px',
          }}>{tab.label}</button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <div>
          <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{pkg.totalEmployees}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Employees</div>
            </div>
            <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{Number(pkg.grossPayTotal).toLocaleString()}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Gross Pay Total</div>
            </div>
            <div style={{ background: '#d1fae5', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{Number(pkg.netPayTotal).toLocaleString()}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Net Pay Total</div>
            </div>
            <div style={{ background: '#fee2e2', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{Number(pkg.deductionTotal).toLocaleString()}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>Deductions Total</div>
            </div>
            <div style={{ background: '#fef3c7', borderRadius: 6, padding: '1rem', minWidth: 100, flex: 1 }}>
              <strong style={{ fontSize: '1.2rem' }}>{Number(pkg.payeTotal).toLocaleString()}</strong>
              <div style={{ fontSize: '0.75rem', color: '#666' }}>PAYE</div>
            </div>
          </div>

          {pkg.approvedAt && (
            <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              Approved by {pkg.approvedBy || 'Unknown'} on {new Date(pkg.approvedAt).toLocaleString()}
            </div>
          )}
          {pkg.reviewedAt && (
            <div style={{ background: '#fffbeb', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              Reviewed by {pkg.reviewedBy || 'Unknown'} on {new Date(pkg.reviewedAt).toLocaleString()}
            </div>
          )}
          {pkg.cancellationReason && (
            <div style={{ background: '#fef2f2', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
              Cancelled: {pkg.cancellationReason}
            </div>
          )}

          <div style={{ fontSize: '0.8rem', color: '#9ca3af', wordBreak: 'break-all' }}>
            Snapshot Hash: {pkg.snapshotHash}
          </div>
        </div>
      )}

      {activeTab === 'payment' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Payment Batches</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>View and manage payment batches for this output package.</p>
          <a href={`/payroll-output-packages/${id}/payment-batches`} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block' }}>View Payment Batches</a>
        </div>
      )}

      {activeTab === 'reports' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Statutory Reports</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>Generate and view statutory reports (PAYE, Pension, WCF, NHIF, NITA).</p>
          <a href={`/payroll-output-packages/${id}/statutory-reports`} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block' }}>View Statutory Reports</a>
        </div>
      )}

      {activeTab === 'journal' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Payroll Journal</h3>
          <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.75rem' }}>View the accounting journal entries for this output package.</p>
          <a href={`/payroll-output-packages/${id}/journal`} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.85rem', display: 'inline-block' }}>View Journal</a>
        </div>
      )}
    </div>
  )
}
