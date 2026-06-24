import { readFile } from "node:fs/promises";
import path from "node:path";
import { DocumentVisibility } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { canUploadDocument, canViewDocument, employeeToScope } from "@/lib/phase2-access";
import { hasPermission } from "@/lib/rbac";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

const documentPatchSchema = z.object({
  visibilityLevel: z.nativeEnum(DocumentVisibility).optional(),
  notes: z.string().nullable().optional(),
  isActive: z.boolean().optional()
});

export async function GET(request: Request, context: RouteContext) {
  const principal = await requirePermission("document.view");
  if (isApiError(principal)) return principal;

  const { documentId } = await context.params;
  const { searchParams } = new URL(request.url);
  const download = searchParams.get("download") === "1";
  const document = await prisma.employeeDocument.findUnique({
    where: { id: documentId },
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
    }
  });

  if (!document || !document.isActive) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }

  if (
    !canViewDocument(principal, {
      employeeId: document.employeeId,
      visibilityLevel: document.visibilityLevel,
      employee: employeeToScope(document.employee)
    })
  ) {
    return NextResponse.json({ error: "Permission denied." }, { status: 403 });
  }

  await writeAuditLog({
    userId: principal.id,
    action: download ? "DOCUMENT_DOWNLOAD" : "DOCUMENT_VIEW",
    entityType: "EmployeeDocument",
    entityId: document.id,
    newValue: {
      employeeId: document.employeeId,
      documentType: document.documentType,
      visibilityLevel: document.visibilityLevel
    }
  });

  if (!download) {
    return NextResponse.json({ document });
  }

  try {
    const bytes = await readFile(document.filePath);
    return new NextResponse(bytes, {
      headers: {
        "content-type": "application/octet-stream",
        "content-disposition": `attachment; filename="${document.originalFilename ?? path.basename(document.filePath)}"`
      }
    });
  } catch {
    return NextResponse.json({ error: "Document file is not available on disk." }, { status: 404 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("document.upload");
  if (isApiError(principal)) return principal;

  const { documentId } = await context.params;
  const existing = await prisma.employeeDocument.findUnique({ where: { id: documentId } });
  if (!existing) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  const parsed = documentPatchSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid document update.", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.visibilityLevel && !canUploadDocument(principal, parsed.data.visibilityLevel)) {
    return NextResponse.json({ error: "Permission denied for this document visibility level." }, { status: 403 });
  }

  if (parsed.data.isActive === false && !hasPermission(principal, "document.deactivate")) {
    return NextResponse.json({ error: "Permission denied for document deactivation." }, { status: 403 });
  }

  const updated = await prisma.employeeDocument.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.visibilityLevel ? { visibilityLevel: parsed.data.visibilityLevel } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {})
    }
  });

  await writeAuditLog({
    userId: principal.id,
    action: parsed.data.isActive === false ? "DOCUMENT_DEACTIVATION" : "DOCUMENT_UPDATE",
    entityType: "EmployeeDocument",
    entityId: updated.id,
    oldValue: {
      visibilityLevel: existing.visibilityLevel,
      notes: existing.notes,
      isActive: existing.isActive
    },
    newValue: {
      visibilityLevel: updated.visibilityLevel,
      notes: updated.notes,
      isActive: updated.isActive
    }
  });

  return NextResponse.json({ document: updated });
}
