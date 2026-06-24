import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { previewAttendanceImport } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({ rows: z.array(z.record(z.unknown())).default([]) });

export async function POST(request: Request) {
  const principal = await requirePermission("attendance.import");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid attendance import preview.", details: parsed.error.flatten() }, { status: 400 });
  const [employees, existing] = await Promise.all([
    prisma.employee.findMany({ select: { employeeId: true } }),
    prisma.attendanceRecord.findMany({ select: { employeeId: true, attendanceDate: true }, take: 5000 })
  ]);
  const known = new Set(employees.map((employee) => employee.employeeId));
  const existingKeys = new Set(existing.map((record) => `${record.employeeId}|${record.attendanceDate.toISOString().slice(0, 10)}`));
  const preview = previewAttendanceImport(parsed.data.rows, known, existingKeys);
  await writeAuditLog({ userId: principal.id, action: "ATTENDANCE_IMPORT", entityType: "AttendanceImportPreview", newValue: { rows: preview.length, blocked: preview.filter((row) => row.blockers.length).length } });
  return NextResponse.json({ preview });
}
