import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export type CallState = "idle" | "calling" | "ringing" | "connected";

export interface IncomingCall {
  from: string;
  fromName: string;
  isVideo: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  {
    urls: "turn:a.relay.metered.ca:80",
    username: "e8dd65b92f6dce2f36e0d574",
    credential: "uWdxNjhGOCVBJEFk",
  },
  {
    urls: "turn:a.relay.metered.ca:80?transport=tcp",
    username: "e8dd65b92f6dce2f36e0d574",
    credential: "uWdxNjhGOCVBJEFk",
  },
  {
    urls: "turn:a.relay.metered.ca:443",
    username: "e8dd65b92f6dce2f36e0d574",
    credential: "uWdxNjhGOCVBJEFk",
  },
  {
    urls: "turns:a.relay.metered.ca:443?transport=tcp",
    username: "e8dd65b92f6dce2f36e0d574",
    credential: "uWdxNjhGOCVBJEFk",
  },
];

export function useWebRTC(roomId?: string) {
  const { user } = useAuth();
  const [callState, setCallState] = useState<CallState>("idle");
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [incomingCall, setIncomingCall] = useState<IncomingCall | null>(null);
  const [callDuration, setCallDuration] = useState(0);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const callStateRef = useRef<CallState>("idle");
  const channelStatusRef = useRef<"idle" | "subscribing" | "subscribed">("idle");
  const channelReadyResolvers = useRef<Array<(ready: boolean) => void>>([]);
  // Track which invites we've already seen to prevent duplicates
  const processedInvites = useRef<Set<string>>(new Set());

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);
  useEffect(() => { callStateRef.current = callState; }, [callState]);

  const resolveChannelWaiters = useCallback((ready: boolean) => {
    const waiters = [...channelReadyResolvers.current];
    channelReadyResolvers.current = [];
    waiters.forEach((resolve) => resolve(ready));
  }, []);

  const waitForChannelReady = useCallback(async () => {
    if (channelStatusRef.current === "subscribed") return true;

    return await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(channelStatusRef.current === "subscribed"), 4000);
      channelReadyResolvers.current.push((ready) => {
        clearTimeout(timeout);
        resolve(ready);
      });
    });
  }, []);

  const sendSignal = useCallback(async (peerId: string, type: string, data: unknown) => {
    if (!user?.id) return false;

    const ready = await waitForChannelReady();
    if (!ready || !channelRef.current) {
      console.warn(`WebRTC channel not ready for ${type}`);
      return false;
    }

    try {
      await channelRef.current.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: { from: user.id, to: peerId, type, data },
      });
      return true;
    } catch (error) {
      console.error(`Failed to send ${type} signal`, error);
      return false;
    }
  }, [user, waitForChannelReady]);

  // Call duration timer
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      if (callState === "idle") setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [callState]);

  const removePeer = useCallback((peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) { pc.close(); peerConnections.current.delete(peerId); }
    setRemoteStreams((prev) => { const next = new Map(prev); next.delete(peerId); return next; });
  }, []);

  const endCall = useCallback(() => {
    peerConnections.current.forEach((_, peerId) => {
      void sendSignal(peerId, "call-end", null);
    });
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();
    processedInvites.current.clear();

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setCallState("idle");
    setIsScreenSharing(false);
    setIncomingCall(null);
  }, [sendSignal]);

  const rejectCall = useCallback(() => {
    if (incomingCall) {
      void sendSignal(incomingCall.from, "call-rejected", null);
    }
    processedInvites.current.clear();
    setIncomingCall(null);
    setCallState("idle");
  }, [incomingCall, sendSignal]);

  useEffect(() => { return () => { endCall(); }; }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    // Close existing connection first
    const existing = peerConnections.current.get(peerId);
    if (existing) {
      try { existing.close(); } catch {}
      peerConnections.current.delete(peerId);
    }

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        void sendSignal(peerId, "ice-candidate", event.candidate.toJSON());
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        const existing = next.get(peerId);
        if (existing) {
          // Add new track to existing stream if not already there
          const trackIds = existing.getTracks().map(t => t.id);
          if (!trackIds.includes(event.track.id)) {
            existing.addTrack(event.track);
          }
          next.set(peerId, existing);
        } else {
          const remoteStream = event.streams[0] || new MediaStream([event.track]);
          next.set(peerId, remoteStream);
        }
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      console.log(`Peer ${peerId} connection state: ${state}`);
      if (state === "connected") setCallState("connected");
      if (state === "failed") {
        console.log("Connection failed, attempting ICE restart for", peerId);
        toast("Reconnecting call...", { duration: 2000 });
        pc.restartIce();
        pc.createOffer({ iceRestart: true }).then((offer) => {
          pc.setLocalDescription(offer);
          void sendSignal(peerId, "offer", offer);
        }).catch(() => {
          toast.error("Call connection lost");
          removePeer(peerId);
        });
      }
      if (state === "disconnected") {
        setTimeout(() => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            removePeer(peerId);
            if (peerConnections.current.size === 0) endCall();
          }
        }, 5000);
      }
    };

    // Add ALL tracks from the stream
    stream.getTracks().forEach((track) => {
      console.log(`Adding track: ${track.kind} enabled=${track.enabled} to peer ${peerId}`);
      pc.addTrack(track, stream);
    });

    peerConnections.current.set(peerId, pc);

    // Flush pending candidates
    const pending = pendingCandidates.current.get(peerId);
    if (pending) {
      pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingCandidates.current.delete(peerId);
    }

    return pc;
  }, [removePeer, endCall, sendSignal]);

  // Signaling channel
  useEffect(() => {
    if (!roomId || !user) return;

    channelStatusRef.current = "subscribing";

    const channel = supabase.channel(`webrtc-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (!payload || payload.to !== user.id) return;
        const { from, type, data } = payload;
        const currentState = callStateRef.current;

        if (type === "call-invite") {
          // Ignore if we're already in a call or already got this invite
          if (currentState !== "idle" && currentState !== "ringing") {
            console.log("Ignoring call-invite, current state:", currentState);
            return;
          }
          // Deduplicate: if we already have an incoming call from this person, ignore
          if (processedInvites.current.has(from)) return;
          processedInvites.current.add(from);

          setIncomingCall({ from, fromName: data?.fromName || "Someone", isVideo: data?.isVideo ?? true });
          setCallState("ringing");
        } else if (type === "offer") {
          let stream = localStreamRef.current;
          if (!stream) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch {
              try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
              } catch (e) {
                console.error("Failed to get media:", e);
                return;
              }
            }
            setLocalStream(stream);
            localStreamRef.current = stream;
          }
          const pc = createPeerConnection(from, stream);
          await pc.setRemoteDescription(new RTCSessionDescription(data));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(from, "answer", answer);
          setCallState("connected");
        } else if (type === "answer") {
          const pc = peerConnections.current.get(from);
          if (pc && pc.signalingState === "have-local-offer") {
            await pc.setRemoteDescription(new RTCSessionDescription(data));
          }
        } else if (type === "ice-candidate") {
          const pc = peerConnections.current.get(from);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
          } else {
            const pending = pendingCandidates.current.get(from) || [];
            pending.push(data);
            pendingCandidates.current.set(from, pending);
          }
        } else if (type === "call-accepted") {
          // The callee accepted, now send the offer
          const stream = localStreamRef.current;
          if (!stream) return;
          const pc = createPeerConnection(from, stream);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          await sendSignal(from, "offer", offer);
        } else if (type === "call-rejected") {
          setCallState("idle");
          processedInvites.current.clear();
        } else if (type === "call-end") {
          removePeer(from);
          processedInvites.current.delete(from);
          if (peerConnections.current.size === 0) endCall();
        }
      })
      .subscribe((status) => {
        console.log("WebRTC channel status:", status);
        if (status === "SUBSCRIBED") {
          channelStatusRef.current = "subscribed";
          resolveChannelWaiters(true);
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          channelStatusRef.current = "idle";
          resolveChannelWaiters(false);
        }
      });

    channelRef.current = channel;
    return () => {
      channelStatusRef.current = "idle";
      resolveChannelWaiters(false);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user, createPeerConnection, removePeer, endCall, sendSignal, resolveChannelWaiters]);

  const acceptCall = useCallback(async () => {
    if (!incomingCall) return;
    const callFrom = incomingCall.from;
    const isVideo = incomingCall.isVideo;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: isVideo });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoEnabled(isVideo);
      setIncomingCall(null);

      // Tell caller we accepted so they send the offer
      const accepted = await sendSignal(callFrom, "call-accepted", null);
      if (!accepted) throw new Error("Could not reach caller");
      setCallState("calling");
    } catch (err) {
      console.error("Failed to accept call:", err);
      rejectCall();
    }
  }, [incomingCall, rejectCall, sendSignal]);

  const startCall = useCallback(async (memberIds: string[], videoEnabled = true, memberNames?: Map<string, string>) => {
    try {
      const otherMembers = memberIds.filter((memberId) => memberId !== user?.id);
      if (otherMembers.length === 0) {
        toast.error("No other members in this room to call");
        return;
      }

      const ready = await waitForChannelReady();
      if (!ready) {
        toast.error("Call signaling is not ready — please try again in a moment");
        throw new Error("Call signaling is not ready yet");
      }

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled });
      } catch (mediaErr: any) {
        if (mediaErr?.name === "NotAllowedError") {
          toast.error("🎤 Microphone/camera access denied", { description: "Allow access in your browser settings" });
          throw mediaErr;
        }
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
          toast("Joined audio-only — camera unavailable");
        } catch (audioErr) {
          toast.error("Could not access microphone");
          throw audioErr;
        }
      }

      // Verify tracks are active
      console.log("Local stream tracks:", stream.getTracks().map(t => `${t.kind}:${t.enabled}:${t.readyState}`));

      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoEnabled(videoEnabled);
      setCallState("calling");

      const myName = memberNames?.get(user?.id || "") || "Someone";

      for (const memberId of otherMembers) {
        await sendSignal(memberId, "call-invite", { isVideo: videoEnabled, fromName: myName });

        window.setTimeout(() => {
          if (callStateRef.current === "calling" && !peerConnections.current.has(memberId)) {
            void sendSignal(memberId, "call-invite", { isVideo: videoEnabled, fromName: myName });
          }
        }, 1200);
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [user, sendSignal, waitForChannelReady]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsAudioEnabled((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsVideoEnabled((prev) => !prev);
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      setScreenStream(stream);
      screenStreamRef.current = stream;
      setIsScreenSharing(true);

      const screenTrack = stream.getVideoTracks()[0];

      // Replace video track on ALL peer connections
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        } else {
          // If no video sender exists, add the track
          pc.addTrack(screenTrack, stream);
        }
      });

      // Also share audio from screen if available
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        peerConnections.current.forEach((pc) => {
          pc.addTrack(audioTrack, stream);
        });
      }

      screenTrack.onended = () => { stopScreenShare(); };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    screenStreamRef.current = null;
    setIsScreenSharing(false);

    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        });
      }
    }
  }, []);

  return {
    callState, localStream, screenStream, remoteStreams,
    isAudioEnabled, isVideoEnabled, isScreenSharing,
    incomingCall, callDuration,
    startCall, endCall, acceptCall, rejectCall,
    toggleAudio, toggleVideo,
    startScreenShare, stopScreenShare,
  };
}
