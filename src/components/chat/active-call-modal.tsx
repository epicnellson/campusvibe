import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { webrtcService, type CallInfo, type CallStatus, type CallType } from "@/services/webrtc";
import { db_ops } from "@/services/db";
import { Avatar } from "@/components/ui/Avatar";
import { ThemedText } from "@/components/themed-text";
import { useToast } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/use-theme";

let RTCView: any = View;
if (Platform.OS !== "web") {
  try {
    const webrtc = require("react-native-webrtc");
    RTCView = webrtc.RTCView;
  } catch {
  }
}

function WebVideo({ stream, style, mirror }: { stream: any; style: any; mirror?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);
  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={mirror}
      style={{
        ...style,
        transform: mirror ? "scaleX(-1)" : undefined,
        objectFit: "cover",
      }}
    />
  );
}

export type ActiveCallModalProps = {
  visible: boolean;
  mode: "outgoing" | "incoming";
  callType: CallType;
  otherUserId?: string;
  callId?: string;
  otherName?: string;
  onAccepted?: () => void;
  onClose: () => void;
};

type Phase = "permissions" | "ringing" | "connecting" | "connected" | "ended" | "error";

function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m.toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;
}

function ControlButton({
  icon,
  label,
  active,
  onPress,
  accessibilityLabel,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
  accessibilityLabel: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      style={[styles.controlButton, active && { backgroundColor: "rgba(255,255,255,0.15)" }]}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
    >
      <Ionicons name={icon} size={24} color="#FFFFFF" />
      <ThemedText style={styles.controlLabel}>{label}</ThemedText>
    </Pressable>
  );
}

export function ActiveCallModal({
  visible,
  mode,
  callType,
  otherUserId,
  callId,
  otherName,
  onAccepted,
  onClose,
}: ActiveCallModalProps) {
  const theme = useTheme();
  const { show: showToast } = useToast();

  const [phase, setPhase] = useState<Phase>("ringing");
  const [remoteStream, setRemoteStream] = useState<any>(null);
  const [localStream, setLocalStream] = useState<any>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState(otherName ?? "User");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingSubRef = useRef<(() => void) | null>(null);
  const phaseRef = useRef<Phase>("ringing");
  const acceptedRef = useRef(false);
  const callIdRef = useRef(callId);
  const otherUserIdRef = useRef(otherUserId);
  const otherNameRef = useRef(otherName ?? "User");

  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    callIdRef.current = callId;
    otherUserIdRef.current = otherUserId;
    otherNameRef.current = otherName ?? "User";
    if (otherName) setDisplayName(otherName);
  }, [callId, otherUserId, otherName]);

  const handlersRef = useRef({
    onRemoteStream: (stream: any) => setRemoteStream(stream),
    onStatusChange: (status: CallStatus) => {
      if (status === "connected") {
        setLocalStream(webrtcService.getLocalStream());
        setPhase("connected");
        if (durationRef.current) clearInterval(durationRef.current);
        durationRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      } else if (status === "ended" || status === "missed") {
        setPhase("ended");
        if (durationRef.current) {
          clearInterval(durationRef.current);
          durationRef.current = null;
        }
      }
    },
    onError: (msg: string) => {
      if (phaseRef.current === "ended") return;
      showToast(msg, "error");
      setErrorMsg(msg);
      setPhase("error");
    },
  });

  useEffect(() => {
    if (!visible || mode !== "outgoing") return;
    let cancelled = false;
    setPhase("permissions");
    setErrorMsg(null);
    setRemoteStream(null);
    setLocalStream(null);
    setDuration(0);
    (async () => {
      const perm = await webrtcService.requestMediaPermissions(callType);
      if (cancelled) return;
      if (!perm.granted) {
        showToast(perm.reason ?? "Permission denied", "error");
        setErrorMsg(perm.reason ?? "Permission denied");
        setPhase("error");
        return;
      }
      let info: CallInfo | null = null;
      try {
        info = await webrtcService.startCall(
          otherUserIdRef.current ?? "",
          callType,
          otherNameRef.current,
          handlersRef.current
        );
      } catch {
        if (!cancelled) {
          setErrorMsg("Failed to start call");
          setPhase("error");
        }
        return;
      }
      if (cancelled) return;
      if (!info) {
        setErrorMsg("Failed to start call");
        setPhase("error");
        return;
      }
      setPhase("ringing");
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, mode, callType, showToast]);

  useEffect(() => {
    if (!visible || mode !== "incoming") return;
    setPhase("ringing");
    setErrorMsg(null);
    setRemoteStream(null);
    setLocalStream(null);
    setDuration(0);

    const cid = callIdRef.current;
    const uid = otherUserIdRef.current;
    if (uid) {
      db_ops
        .get("profiles", uid)
        .then((p: any) => {
          if (p?.avatar_url) setAvatarUrl(p.avatar_url);
        })
        .catch(() => {});
    }
    if (!cid) return;

    incomingSubRef.current = db_ops.subscribeToDoc("calls", cid, (doc: any) => {
      if (!doc) return;
      const st = doc.status as string;
      if (st === "ended" || st === "missed" || st === "rejected" || st === "declined") {
        setPhase("ended");
        webrtcService.close();
      }
    });

    return () => {
      if (incomingSubRef.current) {
        incomingSubRef.current();
        incomingSubRef.current = null;
      }
    };
  }, [visible, mode, callId]);

  useEffect(() => {
    if (!visible || phase !== "connected" || callType !== "audio") return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1600,
          useNativeDriver: Platform.OS !== "web",
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 0,
          useNativeDriver: Platform.OS !== "web",
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [visible, phase, callType, pulse]);

  useEffect(() => {
    if (!visible || phase !== "ended") return;
    closeTimerRef.current = setTimeout(() => {
      onClose();
    }, 1400);
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [visible, phase, onClose]);

  useEffect(() => {
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      const p = phaseRef.current;
      if (mode === "incoming" && callIdRef.current && !acceptedRef.current) {
        // Leaving an un-accepted incoming call (back button, permission denied,
        // error, navigation): mark it missed so the "ringing" doc can't
        // resurrect as a ghost incoming call on the next mount.
        webrtcService.declineCall(callIdRef.current).catch(() => {});
      } else if (acceptedRef.current || (p !== "ended" && p !== "error")) {
        webrtcService.endCall().catch(() => {});
      } else {
        webrtcService.close();
      }
    };
  }, [mode]);

  const handleAccept = useCallback(async () => {
    const cid = callIdRef.current;
    if (!cid) return;
    if (incomingSubRef.current) {
      incomingSubRef.current();
      incomingSubRef.current = null;
    }
    setPhase("permissions");
    const perm = await webrtcService.requestMediaPermissions(callType);
    if (!perm.granted) {
      showToast(perm.reason ?? "Permission denied", "error");
      setErrorMsg(perm.reason ?? "Permission denied");
      setPhase("error");
      return;
    }
    let doc: any = null;
    try {
      doc = await db_ops.get("calls", cid);
      if (!doc) {
        setErrorMsg("Call no longer exists");
        setPhase("error");
        return;
      }
      const info: CallInfo = {
        id: cid,
        callerId: doc.caller_id,
        calleeId: otherUserIdRef.current ?? "",
        callType: (doc.call_type as CallType) ?? callType,
        status: "ringing",
        direction: "incoming",
        otherUserName: otherNameRef.current,
      };
      const ok = await webrtcService.acceptCall(info, handlersRef.current);
      if (!ok) {
        setErrorMsg("Failed to accept call");
        setPhase("error");
        return;
      }
      onAccepted?.();
      acceptedRef.current = true;
      setPhase("connecting");
    } catch {
      setErrorMsg("Failed to accept call");
      setPhase("error");
    }
  }, [callType, onAccepted, showToast]);

  const handleDecline = useCallback(async () => {
    const cid = callIdRef.current;
    if (cid) await webrtcService.declineCall(cid);
    onClose();
  }, [onClose]);

  const handleEnd = useCallback(async () => {
    await webrtcService.endCall();
    setPhase("ended");
  }, []);

  // Android back button: decline an un-accepted incoming call so its "ringing"
  // doc is marked missed and can never re-surface as a ghost later; otherwise
  // end the active call.
  const handleRequestClose = useCallback(() => {
    if (mode === "incoming" && !acceptedRef.current) {
      handleDecline();
    } else {
      handleEnd();
    }
  }, [mode, handleDecline, handleEnd]);

  const handleToggleMute = useCallback(async () => {
    const on = await webrtcService.toggleMute();
    setIsMuted(!on);
  }, []);

  const handleToggleVideo = useCallback(async () => {
    const on = await webrtcService.toggleVideo();
    setIsVideoOn(on);
  }, []);

  const handleToggleSpeaker = useCallback(async () => {
    const on = await webrtcService.toggleSpeaker();
    setIsSpeakerOn(on);
  }, []);

  const showRemoteVideo = !!remoteStream;
  const showLocalPip = !!localStream && callType === "video" && phase === "connected";

  return (
    <Modal
      visible={visible}
      animationType="fade"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <View style={styles.container}>
        {showRemoteVideo && Platform.OS === "web" ? (
          <WebVideo stream={remoteStream} style={styles.remoteVideo} />
        ) : showRemoteVideo ? (
          <RTCView streamURL={remoteStream.toURL()} style={styles.remoteVideo} objectFit="cover" zOrder={0} />
        ) : null}

        {showLocalPip && Platform.OS === "web" ? (
          <WebVideo stream={localStream} style={styles.localVideo} mirror />
        ) : showLocalPip ? (
          <RTCView streamURL={localStream.toURL()} style={styles.localVideo} objectFit="cover" mirror zOrder={1} />
        ) : null}

        {(phase === "permissions" ||
          phase === "ringing" ||
          phase === "connecting" ||
          (phase === "connected" && callType === "audio")) && (
          <View style={styles.center}>
            {phase === "permissions" && <ActivityIndicator size="large" color="#FFFFFF" />}
            <View style={styles.avatarWrap}>
              {callType === "audio" && phase === "connected" ? (
                <>
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      {
                        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }),
                        transform: [
                          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) },
                        ],
                      },
                    ]}
                  />
                  <Animated.View
                    style={[
                      styles.pulseRing,
                      styles.pulseRingInner,
                      {
                        opacity: pulse.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.35, 0.15, 0] }),
                        transform: [
                          { scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] }) },
                        ],
                      },
                    ]}
                  />
                  <Avatar uri={avatarUrl} name={displayName} size={120} style={styles.avatar} />
                </>
              ) : (
                <Avatar uri={avatarUrl} name={displayName} size={96} style={styles.avatar} />
              )}
            </View>
            <ThemedText style={styles.userName}>{displayName}</ThemedText>
            <ThemedText style={styles.status}>
              {phase === "permissions" && "Setting up call..."}
              {phase === "ringing" && (mode === "outgoing" ? "Calling..." : "Incoming call...")}
              {phase === "connecting" && "Connecting..."}
              {phase === "connected" && formatDuration(duration)}
            </ThemedText>
            {mode === "incoming" && phase === "ringing" && (
              <ThemedText style={styles.callType}>
                {callType === "video" ? "Video call" : "Audio call"}
              </ThemedText>
            )}
          </View>
        )}

        {phase === "connected" && (
          <SafeAreaView style={styles.bottomControls}>
            <View style={styles.controlRow}>
              <ControlButton
                icon={isMuted ? "mic-off" : "mic"}
                label={isMuted ? "Unmute" : "Mute"}
                active={isMuted}
                onPress={handleToggleMute}
                accessibilityLabel={isMuted ? "Unmute microphone" : "Mute microphone"}
              />
              {callType === "video" && (
                <ControlButton
                  icon={isVideoOn ? "videocam" : "videocam-off"}
                  label={isVideoOn ? "Video" : "Video Off"}
                  active={!isVideoOn}
                  onPress={handleToggleVideo}
                  accessibilityLabel={isVideoOn ? "Turn off camera" : "Turn on camera"}
                />
              )}
              <ControlButton
                icon={isSpeakerOn ? "volume-high" : "volume-mute"}
                label={isSpeakerOn ? "Speaker" : "Muted"}
                active={!isSpeakerOn}
                onPress={handleToggleSpeaker}
                accessibilityLabel={isSpeakerOn ? "Mute speaker" : "Enable speaker"}
              />
            </View>
            <Pressable
              style={styles.endCallBtn}
              onPress={handleEnd}
              accessibilityLabel="End call"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={styles.endIconRotate} />
            </Pressable>
          </SafeAreaView>
        )}

        {phase === "ringing" && mode === "incoming" && (
          <SafeAreaView style={styles.bottomControls}>
            <View style={styles.incomingRow}>
              <Pressable
                style={styles.declineBtn}
                onPress={handleDecline}
                accessibilityLabel="Decline call"
                accessibilityRole="button"
              >
                <Ionicons name="call" size={28} color="#FFFFFF" style={styles.endIconRotate} />
              </Pressable>
              <Pressable
                style={styles.acceptBtn}
                onPress={handleAccept}
                accessibilityLabel="Accept call"
                accessibilityRole="button"
              >
                <Ionicons name="call" size={28} color="#FFFFFF" />
              </Pressable>
            </View>
          </SafeAreaView>
        )}

        {phase === "ringing" && mode === "outgoing" && (
          <SafeAreaView style={styles.bottomControls}>
            <Pressable
              style={styles.endCallBtn}
              onPress={handleEnd}
              accessibilityLabel="Cancel call"
              accessibilityRole="button"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" style={styles.endIconRotate} />
            </Pressable>
          </SafeAreaView>
        )}

        {phase === "ended" && (
          <View style={styles.center}>
            <Ionicons name="call" size={40} color="#666666" style={styles.endIconRotate} />
            <ThemedText style={styles.endedText}>Call Ended</ThemedText>
            {duration > 0 && <ThemedText style={styles.durationText}>{formatDuration(duration)}</ThemedText>}
            <ActivityIndicator size="small" color="#666666" style={{ marginTop: 16 }} />
          </View>
        )}

        {phase === "error" && errorMsg && (
          <View style={styles.center}>
            <Ionicons name="warning-outline" size={48} color={theme.error} />
            <ThemedText style={styles.errorText}>{errorMsg}</ThemedText>
            <Pressable style={styles.errorBtn} onPress={onClose} accessibilityRole="button">
              <ThemedText style={styles.errorBtnText}>Close</ThemedText>
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
  },
  localVideo: {
    position: "absolute",
    top: Platform.OS === "ios" ? 60 : 30,
    right: 16,
    width: 120,
    height: 180,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.3)",
    overflow: "hidden",
    zIndex: 10,
  },
  avatarWrap: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  avatar: {
    borderWidth: 3,
    borderColor: "rgba(255,255,255,0.25)",
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "#6C47FF",
  },
  pulseRingInner: {
    width: 160,
    height: 160,
    borderRadius: 80,
    borderColor: "#8B6EFF",
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  status: {
    color: "#A1A1AA",
    fontSize: 15,
  },
  callType: {
    color: "#71717A",
    fontSize: 13,
  },
  bottomControls: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
    paddingTop: 16,
    alignItems: "center",
    gap: 24,
  },
  controlRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 20,
  },
  controlButton: {
    alignItems: "center",
    gap: 4,
    width: 64,
    paddingVertical: 8,
    borderRadius: 16,
  },
  controlLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  endIconRotate: {
    transform: [{ rotate: "135deg" }],
  },
  incomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 40,
  },
  declineBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
  },
  acceptBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
  },
  endedText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  durationText: {
    color: "#A1A1AA",
    fontSize: 16,
  },
  errorText: {
    color: "#FFFFFF",
    fontSize: 15,
    textAlign: "center",
    lineHeight: 22,
  },
  errorBtn: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: "#333333",
    borderRadius: 24,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  errorBtnText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
});
