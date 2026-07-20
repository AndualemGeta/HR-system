'use client'

import { useState } from 'react'
import Modal from './Modal'
import FormField from './FormField'

interface ReasonDialogProps {
  open: boolean
  title: string
  message?: string
  reasonLabel?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  onSubmit: (reason: string) => void
  onCancel: () => void
  loading?: boolean
  apiError?: string | null
}

export default function ReasonDialog({ open, title, message, reasonLabel = 'Reason', confirmLabel = 'Submit', cancelLabel = 'Cancel', danger, onSubmit, onCancel, loading = false, apiError }: ReasonDialogProps) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')

  function handleSubmit() {
    if (!reason.trim()) { setError('Reason is required'); return }
    setError('')
    onSubmit(reason.trim())
  }

  function handleCancel() {
    if (!loading) { setReason(''); setError(''); onCancel() }
  }

  return (
    <Modal open={open} onClose={handleCancel} title={title} closeOnEscape={!loading}
      footer={
        <>
          <button onClick={handleCancel} disabled={loading} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
            {cancelLabel}
          </button>
          <button onClick={handleSubmit} disabled={loading} style={{
            padding: '0.4rem 1rem', border: 'none', borderRadius: 4,
            background: loading ? '#999' : (danger ? '#dc2626' : '#2563eb'),
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
          }}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </>
      }
    >
      {message && <p style={{ margin: '0 0 0.75rem', fontSize: '0.9rem' }}>{message}</p>}
      {apiError && <p style={{ margin: '0 0 0.75rem', fontSize: '0.85rem', color: '#dc2626' }}>{apiError}</p>}
      <FormField label={reasonLabel} error={error} required>
        <textarea
          value={reason}
          onChange={e => { setReason(e.target.value); if (error) setError('') }}
          disabled={loading}
          autoFocus
          rows={3}
          style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.9rem', resize: 'vertical' }}
        />
      </FormField>
    </Modal>
  )
}
