'use client'

import { useState } from 'react'
import Modal from './ui/Modal'
import FormField from './ui/FormField'
import ConfirmDialog from './ui/ConfirmDialog'

type Mode = 'CREATE' | 'CHANGE_AMOUNT' | 'CLOSE' | 'DEACTIVATE'

interface Props {
  mode: Mode
  employeeId: string
  assignmentId?: string
  currentAmount?: number
  onClose: () => void
  onSuccess: () => void
}

function validateDate(v: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'Must be YYYY-MM-DD'
  const [y, m, d] = v.split('-').map(Number)
  if (m < 1 || m > 12) return 'Month must be 1-12'
  if (d < 1 || d > new Date(y, m, 0).getDate()) return 'Invalid day for month'
  return null
}

const inputStyle: React.CSSProperties = { width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.9rem' }

export default function KpiAssignmentModal({ mode, employeeId, assignmentId, currentAmount, onClose, onSuccess }: Props) {
  const [defaultAmount, setDefaultAmount] = useState(mode === 'CHANGE_AMOUNT' ? String(currentAmount || '') : '')
  const [effectiveFrom, setEffectiveFrom] = useState('')
  const [effectiveTo, setEffectiveTo] = useState('')
  const [newAmount, setNewAmount] = useState(mode === 'CHANGE_AMOUNT' ? String(currentAmount || '') : '')
  const [newEffectiveFrom, setNewEffectiveFrom] = useState('')
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [apiError, setApiError] = useState('')
  const [saving, setSaving] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  function validate(): boolean {
    const errors: Record<string, string> = {}
    if (mode === 'CREATE') {
      if (!defaultAmount || isNaN(Number(defaultAmount)) || Number(defaultAmount) < 0) errors.defaultAmount = 'Valid non-negative amount required'
      if (!effectiveFrom) errors.effectiveFrom = 'Required'
      else { const de = validateDate(effectiveFrom); if (de) errors.effectiveFrom = de }
      if (effectiveTo) { const de = validateDate(effectiveTo); if (de) errors.effectiveTo = de }
    } else if (mode === 'CHANGE_AMOUNT') {
      if (!newAmount || isNaN(Number(newAmount)) || Number(newAmount) < 0) errors.newAmount = 'Valid non-negative amount required'
      if (!newEffectiveFrom) errors.newEffectiveFrom = 'Required'
      else { const de = validateDate(newEffectiveFrom); if (de) errors.newEffectiveFrom = de }
      if (!reason.trim()) errors.reason = 'Reason is required'
    } else if (mode === 'CLOSE') {
      if (!effectiveTo) errors.effectiveTo = 'Required'
      else { const de = validateDate(effectiveTo); if (de) errors.effectiveTo = de }
      if (!reason.trim()) errors.reason = 'Reason is required'
    } else if (mode === 'DEACTIVATE') {
      if (!reason.trim()) errors.reason = 'Reason is required'
    }
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  async function handleSave() {
    if (!validate()) return
    setSaving(true)
    setApiError('')

    try {
      let url = ''
      let method = 'POST'
      let body: Record<string, unknown> = {}

      if (mode === 'CREATE') {
        url = `/api/employees/${employeeId}/pay-component-assignments`
        body = { payComponentCode: 'KPI_ALLOWANCE', defaultAmount: Number(defaultAmount), effectiveFrom }
        if (effectiveTo) body.effectiveTo = effectiveTo
      } else if (mode === 'CHANGE_AMOUNT') {
        url = `/api/employees/${employeeId}/pay-component-assignments/${assignmentId}`
        method = 'PATCH'
        body = { newAmount: Number(newAmount), newEffectiveFrom, reason: reason.trim() }
      } else if (mode === 'CLOSE') {
        url = `/api/employees/${employeeId}/pay-component-assignments/${assignmentId}/close`
        body = { effectiveTo, reason: reason.trim() }
      } else if (mode === 'DEACTIVATE') {
        url = `/api/employees/${employeeId}/pay-component-assignments/${assignmentId}/deactivate`
        body = { reason: reason.trim() }
      }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        setApiError(json.error || json.message || 'Request failed')
        return
      }
      onSuccess()
    } catch {
      setApiError('Network error')
    } finally {
      setSaving(false)
    }
  }

  function handlePrimary() {
    if ((mode === 'CLOSE' || mode === 'DEACTIVATE') && !showConfirm && Object.keys(fieldErrors).length === 0) {
      if (!validate()) return
      setShowConfirm(true)
    } else {
      handleSave()
    }
  }

  const titles: Record<Mode, string> = {
    CREATE: 'Add KPI Assignment',
    CHANGE_AMOUNT: 'Change KPI Amount',
    CLOSE: 'Close KPI Assignment',
    DEACTIVATE: 'Deactivate KPI Assignment',
  }

  return (
    <>
      <Modal
        open
        onClose={onClose}
        title={titles[mode]}
        closeOnEscape={!saving}
        footer={
          <>
            <button onClick={onClose} disabled={saving} style={{ padding: '0.4rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem' }}>Cancel</button>
            <button onClick={handlePrimary} disabled={saving} style={{
              padding: '0.4rem 1rem', border: 'none', borderRadius: 4,
              background: saving ? '#999' : (mode === 'DEACTIVATE' ? '#dc2626' : '#2563eb'),
              color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
            }}>
              {saving ? 'Saving...' : mode === 'CLOSE' || mode === 'DEACTIVATE' ? 'Continue' : 'Save'}
            </button>
          </>
        }
      >
        {apiError && (
          <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.4rem 0.6rem', borderRadius: 4, fontSize: '0.85rem', marginBottom: '0.75rem' }} role="alert">{apiError}</div>
        )}

        {mode === 'CREATE' && (
          <>
            <FormField label="Default Amount (ETB)" error={fieldErrors.defaultAmount} required>
              <input style={inputStyle} type="number" min="0" value={defaultAmount} onChange={e => { setDefaultAmount(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.defaultAmount; return n }) }} disabled={saving} />
            </FormField>
            <FormField label="Effective From" error={fieldErrors.effectiveFrom} required>
              <input style={inputStyle} type="date" value={effectiveFrom} onChange={e => { setEffectiveFrom(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.effectiveFrom; return n }) }} disabled={saving} />
            </FormField>
            <FormField label="Effective To" error={fieldErrors.effectiveTo}>
              <input style={inputStyle} type="date" value={effectiveTo} onChange={e => { setEffectiveTo(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.effectiveTo; return n }) }} disabled={saving} />
            </FormField>
          </>
        )}

        {mode === 'CHANGE_AMOUNT' && (
          <>
            <FormField label="New Amount (ETB)" error={fieldErrors.newAmount} required>
              <input style={inputStyle} type="number" min="0" value={newAmount} onChange={e => { setNewAmount(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.newAmount; return n }) }} disabled={saving} />
            </FormField>
            <FormField label="New Effective From" error={fieldErrors.newEffectiveFrom} required>
              <input style={inputStyle} type="date" value={newEffectiveFrom} onChange={e => { setNewEffectiveFrom(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.newEffectiveFrom; return n }) }} disabled={saving} />
            </FormField>
            <FormField label="Reason" error={fieldErrors.reason} required>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={reason} onChange={e => { setReason(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.reason; return n }) }} disabled={saving} />
            </FormField>
          </>
        )}

        {mode === 'CLOSE' && (
          <>
            <FormField label="Effective To" error={fieldErrors.effectiveTo} required>
              <input style={inputStyle} type="date" value={effectiveTo} onChange={e => { setEffectiveTo(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.effectiveTo; return n }) }} disabled={saving} />
            </FormField>
            <FormField label="Reason" error={fieldErrors.reason} required>
              <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={reason} onChange={e => { setReason(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.reason; return n }) }} disabled={saving} />
            </FormField>
          </>
        )}

        {mode === 'DEACTIVATE' && (
          <FormField label="Reason" error={fieldErrors.reason} required>
            <textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={reason} onChange={e => { setReason(e.target.value); setFieldErrors(e => { const n = { ...e }; delete n.reason; return n }) }} disabled={saving} />
          </FormField>
        )}
      </Modal>

      {showConfirm && (
        <ConfirmDialog
          open
          title={mode === 'CLOSE' ? 'Close KPI Assignment' : 'Deactivate KPI Assignment'}
          message={mode === 'CLOSE' ? 'Are you sure you want to close this KPI assignment? This cannot be undone.' : 'Are you sure you want to deactivate this KPI assignment? This cannot be undone.'}
          detail={reason ? `Reason: ${reason}` : undefined}
          confirmLabel="Confirm"
          danger={mode === 'DEACTIVATE'}
          loading={saving}
          onConfirm={handleSave}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  )
}
