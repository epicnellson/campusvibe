import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Pressable } from "react-native";
import { router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import { Poppins_700Bold, Poppins_800ExtraBold } from "@expo-google-fonts/poppins";
import { Ionicons } from "@expo/vector-icons";

LogBox.ignoreAllLogs(true);

if (typeof window !== "undefined" && typeof window.addEventListener !== "function") {
  window.addEventListener = () => {};
  window.removeEventListener = () => {};
}

if (Platform.OS === "web" && typeof window !== "undefined") {
  window.addEventListener("error", (e: ErrorEvent) => {
    const msg = e.message || "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("cors") ||
      msg.includes("CORS") ||
      msg.includes("ERR_BLOCKED_BY_CLIENT") ||
      msg.includes("ERR_FAILED")
    ) {
      e.preventDefault();
      return true;
    }
  });
  window.addEventListener("unhandledrejection", (e: PromiseRejectionEvent) => {
    const reason = e.reason;
    const msg = reason?.message || String(reason) || "";
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("cors") ||
      msg.includes("CORS") ||
      msg.includes("ERR_BLOCKED_BY_CLIENT") ||
      msg.includes("ERR_FAILED") ||
      msg.includes("AbortError")
    ) {
      e.preventDefault();
      return true;
    }
  });
}

SplashScreen.preventAutoHideAsync().catch(() => {});

import { AnimatedSplashOverlay } from "@/components/animated-icon";
import { SessionProvider } from "@/hooks/use-session";
import { ProfileProvider } from "@/hooks/use-profile";
import { RefreshProvider } from "@/hooks/use-refresh";
import { useNotifications } from "@/hooks/use-notifications";
import { ThemeProvider as AppThemeProvider, useThemePreference } from "@/hooks/use-theme-context";
import { MuteProvider } from "@/hooks/use-mute";
import { PostInteractionsProvider } from "@/hooks/use-post-interactions";
import { ErrorBoundary } from "@/components/error-boundary";
import { NetworkBanner } from "@/components/network-banner";
import { ToastProvider } from "@/components/ui/Toast";
import { getThemeColors, fontSize, fontWeight } from "@/theme";

function NotificationsInitializer() {
  useNotifications();
  return null;
}

function ThemeAwareLayout() {
  const { isDark } = useThemePreference();
  const scheme = isDark ? "dark" : "light";
  const colors = getThemeColors(scheme);

  const [fontsLoaded] = useFonts({
    Poppins_700Bold,
    Poppins_800ExtraBold,
    ...Ionicons.font,
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
    <NavigationThemeProvider value={isDark ? DarkTheme : DefaultTheme}>
      <SafeAreaProvider>
        <SessionProvider>
          <ProfileProvider>
            <ErrorBoundary>
              <NotificationsInitializer />
              <ToastProvider>
                <MuteProvider>
                  <RefreshProvider>
                  <PostInteractionsProvider>
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
                        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
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
                        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
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
                        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
                          <Ionicons name="chevron-back" size={24} color={colors.primary} />
                        </Pressable>
                      ),
                    }}
                  />
                  <Stack.Screen
                    name="new-dm"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="chat/[id]"
                    options={{
                      headerShown: false,
                    }}
                  />
                  <Stack.Screen
                    name="listing/[id]"
                    options={{
                      title: "Listing",
                      headerLeft: () => (
                        <Pressable onPress={() => router.canGoBack() ? router.back() : router.replace("/")} style={{ paddingLeft: Platform.OS === "ios" ? 0 : 8 }}>
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
    name="external/[id]"
    options={{
      title: "Article",
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
  <Stack.Screen
    name="search"
    options={{
      title: "Search",
      headerShown: false,
    }}
  />
  <Stack.Screen
    name="external-content"
    options={{
      ...modalOptions,
      animation: "fade_from_bottom",
    }}
  />
  <Stack.Screen
    name="user/[id]"
    options={{
      title: "Profile",
      headerShown: false,
    }}
  />
                </Stack>
                  </PostInteractionsProvider>
                  </RefreshProvider>
                </MuteProvider>
              </ToastProvider>
            </ErrorBoundary>
          </ProfileProvider>
        </SessionProvider>
      </SafeAreaProvider>
    </NavigationThemeProvider>
  );
}

function RootLayout() {
  return (
    <AppThemeProvider>
      <ThemeAwareLayout />
    </AppThemeProvider>
  );
}

export default RootLayout;
