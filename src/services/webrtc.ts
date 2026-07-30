import { Platform } from "react-native";
import { db_ops } from "@/services/db";
import { getCurrentUser } from "@/services/firebase";

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

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

function loadWebrtc(): any {
  if (Platform.OS === "web") return null;
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
  private webrtc: any = null;

  private getWebrtc() {
    if (!this.webrtc) this.webrtc = loadWebrtc();
    return this.webrtc;
  }

  async requestCameraAndAudioPermission(): Promise<boolean> {
    if (Platform.OS === "web") return false;
    const w = this.getWebrtc();
    if (!w) return false;
    try {
      const granted = await w.mediaDevices.getUserMedia({ audio: true, video: true });
      granted.getTracks().forEach((t: any) => t.stop());
      return true;
    } catch {
      return false;
    }
  }

  async startLocalStream(callType: CallType): Promise<any> {
    const w = this.getWebrtc();
    if (!w) return null;
    try {
      this.localStream = await w.mediaDevices.getUserMedia({
        audio: true,
        video: callType === "video" ? { facingMode: "user" } : false,
      });
      return this.localStream;
    } catch {
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
    if (!stream) {
      handlers.onError("Could not access camera/microphone");
      return null;
    }

    const callData = {
      caller_id: user.uid,
      callee_id: calleeId,
      call_type: callType,
      status: "ringing",
      offer: null,
      answer: null,
      caller_ice: [],
      callee_ice: [],
      answered_at: null,
      ended_at: null,
    };

    const w = this.getWebrtc();
    if (!w) {
      handlers.onError("WebRTC not available on this platform");
      return null;
    }

    const callId = await db_ops.add("calls", callData);
    this.currentCallId = callId;
    this.amCaller = true;
    this.createPeerConnection();
    this.addLocalTracksToPeer();

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
      if (status === "ended" || status === "missed") {
        this.handlers?.onStatusChange(status as CallStatus);
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
    const track = this.localStream.getVideoTracks()[0];
    if (track) {
      track._switchCamera();
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
        status: "missed",
        ended_at: db_ops.serverTimestamp(),
      });
    } catch {
    }
    this.close();
  }

  close() {
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
