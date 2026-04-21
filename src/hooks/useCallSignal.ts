import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export interface ActiveCall {
  callUrl: string;
  isVideo: boolean;
  startedBy: string;
  startedAt: number;
}

export function makeSessionCallUrl(roomId: string): string {
  const slug = roomId.replace(/-/g, "").slice(0, 16);
  const stamp = Date.now().toString(36).slice(-4);
  return `https://meet.jit.si/sofi-${slug}-${stamp}`;
}

export function useCallSignal(roomId: string) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const popupRef = useRef<Window | null>(null);
  const pollRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const beginPolling = useCallback(() => {
    stopPolling();
    pollRef.current = window.setInterval(() => {
      if (!popupRef.current || popupRef.current.closed) {
        stopPolling();
        popupRef.current = null;
        setActiveCall(null);
      }
    }, 1500);
  }, [stopPolling]);

  const openPopup = useCallback((url: string) => {
    const win = window.open(url, "sofi-call", "width=1280,height=800,toolbar=no,menubar=no");
    if (!win) {
      toast.error("Popup blocked — please allow popups for this site");
      return null;
    }
    popupRef.current = win;
    beginPolling();
    return win;
  }, [beginPolling]);

  const startCall = useCallback(
    async (
      isVideo: boolean,
      displayName: string,
      onPostMessage?: (displayText: string, callUrl: string) => void | Promise<void>,
    ) => {
      const callUrl = makeSessionCallUrl(roomId);
      const win = openPopup(callUrl);
      if (!win) return;
      const call: ActiveCall = {
        callUrl,
        isVideo,
        startedBy: displayName,
        startedAt: Date.now(),
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
    [roomId, openPopup],
  );

  const joinCall = useCallback(
    (callUrl: string) => {
      // Reuse same window name "sofi-call" — focuses existing if open
      openPopup(callUrl);
      if (!activeCall) {
        setActiveCall({
          callUrl,
          isVideo: true,
          startedBy: "Someone",
          startedAt: Date.now(),
        });
      }
    },
    [openPopup, activeCall],
  );

  const endCall = useCallback(() => {
    try {
      popupRef.current?.close();
    } catch {
      // ignore
    }
    popupRef.current = null;
    stopPolling();
    setActiveCall(null);
  }, [stopPolling]);

  const startRecording = useCallback(
    async (onSave: (blob: Blob, filename: string) => void | Promise<void>) => {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        chunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: "video/webm" });
        recorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.onstop = async () => {
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          chunksRef.current = [];
          stream.getTracks().forEach((t) => t.stop());
          const filename = `recording-${new Date().toISOString()}.webm`;
          try {
            await onSave(blob, filename);
          } catch (err) {
            console.error("Save recording failed", err);
            toast.error("Failed to save recording");
          }
        };

        // Stop if user ends share via browser UI
        stream.getVideoTracks()[0].addEventListener("ended", () => {
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
        toast.success("Recording started");
      } catch (err) {
        console.error("startRecording error", err);
        toast.error("Could not start recording");
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
      stopPolling();
      if (recTimerRef.current) window.clearInterval(recTimerRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        try { recorderRef.current.stop(); } catch { /* noop */ }
      }
    };
  }, [stopPolling]);

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
