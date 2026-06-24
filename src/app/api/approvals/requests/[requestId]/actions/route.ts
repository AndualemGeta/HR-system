import { ApprovalActionType } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { isApiError, requirePermission } from "@/lib/api";
import { actOnApprovalRequest } from "@/lib/approvals";
import { readRequestData } from "@/lib/request-data";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ requestId: string }>;
};

const actionSchema = z.object({
  action: z.nativeEnum(ApprovalActionType),
  comments: z.string().optional().nullable()
});

export async function POST(request: Request, context: RouteContext) {
  const principal = await requirePermission("approval.act");
  if (isApiError(principal)) return principal;

  const { requestId } = await context.params;
  const parsed = actionSchema.safeParse(await readRequestData(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid approval action.", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const approvalRequest = await actOnApprovalRequest({
      principal,
      approvalRequestId: requestId,
      action: parsed.data.action,
      comments: parsed.data.comments
    });
    return NextResponse.json({ approvalRequest });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Approval action failed." }, { status: 403 });
  }
}
