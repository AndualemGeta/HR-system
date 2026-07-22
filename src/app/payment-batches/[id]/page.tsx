'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'

interface PaymentInstruction {
  id: string
  employeeName: string
  employeeCode: string
  accountNumber: string
  bankName: string | null
  amount: number
  currency: string
  status: string
  paidAt: string | null
  failureReason: string | null
}

interface PaymentBatch {
  id: string
  batchNumber: string
  periodName: string
  paymentMethod: string
  status: string
  totalAmount: string
  instructionCount: number
  currency: string
  createdAt: string
  approvedAt: string | null
  approvedBy: string | null
  releasedAt: string | null
  reconciledAt: string | null
  reconciliationNotes: string | null
}

const statusStyles: Record<string, React.CSSProperties> = {
  DRAFT: { background: '#e5e7eb', color: '#374151' },
  PENDING_APPROVAL: { background: '#fef3c7', color: '#92400e' },
  APPROVED: { background: '#d1fae5', color: '#065f46' },
  RELEASED: { background: '#dbeafe', color: '#1e40af' },
  RECONCILED: { background: '#d1fae5', color: '#065f46' },
  CANCELLED: { background: '#fee2e2', color: '#991b1b' },
}

const instructionStatusStyles: Record<string, React.CSSProperties> = {
  PENDING: { background: '#fef3c7', color: '#92400e' },
  PAID: { background: '#d1fae5', color: '#065f46' },
  FAILED: { background: '#fee2e2', color: '#991b1b' },
  ON_HOLD: { background: '#dbeafe', color: '#1e40af' },
}

export default function PaymentBatchDetailPage() {
  const params = useParams()
  const id = params.id as string

  const [perms, setPerms] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [batch, setBatch] = useState<PaymentBatch | null>(null)
  const [instructions, setInstructions] = useState<PaymentInstruction[]>([])
  const [actionLoading, setActionLoading] = useState('')
  const [reconcileNote, setReconcileNote] = useState('')
  const [showReconcile, setShowReconcile] = useState(false)
  const [holdReason, setHoldReason] = useState('')
  const [showHold, setShowHold] = useState<string | null>(null)
  const [failReason, setFailReason] = useState('')
  const [showFail, setShowFail] = useState<string | null>(null)

  const has = (p: string) => perms.includes(p)

  const fetchAuth = useCallback(() => {
    return fetch('/api/auth/me').then(r => r.json()).then(j => setPerms(j.data?.permissions || [])).catch(() => {})
  }, [])

  const fetchBatch = useCallback(() => {
    return fetch(`/api/payment-batches/${id}`).then(r => r.json()).then(j => {
      if (!j.data) { setError('Batch not found'); return }
      setBatch(j.data)
    })
  }, [id])

  const fetchInstructions = useCallback(() => {
    return fetch(`/api/payment-batches/${id}/instructions`).then(r => r.json()).then(j => setInstructions(j.data || []))
  }, [id])

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchAuth(), fetchBatch(), fetchInstructions()]).finally(() => setLoading(false))
  }, [fetchAuth, fetchBatch, fetchInstructions])

  const handleAction = async (action: string, body?: unknown) => {
    if (actionLoading) return
    setActionLoading(action)
    setError('')
    const res = await fetch(`/api/payment-batches/${id}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); setActionLoading(''); return }
    await Promise.all([fetchBatch(), fetchInstructions()])
    setActionLoading('')
    setShowReconcile(false)
    setReconcileNote('')
  }

  const handleInstructionAction = async (instructionId: string, action: string, body?: unknown) => {
    if (actionLoading) return
    setActionLoading(action)
    setError('')
    const res = await fetch(`/api/payment-batches/${id}/instructions/${instructionId}/${action}`, {
      method: 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json()
    if (!res.ok) { setError(json.error || `${action} failed`); setActionLoading(''); return }
    await fetchInstructions()
    setActionLoading('')
    setShowHold(null)
    setHoldReason('')
    setShowFail(null)
    setFailReason('')
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!batch && !error) return null
  if (!batch) return <div style={{ padding: '2rem', textAlign: 'center' }}>Batch not found</div>

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <a href="/payment-batches" style={{ color: '#2563eb', fontSize: '0.9rem', textDecoration: 'underline', display: 'inline-block', marginBottom: '0.5rem' }}>&larr; Back to Payment Batches</a>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              {batch.batchNumber}
              <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...statusStyles[batch.status] || statusStyles.DRAFT }}>
                {batch.status.replace(/_/g, ' ')}
              </span>
            </h1>
            <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
              {batch.periodName} &middot; {batch.paymentMethod} &middot; {batch.currency}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
            {batch.status === 'DRAFT' && has('paymentBatch.review') && (
              <button onClick={() => handleAction('submit')} disabled={!!actionLoading} style={{ background: '#f59e0b', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'submit' ? '...' : 'Submit for Approval'}
              </button>
            )}
            {batch.status === 'PENDING_APPROVAL' && has('paymentBatch.approve') && (
              <button onClick={() => handleAction('approve')} disabled={!!actionLoading} style={{ background: '#16a34a', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'approve' ? '...' : 'Approve'}
              </button>
            )}
            {batch.status === 'APPROVED' && has('paymentBatch.release') && (
              <button onClick={() => handleAction('release')} disabled={!!actionLoading} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'release' ? '...' : 'Release'}
              </button>
            )}
            {batch.status === 'RELEASED' && has('paymentBatch.reconcile') && (
              <button onClick={() => setShowReconcile(true)} disabled={!!actionLoading} style={{ background: '#7c3aed', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                Reconcile
              </button>
            )}
            {has('paymentBatch.export') && batch.status !== 'CANCELLED' && (
              <button onClick={() => handleAction('generate-export')} disabled={!!actionLoading} style={{ background: '#6b7280', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'generate-export' ? '...' : 'Export'}
              </button>
            )}
            {(batch.status === 'DRAFT' || batch.status === 'PENDING_APPROVAL') && has('paymentBatch.cancel') && (
              <button onClick={() => handleAction('cancel')} disabled={!!actionLoading} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'cancel' ? '...' : 'Cancel'}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && <p style={{ color: 'red', marginBottom: '0.5rem' }}>{error}</p>}

      {showReconcile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Reconcile Batch</h3>
            <textarea value={reconcileNote} onChange={e => setReconcileNote(e.target.value)} placeholder="Reconciliation notes (optional)" rows={3} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setShowReconcile(false); setReconcileNote('') }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}>Cancel</button>
              <button onClick={() => handleAction('reconcile', { notes: reconcileNote })} disabled={!!actionLoading} style={{ background: '#7c3aed', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem' }}>
                {actionLoading === 'reconcile' ? '...' : 'Confirm Reconciliation'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{batch.instructionCount}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Instructions</div>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{Number(batch.totalAmount).toLocaleString()}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Total Amount ({batch.currency})</div>
        </div>
        <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '1rem', minWidth: 130, flex: 1 }}>
          <strong style={{ fontSize: '1.2rem' }}>{batch.paymentMethod}</strong>
          <div style={{ fontSize: '0.75rem', color: '#666' }}>Payment Method</div>
        </div>
      </div>

      {batch.reconciledAt && (
        <div style={{ background: '#f0fdf4', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Reconciled on {new Date(batch.reconciledAt).toLocaleString()}{batch.reconciliationNotes ? `: ${batch.reconciliationNotes}` : ''}
        </div>
      )}
      {batch.approvedAt && (
        <div style={{ background: '#fffbeb', borderRadius: 6, padding: '0.75rem', marginBottom: '1rem', fontSize: '0.85rem' }}>
          Approved by {batch.approvedBy || 'Unknown'} on {new Date(batch.approvedAt).toLocaleString()}
        </div>
      )}

      <h3 style={{ margin: '0 0 0.75rem', fontSize: '0.95rem' }}>Payment Instructions ({instructions.length})</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ textAlign: 'left', borderBottom: '2px solid #e5e7eb' }}>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Employee</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Code</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Account</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Bank</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Amount</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Status</th>
            <th style={{ padding: '0.5rem', fontSize: '0.85rem' }}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {instructions.map(instr => (
            <tr key={instr.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>{instr.employeeName}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{instr.employeeCode}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem', fontFamily: 'monospace' }}>****{instr.accountNumber.slice(-4)}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{instr.bankName || '-'}</td>
              <td style={{ padding: '0.5rem', fontSize: '0.85rem' }}>{instr.amount.toLocaleString()}</td>
              <td style={{ padding: '0.5rem' }}>
                <span style={{ padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, ...instructionStatusStyles[instr.status] || instructionStatusStyles.PENDING }}>
                  {instr.status.replace(/_/g, ' ')}
                </span>
              </td>
              <td style={{ padding: '0.5rem', whiteSpace: 'nowrap' }}>
                {batch.status === 'RELEASED' && instr.status === 'PENDING' && (
                  <>
                    <button onClick={() => handleInstructionAction(instr.id, 'mark-paid')} disabled={!!actionLoading} style={{ background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.25rem' }}>
                      Paid
                    </button>
                    <button onClick={() => { setShowFail(instr.id); setFailReason('') }} disabled={!!actionLoading} style={{ background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.75rem', marginRight: '0.25rem' }}>
                      Fail
                    </button>
                    <button onClick={() => { setShowHold(instr.id); setHoldReason('') }} disabled={!!actionLoading} style={{ background: '#f59e0b', color: '#fff', border: 'none', borderRadius: 4, padding: '0.2rem 0.4rem', cursor: 'pointer', fontSize: '0.75rem' }}>
                      Hold
                    </button>
                  </>
                )}
                {instr.failureReason && <span style={{ fontSize: '0.7rem', color: '#dc2626' }}>{instr.failureReason}</span>}
              </td>
            </tr>
          ))}
          {instructions.length === 0 && (
            <tr><td colSpan={7} style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>No instructions found</td></tr>
          )}
        </tbody>
      </table>

      {showHold && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Hold Payment</h3>
            <input value={holdReason} onChange={e => setHoldReason(e.target.value)} placeholder="Reason for hold" style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setShowHold(null); setHoldReason('') }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}>Cancel</button>
              <button onClick={() => handleInstructionAction(showHold!, 'hold', { reason: holdReason })} disabled={!holdReason.trim() || !!actionLoading} style={{ background: '#f59e0b', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: holdReason.trim() ? 'pointer' : 'not-allowed', opacity: holdReason.trim() ? 1 : 0.6, fontSize: '0.85rem' }}>
                {actionLoading === 'hold' ? '...' : 'Confirm Hold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: 8, padding: '1.5rem', maxWidth: 400, width: '90%' }}>
            <h3 style={{ margin: '0 0 0.75rem' }}>Mark as Failed</h3>
            <input value={failReason} onChange={e => setFailReason(e.target.value)} placeholder="Failure reason" style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.85rem' }} />
            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.75rem' }}>
              <button onClick={() => { setShowFail(null); setFailReason('') }} style={{ padding: '0.35rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, cursor: 'pointer', fontSize: '0.85rem', background: '#fff' }}>Cancel</button>
              <button onClick={() => handleInstructionAction(showFail!, 'mark-failed', { reason: failReason })} disabled={!failReason.trim() || !!actionLoading} style={{ background: '#dc2626', color: '#fff', padding: '0.35rem 0.75rem', border: 'none', borderRadius: 4, cursor: failReason.trim() ? 'pointer' : 'not-allowed', opacity: failReason.trim() ? 1 : 0.6, fontSize: '0.85rem' }}>
                {actionLoading === 'mark-failed' ? '...' : 'Confirm Failure'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
