'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'

interface ShopLocation { id: string; name: string; code: string }
interface ShopManager { id: string; fullName: string; employeeId: string }

interface PerformanceInput {
  id: string; incentivePeriodId: string; shopLocationId: string
  shopCriteria: string | null; corridorStatus: boolean | null
  qgaAbove90: boolean | null; qgaQuantity: number | null
  mmQoAbove90: boolean | null; dsaAirtimeAchievementPercent: number | null
  evdAbove100AndReconciled: boolean | null
  mpesaTargetAndReconciled: boolean | null; mpesaFloatSold: number | null
  baSite: boolean | null
  ebuTargetAchieved: boolean | null; ebuRevenueMade: boolean | null
  ebuAverageTopupAbove500: boolean | null; ebuFirstMonthLfRevenue: number | null
  responsibleRemarks: string | null
  shopLocation: ShopLocation; shopManager: ShopManager | null
}

interface ReadinessItem {
  readinessStatus: string
  missingFields: string[]
  missingSalesFields: string[]
  missingDistributionFields: string[]
  missingEbuFields: string[]
}

interface InputConfig {
  id: string
  inputCode: string
  inputLabel: string
  isRequired: boolean
  requiredWhenJson: string | null
  helpText: string | null
}

const readinessColors: Record<string, string> = {
  READY: '#16a34a',
  INCOMPLETE: '#dc2626',
  AT_RISK_ZERO: '#6b7280',
  CALCULATED: '#2563eb',
  STALE_CALCULATION: '#f59e0b',
}

const readinessLabels: Record<string, string> = {
  READY: 'Ready',
  INCOMPLETE: 'Incomplete',
  AT_RISK_ZERO: 'At-Risk',
  CALCULATED: 'Calculated',
  STALE_CALCULATION: 'Stale',
}

const FIELD_LABELS: Record<string, string> = {
  shopCriteria: 'Shop Criteria',
  shopManagerId: 'Shop Manager',
  qgaAbove90: 'QGA >90%?',
  qgaQuantity: 'QGA Quantity',
  mmQoAbove90: 'MM QO >90%?',
  dsaAirtimeAchievementPercent: 'DSA Airtime %',
  corridorStatus: 'Corridor',
  evdAbove100AndReconciled: 'EVD >100%',
  mpesaTargetAndReconciled: 'M-PESA Tgt',
  mpesaFloatSold: 'M-PESA Float',
  baSite: 'BA/Site',
  ebuTargetAchieved: 'EBU Tgt',
  ebuRevenueMade: 'EBU Rev',
  ebuAverageTopupAbove500: 'EBU TopUp >500?',
  ebuFirstMonthLfRevenue: 'EBU 1st Mo LF',
  responsibleRemarks: 'Remarks',
}

const SALES_FIELDS = ['qgaAbove90', 'qgaQuantity', 'mmQoAbove90', 'dsaAirtimeAchievementPercent']
const DISTRIBUTION_FIELDS = ['corridorStatus', 'evdAbove100AndReconciled', 'mpesaTargetAndReconciled', 'mpesaFloatSold', 'baSite']
const EBU_FIELDS = ['ebuTargetAchieved', 'ebuRevenueMade', 'ebuAverageTopupAbove500', 'ebuFirstMonthLfRevenue']
const PERFORMANCE_FIELDS = [...SALES_FIELDS, ...DISTRIBUTION_FIELDS, ...EBU_FIELDS]

const fieldToCode: Record<string, string> = {
  shopCriteria: 'SHOP_CRITERIA',
  qgaAbove90: 'QGA_ABOVE_90',
  qgaQuantity: 'QGA_QUANTITY',
  mmQoAbove90: 'MM_QO_ABOVE_90',
  dsaAirtimeAchievementPercent: 'DSA_AIRTIME_PERCENT',
  corridorStatus: 'CORRIDOR_STATUS',
  evdAbove100AndReconciled: 'EVD_ABOVE_100',
  mpesaTargetAndReconciled: 'MPESA_TARGET',
  mpesaFloatSold: 'MPESA_FLOAT_SOLD',
  baSite: 'BA_SITE',
  ebuTargetAchieved: 'EBU_TARGET_ACHIEVED',
  ebuRevenueMade: 'EBU_REVENUE_MADE',
  ebuAverageTopupAbove500: 'EBU_AVG_TOPUP_ABOVE_500',
  ebuFirstMonthLfRevenue: 'EBU_FIRST_MONTH_LF_REVENUE',
  responsibleRemarks: 'RESPONSIBLE_REMARKS',
}

function isSalesField(field: string) { return SALES_FIELDS.includes(field) }
function isDistributionField(field: string) { return DISTRIBUTION_FIELDS.includes(field) }
function isEbuField(field: string) { return EBU_FIELDS.includes(field) }

function isFieldDisabled(
  field: string, atRisk: boolean,
  hasAll: boolean, hasSales: boolean, hasDist: boolean, hasEbu: boolean,
): boolean {
  if (field === 'shopCriteria' || field === 'shopManagerId' || field === 'responsibleRemarks') return false
  if (atRisk) return true
  if (hasAll) return false
  if (isSalesField(field)) return !hasSales
  if (isDistributionField(field)) return !hasDist
  if (isEbuField(field)) return !hasEbu
  return false
}

function getConfig(field: string, configs: Map<string, InputConfig>): InputConfig | undefined {
  const code = fieldToCode[field]
  return code ? configs.get(code) : undefined
}

function isCondRequired(
  field: string, data: Record<string, string>, configs: Map<string, InputConfig>,
): boolean {
  const config = getConfig(field, configs)
  if (!config?.requiredWhenJson) return false
  try {
    const cond = JSON.parse(config.requiredWhenJson)
    for (const [key, val] of Object.entries(cond)) {
      if (data[key] !== val) return false
    }
    const v = data[field]
    return v === '' || v === undefined || v === null
  } catch { return false }
}

function getHelpText(field: string, configs: Map<string, InputConfig>): string | null {
  return getConfig(field, configs)?.helpText ?? null
}

function isRegRequired(field: string, configs: Map<string, InputConfig>): boolean {
  return getConfig(field, configs)?.isRequired === true
}

function RequiredStar({ field, configs }: { field: string; configs: Map<string, InputConfig> }) {
  if (isRegRequired(field, configs)) return <span className="text-red-500" title="Required">*</span>
  return null
}

function CondIndicator({ field, data, configs }: { field: string; data: Record<string, string>; configs: Map<string, InputConfig> }) {
  if (isCondRequired(field, data, configs)) {
    return <span className="text-orange-500 ml-0.5" title="Conditionally required — fill dependent field first">&#9679;</span>
  }
  return null
}

export default function InputsPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string
  const [inputs, setInputs] = useState<PerformanceInput[]>([])
  const [shops, setShops] = useState<ShopLocation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editData, setEditData] = useState<Record<string, string>>({})
  const [actionLoading, setActionLoading] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addFormData, setAddFormData] = useState<Record<string, string>>({})
  const [addFormError, setAddFormError] = useState('')
  const [readinessMap, setReadinessMap] = useState<Map<string, ReadinessItem>>(new Map())
  const [inputConfigs, setInputConfigs] = useState<Map<string, InputConfig>>(new Map())
  const [permAll, setPermAll] = useState(false)
  const [permSales, setPermSales] = useState(false)
  const [permDist, setPermDist] = useState(false)
  const [permEbu, setPermEbu] = useState(false)

  useEffect(() => { fetchData() }, [id])

  async function fetchData() {
    setLoading(true); setError(null)
    try {
      const [inputRes, shopRes, authRes, readinessRes, configRes] = await Promise.all([
        fetch(`/api/shop-manager-incentives/periods/${id}/inputs`),
        fetch('/api/shops?pageSize=500'),
        fetch('/api/auth/me'),
        fetch(`/api/shop-manager-incentives/periods/${id}/readiness`).catch(() => null),
        fetch('/api/shop-manager-incentives/input-config').catch(() => null),
      ])
      const inputJson = await inputRes.json()
      const shopJson = await shopRes.json()
      const authJson = await authRes.json()
      if (!inputRes.ok) { setError(inputJson.error || 'Failed to load inputs') }
      else setInputs(inputJson.data || [])
      if (shopRes.ok) setShops(shopJson.data || [])
      const perms: string[] = authJson.data?.permissions || []
      setPermAll(perms.includes('shopManagerIncentive.inputAll'))
      setPermSales(perms.includes('shopManagerIncentive.inputSales'))
      setPermDist(perms.includes('shopManagerIncentive.inputDistribution'))
      setPermEbu(perms.includes('shopManagerIncentive.inputEbu'))
      if (readinessRes && readinessRes.ok) {
        const rj = await readinessRes.json()
        const m = new Map<string, ReadinessItem>()
        if (rj.data?.inputs) {
          for (const item of rj.data.inputs) {
            m.set(item.inputId, {
              readinessStatus: item.readinessStatus,
              missingFields: item.missingFields || [],
              missingSalesFields: item.missingSalesFields || [],
              missingDistributionFields: item.missingDistributionFields || [],
              missingEbuFields: item.missingEbuFields || [],
            })
          }
        }
        setReadinessMap(m)
      }
      if (configRes && configRes.ok) {
        const cj = await configRes.json()
        const m = new Map<string, InputConfig>()
        if (Array.isArray(cj.data)) {
          for (const c of cj.data) {
            if (c.isActive !== false) m.set(c.inputCode, { id: c.id, inputCode: c.inputCode, inputLabel: c.inputLabel, isRequired: c.isRequired, requiredWhenJson: c.requiredWhenJson, helpText: c.helpText })
          }
        }
        setInputConfigs(m)
      }
    } catch { setError('Network error') }
    finally { setLoading(false) }
  }

  function startEdit(inp: PerformanceInput) {
    setEditingId(inp.id)
    const d: Record<string, string> = {}
    d.shopCriteria = inp.shopCriteria ?? ''
    d.shopManagerId = inp.shopManager?.id ?? ''
    d.corridorStatus = inp.corridorStatus === null ? '' : inp.corridorStatus ? 'true' : 'false'
    d.qgaAbove90 = inp.qgaAbove90 === null ? '' : inp.qgaAbove90 ? 'true' : 'false'
    d.qgaQuantity = inp.qgaQuantity?.toString() ?? ''
    d.mmQoAbove90 = inp.mmQoAbove90 === null ? '' : inp.mmQoAbove90 ? 'true' : 'false'
    d.dsaAirtimeAchievementPercent = inp.dsaAirtimeAchievementPercent?.toString() ?? ''
    d.evdAbove100AndReconciled = inp.evdAbove100AndReconciled === null ? '' : inp.evdAbove100AndReconciled ? 'true' : 'false'
    d.mpesaTargetAndReconciled = inp.mpesaTargetAndReconciled === null ? '' : inp.mpesaTargetAndReconciled ? 'true' : 'false'
    d.mpesaFloatSold = inp.mpesaFloatSold?.toString() ?? ''
    d.baSite = inp.baSite === null ? '' : inp.baSite ? 'true' : 'false'
    d.ebuTargetAchieved = inp.ebuTargetAchieved === null ? '' : inp.ebuTargetAchieved ? 'true' : 'false'
    d.ebuRevenueMade = inp.ebuRevenueMade === null ? '' : inp.ebuRevenueMade ? 'true' : 'false'
    d.ebuAverageTopupAbove500 = inp.ebuAverageTopupAbove500 === null ? '' : inp.ebuAverageTopupAbove500 ? 'true' : 'false'
    d.ebuFirstMonthLfRevenue = inp.ebuFirstMonthLfRevenue?.toString() ?? ''
    d.responsibleRemarks = inp.responsibleRemarks ?? ''
    setEditData(d)
  }

  function cancelEdit() { setEditingId(null); setEditData({}) }

  function boolVal(v: string): boolean | undefined {
    if (v === 'true') return true
    if (v === 'false') return false
    return undefined
  }

  function floatVal(v: string): number | undefined {
    if (v === '' || v === undefined || v === null) return undefined
    const n = parseFloat(v); return isNaN(n) ? undefined : n
  }

  function intVal(v: string): number | undefined {
    if (v === '' || v === undefined || v === null) return undefined
    const n = parseInt(v, 10); return isNaN(n) ? undefined : n
  }

  function buildUpdateBody(data: Record<string, string>): Record<string, unknown> {
    const body: Record<string, unknown> = {}
    if (data.shopCriteria) body.shopCriteria = data.shopCriteria
    if (data.shopManagerId) body.shopManagerId = data.shopManagerId
    const cb = boolVal(data.corridorStatus); if (cb !== undefined) body.corridorStatus = cb
    const qga = boolVal(data.qgaAbove90); if (qga !== undefined) body.qgaAbove90 = qga
    const qq = intVal(data.qgaQuantity); if (qq !== undefined) body.qgaQuantity = qq
    const mm = boolVal(data.mmQoAbove90); if (mm !== undefined) body.mmQoAbove90 = mm
    const dsa = floatVal(data.dsaAirtimeAchievementPercent); if (dsa !== undefined) body.dsaAirtimeAchievementPercent = dsa
    const evd = boolVal(data.evdAbove100AndReconciled); if (evd !== undefined) body.evdAbove100AndReconciled = evd
    const mpesaTgt = boolVal(data.mpesaTargetAndReconciled); if (mpesaTgt !== undefined) body.mpesaTargetAndReconciled = mpesaTgt
    const mpesaFlt = floatVal(data.mpesaFloatSold); if (mpesaFlt !== undefined) body.mpesaFloatSold = mpesaFlt
    const ba = boolVal(data.baSite); if (ba !== undefined) body.baSite = ba
    const ebuTgt = boolVal(data.ebuTargetAchieved); if (ebuTgt !== undefined) body.ebuTargetAchieved = ebuTgt
    const ebuRev = boolVal(data.ebuRevenueMade); if (ebuRev !== undefined) body.ebuRevenueMade = ebuRev
    const ebuAvg = boolVal(data.ebuAverageTopupAbove500); if (ebuAvg !== undefined) body.ebuAverageTopupAbove500 = ebuAvg
    const ebu1st = floatVal(data.ebuFirstMonthLfRevenue); if (ebu1st !== undefined) body.ebuFirstMonthLfRevenue = ebu1st
    body.responsibleRemarks = data.responsibleRemarks || null
    return body
  }

  async function saveEdit(inp: PerformanceInput) {
    const body = buildUpdateBody(editData)
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inp.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { setEditingId(null); setEditData({}); fetchData() }
      else { const j = await res.json(); alert(j.error || 'Failed to update') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleDelete(inputId: string) {
    if (!confirm('Delete this input?')) return
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs/${inputId}`, { method: 'DELETE' })
      if (res.ok) fetchData()
      else { const j = await res.json(); alert(j.error || 'Failed to delete') }
    } catch { alert('Network error') }
    finally { setActionLoading(false) }
  }

  async function handleAddInput(e: React.FormEvent) {
    e.preventDefault()
    setAddFormError('')
    if (!addFormData.shopLocationId) { setAddFormError('Shop is required'); return }
    const body = buildUpdateBody(addFormData)
    body.shopLocationId = addFormData.shopLocationId
    setActionLoading(true)
    try {
      const res = await fetch(`/api/shop-manager-incentives/periods/${id}/inputs`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      if (res.ok) { setShowAddForm(false); setAddFormData({}); fetchData() }
      else { const j = await res.json(); setAddFormError(j.error || 'Failed to add input') }
    } catch { setAddFormError('Network error') }
    finally { setActionLoading(false) }
  }

  function renderBool(v: boolean | null): string {
    if (v === null) return '-'
    return v ? 'Yes' : 'No'
  }

  function isAtRisk(inp: PerformanceInput) { return inp.shopCriteria === 'AT_RISK' }

  function renderReadinessBadge(inp: PerformanceInput) {
    const info = readinessMap.get(inp.id)
    if (!info) return null
    const color = readinessColors[info.readinessStatus] || '#6b7280'
    const label = readinessLabels[info.readinessStatus] || info.readinessStatus
    const missing = [...info.missingSalesFields, ...info.missingDistributionFields, ...info.missingEbuFields]
    const tooltip = missing.length > 0 ? 'Missing: ' + missing.join(', ') : label
    return (
      <span className="inline-block text-white text-[9px] px-1.5 py-0.5 rounded ml-1" style={{ background: color }} title={tooltip}>
        {label}
      </span>
    )
  }

  function InputField({ field, data, onChange, atRisk }: { field: string; data: Record<string, string>; onChange: (v: string) => void; atRisk: boolean }) {
    const disabled = isFieldDisabled(field, atRisk, permAll, permSales, permDist, permEbu)
    const ht = getHelpText(field, inputConfigs)
    const condReq = isCondRequired(field, data, inputConfigs)
    const val = data[field] || ''
    const isBool = ['corridorStatus', 'qgaAbove90', 'mmQoAbove90', 'evdAbove100AndReconciled', 'mpesaTargetAndReconciled', 'baSite', 'ebuTargetAchieved', 'ebuRevenueMade', 'ebuAverageTopupAbove500'].includes(field)
    const isNumber = ['qgaQuantity', 'dsaAirtimeAchievementPercent', 'mpesaFloatSold', 'ebuFirstMonthLfRevenue'].includes(field)
    const cls = `w-14 border rounded px-1 ${disabled ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : ''} ${condReq ? 'border-orange-400' : ''}`

    if (field === 'shopCriteria') {
      return (
        <select value={data.shopCriteria || ''} onChange={e => onChange(e.target.value)} className="border rounded w-full px-1 py-0.5 text-xs" title={ht || undefined}>
          <option value="">Select...</option>
          <option value="GOLD">Gold</option>
          <option value="SILVER">Silver</option>
          <option value="BRONZE">Bronze</option>
          <option value="AT_RISK">At-Risk</option>
        </select>
      )
    }
    if (field === 'shopManagerId') {
      return (
        <input value={data.shopManagerId || ''} onChange={e => onChange(e.target.value)} className="border rounded w-full px-1 py-0.5 text-xs" placeholder="Manager ID" title={ht || undefined} />
      )
    }
    if (field === 'responsibleRemarks') {
      return (
        <input value={data.responsibleRemarks || ''} onChange={e => onChange(e.target.value)} className="border rounded w-24 px-1 py-0.5 text-xs" title={ht || undefined} />
      )
    }
    if (isBool) {
      return (
        <div className="relative inline-block">
          <select value={val} onChange={e => onChange(e.target.value)} disabled={disabled} className={cls} title={ht || undefined}>
            <option value="">-</option>
            <option value="true">Yes</option>
            <option value="false">No</option>
          </select>
          {condReq && <span className="absolute -top-1 -right-1 text-orange-500 text-[8px]">&#9679;</span>}
        </div>
      )
    }
    if (isNumber) {
      return (
        <div className="relative inline-block">
          <input value={val} onChange={e => onChange(e.target.value)} disabled={disabled} className={cls} title={ht || undefined} />
          {condReq && <span className="absolute -top-1 -right-1 text-orange-500 text-[8px]">&#9679;</span>}
        </div>
      )
    }
    return null
  }

  function renderHeaderLabel(field: string) {
    const ht = getHelpText(field, inputConfigs)
    const label = FIELD_LABELS[field] || field
    const req = isRegRequired(field, inputConfigs)
    return (
      <span title={ht || undefined} style={{ cursor: ht ? 'help' : 'default' }}>
        {label}{req ? <span className="text-red-500">*</span> : null}
      </span>
    )
  }

  if (loading) return <div className="p-6"><p>Loading inputs...</p></div>
  if (error) return <div className="p-6"><p className="text-red-600">{error}<button onClick={fetchData} className="text-blue-600 underline ml-2">Retry</button></p></div>

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <div>
          <h1 className="text-2xl font-bold">Performance Inputs</h1>
          <button onClick={() => router.push(`/shop-manager-incentives/${id}`)} className="text-blue-600 text-sm underline">Back to Period</button>
        </div>
        <button onClick={() => setShowAddForm(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm">+ Add Input</button>
      </div>

      {showAddForm && (
        <div className="border rounded p-4 mb-4 bg-gray-50">
          <h3 className="font-semibold mb-2">Add New Input</h3>
          {addFormError && <p className="text-red-500 text-sm mb-2">{addFormError}</p>}
          <form onSubmit={handleAddInput} className="space-y-2 text-sm">
            <div className="grid grid-cols-4 gap-2">
              <select value={addFormData.shopLocationId || ''} onChange={e => setAddFormData(f => ({ ...f, shopLocationId: e.target.value }))} className="border rounded px-2 py-1">
                <option value="">Select Shop...</option>
                {shops.map(s => (
                  <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                ))}
              </select>
              <select value={addFormData.shopCriteria || ''} onChange={e => setAddFormData(f => ({ ...f, shopCriteria: e.target.value }))} className="border rounded px-2 py-1">
                <option value="">Criteria</option>
                <option value="GOLD">Gold</option>
                <option value="SILVER">Silver</option>
                <option value="BRONZE">Bronze</option>
                <option value="AT_RISK">At-Risk</option>
              </select>
              <input placeholder="Manager ID" value={addFormData.shopManagerId || ''} onChange={e => setAddFormData(f => ({ ...f, shopManagerId: e.target.value }))} className="border rounded px-2 py-1" />
              <input placeholder="Remarks" value={addFormData.responsibleRemarks || ''} onChange={e => setAddFormData(f => ({ ...f, responsibleRemarks: e.target.value }))} className="border rounded px-2 py-1" />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={actionLoading} className="bg-green-600 text-white px-3 py-1 rounded disabled:opacity-50">Save</button>
              <button type="button" onClick={() => { setShowAddForm(false); setAddFormError('') }} className="px-3 py-1 border rounded">Cancel</button>
            </div>
          </form>
        </div>
      )}

      {inputs.length === 0 ? <p className="text-gray-400 text-center mt-4">No inputs found.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border text-xs">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-1 text-left" rowSpan={2}>No</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop / Cluster</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop Manager Name</th>
                <th className="border p-1 text-left" rowSpan={2}>Shop Criteria</th>
                <th className="border p-1 text-center bg-blue-50" colSpan={4}>
                  Sales Head Inputs&nbsp;
                  {!permAll && !permSales && <span className="text-gray-400 text-[9px]">(disabled)</span>}
                  {permAll && <span className="text-green-600 text-[9px]">&#10003;</span>}
                </th>
                <th className="border p-1 text-center bg-green-50" colSpan={5}>
                  Distribution Head Inputs&nbsp;
                  {!permAll && !permDist && <span className="text-gray-400 text-[9px]">(disabled)</span>}
                  {permAll && <span className="text-green-600 text-[9px]">&#10003;</span>}
                </th>
                <th className="border p-1 text-center bg-yellow-50" colSpan={4}>
                  EBU Head Inputs&nbsp;
                  {!permAll && !permEbu && <span className="text-gray-400 text-[9px]">(disabled)</span>}
                  {permAll && <span className="text-green-600 text-[9px]">&#10003;</span>}
                </th>
                <th className="border p-1 text-left" rowSpan={2}>Responsible Remarks</th>
                <th className="border p-1 text-left" rowSpan={2}>Actions</th>
              </tr>
              <tr className="bg-gray-50">
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('qgaAbove90')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('qgaQuantity')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('mmQoAbove90')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('dsaAirtimeAchievementPercent')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('corridorStatus')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('evdAbove100AndReconciled')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('mpesaTargetAndReconciled')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('mpesaFloatSold')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('baSite')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('ebuTargetAchieved')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('ebuRevenueMade')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('ebuAverageTopupAbove500')}</th>
                <th className="border p-1 text-left text-[10px]">{renderHeaderLabel('ebuFirstMonthLfRevenue')}</th>
              </tr>
            </thead>
            <tbody>
              {inputs.map((inp, idx) => {
                const atRisk = isAtRisk(inp)
                const info = readinessMap.get(inp.id)
                const missingFields = info ? [...info.missingSalesFields, ...info.missingDistributionFields, ...info.missingEbuFields] : []

                return (
                  <tr key={inp.id} className={`hover:bg-gray-50 ${atRisk ? 'bg-gray-100 text-gray-400' : ''}`}>
                    <td className="border p-1">{idx + 1}</td>
                    <td className="border p-1 font-mono">{inp.shopLocation?.code || '-'}<br /><span className="text-gray-400">{inp.shopLocation?.name || ''}</span></td>
                    <td className="border p-1">{inp.shopManager?.fullName || '-'}</td>
                    <td className="border p-1">
                      <span style={{ color: atRisk ? '#ef4444' : '#000' }} className="font-semibold">{inp.shopCriteria || '-'}</span>
                      {renderReadinessBadge(inp)}
                      {atRisk && <div className="text-red-500 text-[10px] mt-1">At-risk: all incentive components are zero.</div>}
                    </td>
                    {editingId === inp.id ? (
                      <>
                        <td className="border p-1"><InputField field="qgaAbove90" data={editData} onChange={v => setEditData(f => ({ ...f, qgaAbove90: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="qgaQuantity" data={editData} onChange={v => setEditData(f => ({ ...f, qgaQuantity: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="mmQoAbove90" data={editData} onChange={v => setEditData(f => ({ ...f, mmQoAbove90: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="dsaAirtimeAchievementPercent" data={editData} onChange={v => setEditData(f => ({ ...f, dsaAirtimeAchievementPercent: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="corridorStatus" data={editData} onChange={v => setEditData(f => ({ ...f, corridorStatus: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="evdAbove100AndReconciled" data={editData} onChange={v => setEditData(f => ({ ...f, evdAbove100AndReconciled: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="mpesaTargetAndReconciled" data={editData} onChange={v => setEditData(f => ({ ...f, mpesaTargetAndReconciled: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="mpesaFloatSold" data={editData} onChange={v => setEditData(f => ({ ...f, mpesaFloatSold: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="baSite" data={editData} onChange={v => setEditData(f => ({ ...f, baSite: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="ebuTargetAchieved" data={editData} onChange={v => setEditData(f => ({ ...f, ebuTargetAchieved: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="ebuRevenueMade" data={editData} onChange={v => setEditData(f => ({ ...f, ebuRevenueMade: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="ebuAverageTopupAbove500" data={editData} onChange={v => setEditData(f => ({ ...f, ebuAverageTopupAbove500: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="ebuFirstMonthLfRevenue" data={editData} onChange={v => setEditData(f => ({ ...f, ebuFirstMonthLfRevenue: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1"><InputField field="responsibleRemarks" data={editData} onChange={v => setEditData(f => ({ ...f, responsibleRemarks: v }))} atRisk={atRisk} /></td>
                        <td className="border p-1">
                          <div className="flex gap-1">
                            <button onClick={() => saveEdit(inp)} disabled={actionLoading} className="text-green-600 text-xs underline">Save</button>
                            <button onClick={cancelEdit} className="text-gray-500 text-xs underline">Cancel</button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="border p-1">
                          {renderBool(inp.qgaAbove90)}
                          {missingFields.includes('qgaAbove90') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {inp.qgaQuantity ?? '-'}
                          {missingFields.includes('qgaQuantity') && <span className="text-orange-500 ml-0.5" title="Required when QGA is Yes">&#9679;</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.mmQoAbove90)}
                          {missingFields.includes('mmQoAbove90') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {inp.dsaAirtimeAchievementPercent ?? '-'}
                          {missingFields.includes('dsaAirtimeAchievementPercent') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.corridorStatus)}
                          {missingFields.includes('corridorStatus') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.evdAbove100AndReconciled)}
                          {missingFields.includes('evdAbove100AndReconciled') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.mpesaTargetAndReconciled)}
                          {missingFields.includes('mpesaTargetAndReconciled') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {inp.mpesaFloatSold ?? '-'}
                          {missingFields.includes('mpesaFloatSold') && <span className="text-orange-500 ml-0.5" title="Required when M-PESA Tgt is Yes">&#9679;</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.baSite)}
                          {missingFields.includes('baSite') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.ebuTargetAchieved)}
                          {missingFields.includes('ebuTargetAchieved') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.ebuRevenueMade)}
                          {missingFields.includes('ebuRevenueMade') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {renderBool(inp.ebuAverageTopupAbove500)}
                          {missingFields.includes('ebuAverageTopupAbove500') && <span className="text-red-400 ml-0.5" title="Required">*</span>}
                        </td>
                        <td className="border p-1">
                          {inp.ebuFirstMonthLfRevenue ?? '-'}
                          {missingFields.includes('ebuFirstMonthLfRevenue') && <span className="text-orange-500 ml-0.5" title="Required when EBU Rev is Yes">&#9679;</span>}
                        </td>
                        <td className="border p-1 max-w-[100px] truncate">{inp.responsibleRemarks || '-'}</td>
                        <td className="border p-1">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(inp)} disabled={actionLoading} className="text-blue-600 text-xs underline">Edit</button>
                            <button onClick={() => handleDelete(inp.id)} disabled={actionLoading} className="text-red-600 text-xs underline">Delete</button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
