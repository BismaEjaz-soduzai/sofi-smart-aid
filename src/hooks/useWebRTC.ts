import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export type CallState = "idle" | "calling" | "ringing" | "connected";

export interface IncomingCall {
  from: string;
  fromName: string;
  isVideo: boolean;
}

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
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
  const incomingCallDataRef = useRef<{ from: string; offer: RTCSessionDescriptionInit; isVideo: boolean } | null>(null);

  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

  // Call duration timer
  useEffect(() => {
    if (callState === "connected") {
      setCallDuration(0);
      callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
    } else {
      if (callTimerRef.current) { clearInterval(callTimerRef.current); callTimerRef.current = null; }
      setCallDuration(0);
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
      channelRef.current?.send({
        type: "broadcast", event: "webrtc-signal",
        payload: { from: user?.id, to: peerId, type: "call-end", data: null },
      });
    });
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();
    pendingCandidates.current.clear();

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setCallState("idle");
    setIsScreenSharing(false);
    setIncomingCall(null);
    incomingCallDataRef.current = null;
  }, [user]);

  const rejectCall = useCallback(() => {
    if (incomingCallDataRef.current) {
      channelRef.current?.send({
        type: "broadcast", event: "webrtc-signal",
        payload: { from: user?.id, to: incomingCallDataRef.current.from, type: "call-rejected", data: null },
      });
    }
    setIncomingCall(null);
    setCallState("idle");
    incomingCallDataRef.current = null;
  }, [user]);

  useEffect(() => { return () => { endCall(); }; }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS, iceCandidatePoolSize: 10 });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast", event: "webrtc-signal",
          payload: { from: user!.id, to: peerId, type: "ice-candidate", data: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams((prev) => {
        const next = new Map(prev);
        next.set(peerId, event.streams[0]);
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === "connected") setCallState("connected");
      if (state === "failed") {
        // Attempt ICE restart
        console.log("Connection failed, attempting ICE restart for", peerId);
        pc.restartIce();
        const sender = pc.getSenders()[0];
        if (sender) {
          pc.createOffer({ iceRestart: true }).then((offer) => {
            pc.setLocalDescription(offer);
            channelRef.current?.send({
              type: "broadcast", event: "webrtc-signal",
              payload: { from: user!.id, to: peerId, type: "offer", data: offer },
            });
          }).catch(() => removePeer(peerId));
        }
      }
      if (state === "disconnected") {
        // Give it a few seconds before removing
        setTimeout(() => {
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
            removePeer(peerId);
            if (peerConnections.current.size === 0) endCall();
          }
        }, 5000);
      }
    };

    pc.onicegatheringstatechange = () => {
      console.log("ICE gathering state:", pc.iceGatheringState, "for peer:", peerId);
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnections.current.set(peerId, pc);

    const pending = pendingCandidates.current.get(peerId);
    if (pending) {
      pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingCandidates.current.delete(peerId);
    }

    return pc;
  }, [user, removePeer, endCall]);

  // Signaling channel
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`webrtc-${roomId}`, {
      config: { broadcast: { self: false } },
    });

    channel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (!payload || payload.to !== user.id) return;
        const { from, type, data } = payload;

        if (type === "call-invite") {
          // Store invite data and show ringing UI
          incomingCallDataRef.current = { from, offer: data?.offer, isVideo: data?.isVideo ?? true };
          setIncomingCall({ from, fromName: data?.fromName || "Someone", isVideo: data?.isVideo ?? true });
          setCallState("ringing");
        } else if (type === "offer") {
          // Direct offer (after accepting or from initiator)
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
          channelRef.current?.send({
            type: "broadcast", event: "webrtc-signal",
            payload: { from: user.id, to: from, type: "answer", data: answer },
          });
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
          channelRef.current?.send({
            type: "broadcast", event: "webrtc-signal",
            payload: { from: user.id, to: from, type: "offer", data: offer },
          });
        } else if (type === "call-rejected") {
          setCallState("idle");
        } else if (type === "call-end") {
          removePeer(from);
          if (peerConnections.current.size === 0) endCall();
        }
      })
      .subscribe((status) => {
        console.log("WebRTC channel status:", status);
      });

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId, user, createPeerConnection, removePeer, endCall]);

  const acceptCall = useCallback(async () => {
    const callData = incomingCallDataRef.current;
    if (!callData) return;

    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: callData.isVideo });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoEnabled(callData.isVideo);
      setIncomingCall(null);

      // Tell caller we accepted so they send the offer
      channelRef.current?.send({
        type: "broadcast", event: "webrtc-signal",
        payload: { from: user!.id, to: callData.from, type: "call-accepted", data: null },
      });
      setCallState("calling");
    } catch (err) {
      console.error("Failed to accept call:", err);
      rejectCall();
    }
  }, [user, rejectCall]);

  const startCall = useCallback(async (memberIds: string[], videoEnabled = true, memberNames?: Map<string, string>) => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      }
      setLocalStream(stream);
      localStreamRef.current = stream;
      setIsVideoEnabled(videoEnabled);
      setCallState("calling");

      const myName = memberNames?.get(user?.id || "") || "Someone";

      for (const memberId of memberIds) {
        if (memberId === user?.id) continue;

        // Send call invite first (shows ringing UI on receiver)
        channelRef.current?.send({
          type: "broadcast", event: "webrtc-signal",
          payload: {
            from: user!.id, to: memberId, type: "call-invite",
            data: { isVideo: videoEnabled, fromName: myName },
          },
        });
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [user]);

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
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

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
