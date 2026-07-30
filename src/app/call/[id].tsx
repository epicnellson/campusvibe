import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

import { webrtcService, type CallInfo, type CallStatus, type CallType } from "@/services/webrtc";
import { db_ops } from "@/services/db";
import { auth } from "@/services/firebase";

let RTCView: any = View;
if (Platform.OS !== "web") {
  try {
    const webrtc = require("react-native-webrtc");
    RTCView = webrtc.RTCView;
  } catch {
  }
}

type CallState = "ringing" | "connecting" | "connected" | "ended";

export default function CallScreen() {
  const { id: callId, direction, name } = useLocalSearchParams<{
    id: string;
    direction?: string;
    name?: string;
  }>();
  const user = auth.currentUser;

  const [callState, setCallState] = useState<CallState>("ringing");
  const [callType, setCallType] = useState<CallType>("audio");
  const [otherUserName, setOtherUserName] = useState(name ?? "User");
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [duration, setDuration] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isCaller = direction === "outgoing";

  const remoteStream = webrtcService.getRemoteStream();
  const localStream = webrtcService.getLocalStream();

  useEffect(() => {
    if (!user || !callId) {
      setError("Authentication required");
      return;
    }
    if (isCaller) {
      initOutgoingCall();
    } else {
      listenForIncomingCall();
    }
    return () => {
      if (durationRef.current) clearInterval(durationRef.current);
      webrtcService.close();
    };
  }, []);

  async function initOutgoingCall() {
    const doc = await db_ops.get("calls", callId);
    if (!doc) {
      setError("Call not found");
      return;
    }

    setCallType(doc.call_type as CallType);
    setOtherUserName(name ?? "User");

    const info: CallInfo = {
      id: callId,
      callerId: doc.caller_id,
      calleeId: doc.callee_id,
      callType: doc.call_type as CallType,
      status: "ringing",
      direction: "outgoing",
      otherUserName: name ?? "User",
    };

    const result = await webrtcService.startCall(
      doc.callee_id,
      doc.call_type as CallType,
      name ?? "User",
      {
        onRemoteStream: () => {},
        onStatusChange: handleStatusChange,
        onError: handleError,
      }
    );

    if (!result) {
      setError("Failed to start call");
    }
  }

  async function listenForIncomingCall() {
    if (!callId || !user) return;

    const doc = await db_ops.get("calls", callId);
    if (!doc) {
      setError("Call not found");
      return;
    }

    setCallType(doc.call_type as CallType);

    const calleeProfile = await db_ops.get("profiles", doc.caller_id);
    const calleeName = calleeProfile?.name ?? "User";
    setOtherUserName(calleeName);

    const unsub = db_ops.subscribeToDoc("calls", callId, (updatedDoc) => {
      if (!updatedDoc) return;
      if (updatedDoc.status === "ended" || updatedDoc.status === "missed") {
        setCallState("ended");
        webrtcService.close();
      }
    });

    return () => unsub();
  }

  const handleStatusChange = useCallback((status: CallStatus) => {
    if (status === "connected") {
      setCallState("connected");
      durationRef.current = setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else if (status === "ended" || status === "missed") {
      setCallState("ended");
      if (durationRef.current) clearInterval(durationRef.current);
    }
  }, []);

  const handleError = useCallback((msg: string) => {
    setError(msg);
  }, []);

  const handleAccept = useCallback(async () => {
    if (!callId) return;
    const doc = await db_ops.get("calls", callId);
    if (!doc) return;

    const info: CallInfo = {
      id: callId,
      callerId: doc.caller_id,
      calleeId: doc.callee_id,
      callType: doc.call_type as CallType,
      status: "ringing",
      direction: "incoming",
      otherUserName,
    };

    const ok = await webrtcService.acceptCall(info, {
      onRemoteStream: () => {},
      onStatusChange: handleStatusChange,
      onError: handleError,
    });

    if (!ok) {
      setError("Failed to accept call");
    }
  }, [callId, otherUserName, handleStatusChange, handleError]);

  const handleDecline = useCallback(async () => {
    await webrtcService.declineCall(callId);
    router.back();
  }, [callId]);

  const handleEndCall = useCallback(async () => {
    await webrtcService.endCall();
    router.back();
  }, []);

  const handleToggleMute = useCallback(async () => {
    const muted = await webrtcService.toggleMute();
    setIsMuted(!muted);
  }, []);

  const handleToggleVideo = useCallback(async () => {
    const on = await webrtcService.toggleVideo();
    setIsVideoOn(on);
  }, []);

  const handleSwitchCamera = useCallback(() => {
    webrtcService.switchCamera();
  }, []);

  useEffect(() => {
    if (callState === "ended") {
      const t = setTimeout(() => router.back(), 2000);
      return () => clearTimeout(t);
    }
  }, [callState]);

  const formatDuration = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (error) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <StatusBar barStyle="light-content" />
        <Ionicons name="warning-outline" size={48} color="#FF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.backButtonLarge} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {remoteStream && (
        <RTCView
          streamURL={remoteStream.toURL()}
          style={styles.remoteVideo}
          objectFit="cover"
        />
      )}

      {localStream && callState === "connected" && (
        <RTCView
          streamURL={localStream.toURL()}
          style={styles.localVideo}
          objectFit="cover"
          mirror
        />
      )}

      {!remoteStream && callState !== "ended" && (
        <View style={styles.centerContent}>
          <View style={styles.avatarLarge}>
            <Ionicons
              name={callType === "video" ? "videocam" : "call"}
              size={40}
              color="#FFFFFF"
            />
          </View>
          <Text style={styles.userName}>{otherUserName}</Text>
          <Text style={styles.callStatusText}>
            {callState === "ringing" &&
              (isCaller ? "Calling..." : "Incoming call...")}
            {callState === "connecting" && "Connecting..."}
            {callState === "connected" && formatDuration(duration)}
          </Text>
          {callState === "ringing" && !isCaller && (
            <Text style={styles.callTypeText}>
              {callType === "video" ? "Video call" : "Audio call"}
            </Text>
          )}
        </View>
      )}

      {/* Connected controls */}
      {callState === "connected" && (
        <SafeAreaView style={styles.bottomControls}>
          <View style={styles.controlRow}>
            <Pressable
              style={[styles.controlButton, isMuted && styles.controlButtonActive]}
              onPress={handleToggleMute}
              accessibilityLabel={isMuted ? "Unmute" : "Mute"}
            >
              <Ionicons
                name={isMuted ? "mic-off" : "mic"}
                size={24}
                color="#FFFFFF"
              />
              <Text style={styles.controlLabel}>{isMuted ? "Unmute" : "Mute"}</Text>
            </Pressable>

            {callType === "video" && (
              <Pressable
                style={[styles.controlButton, !isVideoOn && styles.controlButtonActive]}
                onPress={handleToggleVideo}
                accessibilityLabel={isVideoOn ? "Turn off video" : "Turn on video"}
              >
                <Ionicons
                  name={isVideoOn ? "videocam" : "videocam-off"}
                  size={24}
                  color="#FFFFFF"
                />
                <Text style={styles.controlLabel}>
                  {isVideoOn ? "Video" : "Video Off"}
                </Text>
              </Pressable>
            )}

            {callType === "video" && (
              <Pressable
                style={styles.controlButton}
                onPress={handleSwitchCamera}
                accessibilityLabel="Switch camera"
              >
                <Ionicons name="camera-reverse" size={24} color="#FFFFFF" />
                <Text style={styles.controlLabel}>Flip</Text>
              </Pressable>
            )}
          </View>

          <View style={styles.endCallRow}>
            <Pressable
              style={styles.endCallButton}
              onPress={handleEndCall}
              accessibilityLabel="End call"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      )}

      {/* Incoming call controls */}
      {callState === "ringing" && !isCaller && (
        <SafeAreaView style={styles.bottomControls}>
          <View style={styles.incomingRow}>
            <Pressable
              style={styles.declineButton}
              onPress={handleDecline}
              accessibilityLabel="Decline call"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" />
            </Pressable>
            <Pressable
              style={styles.acceptButton}
              onPress={handleAccept}
              accessibilityLabel="Accept call"
            >
              <Ionicons name="call" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </SafeAreaView>
      )}

      {/* Outgoing ringing controls */}
      {callState === "ringing" && isCaller && (
        <SafeAreaView style={styles.bottomControls}>
          <Pressable style={styles.endCallButton} onPress={handleEndCall}>
            <Ionicons name="call" size={28} color="#FFFFFF" />
          </Pressable>
        </SafeAreaView>
      )}

      {/* Ended state */}
      {callState === "ended" && (
        <View style={styles.centerContent}>
          <Text style={styles.callEndedText}>Call Ended</Text>
          {duration > 0 && (
            <Text style={styles.durationText}>{formatDuration(duration)}</Text>
          )}
          <ActivityIndicator size="small" color="#666666" style={{ marginTop: 16 }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  centerContent: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    gap: 12,
  },
  errorText: {
    color: "#FF4444",
    fontSize: 16,
    textAlign: "center",
  },
  backButtonLarge: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: "#333333",
    borderRadius: 24,
  },
  backButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
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
  avatarLarge: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: "#6C47FF",
    alignItems: "center",
    justifyContent: "center",
  },
  userName: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "700",
  },
  callStatusText: {
    color: "#A1A1AA",
    fontSize: 15,
  },
  callTypeText: {
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
  controlButtonActive: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  controlLabel: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "500",
  },
  endCallRow: {
    alignItems: "center",
  },
  endCallButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "135deg" }],
  },
  incomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 40,
  },
  declineButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#FF3B30",
    alignItems: "center",
    justifyContent: "center",
    transform: [{ rotate: "135deg" }],
  },
  acceptButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#34C759",
    alignItems: "center",
    justifyContent: "center",
  },
  callEndedText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "600",
  },
  durationText: {
    color: "#A1A1AA",
    fontSize: 16,
  },
});
