import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { writeAuditLog } from "@/lib/audit";
import { canManageIntegrationTokens } from "@/lib/phase5-access";
import { hashIntegrationToken, validateIntegrationToken } from "@/lib/phase5-validation";
import { prisma } from "@/lib/prisma";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

const schema = z.object({
  name: z.string().min(1),
  allowedScopes: z.preprocess(parseScopes, z.array(z.string().min(1)).min(1)),
  activeStatus: z.coerce.boolean().default(true),
  expiresAt: z.string().optional().nullable()
});

function parseScopes(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string") return value.split(",").map((scope) => scope.trim()).filter(Boolean);
  return value;
}

export async function GET() {
  const principal = await requirePermission("integration_token.view");
  if (isApiError(principal)) return principal;
  const tokens = await prisma.integrationToken.findMany({
    select: { id: true, name: true, allowedScopes: true, activeStatus: true, createdById: true, createdAt: true, expiresAt: true, lastUsedAt: true },
    orderBy: { createdAt: "desc" },
    take: 200
  });
  return NextResponse.json({ tokens });
}

export async function POST(request: Request) {
  const principal = await requirePermission("integration_token.manage");
  if (isApiError(principal)) return principal;
  if (!canManageIntegrationTokens(principal)) return NextResponse.json({ error: "Only Super Admin can manage integration tokens." }, { status: 403 });
  const parsed = schema.safeParse(await readRequestData(request));
  if (!parsed.success) return NextResponse.json({ error: "Invalid integration token.", details: parsed.error.flatten() }, { status: 400 });
  const issues = validateIntegrationToken({ scopes: parsed.data.allowedScopes, expiresAt: parsed.data.expiresAt });
  if (issues.length) return NextResponse.json({ error: issues[0].message, issues }, { status: 422 });
  const tokenValue = `lsta_${crypto.randomBytes(24).toString("hex")}`;
  const token = await prisma.integrationToken.create({
    data: {
      name: parsed.data.name,
      tokenHash: hashIntegrationToken(tokenValue),
      allowedScopes: parsed.data.allowedScopes,
      activeStatus: parsed.data.activeStatus,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
      createdById: principal.id
    }
  });
  await writeAuditLog({ userId: principal.id, action: "INTEGRATION_TOKEN_CREATE", entityType: "IntegrationToken", entityId: token.id, newValue: { id: token.id, scopes: parsed.data.allowedScopes } });
  return NextResponse.json({ token: { id: token.id, name: token.name, rawToken: tokenValue, allowedScopes: token.allowedScopes, expiresAt: token.expiresAt } }, { status: 201 });
}
