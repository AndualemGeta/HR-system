import { SystemSettingValueType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ settingId: string }>;
};

const updateSchema = z.object({
  value: z.string().optional(),
  valueType: z.nativeEnum(SystemSettingValueType).optional(),
  description: z.string().optional().nullable(),
  isSensitive: z.coerce.boolean().optional()
});

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("system_settings.update");
  if (isApiError(principal)) return principal;

  const { settingId } = await context.params;
  const parsed = updateSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid system setting update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const existing = await prisma.systemSetting.findUnique({ where: { id: settingId } });
  if (!existing) return NextResponse.json({ error: "System setting not found." }, { status: 404 });

  const setting = await prisma.systemSetting.update({
    where: { id: existing.id },
    data: { ...parsed.data, updatedById: principal.id }
  });

  await writeAuditLog({
    userId: principal.id,
    action: "SYSTEM_SETTING_UPDATE",
    entityType: "SystemSetting",
    entityId: setting.id,
    oldValue: { key: existing.key, valueType: existing.valueType, isSensitive: existing.isSensitive },
    newValue: { key: setting.key, valueType: setting.valueType, isSensitive: setting.isSensitive }
  });

  return NextResponse.json({ setting: { ...setting, value: setting.isSensitive ? "REDACTED" : setting.value } });
}
