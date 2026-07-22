'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

interface PayrollPeriodOption { id: string; periodName: string; status: string }

export default function NewIncentivePeriodPage() {
  const router = useRouter()
  const [payrollPeriods, setPayrollPeriods] = useState<PayrollPeriodOption[]>([])
  const [payrollPeriodId, setPayrollPeriodId] = useState('')
  const [name, setName] = useState('')
  const [month, setMonth] = useState('')
  const [year, setYear] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/payroll-periods')
      .then(r => r.json())
      .then(j => { setPayrollPeriods(j.data || []) })
      .catch(() => setFetchError('Failed to load payroll periods'))
  }, [])

  function validate(): boolean {
    const errs: Record<string, string> = {}
    if (!payrollPeriodId) errs.payrollPeriodId = 'Payroll period is required'
    if (!name.trim()) errs.name = 'Period name is required'
    const m = parseInt(month, 10)
    if (!month || isNaN(m) || m < 1 || m > 12) errs.month = 'Month must be 1-12'
    const y = parseInt(year, 10)
    if (!year || isNaN(y) || y < 2020) errs.year = 'Year must be >= 2020'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!validate()) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/shop-manager-incentives/periods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payrollPeriodId, name: name.trim(), month: parseInt(month, 10), year: parseInt(year, 10) }),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json.details?.fieldErrors) {
          const fieldErrs: Record<string, string> = {}
          for (const [k, msgs] of Object.entries(json.details.fieldErrors)) {
            fieldErrs[k] = (msgs as string[]).join(', ')
          }
          setErrors(fieldErrs)
        } else {
          setErrors({ form: json.error || 'Failed to create period' })
        }
      } else {
        router.push('/shop-manager-incentives')
      }
    } catch {
      setErrors({ form: 'Network error' })
    } finally { setSubmitting(false) }
  }

  if (fetchError) return <div className="p-6"><p className="text-red-600">{fetchError}</p></div>

  return (
    <div className="p-6 max-w-2xl mx-auto">
      <a href="/shop-manager-incentives" className="text-blue-600 underline text-sm block mb-2">&larr; Back to Incentives</a>
      <h1 className="text-2xl font-bold mb-6">New Incentive Period</h1>

      {errors.form && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-4">{errors.form}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Payroll Period</label>
          <select value={payrollPeriodId} onChange={e => setPayrollPeriodId(e.target.value)} className="border rounded px-3 py-2 w-full">
            <option value="">Select payroll period...</option>
            {payrollPeriods.map(pp => (
              <option key={pp.id} value={pp.id}>{pp.periodName} ({pp.status})</option>
            ))}
          </select>
          {errors.payrollPeriodId && <p className="text-red-500 text-xs mt-1">{errors.payrollPeriodId}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Period Name</label>
          <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Q1 2026 Shop Manager Incentive" className="border rounded px-3 py-2 w-full" />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name}</p>}
        </div>

        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Month</label>
            <input type="number" min={1} max={12} value={month} onChange={e => setMonth(e.target.value)} placeholder="1-12" className="border rounded px-3 py-2 w-full" />
            {errors.month && <p className="text-red-500 text-xs mt-1">{errors.month}</p>}
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium mb-1">Year</label>
            <input type="number" min={2020} value={year} onChange={e => setYear(e.target.value)} placeholder="e.g. 2026" className="border rounded px-3 py-2 w-full" />
            {errors.year && <p className="text-red-500 text-xs mt-1">{errors.year}</p>}
          </div>
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-6 py-2 rounded disabled:opacity-50">
            {submitting ? 'Creating...' : 'Create Period'}
          </button>
          <button type="button" onClick={() => router.back()} className="px-4 py-2 border rounded">Cancel</button>
        </div>
      </form>
    </div>
  )
}
