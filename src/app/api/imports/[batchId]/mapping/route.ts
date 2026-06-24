import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import {
  flattenImportIssues,
  importTargetFields,
  requiredImportTargetFields,
  validateImportRows,
  type ImportFieldMapping,
  type SourceRow
} from "@/lib/import/validator";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    batchId: string;
  }>;
};

const allowedTargets = new Set(["unmapped", ...importTargetFields.map((field) => field.value)]);

export async function POST(request: Request, context: RouteContext) {
  const principal = await requirePermission("import.validate");
  if (isApiError(principal)) return principal;

  const { batchId } = await context.params;
  const batch = await prisma.importBatch.findUnique({
    where: { id: batchId },
    include: {
      rows: { orderBy: { rowNumber: "asc" } },
      fieldMappings: true
    }
  });

  if (!batch) return NextResponse.json({ error: "Import batch not found." }, { status: 404 });
  if (batch.status === "APPROVED") {
    return NextResponse.json({ error: "Approved import batches cannot be remapped." }, { status: 409 });
  }

  const formData = await request.formData();
  const nextMapping: ImportFieldMapping = {};
  for (const mapping of batch.fieldMappings) {
    const targetField = String(formData.get(`mapping_${mapping.id}`) ?? mapping.targetField);
    if (!allowedTargets.has(targetField)) {
      return NextResponse.json({ error: `Invalid target field: ${targetField}` }, { status: 400 });
    }
    nextMapping[mapping.sourceColumn] = targetField;
  }

  const employees = await prisma.employee.findMany({
    select: {
      employeeId: true,
      fullName: true,
      phoneNumber: true,
      email: true
    }
  });

  const validations = validateImportRows(
    batch.rows.map((row) => row.sourceData as Prisma.JsonObject as SourceRow),
    {
      existingEmployeeIds: employees.map((employee) => employee.employeeId),
      existingContacts: employees,
      fieldMapping: nextMapping
    }
  );
  const flatIssues = [
    ...flattenImportIssues(validations),
    ...missingRequiredMappingIssues(nextMapping)
  ];
  const counts = summarizeRows(validations);

  const updatedBatch = await prisma.$transaction(async (tx) => {
    for (const mapping of batch.fieldMappings) {
      await tx.importFieldMapping.update({
        where: { id: mapping.id },
        data: { targetField: nextMapping[mapping.sourceColumn] ?? "unmapped" }
      });
    }

    await tx.importValidationIssue.deleteMany({ where: { importBatchId: batch.id } });

    for (const [index, row] of batch.rows.entries()) {
      const validation = validations[index];
      await tx.importRow.update({
        where: { id: row.id },
        data: {
          normalizedData: validation.normalizedData as Prisma.InputJsonValue,
          blockers: validation.blockers as Prisma.InputJsonValue,
          warnings: validation.warnings as Prisma.InputJsonValue,
          reviewItems: validation.reviewItems as Prisma.InputJsonValue,
          status: validation.status,
          employeeCreated: false,
          employeeUpdated: false,
          createdEmployeeId: null,
          notes: "Revalidated after mapping update."
        }
      });
    }

    const rowIdsByNumber = new Map(batch.rows.map((row) => [row.rowNumber, row.id]));
    if (flatIssues.length > 0) {
      await tx.importValidationIssue.createMany({
        data: flatIssues.map((issue) => ({
          importBatchId: batch.id,
          importRowId: issue.rowNumber > 0 ? rowIdsByNumber.get(issue.rowNumber) : null,
          severity: issue.severity,
          fieldName: issue.fieldName,
          issueCode: issue.issueCode,
          message: issue.message,
          suggestedFix: issue.suggestedFix
        }))
      });
    }

    return tx.importBatch.update({
      where: { id: batch.id },
      data: {
        status: "VALIDATED",
        ...counts,
        columnMapping: nextMapping,
        validationReport: {
          ...counts,
          issueCount: flatIssues.length,
          mappingUpdatedAt: new Date().toISOString()
        } as Prisma.InputJsonValue
      },
      include: {
        rows: { orderBy: { rowNumber: "asc" } },
        fieldMappings: { orderBy: { sourceColumn: "asc" } },
        validationIssues: { orderBy: { createdAt: "asc" } }
      }
    });
  });

  await writeAuditLog({
    userId: principal.id,
    action: "IMPORT_VALIDATION",
    entityType: "ImportBatch",
    entityId: batch.id,
    newValue: { mapping: nextMapping, ...counts, issueCount: flatIssues.length }
  });

  return NextResponse.json({ importBatch: updatedBatch });
}

function summarizeRows(rows: ReturnType<typeof validateImportRows>) {
  return rows.reduce(
    (summary, row) => {
      summary.totalRows += 1;
      if (row.status === "CLEAN" || row.status === "WARNING") summary.validRows += 1;
      if (row.status === "CLEAN") summary.cleanRows += 1;
      if (row.status === "WARNING") summary.warningRows += 1;
      if (row.status === "REVIEW_REQUIRED") summary.reviewRows += 1;
      if (row.status === "BLOCKED") summary.blockedRows += 1;
      return summary;
    },
    { totalRows: 0, validRows: 0, cleanRows: 0, warningRows: 0, reviewRows: 0, blockedRows: 0 }
  );
}

function missingRequiredMappingIssues(mapping: ImportFieldMapping) {
  const mappedTargets = new Set(Object.values(mapping));
  return requiredImportTargetFields
    .filter((field) => !mappedTargets.has(field.value))
    .map((field) => ({
      rowNumber: 0,
      severity: "REVIEW" as const,
      fieldName: field.value,
      issueCode: `UNMAPPED_${field.value}`.toUpperCase(),
      message: `Required field "${field.label}" is not mapped to any source column.`,
      suggestedFix: "Map a source column to this target field before approval."
    }));
}
