import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface JitsiCallPanelProps {
  roomName: string;
  callUrl: string;
  isVideo: boolean;
  displayName: string;
  onClose: () => void;
}

const JITSI_SCRIPT_SRC = "https://meet.jit.si/external_api.js";
const JITSI_DOMAIN = "meet.jit.si";

interface JitsiApi {
  addEventListener: (event: string, listener: (...args: unknown[]) => void) => void;
  executeCommand: (cmd: string, ...args: unknown[]) => void;
  dispose: () => void;
}

type JitsiCtor = new (domain: string, options: Record<string, unknown>) => JitsiApi;

declare global {
  interface Window {
    JitsiMeetExternalAPI?: JitsiCtor;
  }
}

function loadJitsiScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.JitsiMeetExternalAPI) return Promise.resolve();
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${JITSI_SCRIPT_SRC}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("Failed to load Jitsi script")));
    });
  }
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = JITSI_SCRIPT_SRC;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Jitsi script"));
    document.body.appendChild(s);
  });
}

function extractRoomPath(url: string, fallback: string): string {
  try {
    const u = new URL(url);
    const path = u.pathname.replace(/^\//, "");
    return path || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Fullscreen embedded Jitsi call using the External API.
 * Replaces the previous popup approach.
 */
export default function JitsiCallPanel({
  roomName,
  callUrl,
  isVideo,
  displayName,
  onClose,
}: JitsiCallPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<ReturnType<NonNullable<Window["JitsiMeetExternalAPI"]>["prototype"]["dispose"]> extends void ? InstanceType<NonNullable<Window["JitsiMeetExternalAPI"]>> | null : null>(null) as React.MutableRefObject<InstanceType<NonNullable<Window["JitsiMeetExternalAPI"]>> | null>;
  const endedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const room = extractRoomPath(callUrl, roomName);

    const handleEnd = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
      onClose();
    };

    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) return;
        const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
          roomName: room,
          parentNode: containerRef.current,
          width: "100%",
          height: "100%",
          userInfo: { displayName },
          configOverwrite: {
            prejoinPageEnabled: false,
            startWithAudioMuted: false,
            startWithVideoMuted: !isVideo,
            disableDeepLinking: true,
            toolbarButtons: ["microphone", "camera", "desktop", "tileview", "hangup"],
          },
          interfaceConfigOverwrite: {
            SHOW_JITSI_WATERMARK: false,
            MOBILE_APP_PROMO: false,
            HIDE_INVITE_MORE_HEADER: true,
          },
        });
        apiRef.current = api;
        api.addEventListener("videoConferenceLeft", handleEnd);
        api.addEventListener("readyToClose", handleEnd);
      })
      .catch((err) => {
        console.error("Jitsi load error", err);
        onClose();
      });

    return () => {
      cancelled = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLeave = () => {
    try { apiRef.current?.executeCommand("hangup"); } catch { /* noop */ }
    if (!endedRef.current) {
      endedRef.current = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur flex-shrink-0">
        <div className="flex items-center gap-2 text-sm min-w-0">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-destructive" />
          </span>
          <span className="font-semibold text-foreground">Live</span>
          <span className="text-muted-foreground">·</span>
          <span className="font-mono text-xs text-muted-foreground truncate">{roomName}</span>
        </div>
        <Button
          size="sm"
          variant="destructive"
          onClick={handleLeave}
          className="gap-1.5"
        >
          <PhoneOff className="w-4 h-4" />
          Leave Call
        </Button>
      </div>
      <div ref={containerRef} className="flex-1 min-h-0 w-full bg-black" />
    </div>
  );
}
