import { NotificationCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const preferenceSchema = z.object({
  category: z.nativeEnum(NotificationCategory),
  inAppEnabled: z.coerce.boolean().default(true),
  emailEnabled: z.coerce.boolean().default(false),
  digestEnabled: z.coerce.boolean().default(false)
});

export async function GET() {
  const principal = await requirePermission("notification_preferences.manage");
  if (isApiError(principal)) return principal;

  const preferences = await prisma.notificationPreference.findMany({
    where: { userId: principal.id },
    orderBy: { category: "asc" }
  });

  return NextResponse.json({ preferences, categories: Object.values(NotificationCategory) });
}

export async function POST(request: Request) {
  const principal = await requirePermission("notification_preferences.manage");
  if (isApiError(principal)) return principal;

  const parsed = preferenceSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid notification preference.", details: parsed.error.flatten() }, { status: 400 });
  }

  const preference = await prisma.notificationPreference.upsert({
    where: { userId_category: { userId: principal.id, category: parsed.data.category } },
    create: { userId: principal.id, ...parsed.data },
    update: parsed.data
  });

  await writeAuditLog({
    userId: principal.id,
    action: "NOTIFICATION_PREFERENCE_UPDATE",
    entityType: "NotificationPreference",
    entityId: preference.id,
    newValue: preference
  });

  return NextResponse.json({ preference });
}
