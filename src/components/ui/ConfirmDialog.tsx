'use client'

import Modal from './Modal'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  detail?: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export default function ConfirmDialog({ open, title, message, detail, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger, loading, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} title={title} closeOnEscape={!loading}
      footer={
        <>
          <button onClick={onCancel} disabled={loading} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>
            {cancelLabel}
          </button>
          <button onClick={onConfirm} disabled={loading} style={{
            padding: '0.4rem 1rem', border: 'none', borderRadius: 4,
            background: loading ? '#999' : (danger ? '#dc2626' : '#2563eb'),
            color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
          }}>
            {loading ? 'Processing...' : confirmLabel}
          </button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: '0.9rem' }}>{message}</p>
      {detail && <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#666' }}>{detail}</p>}
    </Modal>
  )
}
