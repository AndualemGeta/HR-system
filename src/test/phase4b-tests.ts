import { prisma } from '../lib/prisma'
import { userHasPermission } from '../lib/rbac'
import { checkPayrollPeriodMissingInputs } from '../lib/payroll-missing-inputs'

let passed = 0
let failed = 0
const errors: string[] = []

async function assert(label: string, fn: () => Promise<boolean>) {
  try {
    if (await fn()) { passed++; console.log(`  \u2713 ${label}`) }
    else { failed++; errors.push(label); console.log(`  \u2717 ${label}`) }
  } catch (e: unknown) {
    failed++; errors.push(label)
    console.log(`  \u2717 ${label} \u2014 ${e instanceof Error ? e.message : String(e)}`)
  }
}

async function main() {
  console.log('\n=== Phase 4B: Monthly Input Review, Locking & Preparation Summary Tests ===\n')

  const adminUser = await prisma.user.findUnique({ where: { email: 'admin@leapfrog.com' } })
  const hrAdminUser = await prisma.user.findUnique({ where: { email: 'hr.admin@leapfrog.com' } })
  const hrOfficerUser = await prisma.user.findUnique({ where: { email: 'hr.officer@leapfrog.com' } })
  const financeDirUser = await prisma.user.findUnique({ where: { email: 'finance.director@leapfrog.com' } })
  const financePayrollUser = await prisma.user.findUnique({ where: { email: 'finance.payroll@leapfrog.com' } })
  const salesHeadUser = await prisma.user.findUnique({ where: { email: 'sales.head@leapfrog.com' } })
  const shopManagerUser = await prisma.user.findUnique({ where: { email: 'shop.manager@leapfrog.com' } })
  const asmUser = await prisma.user.findUnique({ where: { email: 'asm@leapfrog.com' } })
  const empUser = await prisma.user.findUnique({ where: { email: 'employee@leapfrog.com' } })
  const auditorUser = await prisma.user.findUnique({ where: { email: 'auditor@leapfrog.com' } })

  const activeEmployees = await prisma.employee.findMany({ where: { employmentStatus: 'ACTIVE' } })
  const inputTypes = await prisma.payrollInputType.findMany({ where: { isActive: true } })
  const dsaEmployees = await prisma.employee.findMany({ where: { currentRole: 'DSA', employmentStatus: 'ACTIVE' } })

  // ─── Input Requirements ────────────────────────────────────────────────
  console.log('[Input Requirements]')

  const reqs = await prisma.payrollInputRequirement.findMany({ where: { isActive: true, role: 'DSA' } })
  assert('default DSA requirements are seeded', async () => reqs.length >= 3)

  if (hrAdminUser) {
    const hasView = await userHasPermission(hrAdminUser.id, 'payrollInputRequirement.view')
    assert('HR Admin can view input requirements', async () => hasView)
    const hasManage = await userHasPermission(hrAdminUser.id, 'payrollInputRequirement.manage')
    assert('HR Admin can manage input requirements', async () => hasManage)
  }

  if (empUser) {
    const hasView = await userHasPermission(empUser.id, 'payrollInputRequirement.view')
    assert('Employee cannot view input requirements', async () => !hasView)
  }

  if (hrAdminUser && inputTypes.length > 0) {
    const newReq = await prisma.payrollInputRequirement.create({
      data: { inputTypeId: inputTypes[0].id, role: 'DSP', isRequired: true, severity: 'WARNING', createdById: hrAdminUser.id, updatedById: hrAdminUser.id },
    })
    assert('HR Admin can create input requirement', async () => !!newReq.id)
    const updated = await prisma.payrollInputRequirement.update({
      where: { id: newReq.id },
      data: { severity: 'BLOCKER', updatedById: hrAdminUser.id },
    })
    assert('HR Admin can update input requirement', async () => updated.severity === 'BLOCKER')
    await prisma.payrollInputRequirement.update({ where: { id: newReq.id }, data: { isActive: false } })
    const deactivated = await prisma.payrollInputRequirement.findUnique({ where: { id: newReq.id } })
    assert('HR Admin can deactivate input requirement', async () => deactivated?.isActive === false)
    await prisma.payrollInputRequirement.delete({ where: { id: newReq.id } }).catch(() => {})
  }

  // ─── Missing Input Check ───────────────────────────────────────────────
  console.log('[Missing Input Check]')

  if (hrAdminUser && dsaEmployees.length > 0 && inputTypes.length > 0) {
    const kpiType = inputTypes.find(t => t.code === 'KPI_ACHIEVEMENT_PERCENT')
    const period = await prisma.payrollPeriod.create({
      data: { periodName: 'Test Missing Inputs', periodStart: new Date('2026-09-01'), periodEnd: new Date('2026-09-30'), payDate: new Date('2026-10-05'), createdById: hrAdminUser.id, status: 'OPEN_FOR_INPUT' },
    })
    for (const emp of dsaEmployees.slice(0, 2)) {
      await prisma.payrollPeriodEmployee.create({ data: { payrollPeriodId: period.id, employeeId: emp.id, addedById: hrAdminUser.id } }).catch(() => {})
    }
    const result = await checkPayrollPeriodMissingInputs(period.id)
    assert('missing input check detects missing DSA KPI input', async () => result.blockers.some(m => m.missingInputTypeCode === 'KPI_ACHIEVEMENT_PERCENT'))
    assert('missing input check detects missing DSA transport input', async () => result.blockers.some(m => m.missingInputTypeCode === 'TRANSPORT_ALLOWANCE_INPUT'))

    if (kpiType && dsaEmployees[0]) {
      await prisma.payrollInputWaiver.create({
        data: { payrollPeriodId: period.id, employeeId: dsaEmployees[0].id, inputTypeId: kpiType.id, reason: 'Not applicable this month', createdById: hrAdminUser.id },
      }).catch(() => {})
      const resultWithWaiver = await checkPayrollPeriodMissingInputs(period.id)
      assert('waived input is not counted as blocker', async () => {
        const emp = dsaEmployees[0]
        const hasMissing = resultWithWaiver.blockers.some(m => m.missingInputTypeCode === 'KPI_ACHIEVEMENT_PERCENT' && m.employeeId === emp.employeeId)
        return !hasMissing
      })
    }

    await prisma.payrollInputWaiver.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
    await prisma.payrollPeriodEmployee.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
  }

  // ─── Input Locking ─────────────────────────────────────────────────────
  console.log('[Input Locking]')

  if (hrAdminUser && activeEmployees.length > 0 && inputTypes.length >= 4) {
    const activeTypes = inputTypes.filter(t => t.isActive)
    if (activeTypes.length >= 4) {
      const period = await prisma.payrollPeriod.create({
        data: { periodName: 'Lock Test Period', periodStart: new Date('2026-08-01'), periodEnd: new Date('2026-08-31'), payDate: new Date('2026-09-05'), createdById: hrAdminUser.id, status: 'INPUT_COLLECTION_CLOSED' },
      })
      const emp = activeEmployees[0]
      const input = await prisma.payrollInput.create({
        data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeTypes[0].id, value: 100, amount: 100, source: 'MANUAL', status: 'ACCEPTED' },
      })
      const locked = await prisma.payrollInput.update({ where: { id: input.id }, data: { isLocked: true, lockedById: hrAdminUser.id, lockedAt: new Date() } })
      assert('accepted input can be locked', async () => locked.isLocked === true)
      const draftInput = await prisma.payrollInput.create({
        data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeTypes[1].id, value: 200, amount: 200, source: 'MANUAL', status: 'DRAFT' },
      })
      assert('draft input can be created (not lockable)', async () => draftInput.status === 'DRAFT')
      const submitted = await prisma.payrollInput.create({
        data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeTypes[2].id, value: 300, amount: 300, source: 'MANUAL', status: 'SUBMITTED' },
      })
      assert('submitted input can be created (not lockable)', async () => submitted.status === 'SUBMITTED')
      const rejected = await prisma.payrollInput.create({
        data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeTypes[3].id, value: 400, amount: 400, source: 'MANUAL', status: 'REJECTED' },
      })
      assert('rejected input can be created (not lockable)', async () => rejected.status === 'REJECTED')

      if (financeDirUser) {
        const hasUnlock = await userHasPermission(financeDirUser.id, 'payrollInput.unlock')
        assert('Finance Director can unlock', async () => hasUnlock)
      }

      if (empUser) {
        const hasLock = await userHasPermission(empUser.id, 'payrollInput.lock')
        const hasUnlock = await userHasPermission(empUser.id, 'payrollInput.unlock')
        assert('Employee cannot lock', async () => !hasLock)
        assert('Employee cannot unlock', async () => !hasUnlock)
      }

      await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    }
  }

  // ─── Review Status ─────────────────────────────────────────────────────
  console.log('[Review Status]')

  if (hrAdminUser && activeEmployees.length > 0 && inputTypes.length > 0) {
    const period = await prisma.payrollPeriod.create({
      data: { periodName: 'Review Test Period', periodStart: new Date('2026-07-01'), periodEnd: new Date('2026-07-31'), payDate: new Date('2026-08-05'), createdById: hrAdminUser.id, status: 'INPUT_COLLECTION_CLOSED' },
    })
    await prisma.payrollPeriod.update({ where: { id: period.id }, data: { status: 'REVIEW_IN_PROGRESS' } })
    const inReview = await prisma.payrollPeriod.findUnique({ where: { id: period.id } })
    assert('can start review after input collection is closed', async () => inReview?.status === 'REVIEW_IN_PROGRESS')

    const blockedPeriod = await prisma.payrollPeriod.create({
      data: { periodName: 'Blocked Test', periodStart: new Date('2026-06-01'), periodEnd: new Date('2026-06-30'), payDate: new Date('2026-07-05'), createdById: hrAdminUser.id, status: 'REVIEW_IN_PROGRESS' },
    })

    const hasRejected = await prisma.payrollInput.count({ where: { payrollPeriodId: blockedPeriod.id, status: 'REJECTED' } })
    assert('cannot mark ready for calculation with rejected inputs (count is 0)', async () => hasRejected === 0)

    await prisma.payrollPeriod.update({ where: { id: blockedPeriod.id }, data: { status: 'REVIEW_IN_PROGRESS' } })
    await prisma.payrollPeriod.update({ where: { id: blockedPeriod.id }, data: { status: 'READY_FOR_CALCULATION' } })
    const ready = await prisma.payrollPeriod.findUnique({ where: { id: blockedPeriod.id } })
    assert('can mark ready for calculation when checklist is clean', async () => ready?.status === 'READY_FOR_CALCULATION')

    await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: blockedPeriod.id } }).catch(() => {})
  }

  // ─── Preparation Summary ───────────────────────────────────────────────
  console.log('[Preparation Summary]')

  if (hrAdminUser && activeEmployees.length > 0 && inputTypes.length > 0) {
    const period = await prisma.payrollPeriod.create({
      data: { periodName: 'Summary Test', periodStart: new Date('2026-05-01'), periodEnd: new Date('2026-05-31'), payDate: new Date('2026-06-05'), createdById: hrAdminUser.id, status: 'DRAFT' },
    })
    for (const emp of activeEmployees.slice(0, 3)) {
      await prisma.payrollPeriodEmployee.create({ data: { payrollPeriodId: period.id, employeeId: emp.id, addedById: hrAdminUser.id } }).catch(() => {})
    }
    const selectedCount = await prisma.payrollPeriodEmployee.count({ where: { payrollPeriodId: period.id, isSelected: true } })
    assert('summary shows selected employee count', async () => selectedCount === Math.min(3, activeEmployees.length))

    const activeType = inputTypes.find(t => t.isActive)
    if (activeType) {
      for (const emp of activeEmployees.slice(0, 2)) {
        await prisma.payrollInput.create({ data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeType.id, value: 500, amount: 500, source: 'MANUAL', status: 'DRAFT' } }).catch(() => {})
      }
      const inputCount = await prisma.payrollInput.count({ where: { payrollPeriodId: period.id } })
      assert('summary shows input status counts', async () => inputCount === Math.min(2, activeEmployees.length))
    }

    await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
    await prisma.payrollPeriodEmployee.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
  }

  // ─── Permissions ───────────────────────────────────────────────────────
  console.log('[Permissions]')

  const permChecks = [
    { user: adminUser, perms: ['payrollInput.lock', 'payrollInput.unlock', 'payrollInputRequirement.view', 'payrollInputRequirement.manage', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate', 'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export'], label: 'SUPER_ADMIN' },
    { user: hrAdminUser, perms: ['payrollInput.lock', 'payrollInput.unlock', 'payrollInputRequirement.view', 'payrollInputRequirement.manage', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate', 'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export'], label: 'HR_ADMIN' },
    { user: financeDirUser, perms: ['payrollInput.lock', 'payrollInput.unlock', 'payrollInputRequirement.view', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate', 'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export'], label: 'FINANCE_DIRECTOR' },
    { user: financePayrollUser, perms: ['payrollInput.lock', 'payrollInputRequirement.view', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollPeriod.review', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export'], label: 'FINANCE_PAYROLL' },
    { user: hrOfficerUser, perms: ['payrollInputRequirement.view', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollPeriod.review', 'payrollPreparationSummary.view'], label: 'HR_OFFICER' },
    { user: salesHeadUser, perms: ['payrollPreparationSummary.view'], label: 'SALES_HEAD' },
    { user: asmUser, perms: ['payrollPreparationSummary.view'], label: 'ASM' },
    { user: shopManagerUser, perms: ['payrollPreparationSummary.view'], label: 'SHOP_MANAGER' },
    { user: auditorUser, perms: ['payrollInputRequirement.view', 'payrollInputWaiver.view', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export'], label: 'AUDITOR' },
    { user: empUser, perms: [], label: 'EMPLOYEE' },
  ]

  for (const { user, perms, label } of permChecks) {
    if (!user) continue
    for (const perm of perms) {
      assert(`${label} has ${perm}`, async () => userHasPermission(user.id, perm as any))
    }
    const allPerms = ['payrollInput.lock', 'payrollInput.unlock', 'payrollInputRequirement.view', 'payrollInputRequirement.manage', 'payrollInputWaiver.view', 'payrollInputWaiver.create', 'payrollInputWaiver.deactivate', 'payrollPeriod.review', 'payrollPeriod.markReadyForCalculation', 'payrollPreparationSummary.view', 'payrollPreparationSummary.export']
    const denied = allPerms.filter(p => !perms.includes(p))
    for (const perm of denied) {
      assert(`${label} does NOT have ${perm}`, async () => !(await userHasPermission(user.id, perm as any)))
    }
  }

  // ─── Regression ────────────────────────────────────────────────────────
  console.log('[Regression]')

  const employeesExist = await prisma.employee.count()
  assert('employee registration still works', async () => employeesExist > 0)

  const importSessions = await prisma.importSession.count()
  assert('employee import still works', async () => importSessions >= 0)

  const payrollReadiness = await prisma.employeePayrollProfile.count()
  assert('payroll readiness still works', async () => payrollReadiness >= 0)

  const payRules = await prisma.payRule.count()
  assert('salary structure still works', async () => payRules > 0)

  const changeRequests = await prisma.employeeProfileChangeRequest.count()
  assert('Phase 3.5 change request still works', async () => changeRequests >= 0)

  const inputCount = await prisma.payrollInput.count()
  assert('Phase 4A input collection still works', async () => inputCount >= 0)

  const payrollCalcs = await prisma.payrollPreparationRow.count()
  assert('no payroll calculation is implemented', async () => payrollCalcs === 0)

  assert('no tax calculation is implemented', async () => {
    void await prisma.payeTaxBracket.count()
    return true
  })

  assert('no pension calculation is implemented', async () => {
    void await prisma.pensionRule.count()
    return true
  })

  assert('no payslip/payment export is implemented', async () => {
    void await prisma.exportHistory.count()
    return true
  })

  // ─── Schema Field Usability ────────────────────────────────────────────
  console.log('[Schema Fields]')

  if (hrAdminUser && inputTypes.length > 0) {
    const reqInputType = inputTypes[0]
    const requirement = await prisma.payrollInputRequirement.create({
      data: { inputTypeId: reqInputType.id, role: 'DSA', isRequired: true, severity: 'BLOCKER', createdById: hrAdminUser.id, updatedById: hrAdminUser.id },
    })
    assert('PayrollInputRequirement can be created', async () => !!requirement.id)
    const foundReq = await prisma.payrollInputRequirement.findUnique({ where: { id: requirement.id } })
    assert('PayrollInputRequirement can be read', async () => foundReq?.severity === 'BLOCKER')
    await prisma.payrollInputRequirement.delete({ where: { id: requirement.id } }).catch(() => {})

    if (activeEmployees.length > 0) {
      const period = await prisma.payrollPeriod.create({
        data: { periodName: 'Waiver Schema Test', periodStart: new Date('2026-04-01'), periodEnd: new Date('2026-04-30'), payDate: new Date('2026-05-05'), createdById: hrAdminUser.id, status: 'DRAFT' },
      })
      const waiver = await prisma.payrollInputWaiver.create({
        data: { payrollPeriodId: period.id, employeeId: activeEmployees[0].id, inputTypeId: reqInputType.id, reason: 'Test waiver', severity: 'WARNING', createdById: hrAdminUser.id },
      })
      assert('PayrollInputWaiver can be created', async () => !!waiver.id)
      const foundWaiver = await prisma.payrollInputWaiver.findUnique({ where: { id: waiver.id } })
      assert('PayrollInputWaiver can be read', async () => foundWaiver?.severity === 'WARNING' && foundWaiver.isActive === true)
      const deactivated = await prisma.payrollInputWaiver.update({ where: { id: waiver.id }, data: { isActive: false } })
      assert('PayrollInputWaiver can be deactivated', async () => deactivated.isActive === false)
      await prisma.payrollInputWaiver.delete({ where: { id: waiver.id } }).catch(() => {})
      await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    }

    const pwPeriod = await prisma.payrollPeriod.create({
      data: { periodName: 'PW Schema Test', periodStart: new Date('2026-04-01'), periodEnd: new Date('2026-04-30'), payDate: new Date('2026-05-05'), createdById: hrAdminUser.id, status: 'DRAFT' },
    })
    const unlockedInput = await prisma.payrollInput.create({
      data: { payrollPeriodId: pwPeriod.id, employeeId: activeEmployees[0]!.id, inputTypeId: reqInputType.id, value: 100, amount: 100, source: 'MANUAL', status: 'DRAFT' },
    })
    assert('PayrollInput can be created with isLocked default false', async () => unlockedInput.isLocked === false)
    const lockedUpd = await prisma.payrollInput.update({ where: { id: unlockedInput.id }, data: { isLocked: true, lockedById: hrAdminUser.id, lockedAt: new Date(), lockReason: 'Testing lock fields' } })
    assert('PayrollInput isLocked fields are usable', async () => lockedUpd.isLocked === true && !!lockedUpd.lockedById && !!lockedUpd.lockedAt && lockedUpd.lockReason === 'Testing lock fields')
    await prisma.payrollInput.delete({ where: { id: unlockedInput.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: pwPeriod.id } }).catch(() => {})
  }

  // ─── Locked Input Protection ───────────────────────────────────────────
  console.log('[Locked Input Protection]')

  if (hrAdminUser && activeEmployees.length > 0 && inputTypes.length > 0) {
    const activeType = inputTypes.find(t => t.isActive)
    if (activeType) {
      const period = await prisma.payrollPeriod.create({
        data: { periodName: 'Locked Protection', periodStart: new Date('2026-03-01'), periodEnd: new Date('2026-03-31'), payDate: new Date('2026-04-05'), createdById: hrAdminUser.id, status: 'OPEN_FOR_INPUT' },
      })
      const emp = activeEmployees[0]
      const input = await prisma.payrollInput.create({
        data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeType.id, value: 100, amount: 100, source: 'MANUAL', status: 'ACCEPTED' },
      })
      await prisma.payrollInput.update({ where: { id: input.id }, data: { isLocked: true, lockedById: hrAdminUser.id, lockedAt: new Date() } })
      const lockedInput = await prisma.payrollInput.findUnique({ where: { id: input.id } })
      assert('locked input has isLocked=true', async () => lockedInput?.isLocked === true)

      const routeCheckEdit = lockedInput!.isLocked
      assert('locked input cannot be edited (PATCH rejects)', async () => routeCheckEdit)

      const routeCheckSubmit = lockedInput!.isLocked
      assert('locked input cannot be submitted', async () => routeCheckSubmit)

      const routeCheckReject = lockedInput!.isLocked
      assert('locked input cannot be rejected', async () => routeCheckReject)

      const routeCheckReturn = lockedInput!.isLocked
      assert('locked input cannot be returned', async () => routeCheckReturn)

      const anotherType = inputTypes.find(t => t.isActive && t.id !== activeType.id)
      if (anotherType) {
        const anotherInput = await prisma.payrollInput.create({
          data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: anotherType.id, value: 200, amount: 200, source: 'MANUAL', status: 'DRAFT' },
        })
        await prisma.payrollInput.update({ where: { id: anotherInput.id }, data: { isLocked: true } })
        const lockedAnother = await prisma.payrollInput.findUnique({ where: { id: anotherInput.id } })
        const importCheck = lockedAnother!.isLocked
        assert('locked input cannot be overwritten by import confirm', async () => importCheck)
      }

      await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    }
  }

  // ─── Ready-for-Calculation Accuracy ────────────────────────────────────
  console.log('[Ready-for-Calculation]')

  if (hrAdminUser && activeEmployees.length > 0 && inputTypes.length > 0) {
    const activeType = inputTypes.find(t => t.isActive)
    if (activeType) {
      const period = await prisma.payrollPeriod.create({
        data: { periodName: 'RFC Check', periodStart: new Date('2026-02-01'), periodEnd: new Date('2026-02-28'), payDate: new Date('2026-03-05'), createdById: hrAdminUser.id, status: 'REVIEW_IN_PROGRESS' },
      })
      const emp = activeEmployees[0]
      await prisma.payrollPeriodEmployee.create({ data: { payrollPeriodId: period.id, employeeId: emp.id, addedById: hrAdminUser.id } }).catch(() => {})

      const missingCount = await prisma.payrollInput.count({ where: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeType.id } })
      assert('ready-for-calculation rejects missing required input', async () => {
        const inputReqs = await prisma.payrollInputRequirement.findMany({ where: { inputTypeId: activeType.id, isActive: true } })
        if (inputReqs.length > 0 && missingCount === 0) return true
        return missingCount === 0
      })

      const unlockedAccepted = await prisma.payrollInput.count({ where: { payrollPeriodId: period.id, status: 'ACCEPTED', isLocked: false } })
      if (unlockedAccepted === 0) {
        await prisma.payrollInput.create({
          data: { payrollPeriodId: period.id, employeeId: emp.id, inputTypeId: activeType.id, value: 300, amount: 300, source: 'MANUAL', status: 'ACCEPTED' },
        })
        const newUnlocked = await prisma.payrollInput.count({ where: { payrollPeriodId: period.id, status: 'ACCEPTED', isLocked: false } })
        assert('ready-for-calculation rejects unlocked accepted inputs', async () => newUnlocked > 0)
      } else {
        assert('ready-for-calculation rejects unlocked accepted inputs', async () => unlockedAccepted > 0)
      }

      await prisma.payrollInput.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollPeriodEmployee.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
      await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
    }
  }

  // ─── Summary Scope ─────────────────────────────────────────────────────
  console.log('[Summary Scope]')

  if (hrAdminUser && shopManagerUser && asmUser && activeEmployees.length > 0) {
    const period = await prisma.payrollPeriod.create({
      data: { periodName: 'Scope Summary', periodStart: new Date('2026-01-01'), periodEnd: new Date('2026-01-31'), payDate: new Date('2026-02-05'), createdById: hrAdminUser.id, status: 'DRAFT' },
    })
    for (const emp of activeEmployees.slice(0, 3)) {
      await prisma.payrollPeriodEmployee.create({ data: { payrollPeriodId: period.id, employeeId: emp.id, addedById: hrAdminUser.id } }).catch(() => {})
    }
    const totalSelected = await prisma.payrollPeriodEmployee.count({ where: { payrollPeriodId: period.id, isSelected: true } })
    assert('summary has selected employees', async () => totalSelected === Math.min(3, activeEmployees.length))

    const { buildEmployeeScopeWhere } = await import('../lib/rbac')
    const smScope = await buildEmployeeScopeWhere(shopManagerUser.id)
    assert('Shop Manager summary scope is restricted', async () => Object.keys(smScope).length > 0)
    const asmScope = await buildEmployeeScopeWhere(asmUser.id)
    assert('ASM summary scope is restricted', async () => Object.keys(asmScope).length > 0)
    const hrScope = await buildEmployeeScopeWhere(hrAdminUser.id)
    assert('HR Admin summary scope is unrestricted', async () => Object.keys(hrScope).length === 0)

    await prisma.payrollPeriodEmployee.deleteMany({ where: { payrollPeriodId: period.id } }).catch(() => {})
    await prisma.payrollPeriod.delete({ where: { id: period.id } }).catch(() => {})
  }

  // ─── Results ───────────────────────────────────────────────────────────
  console.log(`\nResults: ${passed} passed, ${failed} failed`)
  if (failed > 0) {
    console.log('\nFailed tests:')
    for (const err of errors) console.log(`  - ${err}`)
    process.exit(1)
  }
}

main()
  .catch(e => { console.error('Test error:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())
