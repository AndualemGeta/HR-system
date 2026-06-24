import { IntegrationEventStatus, Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  eventType: z.string().min(1),
  entityType: z.string().optional().nullable(),
  entityId: z.string().optional().nullable(),
  payloadSummary: z.record(z.unknown()).optional().nullable(),
  status: z.nativeEnum(IntegrationEventStatus).default("CREATED"),
  errorMessage: z.string().optional().nullable()
});

export async function GET() {
  const principal = await requirePermission("integration_event.view");
  if (isApiError(principal)) return principal;
  const events = await prisma.integrationEventLog.findMany({ orderBy: { createdAt: "desc" }, take: 300 });
  return NextResponse.json({ events });
}

export async function POST(request: Request) {
  const principal = await requirePermission("integration_event.view");
  if (isApiError(principal)) return principal;
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration event.", details: parsed.error.flatten() }, { status: 400 });
  const event = await prisma.integrationEventLog.create({
    data: {
      ...parsed.data,
      payloadSummary: parsed.data.payloadSummary == null ? Prisma.JsonNull : parsed.data.payloadSummary as Prisma.InputJsonValue
    }
  });
  await writeAuditLog({ userId: principal.id, action: "INTEGRATION_EVENT_CREATE", entityType: "IntegrationEventLog", entityId: event.id, newValue: event });
  return NextResponse.json({ event }, { status: 201 });
}
