import assert from "node:assert/strict";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { EmployeeLevel, EmployeeRole, EmploymentStatus, EmploymentType, Prisma } from "@prisma/client";
import { writeAuditLog } from "../lib/audit";
import { validateImportRows, flattenImportIssues } from "../lib/import/validator";
import { canApproveAchievement, canViewDocument, employeeToScope } from "../lib/phase2-access";
import { calculateInclusiveDays } from "../lib/phase2-utils";
import { prisma } from "../lib/prisma";
import { canEvaluateEmployee, type Principal } from "../lib/rbac";
import { getDashboardMetrics } from "../lib/reports";

const marker = `PHASE2_SMOKE_${Date.now()}`;
const prefix = "PHASE2_SMOKE_";
const tempFiles: string[] = [];

async function main() {
  await cleanupOldSmokeData();

  const hrUser = await prisma.user.create({
    data: {
      email: `${marker.toLowerCase()}-hr@example.test`,
      name: `${marker} HR Admin`,
      passwordHash: "workflow-smoke"
    }
  });
  const managerEmployee = await createEmployee(`${marker}_MGR`, "Workflow Manager", "SHOP_MANAGER");
  const targetEmployee = await createEmployee(`${marker}_EMP`, "Workflow Employee", "OTHER", managerEmployee.id);
  const outsideEmployee = await createEmployee(`${marker}_OUT`, "Outside Employee", "OTHER");
  const managerUser = await prisma.user.create({
    data: {
      email: `${marker.toLowerCase()}-manager@example.test`,
      name: `${marker} Manager`,
      passwordHash: "workflow-smoke",
      employeeId: managerEmployee.id
    }
  });
  const employeeUser = await prisma.user.create({
    data: {
      email: `${marker.toLowerCase()}-employee@example.test`,
      name: `${marker} Employee`,
      passwordHash: "workflow-smoke",
      employeeId: targetEmployee.id
    }
  });

  const hrPrincipal: Principal = { id: hrUser.id, systemRoles: ["HR_ADMIN"] };
  const financePrincipal: Principal = { id: "finance-smoke", systemRoles: ["FINANCE_PAYROLL"] };
  const managerPrincipal: Principal = {
    id: managerUser.id,
    employeeId: managerEmployee.id,
    systemRoles: ["SHOP_MANAGER"],
    employeeRole: "SHOP_MANAGER",
    directReportIds: [targetEmployee.id]
  };
  const employeePrincipal: Principal = {
    id: employeeUser.id,
    employeeId: targetEmployee.id,
    systemRoles: ["EMPLOYEE"],
    employeeRole: "EMPLOYEE"
  };

  try {
    await verifyImportApproval(hrPrincipal);
    await verifyDocumentVisibilityAndAudit(hrPrincipal, financePrincipal, managerPrincipal, employeePrincipal, targetEmployee.id);
    await verifyLeaveApproval(hrPrincipal, targetEmployee.id);
    await verifyAchievementApproval(hrPrincipal, employeePrincipal, targetEmployee.id);
    await verifyEvaluationWorkflow(hrPrincipal, managerPrincipal, targetEmployee.id, managerEmployee.id, outsideEmployee.id);
    await verifyScopedReports(managerPrincipal, targetEmployee.id, managerEmployee.id, outsideEmployee.id);

    console.log("Phase 2 DB workflow smoke passed.");
  } finally {
    await cleanupOldSmokeData();
    await Promise.all(tempFiles.map((file) => rm(file, { force: true })));
  }
}

async function verifyImportApproval(principal: Principal) {
  const sourceRow = {
    EmployeeID: `${marker}_IMP`,
    "Full Name": "Workflow Import",
    Role: "OTHER",
    "Employment Type": "Full Time",
    "Employment Status": "Draft"
  };
  const [validation] = validateImportRows([sourceRow], {
    existingEmployeeIds: [],
    fieldMapping: {
      EmployeeID: "employeeId",
      "Full Name": "fullName",
      Role: "role",
      "Employment Type": "employmentType",
      "Employment Status": "employmentStatus"
    }
  });
  assert.equal(validation.status, "WARNING");

  const issues = flattenImportIssues([validation]);
  const batch = await prisma.importBatch.create({
    data: {
      fileName: `${marker}.csv`,
      uploadedFile: `${marker}.csv`,
      sourceType: "text/csv",
      uploadedById: principal.id,
      status: "VALIDATED",
      totalRows: 1,
      validRows: 1,
      warningRows: 1,
      columnMapping: {
        EmployeeID: "employeeId",
        "Full Name": "fullName",
        Role: "role",
        "Employment Type": "employmentType",
        "Employment Status": "employmentStatus"
      },
      validationReport: { totalRows: 1, validRows: 1, warningRows: 1 },
      fieldMappings: {
        create: Object.entries({
          EmployeeID: "employeeId",
          "Full Name": "fullName",
          Role: "role",
          "Employment Type": "employmentType",
          "Employment Status": "employmentStatus"
        }).map(([sourceColumn, targetField]) => ({ sourceColumn, targetField }))
      },
      rows: {
        create: {
          rowNumber: validation.rowNumber,
          sourceData: validation.sourceData as Prisma.InputJsonValue,
          normalizedData: validation.normalizedData as Prisma.InputJsonValue,
          blockers: validation.blockers as Prisma.InputJsonValue,
          warnings: validation.warnings as Prisma.InputJsonValue,
          reviewItems: validation.reviewItems as Prisma.InputJsonValue,
          status: validation.status
        }
      }
    },
    include: { rows: true }
  });
  await prisma.importValidationIssue.createMany({
    data: issues.map((issue) => ({
      importBatchId: batch.id,
      importRowId: batch.rows[0].id,
      severity: issue.severity,
      fieldName: issue.fieldName,
      issueCode: issue.issueCode,
      message: issue.message,
      suggestedFix: issue.suggestedFix
    }))
  });
  await writeAuditLog({ userId: principal.id, action: "IMPORT_UPLOAD", entityType: "ImportBatch", entityId: batch.id });
  await writeAuditLog({ userId: principal.id, action: "IMPORT_VALIDATION", entityType: "ImportBatch", entityId: batch.id });

  const created = await prisma.$transaction(async (tx) => {
    const normalized = validation.normalizedData;
    const employee = await tx.employee.create({
      data: {
        employeeId: normalized.employeeId,
        firstName: "Workflow",
        lastName: "Import",
        fullName: normalized.fullName,
        employmentType: normalized.employmentType as EmploymentType,
        employmentStatus: normalized.employmentStatus as EmploymentStatus,
        currentRole: (normalized.role ?? "OTHER") as EmployeeRole,
        currentLevel: normalized.level as EmployeeLevel,
        createdById: principal.id,
        updatedById: principal.id
      }
    });
    await tx.employeeAssignment.create({
      data: {
        employeeId: employee.id,
        role: employee.currentRole,
        level: employee.currentLevel,
        startDate: new Date(),
        reason: `Created from import ${batch.fileName}`,
        approvedById: principal.id
      }
    });
    await tx.employeeStatusHistory.create({
      data: {
        employeeId: employee.id,
        newStatus: employee.employmentStatus,
        reason: `Created from import ${batch.fileName}`,
        effectiveDate: new Date(),
        updatedById: principal.id,
        approvalStatus: "APPROVED"
      }
    });
    await tx.onboardingChecklist.create({ data: { employeeId: employee.id } });
    await tx.importRow.update({
      where: { id: batch.rows[0].id },
      data: { employeeCreated: true, createdEmployeeId: employee.id }
    });
    await tx.importBatch.update({
      where: { id: batch.id },
      data: { status: "APPROVED", approvedById: principal.id, approvedAt: new Date() }
    });
    return employee;
  });
  await writeAuditLog({ userId: principal.id, action: "IMPORT_APPROVAL", entityType: "ImportBatch", entityId: batch.id });
  await writeAuditLog({ userId: principal.id, action: "EMPLOYEE_IMPORT_CREATE", entityType: "Employee", entityId: created.id });

  const imported = await prisma.employee.findUnique({ where: { employeeId: `${marker}_IMP` } });
  assert.ok(imported);
  const approvalLog = await prisma.auditLog.findFirst({ where: { action: "IMPORT_APPROVAL", entityId: batch.id } });
  assert.ok(approvalLog);
}

async function verifyDocumentVisibilityAndAudit(
  hrPrincipal: Principal,
  financePrincipal: Principal,
  managerPrincipal: Principal,
  employeePrincipal: Principal,
  employeeId: string
) {
  const uploadDir = path.join(process.cwd(), "uploads", "phase2-smoke");
  await mkdir(uploadDir, { recursive: true });
  const filePath = path.join(uploadDir, `${marker}.txt`);
  tempFiles.push(filePath);
  await writeFile(filePath, "Phase 2 workflow smoke document");

  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const docs = await prisma.employeeDocument.createManyAndReturn({
    data: [
      { employeeId, documentType: "CONTRACT", filePath, originalFilename: `${marker}-employee.txt`, uploadedById: hrPrincipal.id, visibilityLevel: "EMPLOYEE_VISIBLE" },
      { employeeId, documentType: "CV", filePath, originalFilename: `${marker}-manager.txt`, uploadedById: hrPrincipal.id, visibilityLevel: "MANAGER_VISIBLE" },
      { employeeId, documentType: "OTHER", filePath, originalFilename: `${marker}-sensitive.txt`, uploadedById: hrPrincipal.id, visibilityLevel: "SENSITIVE_HR_ONLY" },
      { employeeId, documentType: "SALARY_DOCUMENT", filePath, originalFilename: `${marker}-salary.txt`, uploadedById: hrPrincipal.id, visibilityLevel: "SALARY_RESTRICTED" }
    ]
  });
  for (const doc of docs) {
    await writeAuditLog({ userId: hrPrincipal.id, action: "DOCUMENT_UPLOAD", entityType: "EmployeeDocument", entityId: doc.id });
  }

  const scope = employeeToScope(employee);
  const byVisibility = new Map(docs.map((doc) => [doc.visibilityLevel, doc]));
  assert.equal(canViewDocument(employeePrincipal, { employeeId, visibilityLevel: "EMPLOYEE_VISIBLE", employee: scope }), true);
  assert.equal(canViewDocument(employeePrincipal, { employeeId, visibilityLevel: "SALARY_RESTRICTED", employee: scope }), false);
  assert.equal(canViewDocument(managerPrincipal, { employeeId, visibilityLevel: "MANAGER_VISIBLE", employee: scope }), true);
  assert.equal(canViewDocument(financePrincipal, { employeeId, visibilityLevel: "SALARY_RESTRICTED", employee: scope }), true);
  assert.equal(canViewDocument(hrPrincipal, { employeeId, visibilityLevel: "SENSITIVE_HR_ONLY", employee: scope }), true);

  const doc = byVisibility.get("EMPLOYEE_VISIBLE");
  assert.ok(doc);
  await writeAuditLog({ userId: employeePrincipal.id, action: "DOCUMENT_VIEW", entityType: "EmployeeDocument", entityId: doc.id });
  await writeAuditLog({ userId: employeePrincipal.id, action: "DOCUMENT_DOWNLOAD", entityType: "EmployeeDocument", entityId: doc.id });
  const auditCount = await prisma.auditLog.count({
    where: { entityType: "EmployeeDocument", entityId: doc.id, action: { in: ["DOCUMENT_VIEW", "DOCUMENT_DOWNLOAD"] } }
  });
  assert.equal(auditCount, 2);
}

async function verifyLeaveApproval(principal: Principal, employeeId: string) {
  const leave = await prisma.leaveRecord.create({
    data: {
      employeeId,
      leaveType: "ANNUAL",
      startDate: new Date("2026-08-03"),
      endDate: new Date("2026-08-05"),
      totalDays: calculateInclusiveDays(new Date("2026-08-03"), new Date("2026-08-05")),
      reason: marker,
      requestedById: principal.id,
      approvalStatus: "PENDING"
    }
  });
  await writeAuditLog({ userId: principal.id, action: "LEAVE_CREATE", entityType: "LeaveRecord", entityId: leave.id });
  const approved = await prisma.leaveRecord.update({
    where: { id: leave.id },
    data: { approvalStatus: "APPROVED", approvedById: principal.id, approvedAt: new Date() }
  });
  await writeAuditLog({ userId: principal.id, action: "LEAVE_APPROVAL", entityType: "LeaveRecord", entityId: leave.id });

  assert.equal(approved.approvalStatus, "APPROVED");
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "LEAVE_APPROVAL", entityId: leave.id } }));
}

async function verifyAchievementApproval(principal: Principal, employeePrincipal: Principal, employeeId: string) {
  assert.equal(canApproveAchievement(employeePrincipal), false);
  const achievement = await prisma.achievement.create({
    data: {
      employeeId,
      achievementType: "TOP_PERFORMER",
      title: `${marker} achievement`,
      achievementDate: new Date("2026-08-06"),
      createdById: principal.id,
      approvalStatus: "SUBMITTED"
    }
  });
  await writeAuditLog({ userId: principal.id, action: "ACHIEVEMENT_SUBMISSION", entityType: "Achievement", entityId: achievement.id });
  const approved = await prisma.achievement.update({
    where: { id: achievement.id },
    data: { approvalStatus: "APPROVED", approvedById: principal.id }
  });
  await writeAuditLog({ userId: principal.id, action: "ACHIEVEMENT_APPROVAL", entityType: "Achievement", entityId: achievement.id });

  assert.equal(approved.approvalStatus, "APPROVED");
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "ACHIEVEMENT_APPROVAL", entityId: achievement.id } }));
}

async function verifyEvaluationWorkflow(
  hrPrincipal: Principal,
  managerPrincipal: Principal,
  employeeId: string,
  evaluatorId: string,
  outsideEmployeeId: string
) {
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: employeeId } });
  const outsideEmployee = await prisma.employee.findUniqueOrThrow({ where: { id: outsideEmployeeId } });
  assert.equal(canEvaluateEmployee(managerPrincipal, employeeToScope(employee)), true);
  assert.equal(canEvaluateEmployee(managerPrincipal, employeeToScope(outsideEmployee)), false);

  const evaluation = await prisma.employeeEvaluation.create({
    data: {
      employeeId,
      evaluatorId,
      evaluationPeriodStart: new Date("2026-08-01"),
      evaluationPeriodEnd: new Date("2026-08-31"),
      evaluationType: "MONTHLY_PERFORMANCE_REVIEW",
      score: 88,
      rating: "VERY_GOOD",
      comments: marker,
      status: "DRAFT"
    }
  });
  await writeAuditLog({ userId: managerPrincipal.id, action: "EVALUATION_CREATE", entityType: "EmployeeEvaluation", entityId: evaluation.id });
  await prisma.employeeEvaluation.update({
    where: { id: evaluation.id },
    data: { status: "SUBMITTED", submittedDate: new Date() }
  });
  await writeAuditLog({ userId: managerPrincipal.id, action: "EVALUATION_SUBMISSION", entityType: "EmployeeEvaluation", entityId: evaluation.id });
  const approved = await prisma.employeeEvaluation.update({
    where: { id: evaluation.id },
    data: { status: "APPROVED", approvedById: hrPrincipal.id }
  });
  await writeAuditLog({ userId: hrPrincipal.id, action: "EVALUATION_APPROVAL", entityType: "EmployeeEvaluation", entityId: evaluation.id });

  assert.equal(approved.status, "APPROVED");
  assert.ok(await prisma.auditLog.findFirst({ where: { action: "EVALUATION_APPROVAL", entityId: evaluation.id } }));
}

async function verifyScopedReports(managerPrincipal: Principal, employeeId: string, managerEmployeeId: string, outsideEmployeeId: string) {
  const metrics = await getDashboardMetrics(managerPrincipal);
  const reportedIds = new Set(metrics.recentlyAddedEmployees.map((employee) => employee.id));
  assert.equal(metrics.totalEmployees, 2);
  assert.equal(reportedIds.has(employeeId), true);
  assert.equal(reportedIds.has(managerEmployeeId), true);
  assert.equal(reportedIds.has(outsideEmployeeId), false);
}

async function createEmployee(employeeId: string, fullName: string, currentRole: "SHOP_MANAGER" | "OTHER", directManagerId?: string) {
  const [firstName, ...rest] = fullName.split(" ");
  return prisma.employee.create({
    data: {
      employeeId,
      firstName,
      lastName: rest.join(" ") || "Smoke",
      fullName,
      employmentType: "FULL_TIME",
      employmentStatus: "ACTIVE",
      currentRole,
      currentLevel: "TO_BE_DEFINED",
      directManagerId
    }
  });
}

async function cleanupOldSmokeData() {
  const smokeUsers = await prisma.user.findMany({
    where: { email: { contains: "phase2_smoke_" } },
    select: { id: true }
  });
  const smokeEmployees = await prisma.employee.findMany({
    where: { employeeId: { startsWith: prefix } },
    select: { id: true }
  });
  const userIds = smokeUsers.map((user) => user.id);
  const employeeIds = smokeEmployees.map((employee) => employee.id);

  await prisma.auditLog.deleteMany({
    where: {
      OR: [
        { userId: { in: userIds.length > 0 ? userIds : ["none"] } },
        { entityId: { in: employeeIds.length > 0 ? employeeIds : ["none"] } }
      ]
    }
  });
  await prisma.importBatch.deleteMany({ where: { fileName: { startsWith: prefix } } });
  if (employeeIds.length > 0) {
    await prisma.employee.updateMany({
      where: { id: { in: employeeIds } },
      data: { directManagerId: null, currentEvaluatorId: null }
    });
    await prisma.employeeDocument.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.leaveRecord.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.achievement.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employeeEvaluation.deleteMany({ where: { OR: [{ employeeId: { in: employeeIds } }, { evaluatorId: { in: employeeIds } }] } });
    await prisma.onboardingChecklist.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employeeStatusHistory.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employeeAssignment.deleteMany({ where: { employeeId: { in: employeeIds } } });
    await prisma.employeeSalary.deleteMany({ where: { employeeId: { in: employeeIds } } });
  }
  await prisma.user.deleteMany({ where: { id: { in: userIds.length > 0 ? userIds : ["none"] } } });
  await prisma.employee.deleteMany({ where: { employeeId: { startsWith: prefix } } });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
