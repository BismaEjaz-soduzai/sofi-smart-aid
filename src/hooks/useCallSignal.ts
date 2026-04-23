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

function buildPopupUrl(callUrl: string, displayName: string): string {
  // Append Jitsi config hash to bypass prejoin and set display name automatically
  const hash = `#config.prejoinPageEnabled=false&config.requireDisplayName=false&userInfo.displayName=${encodeURIComponent(displayName)}`;
  // strip any existing hash
  const base = callUrl.split("#")[0];
  return base + hash;
}

/**
 * Call signal hook — opens Jitsi in a popup window (no 5-min demo limit
 * because there's no embedded External API), and tracks the popup so we
 * can auto-end the call when the user closes it, plus refocus on demand.
 *
 * Use via <CallProvider> so the call survives navigation between pages.
 */
export function useCallSignal(roomId: string) {
  const [activeCall, setActiveCall] = useState<ActiveCall | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  const popupRef = useRef<Window | null>(null);
  const popupWatchRef = useRef<number | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<number | null>(null);
  const recStreamsRef = useRef<MediaStream[]>([]);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const clearPopupWatch = () => {
    if (popupWatchRef.current) {
      window.clearInterval(popupWatchRef.current);
      popupWatchRef.current = null;
    }
  };

  const watchPopup = useCallback(() => {
    clearPopupWatch();
    popupWatchRef.current = window.setInterval(() => {
      const w = popupRef.current;
      if (!w || w.closed) {
        clearPopupWatch();
        popupRef.current = null;
        setActiveCall(null);
      }
    }, 2000);
  }, []);

  const openPopup = useCallback(
    (callUrl: string, displayName: string) => {
      // If existing popup is still open, just focus it
      if (popupRef.current && !popupRef.current.closed) {
        try { popupRef.current.focus(); } catch { /* noop */ }
        return popupRef.current;
      }
      const url = buildPopupUrl(callUrl, displayName);
      const popup = window.open(
        url,
        "sofi-call",
        "width=1280,height=720,toolbar=no,menubar=no,location=no,status=no,resizable=yes",
      );
      if (!popup || popup.closed || typeof popup.closed === "undefined") {
        toast.error("Popup was blocked", {
          description: "Allow popups for this site, then click Retry.",
          duration: 15_000,
          action: {
            label: "Retry",
            onClick: () => {
              const retry = window.open(
                url,
                "sofi-call",
                "width=1280,height=720,toolbar=no,menubar=no,location=no,status=no,resizable=yes",
              );
              if (!retry) {
                toast.error("Still blocked. Open the call link manually.", {
                  action: {
                    label: "Open link",
                    onClick: () => window.open(url, "_blank", "noopener,noreferrer"),
                  },
                });
                return;
              }
              popupRef.current = retry;
              try { retry.focus(); } catch { /* noop */ }
              watchPopup();
            },
          },
        });
        return null;
      }
      popupRef.current = popup;
      try { popup.focus(); } catch { /* noop */ }
      watchPopup();
      return popup;
    },
    [watchPopup],
  );

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
      openPopup(callUrl, displayName);
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
    (callUrl: string, displayName: string = "Guest") => {
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
      openPopup(callUrl, displayName);
    },
    [openPopup],
  );

  const focusCall = useCallback(() => {
    const w = popupRef.current;
    if (w && !w.closed) {
      try { w.focus(); } catch { /* noop */ }
    } else if (activeCall) {
      // Popup was closed but state still active — reopen
      openPopup(activeCall.callUrl, activeCall.startedBy);
    }
  }, [activeCall, openPopup]);

  const endCall = useCallback(() => {
    clearPopupWatch();
    const w = popupRef.current;
    if (w && !w.closed) {
      try { w.close(); } catch { /* noop */ }
    }
    popupRef.current = null;
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
        const display = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });

        let mic: MediaStream | null = null;
        try {
          mic = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        } catch (err) {
          console.warn("Mic capture denied — recording without microphone", err);
        }

        const ctx = new AudioContext();
        audioCtxRef.current = ctx;
        const dest = ctx.createMediaStreamDestination();
        const displayAudioTracks = display.getAudioTracks();
        if (displayAudioTracks.length > 0) {
          ctx.createMediaStreamSource(new MediaStream(displayAudioTracks)).connect(dest);
        }
        if (mic && mic.getAudioTracks().length > 0) {
          ctx.createMediaStreamSource(mic).connect(dest);
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
          try { await onSave(blob, filename); }
          catch (err) { console.error("Save recording failed", err); toast.error("Failed to save recording"); }
        };
        display.getVideoTracks()[0].addEventListener("ended", () => {
          if (recorder.state !== "inactive") recorder.stop();
          setIsRecording(false);
          if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
        });
        recorder.start(1000);
        setIsRecording(true);
        setRecordingTime(0);
        recTimerRef.current = window.setInterval(() => setRecordingTime((t) => t + 1), 1000);
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
    if (recorder && recorder.state !== "inactive") recorder.stop();
    recorderRef.current = null;
    setIsRecording(false);
    if (recTimerRef.current) { window.clearInterval(recTimerRef.current); recTimerRef.current = null; }
    setRecordingTime(0);
  }, []);

  const formatRecTime = useCallback((seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = Math.floor(seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  }, []);

  useEffect(() => {
    return () => {
      clearPopupWatch();
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
    focusCall,
    startRecording,
    stopRecording,
    formatRecTime,
  };
}
