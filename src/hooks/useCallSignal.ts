import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface ActiveCall {
  callUrl: string;
  isVideo: boolean;
  startedBy: string;
  startedAt: number;
  roomName: string;
}

export function makeSessionRoomName(roomId: string): string {
  const slug = roomId.replace(/-/g, "").slice(0, 16);
  const stamp = Date.now().toString(36).slice(-4);
  return `sofi-${slug}-${stamp}`;
}

export function makeSessionCallUrl(roomId: string): string {
  return `https://meet.jit.si/${makeSessionRoomName(roomId)}`;
}

function roomNameFromUrl(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname.replace(/^\//, "") || "sofi-room";
  } catch {
    return "sofi-room";
  }
}

export function useCallSignal(roomId: string) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recStreamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const startCall = useCallback(
    async (
      isVideo: boolean,
      displayName: string,
      onPostMessage?: (displayText: string, callUrl: string) => void | Promise<void>,
    ) => {
      const roomName = makeSessionRoomName(roomId);
      const callUrl = `https://meet.jit.si/${roomName}`;
      const call: ActiveCall = {
        callUrl,
        isVideo,
        startedBy: displayName,
        startedAt: Date.now(),
        roomName,
      };
      setActiveCall(call);
      const displayText = isVideo
        ? `📹 ${displayName} started a video call`
        : `📞 ${displayName} started a voice call`;
      try {
        await onPostMessage?.(displayText, callUrl);
      } catch (err) {
        console.error("Failed to post call message", err);
      }
    },
    [roomId],
  );

  const joinCall = useCallback(
    (callUrl: string) => {
      setActiveCall((prev) => {
        if (prev && prev.callUrl === callUrl) return prev;
        return {
          callUrl,
          isVideo: true,
          startedBy: prev?.startedBy ?? "Someone",
          startedAt: prev?.startedAt ?? Date.now(),
          roomName: roomNameFromUrl(callUrl),
        };
      });
    },
    [],
  );

  const endCall = useCallback(() => {
    setActiveCall(null);
  }, []);

  const stopAllRecStreams = () => {
    recStreamsRef.current.forEach((s) => s.getTracks().forEach((t) => t.stop()));
    recStreamsRef.current = [];
    if (audioCtxRef.current) {
      try { audioCtxRef.current.close(); } catch { /* noop */ }
      audioCtxRef.current = null;
    }
  };

  const startRecording = useCallback(
    async (onSave: (blob: Blob, filename: string) => void | Promise<void>) => {
      try {
        // Capture screen with system audio (for the call audio)
        const display = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });

        // Capture mic so the user's voice is also recorded
        let mic: MediaStream | null = null;
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
          console.warn("Mic capture denied — recording without microphone", err);
        }

        // Merge audio tracks (display audio + mic) using WebAudio
        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();

        const displayAudioTracks = display.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          const src = ctx.createMediaStreamSource(new MediaStream(displayAudioTracks));
          src.connect(dest);
        }
        if (mic && mic.getAudioTracks().length > 0) {
          const src = ctx.createMediaStreamSource(mic);
          src.connect(dest);
        }

        const mixed = new MediaStream([
          ...display.getVideoTracks(),
          ...dest.stream.getAudioTracks(),
        ]);

        recStreamsRef.current = mic ? [display, mic] : [display];

        chunksRef.current = [];
        const recorder = new MediaRecorder(mixed, { mimeType: "video/webm" });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          chunksRef.current = [];
          stopAllRecStreams();
          const filename = `recording-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
          try {
            await onSave(blob, filename);
          } catch (err) {
            console.error("Save recording failed", err);
            toast.error("Failed to save recording");
          }
        };

        // If user ends share via browser UI
        display.getVideoTracks()[0].addEventListener("ended", () => {
          if (recorder.state !== "inactive") recorder.stop();
          setIsRecording(false);
          if (recTimerRef.current) {
            window.clearInterval(recTimerRef.current);
            recTimerRef.current = null;
          }
        });

        recorder.start(1000);
        setIsRecording(true);
        setRecordingTime(0);
        recTimerRef.current = window.setInterval(() => {
          setRecordingTime((t) => t + 1);
        }, 1000);
        toast.success("Recording started (screen + mic)");
      } catch (err) {
        console.error("startRecording error", err);
        toast.error("Could not start recording");
        stopAllRecStreams();
      }
    },
    [],
  );

  const stopRecording = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.stop();
    }
    recorderRef.current = null;
    setIsRecording(false);
    if (recTimerRef.current) {
      window.clearInterval(recTimerRef.current);
      recTimerRef.current = null;
    }
    setRecordingTime(0);
  }, []);

  const formatRecTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  useEffect(() => {
    return () => {
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
      stopAllRecStreams();
    };
  }, []);

  return {
    activeCall,
    isRecording,
    recordingTime,
    startCall,
    joinCall,
    endCall,
    startRecording,
    stopRecording,
    formatRecTime,
  };
}
