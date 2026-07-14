'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'

export default function EmployeeDetailPage() {
  const params = useParams()
  const payId = params.payrollPeriodId as string
  const rowId = params.rowId as string

  const [row, setRow] = useState<any>(null)
  const [lines, setLines] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/payroll-periods/${payId}/calculation/rows/${rowId}`)
      .then(r => r.json()).then(j => {
        if (j.error) setError(j.error)
        else {
          setRow(j.data?.row || j.data)
          setLines(j.data?.lines || [])
        }
      }).catch(() => setError('Failed to load')).finally(() => setLoading(false))
  }, [payId, rowId])

  if (loading) return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
  if (error) return <div style={{ padding: '2rem', color: '#dc2626' }}>{error}</div>
  if (!row) return <div style={{ padding: '2rem', color: '#6b7280' }}>Row not found</div>

  return (
    <div style={{ padding: '2rem', maxWidth: 1000, margin: '0 auto' }}>
      <Link href={`/payroll-calculation/${payId}/results`} style={{ color: '#2563eb', textDecoration: 'none', fontSize: '0.875rem' }}>
        &larr; Back to Results
      </Link>

      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0.75rem 0' }}>
        {row.fullName} ({row.employeeCode})
      </h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <StatCard label="Role" value={row.role} />
        <StatCard label="Level" value={row.level} />
        <StatCard label="Basic Salary" value={Number(row.basicSalary || 0).toLocaleString()} />
        <StatCard label="Prorated Basic" value={Number(row.proratedBasicSalary || 0).toLocaleString()} />
        <StatCard label="Gross Salary" value={Number(row.grossSalary || 0).toLocaleString()} bold />
        <StatCard label="Gross Taxable" value={Number(row.grossTaxableEarnings || 0).toLocaleString()} />
        <StatCard label="Gross Non-Taxable" value={Number(row.grossNonTaxableEarnings || 0).toLocaleString()} />
        <StatCard label="Pensionable Income" value={Number(row.pensionableIncome || 0).toLocaleString()} />
        <StatCard label="Employee Pension" value={Number(row.employeePension || 0).toLocaleString()} />
        <StatCard label="Employer Pension" value={Number(row.employerPension || 0).toLocaleString()} />
        <StatCard label="Taxable Income" value={Number(row.taxableIncome || 0).toLocaleString()} />
        <StatCard label="PAYE Tax" value={Number(row.payeTax || 0).toLocaleString()} />
        <StatCard label="Pre-Tax Deductions" value={Number(row.preTaxDeductions || 0).toLocaleString()} />
        <StatCard label="Post-Tax Deductions" value={Number(row.postTaxDeductions || 0).toLocaleString()} />
        <StatCard label="Total Deductions" value={Number(row.totalDeductions || 0).toLocaleString()} />
        <StatCard label="Net Salary" value={Number(row.netSalary || 0).toLocaleString()} bold />
        <StatCard label="Employer Total Cost" value={Number(row.employerTotalCost || 0).toLocaleString()} />
        <StatCard label="Salary Source" value={row.salarySource || '-'} />
        <StatCard label="Employment Type" value={row.employmentType || '-'} />
      </div>

      {row.blockers?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.25rem' }}>Blockers</h3>
          {row.blockers.map((b: string, i: number) => (
            <div key={i} style={{ fontSize: '0.8rem', color: '#dc2626' }}>⛔ {b}</div>
          ))}
        </div>
      )}

      {row.warnings?.length > 0 && (
        <div style={{ marginBottom: '1rem' }}>
          <h3 style={{ fontSize: '0.875rem', fontWeight: 600, color: '#d97706', marginBottom: '0.25rem' }}>Warnings</h3>
          {row.warnings.map((w: string, i: number) => (
            <div key={i} style={{ fontSize: '0.8rem', color: '#d97706' }}>⚠ {w}</div>
          ))}
        </div>
      )}

      {lines.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem' }}>Calculation Lines (Audit Trail)</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={thStyle}>Component</th>
                  <th style={thStyle}>Line Type</th>
                  <th style={thStyle}>Source</th>
                  <th style={thStyle}>Order</th>
                  <th style={thStyle}>Gross</th>
                  <th style={thStyle}>Taxable</th>
                  <th style={thStyle}>Non-Taxable</th>
                  <th style={thStyle}>Pensionable</th>
                  <th style={thStyle}>Deduction</th>
                  <th style={thStyle}>Employer</th>
                  <th style={thStyle}>Rate</th>
                  <th style={thStyle}>Base</th>
                  <th style={thStyle}>Note</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l: any, i: number) => (
                  <tr key={l.id || i} style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <td style={tdStyle}><strong>{l.componentCode}</strong></td>
                    <td style={tdStyle}>{l.lineType}</td>
                    <td style={tdStyle}>{l.sourceType}</td>
                    <td style={tdStyle}>{l.calculationOrder}</td>
                    <td style={tdStyle}>{Number(l.grossAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(l.taxableAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(l.nonTaxableAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(l.pensionableAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(l.deductionAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{Number(l.employerAmount || 0).toLocaleString()}</td>
                    <td style={tdStyle}>{l.rate != null ? `${l.rate}%` : '-'}</td>
                    <td style={tdStyle}>{l.baseAmount != null ? Number(l.baseAmount).toLocaleString() : '-'}</td>
                    <td style={{ ...tdStyle, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.calculationNote || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, bold }: { label: string; value: string | number; bold?: boolean }) {
  return (
    <div style={{ background: '#f9fafb', padding: '0.5rem 0.75rem', borderRadius: 6, border: '1px solid #e5e7eb' }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', marginBottom: '0.125rem' }}>{label}</div>
      <div style={{ fontWeight: bold ? 700 : 500, fontSize: '0.875rem' }}>{value}</div>
    </div>
  )
}

const thStyle: React.CSSProperties = { padding: '0.5rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb', whiteSpace: 'nowrap' }
const tdStyle: React.CSSProperties = { padding: '0.5rem', whiteSpace: 'nowrap' }
