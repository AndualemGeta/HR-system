'use client'

import { useState, useEffect, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface Dept { id: string; name: string; code: string }
interface Emp { id: string; employeeId: string; fullName: string; currentRole: string }
interface Loc { id: string; name: string; code: string; type: string }

export default function NewEmployeePage() {
  const router = useRouter()
  const [step, setStep] = useState<'category' | 'form'>('category')
  const [category, setCategory] = useState<'HEAD_OFFICE' | 'SHOP_FIELD' | ''>('')
  const [departments, setDepartments] = useState<Dept[]>([])
  const [managers, setManagers] = useState<Emp[]>([])
  const [locations, setLocations] = useState<Loc[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    firstName: '', middleName: '', lastName: '', email: '', phoneNumber: '',
    gender: 'NOT_SPECIFIED', dateOfBirth: '', address: '', notes: '', hireDate: '',
    employmentType: '', employmentStatus: 'DRAFT',
    currentRole: '', currentLevel: '',
    currentDepartmentId: '', currentDivisionId: '', currentRegionId: '',
    currentAreaId: '', currentShopId: '', currentClusterId: '',
    directManagerId: '', accountingReportingManagerId: '', basicSalary: '', salaryEffectiveDate: '',
    kpiDefaultAmount: '', kpiEffectiveFrom: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/departments').then(r => r.json()),
      fetch('/api/employees?limit=200').then(r => r.json()),
      fetch('/api/org-chart').then(r => r.json()),
    ]).then(([deptJson, empJson, orgJson]) => {
      setDepartments(deptJson.data || [])
      const allManagers = empJson.data?.items || []
      setManagers(allManagers)
      const allLocs: Loc[] = []
      const add = (items: Record<string, unknown>[] | undefined) => {
        if (items) for (const item of items) allLocs.push(item as unknown as Loc)
      }
      add(orgJson.data?.rootDepts)
      add(orgJson.data?.childDepts)
      add(orgJson.data?.locations)
      setLocations(allLocs)
    }).catch(() => router.push('/login'))
  }, [router])

  const regions = locations.filter(l => l.type === 'REGION')
  const areas = locations.filter(l => l.type === 'AREA')
  const shops = locations.filter(l => l.type === 'SHOP')

  function set(field: string, value: string) { setForm(prev => ({ ...prev, [field]: value })) }

  function selectCategory(cat: 'HEAD_OFFICE' | 'SHOP_FIELD') {
    setCategory(cat)
    setForm(prev => ({ ...prev, employeeCategory: cat }))
    setStep('form')
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setSaving(true)

    const payload: Record<string, unknown> = { ...form, employeeCategory: category }
    if (!payload.basicSalary) delete payload.basicSalary
    else payload.basicSalary = parseFloat(payload.basicSalary as string)
    if (!payload.kpiDefaultAmount) delete payload.kpiDefaultAmount
    else payload.kpiDefaultAmount = parseFloat(payload.kpiDefaultAmount as string)
    if (!payload.kpiEffectiveFrom) delete payload.kpiEffectiveFrom
    if (!payload.dateOfBirth) delete payload.dateOfBirth
    if (!payload.hireDate) delete payload.hireDate
    if (!payload.notes) delete payload.notes
    if (!payload.directManagerId) payload.directManagerId = undefined
    if (!payload.accountingReportingManagerId) payload.accountingReportingManagerId = undefined
    if (!payload.currentDepartmentId) delete payload.currentDepartmentId
    if (!payload.currentRegionId) delete payload.currentRegionId
    if (!payload.currentAreaId) delete payload.currentAreaId
    if (!payload.currentShopId) delete payload.currentShopId

    try {
      const res = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || json.message || 'Failed to create employee'); return }
      router.push(`/employees/${json.data.id}`)
    } catch { setError('Network error') }
    finally { setSaving(false) }
  }

  // Render category selection step
  if (step === 'category') {
    return (
      <div style={{ maxWidth: 600, margin: '0 auto', padding: '3rem 1rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ margin: '0 0 0.5rem' }}>Register Employee</h1>
          <p style={{ color: '#666' }}>Select the employee category to start registration</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <CategoryCard
            title="Head Office Department"
            description="Employee belongs to a Head Office department (CEO, Finance, HR, Sales, Distribution, Technology)"
            onClick={() => selectCategory('HEAD_OFFICE')}
          />
          <CategoryCard
            title="Shop / Field Structure"
            description="Employee works in a shop or field sales structure (ASM, Shop Manager, DSP, DSA, Shop Accountant)"
            onClick={() => selectCategory('SHOP_FIELD')}
          />
        </div>
        <div style={{ textAlign: 'center', marginTop: '1.5rem' }}>
          <Link href="/employees" style={{ color: '#2563eb', fontSize: '0.9rem' }}>Back to Employees</Link>
        </div>
      </div>
    )
  }

  // Step 2: Category-specific form
  const isHO = category === 'HEAD_OFFICE'
  const selectedRole = form.currentRole

  // Fetch managers for accounting reporting (TREASURY_MANAGER and ACCOUNTANT)
  const acctManagers = managers.filter(m => m.currentRole === 'TREASURY_MANAGER' || m.currentRole === 'ACCOUNTANT')
  const HODeptManagers = managers.filter(m => m.currentRole !== 'DSP' && m.currentRole !== 'DSA')
  const shopFieldManagers = managers

  return (
    <div style={{ maxWidth: 700, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem' }}>Register Employee</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666', fontSize: '0.85rem' }}>
            Category: {isHO ? 'Head Office Department' : 'Shop / Field Structure'}
            <button onClick={() => { setStep('category'); setError('') }} style={{ marginLeft: '0.75rem', background: 'none', border: 'none', color: '#2563eb', cursor: 'pointer', textDecoration: 'underline', fontSize: '0.85rem' }}>Change</button>
          </p>
        </div>
        <Link href="/employees" style={{ color: '#2563eb', fontSize: '0.9rem' }}>Cancel</Link>
      </div>

      {error && <p style={{ color: 'red', background: '#fee', padding: '0.5rem', borderRadius: 4, marginBottom: '0.75rem', fontSize: '0.9rem' }}>{error}</p>}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Personal Information</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="First Name *" value={form.firstName} onChange={v => set('firstName', v)} required />
            <Field label="Middle Name" value={form.middleName} onChange={v => set('middleName', v)} />
            <Field label="Last Name" value={form.lastName} onChange={v => set('lastName', v)} />
            <Select label="Gender" value={form.gender} onChange={v => set('gender', v)} options={[
              { value: 'NOT_SPECIFIED', label: 'Not Specified' },
              { value: 'MALE', label: 'Male' },
              { value: 'FEMALE', label: 'Female' },
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
              { value: '', label: '-- Select --' },
              { value: 'FULL_TIME', label: 'Full Time' },
              { value: 'PART_TIME', label: 'Part Time' },
              { value: 'CONTRACT', label: 'Contract' },
              { value: 'COMMISSION_BASED', label: 'Commission Based' },
              { value: 'INTERN', label: 'Intern' },
              { value: 'TEMPORARY', label: 'Temporary' },
              { value: 'OTHER', label: 'Other' },
            ]} />
            <Select label="Status" value={form.employmentStatus} onChange={v => set('employmentStatus', v)} options={[
              { value: 'DRAFT', label: 'Draft' },
              { value: 'ONBOARDING', label: 'Onboarding' },
              { value: 'ACTIVE', label: 'Active' },
              { value: 'ON_PROBATION', label: 'On Probation' },
            ]} />
            <Field label="Hire Date" value={form.hireDate} onChange={v => set('hireDate', v)} type="date" />
          </div>
        </fieldset>

        {/* HO-specific: Department + Role + Manager */}
        {isHO && (
          <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
            <legend style={{ fontWeight: 600 }}>Head Office Assignment</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Department *" value={form.currentDepartmentId} onChange={v => set('currentDepartmentId', v)} options={[
                { value: '', label: '-- Select --' },
                ...departments.map(d => ({ value: d.id, label: d.name })),
              ]} />
              <Select label="Position / Role *" value={form.currentRole} onChange={v => set('currentRole', v)} options={[
                { value: '', label: '-- Select --' },
                { value: 'CEO', label: 'CEO' },
                { value: 'CEO_COORDINATOR', label: 'CEO Coordinator' },
                { value: 'SALES_HEAD', label: 'Sales Head' },
                { value: 'DISTRIBUTION_MANAGER', label: 'Distribution Manager' },
                { value: 'DISTRIBUTION_OFFICER', label: 'Distribution Officer' },
                { value: 'FINANCE_DIRECTOR', label: 'Finance Director' },
                { value: 'TREASURY_MANAGER', label: 'Treasury Manager' },
                { value: 'ACCOUNTANT', label: 'Accountant' },
                { value: 'FINANCIAL_CONTROL_REPORTING_MANAGER', label: 'Financial Control and Reporting Manager' },
                { value: 'HR_MANAGER', label: 'HR Manager' },
                { value: 'HR_OFFICER', label: 'HR Officer' },
                { value: 'TECHNOLOGY_MANAGER', label: 'Technology Manager' },
              ]} />
              <Select label="Level" value={form.currentLevel} onChange={v => set('currentLevel', v)} options={[
                { value: '', label: '-- Select --' },
                { value: 'JUNIOR', label: 'Junior' },
                { value: 'MID', label: 'Mid' },
                { value: 'SENIOR', label: 'Senior' },
                { value: 'LEAD', label: 'Lead' },
                { value: 'MANAGER', label: 'Manager' },
                { value: 'DIRECTOR', label: 'Director' },
                { value: 'EXECUTIVE', label: 'Executive' },
              ]} />
              <Select label="Direct Manager" value={form.directManagerId} onChange={v => set('directManagerId', v)} options={[
                { value: '', label: '-- Select --' },
                ...HODeptManagers.filter(m => m.currentRole !== form.currentRole).map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId})` })),
              ]} />
            </div>
          </fieldset>
        )}

        {/* Shop/Field-specific: Region, Area, Shop, Role, Managers */}
        {!isHO && (
          <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
            <legend style={{ fontWeight: 600 }}>Shop / Field Assignment</legend>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <Select label="Position / Role *" value={form.currentRole} onChange={v => set('currentRole', v)} options={[
                { value: '', label: '-- Select --' },
                { value: 'ASM', label: 'ASM - Area Sales Manager' },
                { value: 'SHOP_MANAGER', label: 'Shop Manager' },
                { value: 'DSP', label: 'DSP - Indoor Sales' },
                { value: 'DSA', label: 'DSA - Outdoor Sales' },
                { value: 'SHOP_ACCOUNTANT', label: 'Shop Accountant' },
              ]} />

              {/* Show region/area based on role */}
              {(selectedRole === 'ASM' || selectedRole === 'SHOP_MANAGER' || selectedRole === 'DSP' || selectedRole === 'DSA' || selectedRole === 'SHOP_ACCOUNTANT') && (
                <>
                  <Select label="Region / Area *" value={form.currentRegionId} onChange={v => set('currentRegionId', v)} options={[
                    { value: '', label: '-- Select --' },
                    ...regions.map(r => ({ value: r.id, label: r.name })),
                  ]} />
                  <Select label="Area" value={form.currentAreaId} onChange={v => set('currentAreaId', v)} options={[
                    { value: '', label: '-- Select --' },
                    ...areas.map(a => ({ value: a.id, label: a.name })),
                  ]} />
                </>
              )}

              {/* Shop - required for SHOP_MANAGER, DSP, DSA, SHOP_ACCOUNTANT; optional for ASM */}
              {(selectedRole === 'SHOP_MANAGER' || selectedRole === 'DSP' || selectedRole === 'DSA' || selectedRole === 'SHOP_ACCOUNTANT') && (
                <Select label="Shop *" value={form.currentShopId} onChange={v => set('currentShopId', v)} options={[
                  { value: '', label: '-- Select --' },
                  ...shops.map(s => ({ value: s.id, label: s.name })),
                ]} />
              )}
              {selectedRole === 'ASM' && (
                <Select label="Shop (optional)" value={form.currentShopId} onChange={v => set('currentShopId', v)} options={[
                  { value: '', label: '-- Optional --' },
                  ...shops.map(s => ({ value: s.id, label: s.name })),
                ]} />
              )}

              <Select label="Level" value={form.currentLevel} onChange={v => set('currentLevel', v)} options={[
                { value: '', label: '-- Select --' }, { value: 'JUNIOR', label: 'Junior' },
                { value: 'MID', label: 'Mid' }, { value: 'SENIOR', label: 'Senior' },
                { value: 'LEAD', label: 'Lead' }, { value: 'MANAGER', label: 'Manager' },
                { value: 'DIRECTOR', label: 'Director' }, { value: 'EXECUTIVE', label: 'Executive' },
              ]} />

              <Select label="Direct Manager" value={form.directManagerId} onChange={v => set('directManagerId', v)} options={[
                { value: '', label: '-- Auto-set by role --' },
                ...shopFieldManagers.filter(m => m.currentRole !== form.currentRole).map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId} - ${m.currentRole})` })),
              ]} />

              {/* Accounting Reporting Manager - only for Shop Accountant */}
              {selectedRole === 'SHOP_ACCOUNTANT' && (
                <Select label="Accounting Reporting Manager *" value={form.accountingReportingManagerId} onChange={v => set('accountingReportingManagerId', v)} options={[
                  { value: '', label: '-- Select --' },
                  ...acctManagers.map(m => ({ value: m.id, label: `${m.fullName} (${m.employeeId} - ${m.currentRole})` })),
                ]} />
              )}
            </div>
          </fieldset>
        )}

        {/* Compensation - shown for all, but salary visibility enforced by backend */}
        <fieldset style={{ border: '1px solid #d1d5db', borderRadius: 6, padding: '1rem' }}>
          <legend style={{ fontWeight: 600 }}>Compensation</legend>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <Field label="Basic Salary" value={form.basicSalary} onChange={v => set('basicSalary', v)} type="number" />
            <Field label="Salary Effective Date" value={form.salaryEffectiveDate} onChange={v => set('salaryEffectiveDate', v)} type="date" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem', borderTop: '1px solid #e5e7eb', paddingTop: '0.75rem' }}>
            <Field label="KPI Default Amount" value={form.kpiDefaultAmount} onChange={v => set('kpiDefaultAmount', v)} type="number" />
            <Field label="KPI Effective From" value={form.kpiEffectiveFrom} onChange={v => set('kpiEffectiveFrom', v)} type="date" />
          </div>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#888' }}>
            KPI fields must be supplied together. Missing payroll percentage defaults to 100%.
          </p>
        </fieldset>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
          <Link href="/employees" style={{ padding: '0.5rem 1rem', border: '1px solid #d1d5db', borderRadius: 4, textDecoration: 'none', color: '#333', fontSize: '0.9rem' }}>Cancel</Link>
          <button type="submit" disabled={saving} style={{
            padding: '0.5rem 1.5rem', background: saving ? '#999' : '#2563eb', color: '#fff',
            border: 'none', borderRadius: 4, cursor: saving ? 'not-allowed' : 'pointer', fontSize: '0.9rem',
          }}>{saving ? 'Creating...' : 'Register Employee'}</button>
        </div>
      </form>
    </div>
  )
}

function CategoryCard({ title, description, onClick }: { title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'block', width: '100%', padding: '1.5rem', border: '2px solid #e5e7eb',
      borderRadius: 8, background: '#fff', cursor: 'pointer', textAlign: 'left',
      transition: 'border-color 0.2s, box-shadow 0.2s', fontSize: '1rem',
    }}
      onMouseOver={e => { (e.currentTarget as HTMLElement).style.borderColor = '#2563eb'; (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(37,99,235,0.15)' }}
      onMouseOut={e => { (e.currentTarget as HTMLElement).style.borderColor = '#e5e7eb'; (e.currentTarget as HTMLElement).style.boxShadow = 'none' }}
    >
      <h3 style={{ margin: '0 0 0.35rem', color: '#2563eb', fontSize: '1.1rem' }}>{title}</h3>
      <p style={{ margin: 0, color: '#666', fontSize: '0.9rem' }}>{description}</p>
    </button>
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
      <input
        type={type || 'text'} value={value} onChange={e => onChange(e.target.value)}
        required={required}
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
