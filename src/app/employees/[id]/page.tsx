'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'

interface Employee {
  id: string; employeeId: string; fullName: string; firstName: string; middleName: string; lastName: string
  email: string; phoneNumber: string; gender: string; dateOfBirth: string | null; address: string | null
  notes: string | null; hireDate: string | null; employmentType: string | null; employmentStatus: string | null
  employeeCategory: string | null; currentRole: string | null; currentLevel: string | null
  currentDepartmentId: string | null; currentRegionId: string | null; currentAreaId: string | null
  currentShopId: string | null; currentClusterId: string | null; currentDivisionId: string | null
  basicSalary: number | string | null; salaryEffectiveDate: string | null; createdAt: string
  _deptName: string | null; _regionName: string | null; _areaName: string | null; _shopName: string | null
  directManager: { id: string; employeeId: string; fullName: string; currentRole: string } | null
  accountingReportingManager: { id: string; employeeId: string; fullName: string; currentRole: string } | null
  assignments: Assignment[]
}

interface Assignment { id: string; role: string; level: string; startDate: string; endDate: string | null; reason: string | null; isActive: boolean }
interface StatusHist { id: string; newStatus: string; previousStatus: string | null; effectiveDate: string; updatedById: string | null; updatedByName: string | null; reason: string | null }
interface OnboardingItem { id: string; key: string; label: string; completed: boolean; completedAt: string | null }
interface EmpDocument { id: string; documentType: string; originalFilename: string | null; fileSize: number | null; mimeType: string | null; visibilityLevel: string; notes: string | null; isActive: boolean; uploadedAt: string; uploadedById: string | null }
interface RequiredDocStatus { ruleId: string; ruleName: string; documentType: string; isSatisfied: boolean; matchingDocumentId: string | null; matchingDocumentName: string | null }

export default function EmployeeDetailPage() {
  const params = useParams()
  const router = useRouter()
  const [emp, setEmp] = useState<Employee | null>(null)
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [statusHists, setStatusHists] = useState<StatusHist[]>([])
  const [onboardingItems, setOnboardingItems] = useState<OnboardingItem[]>([])
  const [tab, setTab] = useState<'profile' | 'assignments' | 'status' | 'onboarding' | 'documents'>('profile')
  const [loading, setLoading] = useState(true)
  const [perms, setPerms] = useState<string[]>([])
  const [documents, setDocuments] = useState<EmpDocument[]>([])
  const [requiredDocStatus, setRequiredDocStatus] = useState<RequiredDocStatus[]>([])
  const [docCompletionPct, setDocCompletionPct] = useState(100)
  const [docBlockers, setDocBlockers] = useState<string[]>([])

  useEffect(() => {
    if (!params.id) return
    Promise.all([
      fetch('/api/auth/me').then(r => r.json()),
      fetch(`/api/employees/${params.id}`).then(r => r.json()),
      fetch(`/api/employees/${params.id}/assignments`).then(r => r.json()),
      fetch(`/api/employees/${params.id}/status-history`).then(r => r.json()),
      fetch(`/api/employees/${params.id}/onboarding`).then(r => r.json()),
      fetch(`/api/employees/${params.id}/documents`).then(r => r.json()),
      fetch(`/api/employees/${params.id}/required-documents`).then(r => r.json()),
    ]).then(([meJson, empJson, assignJson, shJson, obJson, docJson, reqDocJson]) => {
      const me = meJson.data || meJson
      setPerms(me.permissions || [])
      if (!empJson.data?.id) { router.push('/employees'); return }
      setEmp(empJson.data)
      setAssignments(assignJson.data || [])
      setStatusHists(shJson.data || [])
      if (obJson.data?.items) setOnboardingItems(obJson.data.items)
      else if (obJson.data?.exists && obJson.data.checklist?.items) setOnboardingItems(obJson.data.checklist.items)
      setDocuments(docJson.data || [])
      if (reqDocJson.data?.rules) {
        setRequiredDocStatus(reqDocJson.data.rules)
        setDocCompletionPct(reqDocJson.data.completionPercentage || 0)
        setDocBlockers(reqDocJson.data.blockers || [])
      }
    }).catch(() => router.push('/login'))
    .finally(() => setLoading(false))
  }, [params.id, router])

  async function completeOnboarding() {
    const reason = prompt('Override reason (leave blank if no override needed):')
    if (reason === null) return
    const res = await fetch(`/api/employees/${params.id}/onboarding/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ override: reason.length > 0, overrideReason: reason }),
    })
    const json = await res.json()
    const data = json.data || json
    if (!data.canComplete && data.blockers?.length > 0) {
      alert(`Onboarding blocked:\n${data.blockers.join('\n')}\n\nUse override reason to bypass.`)
      return
    }
    alert('Onboarding completed successfully!')
    window.location.reload()
  }

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (!emp) return null

  const canViewSalary = perms.includes('salary.view')
  const salaryDisplay = canViewSalary ? emp.basicSalary : (emp.basicSalary === 'REDACTED' ? 'Restricted' : 'N/A')
  const isHO = emp.employeeCategory === 'HEAD_OFFICE'

  function InfoRow({ label, value }: { label: string; value: string }) {
    return (
      <div style={{ display: 'flex', padding: '0.35rem 0', borderBottom: '1px solid #f0f0f0' }}>
        <span style={{ width: 200, fontWeight: 500, fontSize: '0.9rem', color: '#555', flexShrink: 0 }}>{label}</span>
        <span style={{ fontSize: '0.9rem' }}>{value || '—'}</span>
      </div>
    )
  }

  const activeAssignments = assignments.filter(a => a.isActive && !a.endDate)

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ margin: 0 }}>{emp.fullName}</h1>
          <p style={{ margin: '0.25rem 0 0', color: '#666' }}>
            {emp.employeeId} · {emp.currentRole || 'No role'}
            {emp.employeeCategory && (
              <span style={{ marginLeft: '0.5rem', padding: '0.15rem 0.5rem', borderRadius: 4, fontSize: '0.75rem', fontWeight: 600, background: isHO ? '#dbeafe' : '#fef3c7', color: isHO ? '#1e40af' : '#92400e' }}>
                {isHO ? 'Head Office' : 'Shop / Field'}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Link href="/employees" style={{ color: '#2563eb', padding: '0.35rem 0.75rem', fontSize: '0.9rem' }}>Back</Link>
          <Link href={`/employees/${emp.id}/edit`} style={{ background: '#2563eb', color: '#fff', padding: '0.35rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem' }}>Edit</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.25rem', marginBottom: '1rem', borderBottom: '2px solid #e5e7eb' }}>
        {        ([
          ['profile', 'Profile'], ['assignments', 'Assignments'],
          ['status', 'Status History'], ['documents', 'Documents'],
          ['onboarding', 'Onboarding'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            padding: '0.5rem 1rem', border: 'none', background: 'none', cursor: 'pointer',
            borderBottom: tab === key ? '2px solid #2563eb' : '2px solid transparent',
            fontWeight: tab === key ? 600 : 400, color: tab === key ? '#2563eb' : '#666', marginBottom: '-2px', fontSize: '0.9rem',
          }}>{label}</button>
        ))}
      </div>

      {tab === 'profile' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Personal Details</h3>
            <InfoRow label="Employee ID" value={emp.employeeId} />
            <InfoRow label="Full Name" value={emp.fullName} />
            <InfoRow label="First Name" value={emp.firstName} />
            <InfoRow label="Middle Name" value={emp.middleName || ''} />
            <InfoRow label="Last Name" value={emp.lastName} />
            <InfoRow label="Gender" value={emp.gender} />
            <InfoRow label="Date of Birth" value={emp.dateOfBirth ? new Date(emp.dateOfBirth).toLocaleDateString() : ''} />
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Contact & Employment</h3>
            <InfoRow label="Email" value={emp.email} />
            <InfoRow label="Phone" value={emp.phoneNumber || ''} />
            <InfoRow label="Address" value={emp.address || ''} />
            <InfoRow label="Notes" value={emp.notes || ''} />
            <InfoRow label="Employment Type" value={emp.employmentType || ''} />
            <InfoRow label="Employment Status" value={emp.employmentStatus || ''} />
            <InfoRow label="Hire Date" value={emp.hireDate ? new Date(emp.hireDate).toLocaleDateString() : ''} />
            <InfoRow label="Level" value={emp.currentLevel || ''} />
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Organization</h3>
            <InfoRow label="Category" value={isHO ? 'Head Office' : 'Shop / Field'} />
            <InfoRow label="Role / Position" value={emp.currentRole || ''} />
            {isHO ? (
              <InfoRow label="Department" value={emp._deptName || emp.currentDepartmentId || ''} />
            ) : (
              <>
                <InfoRow label="Region" value={emp._regionName || emp.currentRegionId || ''} />
                <InfoRow label="Area" value={emp._areaName || emp.currentAreaId || ''} />
                <InfoRow label="Shop" value={emp._shopName || emp.currentShopId || ''} />
              </>
            )}
            <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '0.5rem 0' }} />
            <InfoRow label="Direct Manager" value={emp.directManager ? `${emp.directManager.fullName} (${emp.directManager.employeeId})` : '—'} />
            {emp.accountingReportingManager && (
              <InfoRow label="Accounting Reporting" value={`${emp.accountingReportingManager.fullName} (${emp.accountingReportingManager.employeeId})`} />
            )}
          </div>
          <div style={{ background: '#f9fafb', borderRadius: 6, padding: '1rem' }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1rem' }}>Compensation</h3>
            <InfoRow label="Basic Salary" value={String(salaryDisplay)} />
            <InfoRow label="Salary Eff. Date" value={emp.salaryEffectiveDate ? new Date(emp.salaryEffectiveDate).toLocaleDateString() : '—'} />
            {activeAssignments.length > 0 && (
              <>
                <h3 style={{ margin: '1rem 0 0.5rem', fontSize: '1rem' }}>Current Assignment</h3>
                <InfoRow label="Role" value={activeAssignments[0].role} />
                <InfoRow label="Level" value={activeAssignments[0].level} />
                <InfoRow label="Started" value={new Date(activeAssignments[0].startDate).toLocaleDateString()} />
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'assignments' && (
        <div>
          {assignments.length === 0 ? <p style={{ color: '#888' }}>No assignments recorded.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                <th style={th}>Role</th><th style={th}>Level</th><th style={th}>Start</th><th style={th}>End</th><th style={th}>Status</th><th style={th}>Reason</th>
              </tr></thead>
              <tbody>{assignments.map(a => (
                <tr key={a.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={td}>{a.role}</td>
                  <td style={td}>{a.level}</td>
                  <td style={td}>{new Date(a.startDate).toLocaleDateString()}</td>
                  <td style={td}>{a.endDate ? new Date(a.endDate).toLocaleDateString() : '—'}</td>
                  <td style={td}>{a.isActive && !a.endDate ? <span style={{ color: '#16a34a' }}>Active</span> : 'Past'}</td>
                  <td style={td}>{a.reason || ''}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'status' && (
        <div>
          {statusHists.length === 0 ? <p style={{ color: '#888' }}>No status history recorded.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                <th style={th}>Status</th><th style={th}>Changed At</th><th style={th}>Changed By</th><th style={th}>Reason</th>
              </tr></thead>
              <tbody>{statusHists.map(s => (
                <tr key={s.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={td}>{s.newStatus}</td>
                  <td style={td}>{new Date(s.effectiveDate).toLocaleString()}</td>
                  <td style={td}>{s.updatedByName || 'System'}</td>
                  <td style={td}>{s.reason || ''}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Required Documents</h3>
          {requiredDocStatus.length === 0 ? <p style={{ color: '#888', fontSize: '0.9rem' }}>No document rules configured.</p> : (
            <>
              <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <div style={{ flex: 1, background: '#e5e7eb', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ background: docBlockers.length > 0 ? '#f59e0b' : '#16a34a', height: '100%', width: `${docCompletionPct}%`, transition: 'width 0.3s' }} />
                </div>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{docCompletionPct}%</span>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '1.5rem' }}>
                <thead><tr style={{ background: '#f9fafb' }}>
                  <th style={th}>Document Type</th><th style={th}>Status</th><th style={th}>Uploaded File</th>
                </tr></thead>
                <tbody>{requiredDocStatus.filter(r => !r.isSatisfied).map(r => (
                  <tr key={r.ruleId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={td}>{r.ruleName}</td>
                    <td style={td}><span style={{ color: '#dc2626', fontWeight: 600 }}>Missing</span></td>
                    <td style={td}>—</td>
                  </tr>
                ))}{requiredDocStatus.filter(r => r.isSatisfied).map(r => (
                  <tr key={r.ruleId} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={td}>{r.ruleName}</td>
                    <td style={td}><span style={{ color: '#16a34a', fontWeight: 600 }}>Uploaded</span></td>
                    <td style={td}>{r.matchingDocumentName || '—'}</td>
                  </tr>
                ))}</tbody>
              </table>
            </>
          )}

          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>All Documents</h3>
          {documents.length === 0 ? <p style={{ color: '#888', fontSize: '0.9rem' }}>No documents uploaded.</p> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ background: '#f9fafb' }}>
                <th style={th}>Type</th><th style={th}>File</th><th style={th}>Visibility</th><th style={th}>Uploaded</th><th style={th}>Status</th>
              </tr></thead>
              <tbody>{documents.map(d => (
                <tr key={d.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={td}>{d.documentType}</td>
                  <td style={td}>{d.originalFilename || '—'}</td>
                  <td style={td}>{d.visibilityLevel}</td>
                  <td style={td}>{new Date(d.uploadedAt).toLocaleDateString()}</td>
                  <td style={td}>{d.isActive ? <span style={{ color: '#16a34a' }}>Active</span> : <span style={{ color: '#888' }}>Inactive</span>}</td>
                </tr>
              ))}</tbody>
            </table>
          )}
          {perms.includes('document.upload') && (
            <div style={{ marginTop: '1rem' }}>
              <Link href={`/employees/${params.id}/documents/upload`} style={{ background: '#2563eb', color: '#fff', padding: '0.4rem 1rem', borderRadius: 4, textDecoration: 'none', fontSize: '0.9rem', display: 'inline-block' }}>Upload Document</Link>
            </div>
          )}
        </div>
      )}

      {tab === 'onboarding' && (
        <div>
          <h3 style={{ margin: '0 0 0.75rem', fontSize: '1rem' }}>Onboarding Progress</h3>

          <div style={{ marginBottom: '1rem', padding: '0.75rem', background: '#f9fafb', borderRadius: 6 }}>
            <p style={{ margin: '0 0 0.25rem', fontSize: '0.9rem' }}><strong>Documents:</strong> {docCompletionPct}% complete</p>
            {docBlockers.map((b, i) => <p key={i} style={{ margin: '0.15rem 0', color: '#dc2626', fontSize: '0.85rem' }}>• {b}</p>)}
          </div>

          {onboardingItems.length === 0 ? <p style={{ color: '#888' }}>No onboarding checklist found.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#666' }}>{onboardingItems.filter(o => o.completed).length}/{onboardingItems.length} items completed</p>
              <div style={{ background: '#e5e7eb', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ background: '#2563eb', height: '100%', width: `${(onboardingItems.filter(o => o.completed).length / onboardingItems.length) * 100}%`, transition: 'width 0.3s' }} />
              </div>
              {onboardingItems.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', background: item.completed ? '#f0fdf4' : '#fff', border: '1px solid #e5e7eb', borderRadius: 4 }}>
                  <span style={{ color: item.completed ? '#16a34a' : '#d1d5db', fontSize: '1.1rem' }}>{item.completed ? '✓' : '○'}</span>
                  <span style={{ flex: 1, fontSize: '0.9rem', textDecoration: item.completed ? 'line-through' : 'none' }}>{item.label}</span>
                  {item.completedAt && <span style={{ fontSize: '0.8rem', color: '#888' }}>{new Date(item.completedAt).toLocaleDateString()}</span>}
                </div>
              ))}
            </div>
          )}

          {perms.includes('onboarding.complete') && (
            <div style={{ marginTop: '1rem' }}>
              <button onClick={completeOnboarding} style={{ background: '#16a34a', color: '#fff', padding: '0.5rem 1.5rem', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: '0.9rem' }}>
                Complete Onboarding
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const th: React.CSSProperties = { textAlign: 'left', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }
const td: React.CSSProperties = { padding: '0.5rem', fontSize: '0.9rem' }
