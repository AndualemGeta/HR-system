import type { NotificationType, SystemRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export async function createNotification(input: {
  recipientUserId: string;
  title: string;
  message: string;
  notificationType: NotificationType;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) {
  return prisma.notification.create({
    data: {
      recipientUserId: input.recipientUserId,
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null
    }
  });
}

export async function notifyUsersWithRole(input: {
  role: SystemRole;
  title: string;
  message: string;
  notificationType: NotificationType;
  relatedEntityType?: string | null;
  relatedEntityId?: string | null;
}) {
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roles: { some: { role: { name: input.role } } }
    },
    select: { id: true }
  });

  if (users.length === 0) return;
  await prisma.notification.createMany({
    data: users.map((user) => ({
      recipientUserId: user.id,
      title: input.title,
      message: input.message,
      notificationType: input.notificationType,
      relatedEntityType: input.relatedEntityType ?? null,
      relatedEntityId: input.relatedEntityId ?? null
    }))
  });
}
