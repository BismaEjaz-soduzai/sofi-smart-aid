import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type CallState = "idle" | "calling" | "ringing" | "connected";

// Free STUN + TURN servers for reliable connectivity
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  // Free TURN relay via OpenRelay (metered.ca free tier)
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

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidates = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Keep refs in sync
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);
  useEffect(() => { screenStreamRef.current = screenStream; }, [screenStream]);

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
  }, [user]);

  // Cleanup on unmount
  useEffect(() => { return () => { endCall(); }; }, []);

  const createPeerConnection = useCallback((peerId: string, stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

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
      if (pc.connectionState === "connected") setCallState("connected");
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") removePeer(peerId);
    };

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    peerConnections.current.set(peerId, pc);

    // Flush any pending ICE candidates
    const pending = pendingCandidates.current.get(peerId);
    if (pending) {
      pending.forEach((c) => pc.addIceCandidate(new RTCIceCandidate(c)).catch(() => {}));
      pendingCandidates.current.delete(peerId);
    }

    return pc;
  }, [user, removePeer]);

  // Set up signaling channel
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`webrtc-${roomId}`);

    channel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        const { from, type, data } = payload;

        if (type === "offer") {
          let stream = localStreamRef.current;
          if (!stream) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
            } catch {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
          if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data));
        } else if (type === "ice-candidate") {
          const pc = peerConnections.current.get(from);
          if (pc && pc.remoteDescription) {
            await pc.addIceCandidate(new RTCIceCandidate(data)).catch(() => {});
          } else {
            // Buffer candidates until remote description is set
            const pending = pendingCandidates.current.get(from) || [];
            pending.push(data);
            pendingCandidates.current.set(from, pending);
          }
        } else if (type === "call-invite") {
          setCallState("ringing");
        } else if (type === "call-end") {
          removePeer(from);
          if (peerConnections.current.size === 0) endCall();
        }
      })
      .subscribe();

    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [roomId, user, createPeerConnection, removePeer, endCall]);

  const startCall = useCallback(async (memberIds: string[], videoEnabled = true) => {
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

      for (const memberId of memberIds) {
        if (memberId === user?.id) continue;

        channelRef.current?.send({
          type: "broadcast", event: "webrtc-signal",
          payload: { from: user!.id, to: memberId, type: "call-invite", data: null },
        });

        const pc = createPeerConnection(memberId, stream);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channelRef.current?.send({
          type: "broadcast", event: "webrtc-signal",
          payload: { from: user!.id, to: memberId, type: "offer", data: offer },
        });
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [user, createPeerConnection]);

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
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
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
    startCall, endCall, toggleAudio, toggleVideo,
    startScreenShare, stopScreenShare,
  };
}
