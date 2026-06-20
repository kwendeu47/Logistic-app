import type { NotificationType, Prisma, User } from "@prisma/client";
import { prisma } from "../config/prisma";
import { sendPushNotification } from "./push";

export interface NotifyUserInput {
  user: User;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function notifyUser({ user, type, title, body, data }: NotifyUserInput): Promise<void> {
  await prisma.notification.create({
    data: {
      userId: user.id,
      type,
      title,
      body,
      ...(data ? { data: data as Prisma.InputJsonValue } : {}),
    },
  });

  try {
    await sendPushNotification({ user, title, body, data });
  } catch (error) {
    console.error("Failed to send push notification", error);
  }
}
