import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Platform, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";

import { useSession } from "@/hooks/use-session";
import { useTheme } from "@/hooks/use-theme";
import { createShadow } from "@/theme";
import { db_ops } from "@/services/db";
import { webrtcService } from "@/services/webrtc";
import { Avatar } from "@/components/ui/Avatar";
import { ThemedText } from "@/components/themed-text";
import { ActiveCallModal } from "@/components/chat/active-call-modal";

// A ringing call older than this (caller force-quit / never cleaned up) is
// treated as stale: mark it missed once and never surface it.
const STALE_RING_MS = 45_000;
// The banner auto-declares the call "missed" after this long with no answer.
const BANNER_TIMEOUT_MS = 30_000;

type RingingCall = {
  callId: string;
  callerId: string;
  callType: "audio" | "video";
  callerName: string;
  callerAvatar?: string | null;
};

function createdAtMs(value: any): number | null {
  if (!value) return null;
  if (typeof value.toMillis === "function") return value.toMillis();
  if (typeof value.seconds === "number") return value.seconds * 1000;
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

/**
 * Global incoming-call listener + banner. Surfaces ringing `calls/{callId}`
 * invites to the current user from anywhere in the app (not just the chat
 * screen) and hands off to the full-screen ActiveCallModal on accept.
 */
export function IncomingCallOverlay() {
  const { session } = useSession();
  const currentUserId = session?.user?.id;
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [bannerCall, setBannerCall] = useState<RingingCall | null>(null);
  const [answered, setAnswered] = useState(false);

  const shownIdRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleMarkedRef = useRef<Set<string>>(new Set());
  const inModalRef = useRef(false);
  const slideAnim = useRef(new Animated.Value(-160)).current;

  const clearBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    shownIdRef.current = null;
    setBannerCall(null);
  }, []);

  const startBannerTimer = useCallback((callId: string) => {
    if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    bannerTimerRef.current = setTimeout(() => {
      db_ops
        .get("calls", callId)
        .then((doc: any) => {
          if (doc && doc.status === "ringing") {
            db_ops
              .update("calls", callId, {
                status: "missed",
                ended_at: db_ops.serverTimestamp(),
              })
              .catch(() => {});
          }
        })
        .catch(() => {});
      shownIdRef.current = null;
      setBannerCall(null);
    }, BANNER_TIMEOUT_MS);
  }, []);

  useEffect(() => {
    if (!currentUserId) return;

    const unsub = db_ops.subscribeToCollection(
      "calls",
      (docs: any[]) => {
        for (const d of docs) {
          if (staleMarkedRef.current.has(d.id)) continue;
          const ms = createdAtMs(d.created_at);
          if (ms !== null && Date.now() - ms > STALE_RING_MS) {
            staleMarkedRef.current.add(d.id);
            db_ops
              .update("calls", d.id, {
                status: "missed",
                ended_at: db_ops.serverTimestamp(),
              })
              .catch(() => {});
          }
        }

        // Already handling a call (outgoing from chat, or accepted incoming):
        // don't stack a second ringing banner on top of the call UI.
        if (inModalRef.current || webrtcService.isInCall()) return;

        const active = docs.filter((d) => !staleMarkedRef.current.has(d.id));

        // Keep the currently-shown ringing call pinned while it's still ringing.
        const current = active.find((d) => d.id === shownIdRef.current);
        if (current) return;

        // Otherwise surface the newest ringing invite.
        active.sort((a, b) => (createdAtMs(b.created_at) ?? 0) - (createdAtMs(a.created_at) ?? 0));
        const next = active[0];
        if (!next) {
          if (shownIdRef.current) clearBanner();
          return;
        }
        shownIdRef.current = next.id;
        setBannerCall({
          callId: next.id,
          callerId: next.caller_id,
          callType: next.call_type === "video" ? "video" : "audio",
          callerName: next.caller_name || "User",
          callerAvatar: next.caller_avatar_url ?? null,
        });
        startBannerTimer(next.id);
      },
      {
        conditions: [
          { field: "callee_id", op: "==", value: currentUserId },
          { field: "status", op: "==", value: "ringing" },
        ],
      }
    );

    return () => {
      unsub();
      if (bannerTimerRef.current) {
        clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
      shownIdRef.current = null;
      staleMarkedRef.current.clear();
    };
  }, [currentUserId, clearBanner, startBannerTimer]);

  useEffect(() => {
    if (bannerCall && !answered) {
      slideAnim.setValue(-160);
      Animated.spring(slideAnim, {
        toValue: 0,
        bounciness: 12,
        speed: 14,
        useNativeDriver: Platform.OS !== "web",
      }).start();
    }
  }, [bannerCall, answered, slideAnim]);

  const handleAccept = useCallback(() => {
    if (!bannerCall) return;
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    shownIdRef.current = null;
    inModalRef.current = true;
    setAnswered(true);
  }, [bannerCall]);

  const handleDecline = useCallback(() => {
    if (!bannerCall) return;
    webrtcService.declineCall(bannerCall.callId).catch(() => {});
    clearBanner();
  }, [bannerCall, clearBanner]);

  const handleModalClose = useCallback(() => {
    inModalRef.current = false;
    setAnswered(false);
    clearBanner();
  }, [clearBanner]);

  if (!bannerCall && !answered) return null;

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="box-none"
    >
      {bannerCall && !answered && (
        <Animated.View
          style={[
            styles.bannerWrap,
            { top: insets.top + 8, transform: [{ translateY: slideAnim }] },
          ]}
          pointerEvents="box-none"
        >
          <View style={[styles.banner, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
            <Avatar uri={bannerCall.callerAvatar} name={bannerCall.callerName} size={44} />
            <View style={styles.bannerText}>
              <ThemedText style={styles.bannerTitle} numberOfLines={1}>
                {`Incoming ${bannerCall.callType} call from ${bannerCall.callerName || "User"}`}
              </ThemedText>
              <ThemedText style={styles.bannerSub}>CampusVibe</ThemedText>
            </View>
            <Pressable
              style={[styles.bannerBtn, styles.declineBtn]}
              onPress={handleDecline}
              accessibilityLabel="Decline call"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={20} color="#FFFFFF" style={styles.declineIcon} />
            </Pressable>
            <Pressable
              style={[styles.bannerBtn, styles.acceptBtn]}
              onPress={handleAccept}
              accessibilityLabel="Accept call"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={20} color="#FFFFFF" />
            </Pressable>
          </View>
        </Animated.View>
      )}

      {bannerCall && answered && (
        <ActiveCallModal
          visible
          mode="incoming"
          callType={bannerCall.callType}
          callId={bannerCall.callId}
          otherUserId={bannerCall.callerId}
          otherName={bannerCall.callerName}
          onClose={handleModalClose}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bannerWrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 1000,
    elevation: 1000,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    ...createShadow(12, "#000000", 0.35),
  },
  bannerText: {
    flex: 1,
    gap: 2,
  },
  bannerTitle: {
    fontSize: 14,
    fontWeight: "600",
  },
  bannerSub: {
    fontSize: 12,
    opacity: 0.6,
  },
  bannerBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  declineBtn: {
    backgroundColor: "#FF3B30",
  },
  acceptBtn: {
    backgroundColor: "#34C759",
  },
  declineIcon: {
    transform: [{ rotate: "135deg" }],
  },
});
