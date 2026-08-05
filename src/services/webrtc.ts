import { Platform } from "react-native";
import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "turn:openrelay.metered.ca:80", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:443", username: "openrelayproject", credential: "openrelayproject" },
  { urls: "turn:openrelay.metered.ca:80?transport=tcp", username: "openrelayproject", credential: "openrelayproject" },
];

// Ringing call is auto-declared "missed" after this long if nobody answers.
const RINGING_TIMEOUT_MS = 30_000;

export type CallType = "audio" | "video";
export type CallStatus = "ringing" | "connecting" | "connected" | "ended" | "missed";
export type CallDirection = "outgoing" | "incoming";

export type CallInfo = {
  id: string;
  callerId: string;
  calleeId: string;
  callType: CallType;
  status: CallStatus;
  direction: CallDirection;
  otherUserName: string;
};

type CallEventHandlers = {
  onRemoteStream: (stream: any) => void;
  onStatusChange: (status: CallStatus) => void;
  onError: (error: string) => void;
};

export type { CallEventHandlers };

function loadWebrtc(): any {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && typeof window.RTCPeerConnection === "function") {
      return {
        mediaDevices: navigator.mediaDevices,
        RTCPeerConnection: window.RTCPeerConnection,
        RTCSessionDescription: window.RTCSessionDescription,
        RTCIceCandidate: window.RTCIceCandidate,
      };
    }
    return null;
  }
  try {
    return require("react-native-webrtc");
  } catch {
    return null;
  }
}

class WebRTCService {
  private pc: any = null;
  private localStream: any = null;
  private remoteStream: any = null;
  private currentCallId: string | null = null;
  private handlers: CallEventHandlers | null = null;
  private unsubscribeCallDoc: (() => void) | null = null;
  private remoteDescriptionSet = false;
  private processedIceCandidates = new Set<string>();
  private amCaller = false;
  private speakerEnabled = true;
  private webrtc: any = null;
  private ringingTimeout: ReturnType<typeof setTimeout> | null = null;

  private getWebrtc() {
    if (!this.webrtc) this.webrtc = loadWebrtc();
    return this.webrtc;
  }

  async requestCameraAndAudioPermission(): Promise<boolean> {
    const w = this.getWebrtc();
    if (!w) return false;
    try {
      const md = w.mediaDevices ?? w;
      const granted = await md.getUserMedia({ audio: true, video: true });
      granted.getTracks().forEach((t: any) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  private describeMediaError(err: any): string {
    const msg = err?.message ?? "";
    if (msg.includes("NotAllowed") || msg.includes("permission") || msg.includes("Permission")) {
      return "Camera/microphone permission denied. Allow access in your browser or device settings.";
    }
    if (msg.includes("NotFound")) return "No camera or microphone found on this device.";
    if (msg.includes("NotReadable")) return "Camera or microphone is busy. Close other apps using them.";
    if (msg.includes("Overconstrained")) return "No device matches the requested camera settings.";
    return "Could not access camera/microphone.";
  }

  async requestMediaPermissions(callType: CallType): Promise<{ granted: boolean; reason?: string }> {
    const w = this.getWebrtc();
    if (!w) {
      return {
        granted: false,
        reason: Platform.OS === "web"
          ? "Your browser does not support WebRTC. Try Chrome, Firefox, or Safari."
          : "WebRTC not available on this platform",
      };
    }
    if (Platform.OS === "web") {
      try {
        const md = w.mediaDevices ?? w;
        const stream = await md.getUserMedia({
          audio: true,
          video: callType === "video" ? true : false,
        });
        stream.getTracks().forEach((t: any) => t.stop());
        return { granted: true };
      } catch (err: any) {
        return { granted: false, reason: this.describeMediaError(err) };
      }
    }
    try {
      if (callType === "video") {
        const { requestCameraPermissionsAsync } = await import("expo-image-picker");
        const cam = await requestCameraPermissionsAsync();
        if (!cam.granted) {
          return { granted: false, reason: "Camera permission denied. Allow camera access to start a video call." };
        }
      }
      const { requestRecordingPermissionsAsync } = await import("expo-audio");
      const mic = await requestRecordingPermissionsAsync();
      if (!mic.granted) {
        return { granted: false, reason: "Microphone permission denied. Allow microphone access to start a call." };
      }
      return { granted: true };
    } catch {
      return { granted: false, reason: "Could not request media permissions." };
    }
  }

  async toggleSpeaker(): Promise<boolean> {
    if (Platform.OS === "android") {
      try {
        const { setAudioModeAsync } = await import("expo-audio");
        this.speakerEnabled = !this.speakerEnabled;
        await setAudioModeAsync({ shouldRouteThroughEarpiece: !this.speakerEnabled });
        return this.speakerEnabled;
      } catch {
        return this.speakerEnabled;
      }
    }
    this.speakerEnabled = !this.speakerEnabled;
    return this.speakerEnabled;
  }

  async startLocalStream(callType: CallType): Promise<any> {
    const w = this.getWebrtc();
    if (!w) return null;
    try {
      const md = w.mediaDevices ?? w;
      this.localStream = await md.getUserMedia({
        audio: true,
        video: callType === "video" ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false,
      });
      return this.localStream;
    } catch (err: any) {
      this.handlers?.onError(this.describeMediaError(err));
      return null;
    }
  }

  stopLocalStream() {
    if (this.localStream) {
      this.localStream.getTracks().forEach((t: any) => t.stop());
      this.localStream = null;
    }
  }

  private createPeerConnection() {
    if (this.pc) this.close();
    const w = this.getWebrtc();
    if (!w) return;

    this.pc = new w.RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event: any) => {
      if (!event.candidate || !this.currentCallId) return;
      const field = this.amCaller ? "caller_ice" : "callee_ice";
      db_ops.addToArray("calls", this.currentCallId, field, JSON.stringify(event.candidate)).catch(() => {});
    };

    this.pc.oniceconnectionstatechange = () => {
      if (!this.pc) return;
      const state = this.pc.iceConnectionState;
      if (state === "connected" || state === "completed") {
        this.handlers?.onStatusChange("connected");
      } else if (state === "failed") {
        this.handlers?.onStatusChange("ended");
        this.handlers?.onError("Connection failed");
      } else if (state === "disconnected") {
        this.handlers?.onStatusChange("ended");
      }
    };

    this.pc.ontrack = (event: any) => {
      if (event.streams && event.streams[0]) {
        this.remoteStream = event.streams[0];
        this.handlers?.onRemoteStream(event.streams[0]);
      }
    };
  }

  private addLocalTracksToPeer() {
    if (!this.pc || !this.localStream) return;
    this.localStream.getTracks().forEach((track: any) => {
      if (this.localStream) {
        this.pc.addTrack(track, this.localStream);
      }
    });
  }

  async startCall(
    calleeId: string,
    callType: CallType,
    otherUserName: string,
    handlers: CallEventHandlers
  ): Promise<CallInfo | null> {
    const user = getCurrentUser();
    this.handlers = handlers;

    const stream = await this.startLocalStream(callType);
    if (!stream) return null;

    // Fetch the caller's display name/avatar so the callee's incoming-call UI
    // can show who is calling without an extra lookup.
    let callerName = "";
    let callerAvatar: string | null = null;
    try {
      const profile = await db_ops.get("profiles", user.uid);
      callerName = profile?.name ?? "";
      callerAvatar = profile?.avatar_url ?? null;
    } catch {
    }

    const callData = {
      caller_id: user.uid,
      callee_id: calleeId,
      call_type: callType,
      status: "ringing",
      caller_name: callerName,
      caller_avatar_url: callerAvatar,
      offer: null,
      answer: null,
      caller_ice: [],
      callee_ice: [],
      answered_at: null,
      ended_at: null,
      created_at: db_ops.serverTimestamp(),
    };

    const w = this.getWebrtc();
    if (!w) {
      const msg = Platform.OS === "web"
        ? "Your browser does not support WebRTC. Try Chrome, Firefox, or Safari."
        : "WebRTC not available on this platform";
      handlers.onError(msg);
      return null;
    }

    const callId = await db_ops.add("calls", callData);
    this.currentCallId = callId;
    this.amCaller = true;
    this.createPeerConnection();
    this.addLocalTracksToPeer();

    // If nobody answers within 30s, the call is auto-declared "missed" so both
    // sides (caller modal + callee global banner) resolve to a terminal state.
    if (this.ringingTimeout) clearTimeout(this.ringingTimeout);
    this.ringingTimeout = setTimeout(async () => {
      try {
        const doc = await db_ops.get("calls", callId);
        if (doc && doc.status === "ringing") {
          await db_ops.update("calls", callId, {
            status: "missed",
            ended_at: db_ops.serverTimestamp(),
          });
        }
      } catch {
      }
    }, RINGING_TIMEOUT_MS);

    const offer = await this.pc!.createOffer();
    await this.pc!.setLocalDescription(offer);
    await db_ops.update("calls", callId, { offer: JSON.stringify(offer) });

    this.listenForSignaling(callId);

    return {
      id: callId,
      callerId: user.uid,
      calleeId,
      callType,
      status: "ringing",
      direction: "outgoing",
      otherUserName,
    };
  }

  async acceptCall(callInfo: CallInfo, handlers: CallEventHandlers): Promise<boolean> {
    const user = getCurrentUser();
    this.handlers = handlers;
    this.currentCallId = callInfo.id;
    this.amCaller = false;

    const w = this.getWebrtc();
    if (!w) return false;

    const stream = await this.startLocalStream(callInfo.callType);
    if (!stream) return false;

    this.createPeerConnection();
    this.addLocalTracksToPeer();

    const callDoc = await db_ops.get("calls", callInfo.id);
    if (!callDoc || !callDoc.offer) return false;

    const offer = JSON.parse(callDoc.offer);
    await this.pc!.setRemoteDescription(new w.RTCSessionDescription(offer));
    this.remoteDescriptionSet = true;

    const answer = await this.pc!.createAnswer();
    await this.pc!.setLocalDescription(answer);
    await db_ops.update("calls", callInfo.id, {
      status: "connecting",
      answer: JSON.stringify(answer),
      answered_at: db_ops.serverTimestamp(),
    });

    this.listenForSignaling(callInfo.id);
    return true;
  }

  private listenForSignaling(callId: string) {
    this.unsubscribeCallDoc = db_ops.subscribeToDoc("calls", callId, (doc) => {
      if (!doc || !this.pc) return;

      const w = this.getWebrtc();
      const status = doc.status as string;
      if (status === "ended" || status === "missed" || status === "rejected") {
        this.handlers?.onStatusChange(status === "rejected" ? "missed" : (status as CallStatus));
        this.close();
        return;
      }

      if (this.amCaller && doc.answer && !this.remoteDescriptionSet) {
        try {
          const answer = JSON.parse(doc.answer);
          this.pc.setRemoteDescription(new w.RTCSessionDescription(answer));
          this.remoteDescriptionSet = true;
          this.handlers?.onStatusChange("connected");
        } catch {
        }
      }

      if (status === "connecting" || status === "connected") {
        const theirIceField = this.amCaller ? "callee_ice" : "caller_ice";
        const theirIce = doc[theirIceField] as string[] | undefined;
        if (theirIce && Array.isArray(theirIce)) {
          for (const candidateStr of theirIce) {
            if (typeof candidateStr !== "string") continue;
            if (this.processedIceCandidates.has(candidateStr)) continue;
            this.processedIceCandidates.add(candidateStr);
            try {
              this.pc.addIceCandidate(new w.RTCIceCandidate(JSON.parse(candidateStr)));
            } catch {
            }
          }
        }
      }
    });
  }

  async toggleMute(): Promise<boolean> {
    if (!this.localStream) return false;
    const track = this.localStream.getAudioTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  async toggleVideo(): Promise<boolean> {
    if (!this.localStream) return false;
    const track = this.localStream.getVideoTracks()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    return track.enabled;
  }

  async switchCamera() {
    if (!this.localStream) return;
    if (Platform.OS === "web") {
      const track = this.localStream.getVideoTracks()[0];
      if (!track) return;
      const curFacing = track.getSettings?.().facingMode ?? "user";
      const newFacing = curFacing === "user" ? "environment" : "user";
      track.stop();
      const w = this.getWebrtc();
      if (!w) return;
      try {
        const md = w.mediaDevices ?? w;
        const newStream = await md.getUserMedia({
          audio: false,
          video: { facingMode: newFacing, width: { ideal: 640 }, height: { ideal: 480 } },
        });
        const newTrack = newStream.getVideoTracks()[0];
        if (newTrack) {
          this.localStream.removeTrack(track);
          this.localStream.addTrack(newTrack);
        }
      } catch {
        this.handlers?.onError("Could not switch camera.");
      }
    } else {
      const track = this.localStream.getVideoTracks()[0];
      if (track) {
        track._switchCamera();
      }
    }
  }

  async endCall(): Promise<void> {
    if (this.currentCallId) {
      try {
        await db_ops.update("calls", this.currentCallId, {
          status: "ended",
          ended_at: db_ops.serverTimestamp(),
        });
      } catch {
      }
    }
    this.close();
  }

  async declineCall(callId: string): Promise<void> {
    try {
      await db_ops.update("calls", callId, {
        status: "rejected",
        ended_at: db_ops.serverTimestamp(),
      });
    } catch {
    }
    this.close();
  }

  close() {
    if (this.ringingTimeout) {
      clearTimeout(this.ringingTimeout);
      this.ringingTimeout = null;
    }
    if (this.unsubscribeCallDoc) {
      this.unsubscribeCallDoc();
      this.unsubscribeCallDoc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    this.stopLocalStream();
    if (this.remoteStream) {
      this.remoteStream.getTracks().forEach((t: any) => t.stop());
      this.remoteStream = null;
    }
    this.currentCallId = null;
    this.handlers = null;
    this.remoteDescriptionSet = false;
    this.processedIceCandidates.clear();
  }

  isInCall(): boolean {
    return this.currentCallId !== null;
  }

  getRemoteStream(): any {
    return this.remoteStream;
  }

  getLocalStream(): any {
    return this.localStream;
  }
}

export const webrtcService = new WebRTCService();
