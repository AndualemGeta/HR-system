'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

interface Dept { id: string; name: string; code: string }
interface Emp { id: string; employeeId: string; fullName: string; currentRole: string }
interface Assign { id: string; role: string; level: string; startDate: string; endDate: string | null; reason: string | null; isActive: boolean; departmentId: string | null; regionId: string | null; areaId: string | null; shopId: string | null; directManagerId: string | null; accountingReportingManagerId: string | null }

export default function EditEmployeePage() {
  const router = useRouter()
  const params = useParams()
  const [departments, setDepartments] = useState<Dept[]>([])
  const [managers, setManagers] = useState<Emp[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [empIdStr, setEmpIdStr] = useState('')
  const [assignments, setAssignments] = useState<Assign[]>([])
  const [editingAssignId, setEditingAssignId] = useState<string | null>(null)
  const [assignForm, setAssignForm] = useState<Record<string, string>>({})
  const [savingAssign, setSavingAssign] = useState(false)
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phoneNumber: '',
    gender: 'NOT_SPECIFIED', dateOfBirth: '', address: '', notes: '', hireDate: '',
    employmentType: '', employmentStatus: 'DRAFT',
    employeeCategory: '',
    currentRole: '', currentLevel: '',
    currentDepartmentId: '', currentDivisionId: '', currentRegionId: '',
    currentAreaId: '', currentShopId: '', currentClusterId: '',
    directManagerId: '', accountingReportingManagerId: '', basicSalary: '', salaryEffectiveDate: '',
  })
  const isHO = form.employeeCategory === 'HEAD_OFFICE'

  useEffect(() => {
    const id = params.id as string
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/employees?limit=200').then(r => r.json()),
      fetch(`/api/employees/${id}`).then(r => r.json()),
      fetch(`/api/employees/${id}/assignments`).then(r => r.json()),
    ]).then(([meJson, deptJson, empJson, empDetail, assignJson]) => {
      const me = meJson.data || meJson
      const employee = empDetail.data || empDetail
      if (!me.id) { router.push('/login'); return }
      if (!employee.id) { router.push('/employees'); return }
      setDepartments(deptJson.data || [])
      setAssignments(assignJson.data || [])
      const allManagers = empJson.data?.items || []
      setManagers(allManagers.filter((m: Emp) => m.id !== id))
      setEmpIdStr(employee.employeeId || '')
      setForm({
        firstName: employee.firstName || '',
        middleName: employee.middleName || '',
        lastName: employee.lastName || '',
        email: employee.email || '',
        phoneNumber: employee.phoneNumber || '',
        gender: employee.gender || 'NOT_SPECIFIED',
        dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.split('T')[0] : '',
        address: employee.address || '',
        notes: employee.notes || '',
        hireDate: employee.hireDate ? employee.hireDate.split('T')[0] : '',
        employmentType: employee.employmentType || '',
        employmentStatus: employee.employmentStatus || 'DRAFT',
        employeeCategory: employee.employeeCategory || '',
        currentRole: employee.currentRole || '',
        currentLevel: employee.currentLevel || '',
        currentDepartmentId: employee.currentDepartmentId || '',
        currentDivisionId: employee.currentDivisionId || '',
        currentRegionId: employee.currentRegionId || '',
        currentAreaId: employee.currentAreaId || '',
        currentShopId: employee.currentShopId || '',
        currentClusterId: employee.currentClusterId || '',
        directManagerId: employee.directManagerId || '',
        accountingReportingManagerId: employee.accountingReportingManagerId || '',
        basicSalary: employee.basicSalary != null && employee.basicSalary !== 'REDACTED' ? String(employee.basicSalary) : '',
        salaryEffectiveDate: employee.salaryEffectiveDate ? employee.salaryEffectiveDate.split('T')[0] : '',
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
    const sensitivePayload: Record<string, unknown> = {}

    if (payload.basicSalary) {
      const parsed = parseFloat(payload.basicSalary as string)
      if (isNaN(parsed)) { setError('Invalid salary value'); setSaving(false); return }
      sensitivePayload.basicSalary = parsed
    }
    if (payload.salaryEffectiveDate) {
      sensitivePayload.salaryEffectiveDate = payload.salaryEffectiveDate
    }
    delete payload.basicSalary
    delete payload.salaryEffectiveDate

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
      if (!res.ok) { setError(json.error || json.message || 'Failed to update'); setSaving(false); return }

      if (Object.keys(sensitivePayload).length > 0) {
        const empId = params.id as string
        for (const [field, value] of Object.entries(sensitivePayload)) {
          const crRes = await fetch('/api/change-requests', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ employeeId: empId, requestedField: field, oldValue: json.data?.[field]?.toString() || '', newValue: String(value), reason: 'Updated during employee edit' }),
          })
          if (!crRes.ok) {
            const crJson = await crRes.json()
            setError(`Change request for ${field} failed: ${crJson.error || 'Error'}`)
            setSaving(false)
            return
          }
        }
      }

      router.push(`/employees/${params.id}`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  function startEditAssignment(a: Assign) {
    setAssignForm({
      role: a.role || '',
      level: a.level || '',
      startDate: a.startDate ? a.startDate.split('T')[0] : '',
      endDate: a.endDate ? a.endDate.split('T')[0] : '',
      reason: a.reason || '',
    })
    setEditingAssignId(a.id)
  }

  async function saveAssignment(id: string) {
    setSavingAssign(true)
    setError('')
    const payload: Record<string, unknown> = { ...assignForm }
    if (!payload.startDate) delete payload.startDate
    if (!payload.endDate) payload.endDate = null
    if (!payload.reason) payload.reason = null
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || json.message || 'Failed to update assignment'); return }
      setAssignments(prev => prev.map(a => a.id === id ? { ...a, ...json.data } : a))
      setEditingAssignId(null)
    } catch { setError('Network error saving assignment') }
    finally { setSavingAssign(false) }
  }

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
              { value: 'SUSPENDED', label: 'Suspended' },
              { value: 'RESIGNED', label: 'Resigned' }, { value: 'TERMINATED', label: 'Terminated' },
              { value: 'ON_LEAVE', label: 'On Leave' },
            ]} />
            <Field label="Hire Date" value={form.hireDate} onChange={v => set('hireDate', v)} type="date" />
            <Field label="Notes" value={form.notes} onChange={v => set('notes', v)} />
          </div>
          <div style={{ marginTop: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', fontWeight: 500 }}>Employee Category *</label>
            <div style={{ display: 'flex', gap: '1.5rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="radio" name="employeeCategory" value="HEAD_OFFICE" checked={form.employeeCategory === 'HEAD_OFFICE'}
                  onChange={() => {
                    set('employeeCategory', 'HEAD_OFFICE')
                    set('currentDepartmentId', form.currentDepartmentId)
                    set('currentRegionId', '')
                    set('currentAreaId', '')
                    set('currentShopId', '')
                    set('currentClusterId', '')
                  }} />
                Head Office
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                <input type="radio" name="employeeCategory" value="SHOP_FIELD" checked={form.employeeCategory === 'SHOP_FIELD'}
                  onChange={() => {
                    set('employeeCategory', 'SHOP_FIELD')
                    set('currentDepartmentId', '')
                  }} />
                Shop / Field
              </label>
            </div>
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
              <Select label="Role" value={form.currentRole} onChange={v => set('currentRole', v)} options={[
                { value: '', label: '-- Select --' }, { value: 'CEO', label: 'CEO' },
                { value: 'SALES_HEAD', label: 'Sales Head' }, { value: 'HR_OFFICER', label: 'HR Officer' },
                { value: 'HR_MANAGER', label: 'HR Manager' }, { value: 'FINANCE_DIRECTOR', label: 'Finance Director' },
                { value: 'TREASURY_MANAGER', label: 'Treasury Manager' }, { value: 'ACCOUNTANT', label: 'Accountant' },
                { value: 'DISTRIBUTION_MANAGER', label: 'Distribution Manager' },
                { value: 'TECHNOLOGY_MANAGER', label: 'Technology Manager' },
                { value: 'BUSINESS_DEVELOPMENT_MANAGER', label: 'Business Development Manager' },
                { value: 'EBU_FTTH_SUPERVISOR', label: 'FTTH Supervisor' },
                { value: 'CLEANING_STAFF', label: 'Cleaning Staff' },
                { value: 'EMPLOYEE', label: 'Employee' }, { value: 'OTHER', label: 'Other' },
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
              <Select label="Role" value={form.currentRole} onChange={v => set('currentRole', v)} options={[
                { value: '', label: '-- Select --' },
                { value: 'SHOP_MANAGER', label: 'Shop Manager' }, { value: 'DSP', label: 'DSP (Indoor Sales)' },
                { value: 'DSA', label: 'DSA (Outdoor Sales)' }, { value: 'SHOP_ACCOUNTANT', label: 'Shop Accountant' },
                { value: 'ASM', label: 'Area Sales Manager' },
                { value: 'CLEANING_STAFF', label: 'Cleaning Staff' }, { value: 'SECURITY_STAFF', label: 'Security Staff' },
                { value: 'EBU_SUPERVISOR', label: 'EBU Supervisor' }, { value: 'BA_COORDINATOR', label: 'BA Coordinator' },
                { value: 'EMPLOYEE', label: 'Employee' }, { value: 'OTHER', label: 'Other' },
              ]} />
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
            <Field label="Salary Effective Date" value={form.salaryEffectiveDate} onChange={v => set('salaryEffectiveDate', v)} type="date" />
          </div>
        </fieldset>

        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Assignment Records</legend>
          {assignments.length === 0 ? <p style={{ color: '#888', fontSize: '0.9rem' }}>No assignment records found.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {assignments.map(a => (
                <div key={a.id} style={{ border: '1px solid #e5e7eb', borderRadius: 4, padding: '0.75rem' }}>
                  {editingAssignId === a.id ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <Field label="Role" value={assignForm.role || ''} onChange={v => setAssignForm(p => ({ ...p, role: v }))} />
                        <Select label="Level" value={assignForm.level || ''} onChange={v => setAssignForm(p => ({ ...p, level: v }))} options={[
                          { value: '', label: '-- Select --' }, { value: 'JUNIOR', label: 'Junior' },
                          { value: 'MID', label: 'Mid' }, { value: 'SENIOR', label: 'Senior' },
                          { value: 'LEAD', label: 'Lead' }, { value: 'MANAGER', label: 'Manager' },
                          { value: 'DIRECTOR', label: 'Director' }, { value: 'EXECUTIVE', label: 'Executive' },
                        ]} />
                        <Field label="Start Date" value={assignForm.startDate || ''} onChange={v => setAssignForm(p => ({ ...p, startDate: v }))} type="date" />
                        <Field label="End Date" value={assignForm.endDate || ''} onChange={v => setAssignForm(p => ({ ...p, endDate: v }))} type="date" />
                        <Field label="Reason" value={assignForm.reason || ''} onChange={v => setAssignForm(p => ({ ...p, reason: v }))} />
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingAssignId(null)} style={{ padding: '0.3rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.85rem' }}>Cancel</button>
                        <button onClick={() => saveAssignment(a.id)} disabled={savingAssign} style={{
                          padding: '0.3rem 0.75rem', background: savingAssign ? '#999' : '#2563eb', color: '#fff',
                          border: 'none', borderRadius: 4, cursor: savingAssign ? 'not-allowed' : 'pointer', fontSize: '0.85rem',
                        }}>{savingAssign ? 'Saving...' : 'Save'}</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ fontSize: '0.85rem' }}>
                        <strong>{a.role}</strong> · {a.level}{a.isActive ? <span style={{ color: '#16a34a', marginLeft: '0.5rem', fontSize: '0.8rem' }}>Active</span> : <span style={{ color: '#888', marginLeft: '0.5rem', fontSize: '0.8rem' }}>Past</span>}
                        <div style={{ color: '#666', marginTop: '0.2rem' }}>{new Date(a.startDate).toLocaleDateString()} {a.endDate ? `- ${new Date(a.endDate).toLocaleDateString()}` : '- Present'}</div>
                        {a.reason && <div style={{ color: '#888' }}>{a.reason}</div>}
                      </div>
                      <button onClick={() => startEditAssignment(a)} style={{ padding: '0.25rem 0.6rem', border: '1px solid #d1d5db', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
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
