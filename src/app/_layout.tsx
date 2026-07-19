import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { useColorScheme, LogBox, Platform } from "react-native";
import { useCallback, useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Pressable } from "react-native";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";

LogBox.ignoreAllLogs(true);

// Hermes in RN 0.81 sets global.window = global but global lacks addEventListener.
if (typeof window !== "undefined" && typeof window.addEventListener !== "function") {
  window.addEventListener = () => {};
  window.removeEventListener = () => {};
}

// Keep the native splash screen visible until we explicitly hide it.
SplashScreen.preventAutoHideAsync().catch(() => {});

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { SessionProvider } from "@/hooks/use-session";
import { ProfileProvider } from "@/hooks/use-profile";
import { RefreshProvider } from "@/hooks/use-refresh";
import { useNotifications } from "@/hooks/use-notifications";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkBanner } from "@/components/network-banner";
import { ToastProvider } from "@/components/ui/Toast";
import { getThemeColors, fontSize, fontWeight } from "@/theme";

function NotificationsInitializer() {
  useNotifications();
  return null;
}

function RootLayout() {
  const colorScheme = useColorScheme();
  const scheme = colorScheme === "dark" ? "dark" : "light";
  const colors = getThemeColors(scheme);

  const [fontsLoaded] = useFonts({
    Poppins_700Bold,
    Poppins_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [fontsLoaded]);

  const defaultHeader = {
    headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.primary,
    headerTitleStyle: {
      fontWeight: fontWeight.bold,
      fontSize: fontSize.lg,
      color: colors.text,
    },
    headerTitleAlign: "center" as const,
    headerBackTitleVisible: false,
    headerShadowVisible: false,
    gestureEnabled: true,
    animation: "slide_from_right" as const,
  };

  const modalOptions = {
    presentation: "modal" as const,
    gestureEnabled: true,
    gestureDirection: "vertical" as const,
    headerShown: false,
  };

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <SessionProvider>
          <ProfileProvider>
            <ErrorBoundary>
              <NotificationsInitializer />
              <ToastProvider>
                  <RefreshProvider>
                  <AnimatedSplashOverlay />
                  <NetworkBanner />
                  <Stack screenOptions={defaultHeader}>
                  <Stack.Screen name="index" options={{ headerShown: false }} />
                  <Stack.Screen name="signup" options={{ headerShown: false }} />
                  <Stack.Screen name="login" options={{ headerShown: false }} />
                  <Stack.Screen name="verify" options={{ headerShown: false }} />
                  <Stack.Screen name="onboarding" options={{ headerShown: false }} />
                  <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="confessions" options={{ headerShown: false }} />
                  <Stack.Screen name="compose" options={modalOptions} />
                  <Stack.Screen name="create-event" options={modalOptions} />
                  <Stack.Screen name="create-listing" options={modalOptions} />
                  <Stack.Screen name="verify-student-id" options={modalOptions} />
                  <Stack.Screen
                    name="edit-profile"
                    options={{
                      title: "Edit Profile",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="notification-settings"
                    options={{
                      title: "Notification Settings",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="notifications"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="privacy"
                    options={{
                      title: "Privacy Policy",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="new-dm"
                    options={{
                      title: "New Message",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="chat/[id]"
                    options={{
                      title: "Chat",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="listing/[id]"
                    options={{
                      title: "Listing",
                      headerLeft: () => (
                        <Pressable onPress={() => router.back()} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="post/[id]"
                    options={{
                      title: "Post",
                      headerShown: false,
                    }}
                  />
  <Stack.Screen
    name="event/[id]"
    options={{
      title: "Event",
      headerShown: false,
    }}
  />
  <Stack.Screen
    name="confession/[id]"
    options={{
      title: "Confession",
      headerShown: false,
    }}
  />
  <Stack.Screen
    name="settings"
    options={{
      title: "Settings",
      headerShown: false,
    }}
  />
                </Stack>
              </RefreshProvider>
            </ToastProvider>
            </ErrorBoundary>
          </ProfileProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export default RootLayout;
