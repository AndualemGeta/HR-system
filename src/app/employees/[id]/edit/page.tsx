'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Dept { id: string; name: string; code: string }
interface Emp { id: string; employeeId: string; fullName: string; currentRole: string }

export default function EditEmployeePage() {
  const router = useRouter()
  const params = useParams()
  const [departments, setDepartments] = useState<Dept[]>([])
  const [managers, setManagers] = useState<Emp[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [isHO, setIsHO] = useState(false)
  const [empIdStr, setEmpIdStr] = useState('')
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phoneNumber: '',
    gender: 'NOT_SPECIFIED', dateOfBirth: '', address: '', notes: '', hireDate: '',
    employmentType: '', employmentStatus: 'DRAFT',
    employeeCategory: '',
    currentRole: '', currentLevel: '',
    currentDepartmentId: '', currentDivisionId: '', currentRegionId: '',
    currentAreaId: '', currentShopId: '', currentClusterId: '',
    directManagerId: '', accountingReportingManagerId: '', basicSalary: '',
  })

  useEffect(() => {
    const id = params.id as string
    Promise.all([
      fetch('/api/me').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/employees?limit=200').then(r => r.json()),
      fetch(`/api/employees/${id}`).then(r => r.json()),
    ]).then(([me, deptJson, empJson, empDetail]) => {
      if (!me.id) { router.push('/login'); return }
      if (!empDetail.id) { router.push('/employees'); return }
      setDepartments(deptJson.data || [])
      const allManagers = empJson.data?.items || []
      setManagers(allManagers.filter((m: Emp) => m.id !== id))
      const isHo = empDetail.employeeCategory === 'HEAD_OFFICE'
      setIsHO(isHo)
      setEmpIdStr(empDetail.employeeId || '')
      setForm({
        firstName: empDetail.firstName || '',
        middleName: empDetail.middleName || '',
        lastName: empDetail.lastName || '',
        email: empDetail.email || '',
        phoneNumber: empDetail.phoneNumber || '',
        gender: empDetail.gender || 'NOT_SPECIFIED',
        dateOfBirth: empDetail.dateOfBirth ? empDetail.dateOfBirth.split('T')[0] : '',
        address: empDetail.address || '',
        notes: empDetail.notes || '',
        hireDate: empDetail.hireDate ? empDetail.hireDate.split('T')[0] : '',
        employmentType: empDetail.employmentType || '',
        employmentStatus: empDetail.employmentStatus || 'DRAFT',
        employeeCategory: empDetail.employeeCategory || '',
        currentRole: empDetail.currentRole || '',
        currentLevel: empDetail.currentLevel || '',
        currentDepartmentId: empDetail.currentDepartmentId || '',
        currentDivisionId: empDetail.currentDivisionId || '',
        currentRegionId: empDetail.currentRegionId || '',
        currentAreaId: empDetail.currentAreaId || '',
        currentShopId: empDetail.currentShopId || '',
        currentClusterId: empDetail.currentClusterId || '',
        directManagerId: empDetail.directManagerId || '',
        accountingReportingManagerId: empDetail.accountingReportingManagerId || '',
        basicSalary: empDetail.basicSalary != null && empDetail.basicSalary !== 'REDACTED' ? String(empDetail.basicSalary) : '',
      })
    }).catch(() => router.push('/login'))
    .finally(() => setLoading(false))
  }, [params.id, router])

  const HODeptManagers = managers.filter(m => m.currentRole !== 'DSP' && m.currentRole !== 'DSA')
  const acctManagers = managers.filter(m => m.currentRole === 'TREASURY_MANAGER' || m.currentRole === 'ACCOUNTANT')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload: Record<string, unknown> = { ...form }
    if (!payload.basicSalary) delete payload.basicSalary
    else payload.basicSalary = parseFloat(payload.basicSalary as string)
    if (!payload.dateOfBirth) delete payload.dateOfBirth
    if (!payload.hireDate) delete payload.hireDate
    if (!payload.notes) delete payload.notes
    if (!payload.directManagerId) payload.directManagerId = null
    if (!payload.accountingReportingManagerId) payload.accountingReportingManagerId = null

    try {
      const res = await fetch(`/api/employees/${params.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || json.message || 'Failed to update'); return }
      router.push(`/employees/${params.id}`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>

  const selectedRole = form.currentRole

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Edit Employee</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            {form.employeeCategory === 'HEAD_OFFICE' ? 'Head Office' : form.employeeCategory === 'SHOP_FIELD' ? 'Shop / Field' : ''} · {empIdStr}
          </p>
        </div>
        <Link href={`/employees/${params.id}`} style={{ color: '#2563eb', fontSize: '0.9rem' }}>Cancel</Link>
      </div>

      {error && <p style={{ color: 'red', background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Personal Information</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="First Name *" value={form.firstName} onChange={v => set('firstName', v)} required />
            <Field label="Middle Name" value={form.middleName} onChange={v => set('middleName', v)} />
            <Field label="Last Name *" value={form.lastName} onChange={v => set('lastName', v)} required />
            <Select label="Gender" value={form.gender} onChange={v => set('gender', v)} options={[
              { value: 'NOT_SPECIFIED', label: 'Not Specified' }, { value: 'MALE', label: 'Male' }, { value: 'FEMALE', label: 'Female' },
            ]} />
            <Field label="Email" value={form.email} onChange={v => set('email', v)} type="email" />
            <Field label="Phone" value={form.phoneNumber} onChange={v => set('phoneNumber', v)} />
            <Field label="Date of Birth" value={form.dateOfBirth} onChange={v => set('dateOfBirth', v)} type="date" />
            <Field label="Address" value={form.address} onChange={v => set('address', v)} />
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Employment Details</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Select label="Employment Type" value={form.employmentType} onChange={v => set('employmentType', v)} options={[
              { value: '', label: '-- Select --' }, { value: 'FULL_TIME', label: 'Full Time' },
              { value: 'PART_TIME', label: 'Part Time' }, { value: 'CONTRACT', label: 'Contract' },
              { value: 'COMMISSION_BASED', label: 'Commission Based' }, { value: 'INTERN', label: 'Intern' },
              { value: 'TEMPORARY', label: 'Temporary' }, { value: 'OTHER', label: 'Other' },
            ]} />
            <Select label="Status" value={form.employmentStatus} onChange={v => set('employmentStatus', v)} options={[
              { value: 'DRAFT', label: 'Draft' }, { value: 'ONBOARDING', label: 'Onboarding' },
              { value: 'ACTIVE', label: 'Active' }, { value: 'ON_PROBATION', label: 'On Probation' },
            ]} />
            <Field label="Hire Date" value={form.hireDate} onChange={v => set('hireDate', v)} type="date" />
            <Field label="Notes" value={form.notes} onChange={v => set('notes', v)} />
          </div>
        </fieldset>

        {isHO && (
          <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
            <legend style={{ fontWeight: 600 }}>Head Office Assignment</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Department" value={form.currentDepartmentId} onChange={v => set('currentDepartmentId', v)} options={[
                { value: '', label: '-- Select --' },
                ...departments.map(d => ({ value: d.id, label: d.name })),
              ]} />
              <Select label="Level" value={form.currentLevel} onChange={v => set('currentLevel', v)} options={[
                { value: '', label: '-- Select --' }, { value: 'JUNIOR', label: 'Junior' },
                { value: 'MID', label: 'Mid' }, { value: 'SENIOR', label: 'Senior' },
                { value: 'LEAD', label: 'Lead' }, { value: 'MANAGER', label: 'Manager' },
                { value: 'DIRECTOR', label: 'Director' }, { value: 'EXECUTIVE', label: 'Executive' },
              ]} />
              <Select label="Direct Manager" value={form.directManagerId} onChange={v => set('directManagerId', v)} options={[
                { value: '', label: '-- Select --' },
                ...HODeptManagers.map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId})` })),
              ]} />
            </div>
          </fieldset>
        )}

        {!isHO && (
          <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
            <legend style={{ fontWeight: 600 }}>Shop / Field Assignment</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Level" value={form.currentLevel} onChange={v => set('currentLevel', v)} options={[
                { value: '', label: '-- Select --' }, { value: 'JUNIOR', label: 'Junior' },
                { value: 'MID', label: 'Mid' }, { value: 'SENIOR', label: 'Senior' },
                { value: 'LEAD', label: 'Lead' }, { value: 'MANAGER', label: 'Manager' },
                { value: 'DIRECTOR', label: 'Director' }, { value: 'EXECUTIVE', label: 'Executive' },
              ]} />
              <Select label="Direct Manager" value={form.directManagerId} onChange={v => set('directManagerId', v)} options={[
                { value: '', label: '-- None --' },
                ...managers.filter(m => m.currentRole !== form.currentRole).map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId} - ${m.currentRole})` })),
              ]} />
              {selectedRole === 'SHOP_ACCOUNTANT' && (
                <Select label="Accounting Reporting Manager" value={form.accountingReportingManagerId} onChange={v => set('accountingReportingManagerId', v)} options={[
                  { value: '', label: '-- None --' },
                  ...acctManagers.map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId})` })),
                ]} />
              )}
            </div>
          </fieldset>
        )}

        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Compensation</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Basic Salary" value={form.basicSalary} onChange={v => set('basicSalary', v)} type="number" />
          </div>
        </fieldset>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Link href={`/employees/${params.id}`} style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{
            padding: '0.5rem 1.5rem', background: saving ? '#999' : '#2563eb', color: '#fff',
            border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
          }}>{saving ? 'Saving...' : 'Save Changes'}</button>
        </div>
      </form>
    </div>
  )
}

function Field({ label, value, onChange, type, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>
        {label} {required && <span style={{ color: 'red' }}>*</span>}
      </label>
      <input type={type || 'text'} value={value} onChange={e => onChange(e.target.value)} required={required}
        style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.9rem' }}
      />
    </div>
  )
}

function Select({ label, value, onChange, options }: {
  label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[]
}) {
  return (
    <div>
      <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.85rem', fontWeight: 500 }}>{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', padding: '0.4rem', border: '1px solid #d1d5db', borderRadius: 4, boxSizing: 'border-box', fontSize: '0.9rem', background: '#fff' }}
      >
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  )
}
