import { useEffect, useRef, useState } from "react";
import { PhoneOff, Loader2, AlertTriangle, Mic, MicOff, Video, VideoOff, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface JitsiCallPanelProps {
  roomName: string;
  callUrl: string;
  isVideo: boolean;
  displayName: string;
  /** Called when the user truly leaves the call (Leave button confirmed, or Jitsi conference ended). */
  onLeave: () => void;
  /** Optional: called when the user minimizes the panel. Iframe stays alive — parent should hide the panel. */
  onMinimize?: () => void;
  /** When true, panel is rendered hidden (display:none) but iframe remains mounted so the call session is preserved. */
  isMinimized?: boolean;
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

/**
 * Sanitize any input into a safe Jitsi room path.
 * - Strips https://meet.jit.si/ (and any other origin)
 * - Removes leading/trailing slashes
 * - Removes query/hash
 * - Removes characters Jitsi doesn't accept in a room name
 * - Falls back to provided fallback when input is empty
 */
export function sanitizeJitsiRoomName(input: string, fallback: string): string {
  if (!input) return sanitizeJitsiRoomName(fallback, "sofi-room");
  let candidate = input.trim();

  // Try parsing as URL — pull just the path
  try {
    const u = new URL(candidate);
    candidate = u.pathname;
  } catch {
    // Not a URL — strip a leading "meet.jit.si/" if present
    candidate = candidate.replace(/^https?:\/\//i, "").replace(/^meet\.jit\.si\//i, "");
  }

  // Drop any query/hash that may have slipped through
  candidate = candidate.split("?")[0].split("#")[0];

  // Trim slashes & whitespace
  candidate = candidate.replace(/^\/+|\/+$/g, "").trim();

  // Strip any path beyond the first segment
  candidate = candidate.split("/")[0];

  // Allow only safe characters
  candidate = candidate.replace(/[^A-Za-z0-9_-]/g, "");

  if (!candidate) {
    return fallback.replace(/[^A-Za-z0-9_-]/g, "") || "sofi-room";
  }
  return candidate;
}

type PermStatus = "checking" | "granted" | "denied" | "prompt" | "unsupported";

/**
 * Fullscreen embedded Jitsi call using the External API.
 * - Sanitizes room name
 * - Pre-flights mic/camera permissions
 * - Confirms before leaving
 * - Supports minimize → keeps iframe alive so user can return to the call
 * - Loading + error overlays
 */
export default function JitsiCallPanel({
  roomName,
  callUrl,
  isVideo,
  displayName,
  onLeave,
  onMinimize,
  isMinimized = false,
}: JitsiCallPanelProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef<JitsiApi | null>(null);
  const endedRef = useRef(false);

  const [phase, setPhase] = useState<"preflight" | "loading" | "ready" | "error">("preflight");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [micStatus, setMicStatus] = useState<PermStatus>("checking");
  const [camStatus, setCamStatus] = useState<PermStatus>(isVideo ? "checking" : "granted");
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);

  const safeRoomName = sanitizeJitsiRoomName(callUrl || roomName, roomName || "sofi-room");

  // ─── Preflight: request mic/cam permissions BEFORE creating the iframe ───
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setMicStatus("unsupported");
        setCamStatus("unsupported");
        setPhase("loading");
        return;
      }

      // Mic check
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        if (!cancelled) setMicStatus("granted");
      } catch {
        if (!cancelled) setMicStatus("denied");
      }

      // Cam check (only if video call)
      if (isVideo) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          stream.getTracks().forEach((t) => t.stop());
          if (!cancelled) setCamStatus("granted");
        } catch {
          if (!cancelled) setCamStatus("denied");
        }
      } else if (!cancelled) {
        setCamStatus("granted");
      }

      if (!cancelled) setPhase("loading");
    };
    void run();
    return () => { cancelled = true; };
  }, [isVideo]);

  // ─── Initialize Jitsi once preflight is complete ───
  useEffect(() => {
    if (phase !== "loading") return;
    let cancelled = false;

    const handleEnd = () => {
      if (endedRef.current) return;
      endedRef.current = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
      onLeave();
    };

    loadJitsiScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.JitsiMeetExternalAPI) {
          if (!cancelled) {
            setErrorMsg("Jitsi could not initialize. Please reload the page.");
            setPhase("error");
          }
          return;
        }
        try {
          const api = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
            roomName: safeRoomName,
            parentNode: containerRef.current,
            width: "100%",
            height: "100%",
            userInfo: { displayName },
            configOverwrite: {
              prejoinPageEnabled: false,
              startWithAudioMuted: micStatus !== "granted",
              startWithVideoMuted: !isVideo || camStatus !== "granted",
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
          api.addEventListener("videoConferenceJoined", () => {
            if (!cancelled) setPhase("ready");
          });
        } catch (err) {
          console.error("Jitsi init error", err);
          setErrorMsg("Could not start the call. Try again.");
          setPhase("error");
        }
      })
      .catch((err) => {
        console.error("Jitsi load error", err);
        if (!cancelled) {
          setErrorMsg("Failed to load the video service. Check your internet connection.");
          setPhase("error");
        }
      });

    return () => {
      cancelled = true;
      // NOTE: do NOT dispose here — we want to keep iframe alive across minimize/restore.
      // Disposal happens in handleEnd or in component unmount cleanup below.
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Hard-cleanup only on true unmount
  useEffect(() => {
    return () => {
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
    };
  }, []);

  const confirmLeave = () => {
    setShowLeaveConfirm(false);
    try { apiRef.current?.executeCommand("hangup"); } catch { /* noop */ }
    if (!endedRef.current) {
      endedRef.current = true;
      try { apiRef.current?.dispose(); } catch { /* noop */ }
      apiRef.current = null;
      onLeave();
    }
  };

  const renderStatusPill = (label: string, status: PermStatus, GrantedIcon: typeof Mic, DeniedIcon: typeof MicOff) => {
    const tone =
      status === "granted" ? "bg-success/15 text-success border-success/30" :
      status === "denied" ? "bg-destructive/15 text-destructive border-destructive/30" :
      "bg-muted text-muted-foreground border-border";
    const Icon = status === "granted" ? GrantedIcon : DeniedIcon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border ${tone}`}>
        <Icon className="w-3 h-3" /> {label}
      </span>
    );
  };

  return (
    <div
      className={`fixed inset-0 z-50 bg-background flex flex-col ${isMinimized ? "hidden" : ""}`}
      aria-hidden={isMinimized}
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-card/80 backdrop-blur flex-shrink-0 gap-3">
        <div className="flex items-center gap-2 text-sm min-w-0 flex-1">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            {phase === "ready" && (
              <span className="absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75 animate-ping" />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${phase === "ready" ? "bg-destructive" : phase === "error" ? "bg-warning" : "bg-muted-foreground"}`} />
          </span>
          <span className="font-semibold text-foreground">
            {phase === "ready" ? "Live" : phase === "error" ? "Error" : phase === "loading" ? "Connecting…" : "Preparing…"}
          </span>
          <span className="text-muted-foreground hidden sm:inline">·</span>
          <span className="font-mono text-xs text-muted-foreground truncate hidden sm:inline">{safeRoomName}</span>
          <div className="ml-2 flex items-center gap-1.5">
            {renderStatusPill(micStatus === "granted" ? "Mic" : micStatus === "denied" ? "Mic blocked" : "Mic…", micStatus, Mic, MicOff)}
            {isVideo && renderStatusPill(camStatus === "granted" ? "Camera" : camStatus === "denied" ? "Camera blocked" : "Camera…", camStatus, Video, VideoOff)}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {onMinimize && (
            <Button size="sm" variant="outline" onClick={onMinimize} className="gap-1.5">
              <Minimize2 className="w-4 h-4" />
              <span className="hidden sm:inline">Minimize</span>
            </Button>
          )}
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setShowLeaveConfirm(true)}
            className="gap-1.5"
          >
            <PhoneOff className="w-4 h-4" />
            Leave Call
          </Button>
        </div>
      </div>

      {/* Iframe container — always mounted so the session survives minimize */}
      <div className="flex-1 min-h-0 w-full bg-black relative">
        <div ref={containerRef} className="absolute inset-0" />

        {/* Loading overlay */}
        {(phase === "preflight" || phase === "loading") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-3 text-center px-6">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                {phase === "preflight" ? "Checking microphone & camera…" : "Connecting to call…"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {phase === "preflight"
                  ? "Allow access in the browser prompt to be heard and seen."
                  : "Loading Jitsi Meet — this takes a moment on first use."}
              </p>
            </div>
            {(micStatus === "denied" || (isVideo && camStatus === "denied")) && phase === "preflight" && (
              <div className="mt-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-md px-3 py-2 max-w-sm">
                Permission denied. You can still join, but others won't hear or see you until you allow access in your browser settings.
              </div>
            )}
          </div>
        )}

        {/* Error overlay */}
        {phase === "error" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm gap-4 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-destructive/15 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <div className="max-w-sm">
              <p className="text-sm font-semibold text-foreground">Call could not start</p>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg || "Something went wrong."}</p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setErrorMsg(null);
                  setPhase("loading");
                }}
              >
                Retry
              </Button>
              <Button size="sm" variant="destructive" onClick={onLeave}>
                Close
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Leave confirmation */}
      <AlertDialog open={showLeaveConfirm} onOpenChange={setShowLeaveConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Leave this call?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll disconnect from the meeting. Other participants can keep going without you. You can always rejoin from the call bar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Stay in call</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmLeave}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Leave
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
