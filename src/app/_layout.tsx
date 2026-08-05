import { DarkTheme, DefaultTheme, ThemeProvider as NavigationThemeProvider } from "@react-navigation/native";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { useEffect } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
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

if (Platform.OS === "web" && typeof console !== "undefined") {
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    if (msg.includes("pointerEvents is deprecated")) return;
    // Firestore logs every interrupted Listen transport (QUIC drop, tab
    // throttle, network blip) as a console.warn. The SDK auto-reconnects, so
    // this is noise — suppress it and let the network banner handle UX.
    if (msg.includes("WebChannelConnection") && msg.includes("transport")) return;
    originalWarn(...args);
  };
  const originalError = console.error;
  console.error = (...args: unknown[]) => {
    const msg = args.map(String).join(" ");
    // react-dom (dev) warns when an aria-hidden ancestor wraps a focused
    // element while react-navigation hides inactive screens on web. It's a
    // focus-management artifact of navigation, not an app error.
    if (msg.includes("Blocked aria-hidden on an element because its descendant retained focus")) return;
    // Firestore reports every interrupted Listen transport (QUIC drop, tab
    // throttle, network blip) as a console.error. The SDK auto-reconnects, so
    // this is noise — suppress it and let the network banner handle UX.
    if (msg.includes("WebChannelConnection") && msg.includes("transport")) return;
    originalError(...args);
  };
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
    const msg = (reason?.message ?? "") as string;
    const name = (reason?.name ?? "") as string;
    const isAudioPlayAbort = name === "AbortError" && /play\(\)|interrupted by a call to pause/i.test(msg);
    if (
      msg.includes("Failed to fetch") ||
      msg.includes("NetworkError") ||
      msg.includes("cors") ||
      msg.includes("CORS") ||
      msg.includes("ERR_BLOCKED_BY_CLIENT") ||
      msg.includes("ERR_FAILED") ||
      msg.includes("AbortError") ||
      isAudioPlayAbort
    ) {
      e.preventDefault();
      return true;
    }
  });
}

if (Platform.OS === "web" && typeof document !== "undefined") {
  const style = document.createElement("style");
  style.setAttribute("data-cv", "rnw-focus-reset");
  style.textContent = `
    input:focus, textarea:focus, [contenteditable="true"]:focus {
      outline: none !important;
      box-shadow: none !important;
    }
  `;
  document.head.appendChild(style);
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
import { IncomingCallOverlay } from "@/components/calls/incoming-call-overlay";
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
              {Platform.OS !== "web" && <NotificationsInitializer />}
              <ToastProvider>
                <MuteProvider>
                  <RefreshProvider>
                  <PostInteractionsProvider>
                  <AnimatedSplashOverlay />
                  <NetworkBanner />
                  <IncomingCallOverlay />
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
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="notification-settings"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="notifications"
                    options={{ headerShown: false }}
                  />
                  <Stack.Screen
                    name="privacy"
                    options={{ headerShown: false }}
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
                    options={{ headerShown: false }}
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
  <Stack.Screen
    name="call/[id]"
    options={{
      headerShown: false,
      animation: "fade_from_bottom",
      presentation: "fullScreenModal",
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
