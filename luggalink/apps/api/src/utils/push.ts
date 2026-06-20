import type { User } from "@prisma/client";
import { Expo } from "expo-server-sdk";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export interface SendPushNotificationInput {
  user: Pick<User, "expoPushToken">;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export async function sendPushNotification({
  user,
  title,
  body,
  data,
}: SendPushNotificationInput): Promise<void> {
  if (!user.expoPushToken || !Expo.isExpoPushToken(user.expoPushToken)) {
    return;
  }

  await expo.sendPushNotificationsAsync([{ to: user.expoPushToken, title, body, data }]);
}
