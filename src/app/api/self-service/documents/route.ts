import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DocumentType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { jsonError, requirePrincipal, isApiError } from "@/lib/api";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

const uploadSchema = z.object({
  documentType: z.nativeEnum(DocumentType),
  notes: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const principal = await requirePrincipal();
  if (isApiError(principal)) return principal;
  if (!principal.employeeId) return jsonError("No linked employee record.", 400);
  if (!hasPermission(principal, "self_service.document_upload")) return jsonError("Permission denied.", 403);

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return jsonError("Upload a document file.", 422);

  const parsed = uploadSchema.safeParse({
    documentType: formData.get("documentType") || "OTHER",
    notes: formData.get("notes") || null
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid upload.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findUnique({ where: { id: principal.employeeId } });
  if (!employee) return jsonError("Employee not found.", 404);

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
      visibilityLevel: "EMPLOYEE_VISIBLE",
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
      originalFilename: document.originalFilename,
      source: "self_service"
    }
  });

  return NextResponse.json({ document }, { status: 201 });
}
