import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { isApiError, requirePermission } from "@/lib/api";
import { onboardingItems } from "@/lib/constants";
import { writeAuditLog } from "@/lib/audit";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

const onboardingSchema = z.object({
  items: z.array(
    z.object({
      key: z.string().min(1),
      completed: z.boolean()
    })
  )
});

const defaultOnboardingLabels: Map<string, string> = new Map(onboardingItems);

export async function PATCH(request: Request, context: RouteContext) {
  const principal = await requirePermission("onboarding.update");
  if (isApiError(principal)) return principal;

  const { employeeId } = await context.params;
  const parsed = onboardingSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding update.", details: parsed.error.flatten() }, { status: 400 });
  }

  const employee = await prisma.employee.findFirst({
    where: {
      OR: [{ id: employeeId }, { employeeId }]
    },
    include: {
      onboardingChecklist: {
        include: {
          items: true
        }
      }
    }
  });

  if (!employee) {
    return NextResponse.json({ error: "Employee not found." }, { status: 404 });
  }

  const existingLabels = new Map(employee.onboardingChecklist?.items.map((item) => [item.key, item.label]) ?? []);
  const unknownItem = parsed.data.items.find(
    (item) => !defaultOnboardingLabels.has(item.key) && !existingLabels.has(item.key)
  );

  if (unknownItem) {
    return NextResponse.json({ error: `Unknown onboarding item: ${unknownItem.key}` }, { status: 400 });
  }

  const checklist = await prisma.$transaction(async (tx) => {
    const current =
      employee.onboardingChecklist ??
      (await tx.onboardingChecklist.create({
        data: {
          employeeId: employee.id,
          status: "DRAFT",
          items: {
            create: onboardingItems.map(([key, label]) => ({ key, label }))
          }
        },
        include: {
          items: true
        }
      }));

    const knownLabels = new Map(current.items.map((item) => [item.key, item.label]));
    const now = new Date();

    for (const [key, label] of onboardingItems) {
      if (!knownLabels.has(key)) {
        await tx.onboardingChecklistItem.create({
          data: {
            checklistId: current.id,
            key,
            label
          }
        });
      }
    }

    for (const item of parsed.data.items) {
      const label = knownLabels.get(item.key) ?? defaultOnboardingLabels.get(item.key);
      if (!label) continue;

      await tx.onboardingChecklistItem.upsert({
        where: {
          checklistId_key: {
            checklistId: current.id,
            key: item.key
          }
        },
        update: {
          completed: item.completed,
          completedAt: item.completed ? now : null,
          completedById: item.completed ? principal.id : null
        },
        create: {
          checklistId: current.id,
          key: item.key,
          label,
          completed: item.completed,
          completedAt: item.completed ? now : null,
          completedById: item.completed ? principal.id : null
        }
      });
    }

    const updatedItems = await tx.onboardingChecklistItem.findMany({
      where: { checklistId: current.id },
      orderBy: { label: "asc" }
    });
    const completedCount = updatedItems.filter((item) => item.completed).length;
    const status = completedCount === 0 ? "DRAFT" : completedCount === updatedItems.length ? "APPROVED" : "PENDING";

    return tx.onboardingChecklist.update({
      where: { id: current.id },
      data: {
        status,
        completedAt: status === "APPROVED" ? now : null
      },
      include: {
        items: {
          orderBy: { label: "asc" }
        }
      }
    });
  });

  await writeAuditLog({
    userId: principal.id,
    action: "EMPLOYEE_UPDATE",
    entityType: "OnboardingChecklist",
    entityId: checklist.id,
    newValue: {
      employeeId: employee.id,
      status: checklist.status,
      completedItems: checklist.items.filter((item) => item.completed).length,
      totalItems: checklist.items.length
    }
  });

  return NextResponse.json({ checklist });
}
