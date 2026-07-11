import { useEffect, useRef } from "react";
import { Platform } from "react-native";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { router } from "expo-router";

import { registerPushToken } from "@/services/notifications";

const isNative = Platform.OS !== "web";

async function getExpoPushToken(): Promise<string | null> {
  if (!isNative) return null;
  if (!Device.isDevice) {
    console.warn("Push notifications only work on physical devices");
    return null;
  }

  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;

  if (existing !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    console.warn("Notification permission not granted");
    return null;
  }

  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: undefined,
    });
    return tokenData.data;
  } catch {
    console.warn("Failed to get Expo push token");
    return null;
  }
}

export function useNotifications() {
  const responseListener = useRef<{ remove: () => void } | null>(null);

  useEffect(() => {
    if (!isNative) return;

    try {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
    } catch {
      console.warn("Failed to set notification handler");
    }

    getExpoPushToken().then((token) => {
      if (token) registerPushToken(token);
    }).catch((e) => {
      console.warn("Push token registration failed:", e);
    });

    if (Platform.OS === "android") {
      Notifications.setNotificationChannelAsync("default", {
        name: "default",
        importance: Notifications.AndroidImportance.MAX,
      });
    }

    responseListener.current =
      Notifications.addNotificationResponseReceivedListener(
        (response: Notifications.NotificationResponse) => {
          const data = response.notification.request.content
            .data as Record<string, string | undefined>;

          if (data?.type === "chat" && data?.channelId) {
            router.push(`/chat/${data.channelId}`);
          } else if (data?.type === "event" && data?.eventId) {
            router.push(`/(tabs)/events`);
          } else if (data?.type === "post") {
            router.push(`/(tabs)`);
          }
        }
      );

    Notifications.getLastNotificationResponseAsync()
      .then(
        (response: Notifications.NotificationResponse | null) => {
          if (response) {
            const data = response.notification.request.content
              .data as Record<string, string | undefined>;
            if (data?.type === "chat" && data?.channelId) {
              router.push(`/chat/${data.channelId}`);
            } else if (data?.type === "event" && data?.eventId) {
              router.push(`/(tabs)/events`);
            }
          }
        }
      )
      .catch(() => {
        // Silently ignore — this API is unavailable on web
      });

    return () => {
      responseListener.current?.remove();
    };
  }, []);
}
