import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

type CallState = "idle" | "calling" | "ringing" | "connected";

const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
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
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);

  // Fetch TURN credentials on mount
  useEffect(() => {
    const fetchIceServers = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        const { data, error } = await supabase.functions.invoke("turn-credentials");
        if (!error && data?.iceServers) {
          iceServersRef.current = data.iceServers;
          console.log("ICE servers loaded (STUN+TURN):", data.iceServers.length, "servers");
        }
      } catch (err) {
        console.warn("Using fallback STUN servers:", err);
      }
    };
    fetchIceServers();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      endCall();
    };
  }, []);

  // Set up signaling channel
  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`webrtc-${roomId}`);

    channel
      .on("broadcast", { event: "webrtc-signal" }, async ({ payload }) => {
        if (payload.to !== user.id) return;
        const { from, type, data } = payload;

        if (type === "offer") {
          await handleOffer(from, data);
        } else if (type === "answer") {
          await handleAnswer(from, data);
        } else if (type === "ice-candidate") {
          await handleIceCandidate(from, data);
        } else if (type === "call-invite") {
          setCallState("ringing");
        } else if (type === "call-end") {
          removePeer(from);
          if (peerConnections.current.size === 0) {
            endCall();
          }
        }
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user]);

  const createPeerConnection = useCallback((peerId: string) => {
    const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        channelRef.current?.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { from: user!.id, to: peerId, type: "ice-candidate", data: event.candidate },
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
      if (pc.connectionState === "connected") {
        setCallState("connected");
      } else if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        removePeer(peerId);
      }
    };

    if (localStream) {
      localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));
    }

    peerConnections.current.set(peerId, pc);
    return pc;
  }, [user, localStream]);

  const handleOffer = async (from: string, offer: RTCSessionDescriptionInit) => {
    let stream = localStream;
    if (!stream) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      setLocalStream(stream);
    }

    const pc = createPeerConnection(from);
    stream.getTracks().forEach((track) => pc.addTrack(track, stream!));

    await pc.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    channelRef.current?.send({
      type: "broadcast",
      event: "webrtc-signal",
      payload: { from: user!.id, to: from, type: "answer", data: answer },
    });

    setCallState("connected");
  };

  const handleAnswer = async (from: string, answer: RTCSessionDescriptionInit) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));
    }
  };

  const handleIceCandidate = async (from: string, candidate: RTCIceCandidateInit) => {
    const pc = peerConnections.current.get(from);
    if (pc) {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  };

  const removePeer = (peerId: string) => {
    const pc = peerConnections.current.get(peerId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(peerId);
    }
    setRemoteStreams((prev) => {
      const next = new Map(prev);
      next.delete(peerId);
      return next;
    });
  };

  const startCall = useCallback(async (memberIds: string[], videoEnabled = true) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: videoEnabled });
      setLocalStream(stream);
      setIsVideoEnabled(videoEnabled);
      setCallState("calling");

      for (const memberId of memberIds) {
        if (memberId === user?.id) continue;

        channelRef.current?.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { from: user!.id, to: memberId, type: "call-invite", data: null },
        });

        const pc = new RTCPeerConnection({ iceServers: iceServersRef.current });

        pc.onicecandidate = (event) => {
          if (event.candidate) {
            channelRef.current?.send({
              type: "broadcast",
              event: "webrtc-signal",
              payload: { from: user!.id, to: memberId, type: "ice-candidate", data: event.candidate },
            });
          }
        };

        pc.ontrack = (event) => {
          setRemoteStreams((prev) => {
            const next = new Map(prev);
            next.set(memberId, event.streams[0]);
            return next;
          });
        };

        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "connected") setCallState("connected");
          if (pc.connectionState === "disconnected" || pc.connectionState === "failed") removePeer(memberId);
        };

        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
        peerConnections.current.set(memberId, pc);

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channelRef.current?.send({
          type: "broadcast",
          event: "webrtc-signal",
          payload: { from: user!.id, to: memberId, type: "offer", data: offer },
        });
      }
    } catch (err) {
      console.error("Failed to start call:", err);
      setCallState("idle");
    }
  }, [user]);

  const endCall = useCallback(() => {
    peerConnections.current.forEach((_, peerId) => {
      channelRef.current?.send({
        type: "broadcast",
        event: "webrtc-signal",
        payload: { from: user?.id, to: peerId, type: "call-end", data: null },
      });
    });

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    localStream?.getTracks().forEach((t) => t.stop());
    screenStream?.getTracks().forEach((t) => t.stop());

    setLocalStream(null);
    setScreenStream(null);
    setRemoteStreams(new Map());
    setCallState("idle");
    setIsScreenSharing(false);
  }, [user, localStream, screenStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsAudioEnabled((prev) => !prev);
    }
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach((t) => { t.enabled = !t.enabled; });
      setIsVideoEnabled((prev) => !prev);
    }
  }, [localStream]);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenStream(stream);
      setIsScreenSharing(true);

      const screenTrack = stream.getVideoTracks()[0];

      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => {
        stopScreenShare();
      };
    } catch (err) {
      console.error("Screen share failed:", err);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);

    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        peerConnections.current.forEach((pc) => {
          const sender = pc.getSenders().find((s) => s.track?.kind === "video");
          if (sender) sender.replaceTrack(videoTrack);
        });
      }
    }
  }, [screenStream, localStream]);

  return {
    callState,
    localStream,
    screenStream,
    remoteStreams,
    isAudioEnabled,
    isVideoEnabled,
    isScreenSharing,
    startCall,
    endCall,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
  };
}
