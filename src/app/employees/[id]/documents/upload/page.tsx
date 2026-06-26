'use client'

import { useState, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function UploadDocumentPage() {
  const router = useRouter()
  const params = useParams()
  const [documentType, setDocumentType] = useState('')
  const [visibilityLevel, setVisibilityLevel] = useState('PUBLIC_TO_HR')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    if (!file) { setError('File is required'); return }
    if (!documentType) { setError('Document type is required'); return }

    setSaving(true)
    const formData = new FormData()
    formData.append('file', file)
    formData.append('documentType', documentType)
    formData.append('visibilityLevel', visibilityLevel)
    if (notes) formData.append('notes', notes)

    try {
      const res = await fetch(`/api/employees/${params.id}/documents`, {
        method: 'POST',
        body: formData,
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || json.message || 'Upload failed'); return }
      router.push(`/employees/${params.id}`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Upload Document</h1>
        <Link href={`/employees/${params.id}`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>Cancel</Link>
      </div>

      {error && <p style={{ color: 'red', background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Document Type *</label>
          <select value={documentType} onChange={e => setDocumentType(e.target.value)} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
            <option value="">-- Select --</option>
            <option value="ID">ID</option>
            <option value="CONTRACT">Contract</option>
            <option value="CV">CV</option>
            <option value="CERTIFICATE">Certificate</option>
            <option value="EMERGENCY_CONTACT">Emergency Contact</option>
            <option value="BANK_OR_PAYMENT_INFORMATION">Bank / Payment Information</option>
            <option value="TAX_OR_PAYROLL_INFORMATION">Tax / Payroll Information</option>
            <option value="COMMISSION_AGREEMENT">Commission Agreement</option>
            <option value="ASSIGNMENT_LETTER">Assignment Letter</option>
            <option value="RESPONSIBILITY_DOCUMENT">Responsibility Document</option>
            <option value="CONFIDENTIALITY_DOCUMENT">Confidentiality Document</option>
            <option value="SALARY_DOCUMENT">Salary Document</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Visibility Level *</label>
          <select value={visibilityLevel} onChange={e => setVisibilityLevel(e.target.value)} required style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', background: '#fff' }}>
            <option value="PUBLIC_TO_HR">Visible to HR</option>
            <option value="MANAGER_VISIBLE">Manager Visible</option>
            <option value="EMPLOYEE_VISIBLE">Employee Visible</option>
            <option value="SENSITIVE_HR_ONLY">Sensitive HR Only</option>
            <option value="SALARY_RESTRICTED">Salary Restricted</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>File *</label>
          <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} required accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" style={{ fontSize: '0.9rem' }} />
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#888' }}>Accepted: PDF, JPG, PNG, DOC, DOCX (max 10 MB)</p>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, fontSize: '0.9rem', boxSizing: 'border-box' }} />
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Link href={`/employees/${params.id}`} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{
            padding: '0.5rem 1.5rem', background: saving ? '#999' : '#2563eb', color: '#fff',
            border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
          }}>{saving ? 'Uploading...' : 'Upload'}</button>
        </div>
      </form>
    </div>
  )
}
