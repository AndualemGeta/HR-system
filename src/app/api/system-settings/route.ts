import { SystemSettingValueType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canViewSystemSetting } from "@/lib/phase4-access";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const settingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
  valueType: z.nativeEnum(SystemSettingValueType).default("STRING"),
  description: z.string().optional().nullable(),
  isSensitive: z.coerce.boolean().default(false)
});

export async function GET() {
  const principal = await requirePermission("system_settings.view");
  if (isApiError(principal)) return principal;

  const settings = await prisma.systemSetting.findMany({ orderBy: { key: "asc" }, take: 200 });
  return NextResponse.json({
    settings: settings.map((setting) => ({
      ...setting,
      value: canViewSystemSetting(principal, setting.isSensitive) ? setting.value : "REDACTED"
    }))
  });
}

export async function POST(request: Request) {
  const principal = await requirePermission("system_settings.update");
  if (isApiError(principal)) return principal;

  const parsed = settingSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid system setting.", details: parsed.error.flatten() }, { status: 400 });
  }

  const setting = await prisma.systemSetting.upsert({
    where: { key: parsed.data.key },
    create: { ...parsed.data, updatedById: principal.id },
    update: { ...parsed.data, updatedById: principal.id }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "SYSTEM_SETTING_UPDATE",
    entityType: "SystemSetting",
    entityId: setting.id,
    newValue: { key: setting.key, valueType: setting.valueType, isSensitive: setting.isSensitive }
  });

  return NextResponse.json({ setting: { ...setting, value: setting.isSensitive ? "REDACTED" : setting.value } });
}
