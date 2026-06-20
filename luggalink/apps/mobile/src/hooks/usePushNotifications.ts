import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { registerDeviceToken } from "../api/auth.api";
import { useAuthStore } from "../store/auth.store";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export function usePushNotifications() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const hasRegisteredRef = useRef(false);

  useEffect(() => {
    if (!isAuthenticated || hasRegisteredRef.current) return;

    async function register() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== "granted") return;

      const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
      const tokenResponse = await Notifications.getExpoPushTokenAsync(
        projectId ? { projectId } : undefined,
      );

      await registerDeviceToken(tokenResponse.data, Platform.OS === "ios" ? "ios" : "android");
      hasRegisteredRef.current = true;
    }

    register().catch(() => {
      // best-effort: push registration failures shouldn't block the app
    });
  }, [isAuthenticated]);

  useEffect(() => {
    const foregroundSub = Notifications.addNotificationReceivedListener(() => {
      // foreground notifications are surfaced via the in-app banner handler above
    });

    return () => {
      foregroundSub.remove();
    };
  }, []);
}
