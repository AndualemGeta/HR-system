import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getNavGroupsForPrincipal } from "../components/layout/nav";
import { formatEmployeeId, isValidEmployeeId, nextEmployeeId, parseEmployeeSequence } from "../lib/employee-id";
import { defaultLevelForRole, normalizeEmploymentType, normalizeRole } from "../lib/import/normalize";
import { detectImportTargetField, validateImportRows } from "../lib/import/validator";
import { canEvaluateEmployee, canUpdateSalary, canViewEmployee, canViewSalary, hasPermission, type Principal } from "../lib/rbac";
import { validateEmployeeLifecycle, validateStatusTransition } from "../lib/validation";
import { canCreateAchievementFor, canViewDocument } from "../lib/phase2-access";
import { calculateInclusiveDays } from "../lib/phase2-utils";
import { canApproveLifecycleRecord, canCreateLifecycleRecord, canUpdateFinalPayment } from "../lib/phase3-access";
import {
  validateApprovalWorkflowActivation,
  validateDisciplinarySubmission,
  validateExitCompletion,
  validatePromotionApproval,
  validateTerminationApproval,
  validateTransferApproval
} from "../lib/phase3-validation";
import { buildPayrollRow, summarizePayrollRows } from "../lib/payroll-readiness";
import { canExportPayroll, canViewDataQualityIssue, canViewKpiForEmployee, canViewPayrollPreparation } from "../lib/phase4-access";
import { calculateCommission, calculatePayroll, calculateProratedBasicSalary, calculatePayeTax } from "../lib/payroll-calculation";
import { detectPayrollImportField, mapPayrollImportHeaders } from "../lib/payroll-import";
import { isApprovedEffectivePayrollRule, payrollRuleSetupIssues } from "../lib/payroll-rule-governance";
import { canViewRestrictedCompensation, canViewSalaryReviewForEmployee } from "../lib/phase45-access";
import {
  payeBracketsOverlap,
  salaryReviewChange,
  validateAllowance,
  validateAttendanceInput,
  validateCommissionCalculation,
  validateCommissionPlan,
  validateDeduction,
  validatePayeBracket,
  validatePensionRule,
  validateSalaryReview
} from "../lib/phase45-validation";
import {
  calculateAchievementPercent,
  ratingFromAchievement,
  reminderComputedStatus,
  validateGovernanceSettings,
  validateKpiResult,
  validatePayrollPeriod,
  validateProfileChangeField
} from "../lib/phase4-validation";
import {
  documentCompliancePercentage,
  missingRequiredDocuments,
  requiredDocumentDataQualityIssues,
  requiredDocumentsForEmployee
} from "../lib/required-document-rules";
import {
  calculateLeaveClosingBalance,
  hashIntegrationToken,
  isPayrollPeriodLocked,
  previewAttendanceImport,
  templateUsesRestrictedFields,
  validateEmailTemplate,
  validateIntegrationToken,
  validateKpiWeights,
  validateLeaveBalance,
  validateLeavePolicy,
  validatePayrollAdjustment,
  validatePayrollExportTemplate,
  validateRetentionPolicy,
  validateUnlockRequest
} from "../lib/phase5-validation";
import { canManageIntegrationTokens, canManagePayrollLock, canViewLeaveBalanceForEmployee, canViewManagerDashboard } from "../lib/phase5-access";
import { filterEmployeeIdLinkedRecords, filterEmployeeLinkedRecords, type EmployeeScopeRecord } from "../lib/scope";

type TestCase = {
  name: string;
  run: () => void;
};

function navHrefsFor(principal: Principal): Set<string> {
  return new Set(getNavGroupsForPrincipal(principal).flatMap((group) => group.items.map((item) => item.href)));
}

const tests: TestCase[] = [
  {
    name: "formats employee IDs with global LSTA sequence",
    run: () => {
      assert.equal(formatEmployeeId(1), "LSTA_0001");
      assert.equal(formatEmployeeId(42), "LSTA_0042");
      assert.equal(parseEmployeeSequence("LSTA_0007"), 7);
      assert.equal(nextEmployeeId(["LSTA_0001", "LSTA_0099", "BAD", null]), "LSTA_0100");
      assert.equal(isValidEmployeeId("LSTA_0101"), true);
      assert.equal(isValidEmployeeId("HR_0101"), false);
    }
  },
  {
    name: "normalizes messy role and employment type values",
    run: () => {
      assert.equal(normalizeRole("Area Sales Manager").value, "AREA_SALES_MANAGER");
      assert.equal(normalizeRole("shop-accountant").value, "SHOP_ACCOUNTANT");
      assert.equal(normalizeRole("Regional Hero").reviewRequired, true);
      assert.equal(normalizeEmploymentType("commission").value, "COMMISSION_BASED");
      assert.equal(defaultLevelForRole("DSA"), "JUNIOR");
      assert.equal(defaultLevelForRole("SHOP_MANAGER"), "TO_BE_DEFINED");
    }
  },
  {
    name: "blocks active employees without employment type and onboarding",
    run: () => {
      const result = validateEmployeeLifecycle({
        employeeId: "LSTA_0010",
        fullName: "Test Employee",
        employmentStatus: "ACTIVE",
        currentRole: "SHOP_MANAGER",
        currentRegionId: "REG",
        currentShopId: "SHOP",
        directManagerId: "MGR",
        currentEvaluatorId: "MGR",
        onboardingComplete: false
      });

      assert.ok(result.blockers.some((issue) => issue.field === "employmentType"));
      assert.ok(result.blockers.some((issue) => issue.field === "onboarding"));
    }
  },
  {
    name: "requires DSA/DSP cluster assignment unless exception exists",
    run: () => {
      const result = validateEmployeeLifecycle({
        employeeId: "LSTA_0011",
        fullName: "Cluster Employee",
        employmentType: "COMMISSION_BASED",
        employmentStatus: "ONBOARDING",
        currentRole: "DSA",
        currentRegionId: "REG",
        currentShopId: "SHOP",
        directManagerId: "MGR",
        currentEvaluatorId: "MGR",
        onboardingComplete: true
      });

      assert.ok(result.blockers.some((issue) => issue.field === "currentClusterId"));
    }
  },
  {
    name: "blocks more than one active assignment",
    run: () => {
      const result = validateEmployeeLifecycle({
        employeeId: "LSTA_0012",
        fullName: "Assigned Employee",
        employmentType: "FULL_TIME",
        employmentStatus: "ONBOARDING",
        currentRole: "HR_OFFICER",
        currentDepartmentId: "HR",
        directManagerId: "MGR",
        currentEvaluatorId: "MGR",
        activeAssignmentCount: 2
      });

      assert.ok(result.blockers.some((issue) => issue.field === "assignments"));
    }
  },
  {
    name: "rejects invalid status transitions",
    run: () => {
      assert.equal(validateStatusTransition("EXITED", "ACTIVE").blockers.length, 1);
    }
  },
  {
    name: "enforces salary and evaluation access control",
    run: () => {
      const salesHead: Principal = {
        id: "user-1",
        employeeId: "emp-sales",
        systemRoles: ["SALES_HEAD"],
        employeeRole: "SALES_HEAD",
        regionIds: ["REG-1"]
      };

      assert.equal(canViewSalary(salesHead), false);
      assert.equal(canViewSalary({ ...salesHead, systemRoles: ["FINANCE_PAYROLL"] }), true);
      assert.equal(canUpdateSalary({ ...salesHead, systemRoles: ["FINANCE_PAYROLL"] }), false);
      assert.equal(canUpdateSalary({ ...salesHead, systemRoles: ["HR_ADMIN"] }), true);
      assert.equal(hasPermission(salesHead, "evaluation.create"), true);
      assert.equal(hasPermission(salesHead, "salary.update"), false);
      assert.equal(hasPermission({ ...salesHead, systemRoles: ["HR_OFFICER"] }, "onboarding.update"), true);
      assert.equal(hasPermission({ ...salesHead, systemRoles: ["HR_OFFICER"] }, "assignment.update"), true);
      assert.equal(
        canEvaluateEmployee(salesHead, {
          id: "emp-shop",
          currentRole: "DSA",
          currentRegionId: "REG-1"
        }),
        true
      );
      assert.equal(
        canEvaluateEmployee(
          { id: "user-2", employeeId: "emp-1", systemRoles: ["SHOP_MANAGER"], employeeRole: "SHOP_MANAGER" },
          { id: "emp-1", currentRole: "SHOP_MANAGER" }
        ),
        false
      );
    }
  },
  {
    name: "limits employee profile visibility by self or reporting scope",
    run: () => {
      const employeeUser: Principal = {
        id: "user-employee",
        employeeId: "emp-self",
        systemRoles: ["EMPLOYEE"],
        employeeRole: "EMPLOYEE"
      };
      const managerUser: Principal = {
        id: "user-manager",
        employeeId: "emp-manager",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-report"]
      };

      assert.equal(canViewEmployee(employeeUser, { id: "emp-self", currentRole: "EMPLOYEE" }), true);
      assert.equal(canViewEmployee(employeeUser, { id: "emp-other", currentRole: "EMPLOYEE" }), false);
      assert.equal(canViewEmployee(managerUser, { id: "emp-report", currentRole: "EMPLOYEE" }), true);
      assert.equal(canViewEmployee(managerUser, { id: "emp-outside", currentRole: "EMPLOYEE" }), false);
    }
  },
  {
    name: "filters navigation links by role and permission",
    run: () => {
      const employeeLinks = navHrefsFor({ id: "employee", employeeId: "emp-1", systemRoles: ["EMPLOYEE"], employeeRole: "EMPLOYEE" });
      assert.equal(employeeLinks.has("/self-service"), true);
      assert.equal(employeeLinks.has("/payroll-preparation"), false);
      assert.equal(employeeLinks.has("/security-settings"), false);
      assert.equal(employeeLinks.has("/audit"), false);

      const financeLinks = navHrefsFor({ id: "finance", systemRoles: ["FINANCE_PAYROLL"] });
      assert.equal(financeLinks.has("/payroll-preparation"), true);
      assert.equal(financeLinks.has("/salary-reviews"), true);
      assert.equal(financeLinks.has("/paye-tax-brackets"), true);
      assert.equal(financeLinks.has("/users"), false);

      const auditorLinks = navHrefsFor({ id: "auditor", systemRoles: ["AUDITOR"] });
      assert.equal(auditorLinks.has("/audit"), true);
      assert.equal(auditorLinks.has("/employees/new"), false);
      assert.equal(auditorLinks.has("/disciplinary"), false);
      assert.equal(auditorLinks.has("/payroll-preparation"), false);
    }
  },
  {
    name: "guards employee pages with explicit page permissions",
    run: () => {
      const employeeListPage = readFileSync("src/app/(app)/employees/page.tsx", "utf8");
      const createEmployeePage = readFileSync("src/app/(app)/employees/new/page.tsx", "utf8");

      assert.match(employeeListPage, /requirePagePermission\("employee\.view"\)/);
      assert.match(createEmployeePage, /requirePagePermission\("employee\.create"\)/);
    }
  },
  {
    name: "filters direct-rendered employee-linked records by reporting scope",
    run: () => {
      const manager: Principal = {
        id: "manager",
        employeeId: "mgr-1",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-direct"],
        shopIds: ["shop-1"]
      };
      const employees: EmployeeScopeRecord[] = [
        {
          id: "emp-direct",
          currentRole: "EMPLOYEE",
          currentDepartmentId: null,
          currentRegionId: null,
          currentShopId: null,
          currentClusterId: null,
          directManagerId: "mgr-1"
        },
        {
          id: "emp-shop",
          currentRole: "DSA",
          currentDepartmentId: null,
          currentRegionId: null,
          currentShopId: "shop-1",
          currentClusterId: null,
          directManagerId: null
        },
        {
          id: "emp-outside",
          currentRole: "EMPLOYEE",
          currentDepartmentId: "other-dept",
          currentRegionId: null,
          currentShopId: "shop-2",
          currentClusterId: null,
          directManagerId: null
        }
      ];

      const attendanceRows = [
        { id: "row-direct", employeeId: "emp-direct" },
        { id: "row-shop", employeeId: "emp-shop" },
        { id: "row-outside", employeeId: "emp-outside" }
      ];
      assert.deepEqual(filterEmployeeIdLinkedRecords(manager, attendanceRows, employees).map((row) => row.id), ["row-direct", "row-shop"]);

      const linkedRows = employees.map((employee) => ({ id: `linked-${employee.id}`, employee }));
      assert.deepEqual(filterEmployeeLinkedRecords(manager, linkedRows).map((row) => row.id), ["linked-emp-direct", "linked-emp-shop"]);
    }
  },
  {
    name: "applies editable import field mappings during revalidation",
    run: () => {
      assert.equal(detectImportTargetField("Job Title"), "role");
      assert.equal(detectImportTargetField("Unmapped Notes"), "unmapped");

      const [row] = validateImportRows(
        [
          {
            "Column A": "Mapped Import Person",
            "Column B": "CEO",
            "Column C": "Full Time",
            "Column D": "Draft",
            "Column E": "Executive"
          }
        ],
        {
          existingEmployeeIds: ["LSTA_0001"],
          fieldMapping: {
            "Column A": "fullName",
            "Column B": "role",
            "Column C": "employmentType",
            "Column D": "employmentStatus",
            "Column E": "department"
          }
        }
      );

      assert.equal(row.normalizedData.fullName, "Mapped Import Person");
      assert.equal(row.normalizedData.role, "CEO");
      assert.equal(row.normalizedData.employmentType, "FULL_TIME");
      assert.equal(row.status, "REVIEW_REQUIRED");
      assert.ok(row.reviewItems.some((issue) => issue.field === "employeeId"));
    }
  },
  {
    name: "separates import blockers and review items",
    run: () => {
      const [row] = validateImportRows(
        [
          {
            "Full Name": "Imported Person",
            Role: "Regional Hero",
            "Employment Type": "",
            "Employment Status": "Active"
          }
        ],
        { existingEmployeeIds: ["LSTA_0001"] }
      );

      assert.equal(row.normalizedData.employeeId, "LSTA_0002");
      assert.ok(row.blockers.some((issue) => issue.field === "employmentType"));
      assert.ok(row.reviewItems.some((issue) => issue.field === "role"));
      assert.equal(row.status, "BLOCKED");
    }
  },
  {
    name: "detects duplicate import IDs and invalid salary formats",
    run: () => {
      const [row] = validateImportRows(
        [
          {
            EmployeeID: "LSTA_0001",
            "Full Name": "Imported Person",
            Role: "HR Officer",
            "Employment Type": "Full Time",
            "Employment Status": "Draft",
            "Basic Salary": "forty thousand"
          }
        ],
        { existingEmployeeIds: ["LSTA_0001"] }
      );

      assert.ok(row.blockers.some((issue) => issue.field === "employeeId"));
      assert.ok(row.blockers.some((issue) => issue.field === "basicSalary"));
    }
  },
  {
    name: "marks generated import employee IDs as provisional review items",
    run: () => {
      const [row] = validateImportRows(
        [
          {
            "Full Name": "Draft Import",
            Role: "CEO",
            "Employment Type": "Full Time",
            "Employment Status": "Draft"
          }
        ],
        { existingEmployeeIds: ["LSTA_0001"] }
      );

      assert.equal(row.normalizedData.employeeIdGenerated, true);
      assert.ok(row.reviewItems.some((issue) => issue.field === "employeeId"));
    }
  },
  {
    name: "enforces Phase 2 document visibility rules",
    run: () => {
      const employee = {
        id: "emp-1",
        currentRole: "EMPLOYEE" as const,
        currentDepartmentId: "HR",
        currentRegionId: null,
        currentShopId: null,
        currentClusterId: null,
        directManagerId: "mgr-1"
      };
      const employeeUser: Principal = {
        id: "user-employee",
        employeeId: "emp-1",
        systemRoles: ["EMPLOYEE"],
        employeeRole: "EMPLOYEE"
      };
      const financeUser: Principal = {
        id: "user-finance",
        systemRoles: ["FINANCE_PAYROLL"]
      };

      assert.equal(
        canViewDocument(employeeUser, {
          employeeId: "emp-1",
          visibilityLevel: "EMPLOYEE_VISIBLE",
          employee
        }),
        true
      );
      assert.equal(
        canViewDocument(employeeUser, {
          employeeId: "emp-1",
          visibilityLevel: "SALARY_RESTRICTED",
          employee
        }),
        false
      );
      assert.equal(
        canViewDocument(financeUser, {
          employeeId: "emp-1",
          visibilityLevel: "SALARY_RESTRICTED",
          employee
        }),
        true
      );
      assert.equal(
        canViewDocument(
          {
            id: "manager-outside",
            employeeId: "mgr-2",
            systemRoles: ["SHOP_MANAGER"],
            employeeRole: "SHOP_MANAGER"
          },
          {
            employeeId: "emp-1",
            visibilityLevel: "MANAGER_VISIBLE",
            employee
          }
        ),
        false
      );
    }
  },
  {
    name: "supports leave day calculation and achievement scope checks",
    run: () => {
      assert.equal(calculateInclusiveDays(new Date("2026-07-01"), new Date("2026-07-05")), 5);
      const manager: Principal = {
        id: "mgr-user",
        employeeId: "mgr-1",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-1"]
      };
      assert.equal(
        canCreateAchievementFor(manager, {
          id: "emp-1",
          currentRole: "EMPLOYEE",
          directManagerId: "mgr-1"
        }),
        true
      );
    }
  },
  {
    name: "grants Phase 2 evaluation and criteria permissions correctly",
    run: () => {
      assert.equal(hasPermission({ id: "hr", systemRoles: ["HR_ADMIN"] }, "evaluation.configure"), true);
      assert.equal(hasPermission({ id: "sales", systemRoles: ["SALES_HEAD"] }, "evaluation.submit"), true);
      assert.equal(hasPermission({ id: "auditor", systemRoles: ["AUDITOR"] }, "import.approve"), false);
      assert.equal(hasPermission({ id: "auditor", systemRoles: ["AUDITOR"] }, "import.view"), true);
    }
  },
  {
    name: "enforces Phase 3 lifecycle permissions by role and scope",
    run: () => {
      const hrAdmin: Principal = { id: "hr", systemRoles: ["HR_ADMIN"] };
      const hrOfficer: Principal = { id: "officer", systemRoles: ["HR_OFFICER"] };
      const manager: Principal = {
        id: "manager",
        employeeId: "mgr-1",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-1"]
      };
      const employee: Principal = { id: "employee", employeeId: "emp-1", systemRoles: ["EMPLOYEE"], employeeRole: "EMPLOYEE" };
      const finance: Principal = { id: "finance", systemRoles: ["FINANCE_PAYROLL"] };

      assert.equal(hasPermission(hrAdmin, "approval.configure"), true);
      assert.equal(canApproveLifecycleRecord(hrAdmin, "termination.approve"), true);
      assert.equal(canApproveLifecycleRecord(hrOfficer, "termination.approve"), false);
      assert.equal(canCreateLifecycleRecord(manager, { id: "emp-1", currentRole: "EMPLOYEE" }, "disciplinary.create"), true);
      assert.equal(canCreateLifecycleRecord(manager, { id: "emp-2", currentRole: "EMPLOYEE" }, "disciplinary.create"), false);
      assert.equal(hasPermission(employee, "disciplinary.view"), false);
      assert.equal(canUpdateFinalPayment(finance), true);
    }
  },
  {
    name: "validates Phase 3 disciplinary, exit, transfer, promotion, and approval rules",
    run: () => {
      assert.equal(validateDisciplinarySubmission({ employeeId: "emp-1", incidentType: "", incidentDate: null, description: "" }).length, 3);
      assert.equal(validateTerminationApproval({ reason: "Resignation", lastWorkingDate: null }).length, 1);
      assert.equal(validateExitCompletion([{ isRequired: true, completed: false }]).length, 1);
      assert.equal(validateExitCompletion([{ isRequired: true, completed: false }], "HR override").length, 0);
      assert.ok(
        validateTransferApproval({
          requestedRole: "DSA",
          requestedRegionId: "REG",
          requestedShopId: "SHOP",
          effectiveDate: new Date()
        }).some((issue) => issue.field === "requestedClusterId")
      );
      assert.ok(
        validatePromotionApproval({
          proposedRole: null,
          proposedLevel: null,
          proposedSalary: 50000,
          effectiveDate: new Date(),
          canChangeSalary: false
        }).some((issue) => issue.field === "promotion")
      );
      assert.equal(validateApprovalWorkflowActivation({ activeStatus: true, activeStepCount: 0 }).length, 1);
    }
  },
  {
    name: "validates Phase 4 payroll readiness and export exclusion rules",
    run: () => {
      assert.equal(validatePayrollPeriod({ start: "2026-06-30", end: "2026-06-01" }).length, 1);

      const blocked = buildPayrollRow({
        id: "emp-1",
        employeeId: "LSTA_0200",
        fullName: "Payroll Blocked",
        employmentType: "FULL_TIME",
        employmentStatus: "ACTIVE",
        currentRole: "SHOP_MANAGER",
        currentLevel: "TO_BE_DEFINED",
        currentDivisionId: null,
        currentDepartmentId: null,
        currentRegionId: null,
        currentShopId: null,
        currentClusterId: null,
        directManagerId: null,
        basicSalary: null,
        salaryEffectiveDate: null,
        assignments: []
      });
      const readyCommission = buildPayrollRow({
        id: "emp-2",
        employeeId: "LSTA_0201",
        fullName: "Commission Ready",
        employmentType: "COMMISSION_BASED",
        employmentStatus: "ACTIVE",
        currentRole: "DSA",
        currentLevel: "JUNIOR",
        currentDivisionId: null,
        currentDepartmentId: null,
        currentRegionId: "REG",
        currentShopId: "SHOP",
        currentClusterId: "CLUSTER",
        directManagerId: "mgr-1",
        basicSalary: null,
        salaryEffectiveDate: null,
        assignments: [{ id: "assign-1", endDate: null }]
      });

      assert.equal(blocked.readinessStatus, "BLOCKED");
      assert.equal(blocked.includedInExport, false);
      assert.equal(readyCommission.readinessStatus, "READY");
      assert.deepEqual(summarizePayrollRows([blocked, readyCommission]), {
        totalEmployees: 2,
        readyCount: 1,
        warningCount: 0,
        blockedCount: 1
      });
    }
  },
  {
    name: "enforces Phase 4 payroll, KPI, and data-quality permissions",
    run: () => {
      const finance: Principal = { id: "finance", systemRoles: ["FINANCE_PAYROLL"] };
      const hrManager: Principal = { id: "hr-manager", systemRoles: ["HR_MANAGER"] };
      const employee: Principal = { id: "employee", employeeId: "emp-1", systemRoles: ["EMPLOYEE"], employeeRole: "EMPLOYEE" };
      const manager: Principal = {
        id: "manager",
        employeeId: "mgr-1",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-1"]
      };

      assert.equal(canViewPayrollPreparation(finance), true);
      assert.equal(canExportPayroll(finance), true);
      assert.equal(canViewPayrollPreparation(hrManager), false);
      assert.equal(canViewPayrollPreparation(employee), false);
      assert.equal(canViewKpiForEmployee(manager, { id: "emp-1", currentRole: "EMPLOYEE" }), true);
      assert.equal(canViewKpiForEmployee(manager, { id: "emp-2", currentRole: "EMPLOYEE" }), false);
      assert.equal(canViewDataQualityIssue(manager, { id: "emp-1", currentRole: "EMPLOYEE" }), true);
      assert.equal(canViewDataQualityIssue(manager, undefined), false);
    }
  },
  {
    name: "calculates and validates Phase 4 KPI results",
    run: () => {
      assert.equal(calculateAchievementPercent(100, 125), 125);
      assert.equal(ratingFromAchievement(125), "EXCEEDED");
      assert.equal(ratingFromAchievement(95), "MET");
      assert.equal(ratingFromAchievement(75), "PARTIALLY_MET");
      assert.equal(ratingFromAchievement(40), "NOT_MET");
      assert.equal(ratingFromAchievement(null), "NOT_APPLICABLE");
      assert.equal(validateKpiResult({ employeeId: "emp", metricId: "metric", periodStart: "2026-06-01", periodEnd: "2026-06-30", actualValue: 9 }).length, 0);
      assert.ok(validateKpiResult({ employeeId: "", metricId: "", actualValue: Number.NaN }).length >= 3);
    }
  },
  {
    name: "validates Phase 4 profile-change and governance controls",
    run: () => {
      assert.equal(validateProfileChangeField("PHONE_NUMBER"), true);
      assert.equal(validateProfileChangeField("BASIC_SALARY"), false);
      assert.equal(validateGovernanceSettings({ activeStatus: true, requiredStepCount: 0 }).length, 1);
      assert.ok(
        validateGovernanceSettings({
          activeStatus: true,
          requiredStepCount: 1,
          escalationAfterDays: 2,
          fallbackConfigured: false
        }).some((issue) => issue.field === "fallback")
      );
    }
  },
  {
    name: "computes Phase 4 reminder overdue state",
    run: () => {
      assert.equal(reminderComputedStatus(new Date("2026-06-01"), "OPEN", new Date("2026-06-23")), "OVERDUE");
      assert.equal(reminderComputedStatus(new Date("2026-07-01"), "OPEN", new Date("2026-06-23")), "OPEN");
      assert.equal(reminderComputedStatus(new Date("2026-06-01"), "COMPLETED", new Date("2026-06-23")), "COMPLETED");
    }
  },
  {
    name: "validates Phase 4.5 salary review and compensation access controls",
    run: () => {
      assert.deepEqual(salaryReviewChange(10000, 11500), { changeAmount: 1500, changePercent: 15 });
      assert.equal(validateSalaryReview({ proposedSalary: -1, status: "DRAFT", reason: "Bad" }).length, 1);
      assert.ok(validateSalaryReview({ proposedSalary: 12000, status: "APPROVED", reason: "Merit" }).some((issue) => issue.field === "effectiveDate"));

      const finance: Principal = { id: "finance", systemRoles: ["FINANCE_PAYROLL"] };
      const manager: Principal = {
        id: "manager",
        employeeId: "mgr-1",
        systemRoles: ["SHOP_MANAGER"],
        employeeRole: "SHOP_MANAGER",
        directReportIds: ["emp-1"]
      };
      assert.equal(canViewRestrictedCompensation(finance), true);
      assert.equal(canViewRestrictedCompensation(manager), false);
      assert.equal(canViewSalaryReviewForEmployee(manager, { id: "emp-1", currentRole: "EMPLOYEE" }), true);
      assert.equal(canViewSalaryReviewForEmployee(manager, { id: "emp-2", currentRole: "EMPLOYEE" }), false);
    }
  },
  {
    name: "validates Phase 4.5 payroll configuration and inputs",
    run: () => {
      assert.equal(validatePayeBracket({ minIncome: 0, maxIncome: 1000, taxRate: 0.1 }).length, 0);
      assert.equal(payeBracketsOverlap({ minIncome: 500, maxIncome: 1500 }, [{ minIncome: 0, maxIncome: 1000 }]), true);
      assert.equal(validatePensionRule({ employeeRate: 0.07, employerRate: 0.11 }).length, 0);
      assert.ok(validateAttendanceInput({ workingDays: 0 }).some((issue) => issue.field === "workingDays"));
      assert.ok(validateAllowance({ amount: -1 }).some((issue) => issue.field === "amount"));
      assert.ok(validateDeduction({ amount: 100, deductionType: "LOAN_DEDUCTION" }).some((issue) => issue.field === "reason"));
    }
  },
  {
    name: "enforces payroll rule approval governance",
    run: () => {
      const periodEnd = new Date("2026-06-30");
      assert.equal(
        isApprovedEffectivePayrollRule({
          activeStatus: true,
          approvalStatus: "APPROVED",
          approvedById: "finance",
          isSample: false,
          effectiveStartDate: new Date("2026-01-01")
        }, periodEnd),
        true
      );
      assert.equal(
        isApprovedEffectivePayrollRule({
          activeStatus: true,
          approvalStatus: "DRAFT",
          approvedById: null,
          isSample: false,
          effectiveStartDate: new Date("2026-01-01")
        }, periodEnd),
        false
      );
      assert.equal(
        isApprovedEffectivePayrollRule({
          activeStatus: true,
          approvalStatus: "APPROVED",
          approvedById: "finance",
          isSample: true,
          effectiveStartDate: new Date("2026-01-01")
        }, periodEnd),
        false
      );
      const setupIssues = payrollRuleSetupIssues({
        payeRuleCount: 0,
        pensionRuleCount: 0,
        overtimeRuleCount: 0,
        workingDayRuleCount: 0,
        hasSampleRules: true
      });
      assert.ok(setupIssues.some((issue) => issue.message.includes("verified and approved by HR/Finance")));
    }
  },
  {
    name: "calculates Phase 4.5 payroll breakdown from configurable inputs",
    run: () => {
      assert.equal(calculateProratedBasicSalary({ basicSalary: 22000, workingDays: 22, daysPresent: 20, paidLeaveDays: 1 }), 21000);
      assert.equal(
        calculatePayeTax(24000, [{ name: "Test", minIncome: 0, maxIncome: null, taxRate: 0.1, deductionAmount: 100 }]).amount,
        2300
      );
      const payroll = calculatePayroll({
        basicSalary: 22000,
        workingDays: 22,
        daysPresent: 20,
        paidLeaveDays: 1,
        sundayOvertimeHours: 2,
        approvedAllowances: 1000,
        approvedCommission: 2000,
        approvedDeductions: 500,
        overtimeRates: { sundayRate: 2 },
        pensionRule: { name: "Pension", employeeRate: 0.07, employerRate: 0.11 },
        payeBrackets: [{ name: "Tax", minIncome: 0, maxIncome: null, taxRate: 0.1, deductionAmount: 100 }]
      });
      assert.equal(payroll.proratedBasicSalary, 21000);
      assert.equal(payroll.grossSalary, 24500);
      assert.equal(payroll.employeePension, 1715);
      assert.equal(payroll.employerPension, 2695);
      assert.equal(payroll.netSalary, 19935);
      assert.equal(payroll.employerTotalCost, 27195);
    }
  },
  {
    name: "calculates Phase 4.5 commission plans and validates manual adjustments",
    run: () => {
      assert.equal(calculateCommission({ calculationType: "FIXED_AMOUNT", fixedAmount: 500 }).finalCommission, 500);
      assert.equal(calculateCommission({ calculationType: "PERCENT_OF_SALES", salesAmount: 10000, rate: 0.05 }).finalCommission, 500);
      assert.equal(calculateCommission({ calculationType: "TARGET_BASED", salesAmount: 8000, targetAmount: 10000, rate: 0.05 }).finalCommission, 0);
      assert.equal(calculateCommission({ calculationType: "PERCENT_OF_SALES", salesAmount: 10000, rate: 0.1, capAmount: 600 }).finalCommission, 600);
      assert.ok(validateCommissionPlan({ calculationType: "PERCENT_OF_SALES", effectiveStartDate: "2026-01-01" }).some((issue) => issue.field === "rate"));
      assert.ok(validateCommissionCalculation({ periodStart: "2026-01-01", periodEnd: "2026-01-31", manualAdjustment: 10 }).some((issue) => issue.field === "manualAdjustmentReason"));
    }
  },
  {
    name: "maps Phase 4.5 payroll import headers for preview usability",
    run: () => {
      assert.equal(detectPayrollImportField("Employee ID"), "employeeId");
      assert.equal(detectPayrollImportField("Night Overtime Hours"), "nightOvertimeHours");
      const mapped = mapPayrollImportHeaders(["EmployeeID", "Sales Amount", "Mystery Column"]);
      assert.deepEqual(mapped.unmatchedColumns, ["Mystery Column"]);
    }
  },
  {
    name: "validates required document rules by employment type and role",
    run: () => {
      const employee = {
        id: "emp-doc",
        employeeId: "LSTA_0500",
        fullName: "Document Person",
        employmentType: "COMMISSION_BASED" as const,
        currentRole: "SHOP_MANAGER" as const,
        currentDepartmentId: null,
        currentDivisionId: null
      };
      const required = requiredDocumentsForEmployee(employee);
      assert.ok(required.some((rule) => rule.documentType === "COMMISSION_AGREEMENT"));
      assert.ok(required.some((rule) => rule.documentType === "ASSIGNMENT_LETTER"));
      const missing = missingRequiredDocuments(employee, [{ documentType: "ID", isActive: true }]);
      assert.ok(missing.some((rule) => rule.documentType === "COMMISSION_PLAN_ACKNOWLEDGEMENT"));
      assert.ok(documentCompliancePercentage(employee, [{ documentType: "ID", isActive: true }]) < 100);
      const issues = requiredDocumentDataQualityIssues(employee, [{ documentType: "ID", isActive: true }]);
      assert.ok(issues.some((issue) => issue.issueType === "MISSING_DOCUMENT" && issue.suggestedFix.includes("Upload")));
    }
  },
  {
    name: "validates Phase 5 payroll export, lock, and adjustment governance",
    run: () => {
      assert.equal(validatePayrollExportTemplate({ fieldMapping: { employeeId: "Employee ID" } }).length, 0);
      assert.ok(validatePayrollExportTemplate({ fieldMapping: {} }).some((issue) => issue.field === "fieldMapping"));
      assert.equal(templateUsesRestrictedFields({ netSalary: "Net Salary" }), true);
      assert.equal(
        isPayrollPeriodLocked(
          [{ payrollPeriodStart: new Date("2026-06-01"), payrollPeriodEnd: new Date("2026-06-30"), lockStatus: "LOCKED" }],
          new Date("2026-06-15"),
          new Date("2026-06-15")
        ),
        true
      );
      assert.ok(validateUnlockRequest({}).some((issue) => issue.field === "reason"));
      assert.ok(validatePayrollAdjustment({ amount: 0, reason: "Correction" }).some((issue) => issue.field === "amount"));
      assert.equal(validatePayrollAdjustment({ amount: -100, reason: "Attendance correction" }).length, 0);
      assert.equal(canManagePayrollLock({ id: "finance", systemRoles: ["FINANCE_PAYROLL"] }), true);
      assert.equal(canManagePayrollLock({ id: "manager", systemRoles: ["SHOP_MANAGER"] }), false);
    }
  },
  {
    name: "validates Phase 5 attendance import and leave balance rules",
    run: () => {
      const preview = previewAttendanceImport(
        [
          { "Employee ID": "LSTA_0001", Date: "2026-06-01", Status: "PRESENT" },
          { "Employee ID": "UNKNOWN", Date: "bad", Status: "" },
          { "Employee ID": "LSTA_0001", Date: "2026-06-01", Status: "ABSENT" }
        ],
        new Set(["LSTA_0001"])
      );
      assert.equal(preview[0].statusLabel, "CLEAN");
      assert.equal(preview[1].statusLabel, "BLOCKED");
      assert.ok(preview[2].blockers.some((issue) => issue.field === "duplicate"));
      assert.equal(calculateLeaveClosingBalance({ openingBalance: 10, accruedDays: 2, usedDays: 3, adjustedDays: 1 }), 10);
      assert.equal(validateLeavePolicy({ effectiveStartDate: "2026-01-01", annualEntitlementDays: 18 }).length, 0);
      assert.ok(validateLeaveBalance({ closingBalance: -1 }).some((issue) => issue.field === "closingBalance"));
      const employee = { id: "emp-1", currentRole: "EMPLOYEE" as const };
      assert.equal(canViewLeaveBalanceForEmployee({ id: "self", employeeId: "emp-1", systemRoles: ["EMPLOYEE"] }, employee), true);
      assert.equal(canViewLeaveBalanceForEmployee({ id: "other", employeeId: "emp-2", systemRoles: ["EMPLOYEE"] }, employee), false);
    }
  },
  {
    name: "validates Phase 5 KPI, email, retention, integration, and manager controls",
    run: () => {
      assert.equal(validateKpiWeights([{ weight: 60 }, { weight: 40 }]).length, 0);
      assert.ok(validateKpiWeights([{ weight: 60 }, { weight: 30 }]).some((issue) => issue.field === "weightTotal"));
      assert.ok(validateEmailTemplate({ subjectTemplate: "Payroll", bodyTemplate: "{{salary}}", recipientCanViewRestricted: false }).some((issue) => issue.field === "bodyTemplate"));
      assert.equal(validateEmailTemplate({ subjectTemplate: "Approval", bodyTemplate: "Request approved", recipientCanViewRestricted: false }).length, 0);
      assert.ok(validateRetentionPolicy({ retentionPeriodDays: 0, entityType: "AUDIT_LOG", actionAfterRetention: "REVIEW_REQUIRED" }).some((issue) => issue.field === "retentionPeriodDays"));
      assert.ok(validateRetentionPolicy({ retentionPeriodDays: 365, entityType: "AUDIT_LOG", actionAfterRetention: "DELETE_IF_ALLOWED" }).some((issue) => issue.field === "actionAfterRetention"));
      assert.notEqual(hashIntegrationToken("secret-token"), "secret-token");
      assert.ok(validateIntegrationToken({ scopes: [] }).some((issue) => issue.field === "allowedScopes"));
      assert.equal(canManageIntegrationTokens({ id: "super", systemRoles: ["SUPER_ADMIN"] }), true);
      assert.equal(canManageIntegrationTokens({ id: "hr", systemRoles: ["HR_ADMIN"] }), false);
      assert.equal(canViewManagerDashboard({ id: "mgr", systemRoles: ["SHOP_MANAGER"], directReportIds: ["emp-1"] }), true);
    }
  }
];

let passed = 0;

for (const test of tests) {
  test.run();
  passed += 1;
  console.log(`ok ${passed} - ${test.name}`);
}

console.log(`\n${passed}/${tests.length} tests passed.`);
