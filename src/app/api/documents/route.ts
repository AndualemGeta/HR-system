import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType, DocumentVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canUploadDocument, canViewDocument, employeeToScope } from "@/lib/phase2-access";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const uploadSchema = z.object({
  employeeId: z.string().min(1),
  documentType: z.nativeEnum(DocumentType),
  visibilityLevel: z.nativeEnum(DocumentVisibility).default("PUBLIC_TO_HR"),
  notes: z.string().optional().nullable()
});

export async function GET(request: Request) {
  const principal = await requirePermission("document.view");
  if (isApiError(principal)) return principal;

  const { searchParams } = new URL(request.url);
  const employeeId = searchParams.get("employeeId");

  const documents = await prisma.employeeDocument.findMany({
    where: {
      isActive: true,
      ...(employeeId ? { employee: { OR: [{ id: employeeId }, { employeeId }] } } : {})
    },
    include: {
      employee: {
        select: {
          id: true,
          employeeId: true,
          fullName: true,
          currentRole: true,
          currentDepartmentId: true,
          currentRegionId: true,
          currentShopId: true,
          currentClusterId: true,
          directManagerId: true
        }
      }
    },
    orderBy: { uploadedAt: "desc" },
    take: 100
  });

  const visibleDocuments = documents.filter((document) =>
    canViewDocument(principal, {
      employeeId: document.employeeId,
      visibilityLevel: document.visibilityLevel,
      employee: employeeToScope(document.employee)
    })
  );

  await writeAuditLog({
    userId: principal.id,
    action: "DOCUMENT_VIEW",
    entityType: "EmployeeDocument",
    newValue: { employeeId, count: visibleDocuments.length }
  });

  return NextResponse.json({ documents: visibleDocuments });
}

export async function POST(request: Request) {
  const principal = await requirePermission("document.upload");
  if (isApiError(principal)) return principal;

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a document file." }, { status: 422 });
  }

  const parsed = uploadSchema.safeParse({
    employeeId: formData.get("employeeId"),
    documentType: formData.get("documentType"),
    visibilityLevel: formData.get("visibilityLevel") || "PUBLIC_TO_HR",
    notes: formData.get("notes") || null
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document upload.", details: parsed.error.flatten() }, { status: 400 });
  }

  if (!canUploadDocument(principal, parsed.data.visibilityLevel)) {
    return NextResponse.json({ error: "Permission denied for this document visibility level." }, { status: 403 });
  }

  const employee = await prisma.employee.findFirst({
    where: { OR: [{ id: parsed.data.employeeId }, { employeeId: parsed.data.employeeId }] }
  });
  if (!employee) return NextResponse.json({ error: "Employee not found." }, { status: 404 });

  const uploadDir = path.join(process.cwd(), "uploads", "employee-documents", employee.employeeId);
  await mkdir(uploadDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storedName = `${Date.now()}-${randomUUID()}-${safeName}`;
  const filePath = path.join(uploadDir, storedName);
  await writeFile(filePath, Buffer.from(await file.arrayBuffer()));

  const document = await prisma.employeeDocument.create({
    data: {
      employeeId: employee.id,
      documentType: parsed.data.documentType,
      filePath,
      originalFilename: file.name,
      uploadedById: principal.id,
      visibilityLevel: parsed.data.visibilityLevel,
      notes: parsed.data.notes
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "DOCUMENT_UPLOAD",
    entityType: "EmployeeDocument",
    entityId: document.id,
    newValue: {
      employeeId: employee.id,
      documentType: document.documentType,
      visibilityLevel: document.visibilityLevel,
      originalFilename: document.originalFilename
    }
  });

  return NextResponse.json({ document }, { status: 201 });
}
