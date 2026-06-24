import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { parseHrFile } from "@/lib/import/parse";
import { detectImportTargetField, flattenImportIssues, validateImportRows } from "@/lib/import/validator";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

export async function GET() {
  const principal = await requirePermission("import.view");
  if (isApiError(principal)) return principal;

  const imports = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      rows: { take: 20, orderBy: { rowNumber: "asc" } },
      validationIssues: { take: 50, orderBy: { createdAt: "asc" } },
      fieldMappings: { orderBy: { sourceColumn: "asc" } }
    },
    take: 50
  });

  return NextResponse.json({ imports });
}

export async function POST(request: Request) {
  const principal = await requirePermission("import.validate");
  if (isApiError(principal)) return principal;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a CSV, XLS, or XLSX file." }, { status: 422 });
  }

  const parsed = await parseHrFile(file);
  const firstSheet = parsed.sheets[0];
  if (!firstSheet) {
    return NextResponse.json({ error: "No sheets or rows found in file." }, { status: 422 });
  }

  const employees = await prisma.employee.findMany({
    select: {
      employeeId: true,
      fullName: true,
      phoneNumber: true,
      email: true
    }
  });

  const detectedMapping = Object.fromEntries(
    firstSheet.columns.map((column) => [column, detectImportTargetField(column)])
  );
  const validations = validateImportRows(firstSheet.rows, {
    existingEmployeeIds: employees.map((employee) => employee.employeeId),
    existingContacts: employees,
    fieldMapping: detectedMapping
  });
  const flatIssues = flattenImportIssues(validations);

  const counts = validations.reduce(
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

  const importBatch = await prisma.$transaction(async (tx) => {
    const created = await tx.importBatch.create({
      data: {
        fileName: file.name,
        uploadedFile: file.name,
        sourceType: file.type || file.name.split(".").pop() || "unknown",
        uploadedById: principal.id,
        status: "VALIDATED",
        ...counts,
        columnMapping: detectedMapping,
        validationReport: {
          ...counts,
          issueCount: flatIssues.length,
          sheetName: firstSheet.name,
          columns: firstSheet.columns
        } as Prisma.InputJsonValue,
        fieldMappings: {
          create: firstSheet.columns.map((column) => ({
            sourceColumn: column,
            targetField: detectedMapping[column]
          }))
        },
        rows: {
          create: validations.map((row) => ({
            rowNumber: row.rowNumber,
            sourceData: row.sourceData as Prisma.InputJsonValue,
            normalizedData: row.normalizedData as Prisma.InputJsonValue,
            blockers: row.blockers as Prisma.InputJsonValue,
            warnings: row.warnings as Prisma.InputJsonValue,
            reviewItems: row.reviewItems as Prisma.InputJsonValue,
            status: row.status
          }))
        }
      },
      include: {
        rows: { orderBy: { rowNumber: "asc" } },
        fieldMappings: { orderBy: { sourceColumn: "asc" } }
      }
    });

    const rowIdsByNumber = new Map(created.rows.map((row) => [row.rowNumber, row.id]));
    if (flatIssues.length > 0) {
      await tx.importValidationIssue.createMany({
        data: flatIssues.map((issue) => ({
          importBatchId: created.id,
          importRowId: rowIdsByNumber.get(issue.rowNumber),
          severity: issue.severity,
          fieldName: issue.fieldName,
          issueCode: issue.issueCode,
          message: issue.message,
          suggestedFix: issue.suggestedFix
        }))
      });
    }

    return tx.importBatch.findUniqueOrThrow({
      where: { id: created.id },
      include: {
        rows: { orderBy: { rowNumber: "asc" } },
        fieldMappings: { orderBy: { sourceColumn: "asc" } },
        validationIssues: { orderBy: { createdAt: "asc" } }
      }
    });
  });

  await writeAuditLog({
    userId: principal.id,
    action: "IMPORT_UPLOAD",
    entityType: "ImportBatch",
    entityId: importBatch.id,
    newValue: { fileName: file.name, sourceType: file.type }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "IMPORT_VALIDATION",
    entityType: "ImportBatch",
    entityId: importBatch.id,
    newValue: { ...counts, issueCount: flatIssues.length }
  });

  return NextResponse.json({ importBatch, sheets: parsed.sheets.map(({ name, columns }) => ({ name, columns })) });
}
