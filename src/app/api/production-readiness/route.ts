import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const defaultChecks = [
  ["environment_variables", "Environment variables confirmed"],
  ["database_migrations", "Database migration procedure confirmed"],
  ["seed_data", "Seed data procedure confirmed"],
  ["admin_user", "Admin user creation confirmed"],
  ["backup_restore", "Backup and restore procedure confirmed"],
  ["file_storage", "File storage configuration confirmed"],
  ["email_configuration", "Email configuration confirmed"],
  ["payroll_rules", "Payroll rules confirmed by HR/Finance"],
  ["role_review", "User role review complete"],
  ["security_review", "Security review complete"],
  ["audit_review", "Audit log review process confirmed"],
  ["export_permissions", "Export permission review complete"],
  ["deployment_steps", "Deployment steps documented"],
  ["rollback_plan", "Rollback plan documented"]
];

const schema = z.object({ key: z.string().min(1), completed: z.coerce.boolean(), notes: z.string().optional().nullable() });

export async function GET() {
  const principal = await requirePermission("production_readiness.view");
  if (isApiError(principal)) return principal;
  for (const [key, label] of defaultChecks) {
    await prisma.productionReadinessCheck.upsert({ where: { key }, update: {}, create: { key, label } });
  }
  const checks = await prisma.productionReadinessCheck.findMany({ orderBy: { key: "asc" } });
  return NextResponse.json({ checks });
}

export async function POST(request: Request) {
  const principal = await requirePermission("production_readiness.view");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid readiness check.", details: parsed.error.flatten() }, { status: 400 });
  const check = await prisma.productionReadinessCheck.update({ where: { key: parsed.data.key }, data: { completed: parsed.data.completed, notes: parsed.data.notes, updatedById: principal.id } });
  return NextResponse.json({ check });
}
