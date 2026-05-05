import { useEffect, useRef, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Outlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import VoiceNavigator from "@/components/VoiceNavigator";
import { GlobalCallNotifier } from "@/components/GlobalCallNotifier";
import FocusCompletionModal from "@/components/FocusCompletionModal";
import CallBar from "@/components/chat/CallBar";
import { useCallContext } from "@/contexts/CallContext";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format } from "date-fns";

const IDLE_WARN_MS = 30 * 60 * 1000; // 30 min
const IDLE_LOGOUT_MS = 5 * 60 * 1000; // additional 5 min
const ACTIVE_DAYS_KEY = "sofi-active-days";
const VOICE_OPENS_KEY = "sofi-voice-opens";
const ACTIVE_DAYS_CAP = 90;

export default function AppLayout() {
  const { signOut, session } = useAuth();
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

  // Track active day on mount
  useEffect(() => {
    try {
      const today = format(new Date(), "yyyy-MM-dd");
      const raw = localStorage.getItem(ACTIVE_DAYS_KEY);
      const arr: string[] = raw ? JSON.parse(raw) : [];
      if (!arr.includes(today)) {
        const next = [...arr, today].slice(-ACTIVE_DAYS_CAP);
        localStorage.setItem(ACTIVE_DAYS_KEY, JSON.stringify(next));
      }
    } catch { /* ignore */ }
  }, []);

  // Listen for voice mode opens
  useEffect(() => {
    const handler = () => {
      try {
        const current = parseInt(localStorage.getItem(VOICE_OPENS_KEY) || "0", 10);
        localStorage.setItem(VOICE_OPENS_KEY, String(current + 1));
      } catch { /* ignore */ }
    };
    window.addEventListener("sofi-voice-opened", handler);
    return () => window.removeEventListener("sofi-voice-opened", handler);
  }, []);

  // Idle session timeout
  useEffect(() => {
    if (!session) return;

    const clearTimers = () => {
      if (warnTimer.current) window.clearTimeout(warnTimer.current);
      if (logoutTimer.current) window.clearTimeout(logoutTimer.current);
      warnTimer.current = null;
      logoutTimer.current = null;
    };

    const dismissWarning = () => {
      if (toastIdRef.current !== null) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = null;
      }
    };

    const reset = () => {
      clearTimers();
      dismissWarning();
      warnTimer.current = window.setTimeout(showWarning, IDLE_WARN_MS);
    };

    const showWarning = () => {
      toastIdRef.current = toast.warning("You've been inactive. Stay signed in?", {
        duration: IDLE_LOGOUT_MS,
        action: { label: "Keep me signed in", onClick: () => reset() },
      });
      logoutTimer.current = window.setTimeout(() => { void signOut(); }, IDLE_LOGOUT_MS);
    };

    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "click", "touchstart"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      clearTimers();
      dismissWarning();
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [session, signOut]);

  // ===== Global call bar (visible on every protected page during a call) =====
  const call = useCallContext();
  const [callElapsed, setCallElapsed] = useState(0);
  useEffect(() => {
    if (!call.activeCall) { setCallElapsed(0); return; }
    const start = call.activeCall.startedAt;
    const tick = () => setCallElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [call.activeCall]);

  const handleSaveGlobalRecording = async (blob: Blob, filename: string) => {
    const userId = session?.user?.id;
    if (!userId) {
      toast.error("You must be signed in to save a recording");
      return;
    }
    if (!blob || blob.size === 0) {
      toast.error("Recording is empty — nothing to save");
      return;
    }
    const workspaceRoomId = call.activeCall?.workspaceRoomId || null;
    const savingToastId = toast.loading(
      workspaceRoomId ? "Saving recording to workspace…" : "Saving recording…",
      { description: filename },
    );

    try {
      const path = workspaceRoomId
        ? `rooms/${workspaceRoomId}/recordings/${filename}`
        : `personal/${userId}/recordings/${filename}`;

      // 1) Upload blob to storage
      const { error: uploadError } = await supabase.storage
        .from("study-files")
        .upload(path, blob, { contentType: "video/webm", upsert: false });
      if (uploadError) {
        console.error("[recording] storage upload failed", uploadError);
        throw new Error(uploadError.message || "Upload failed");
      }

      // 2) Index in study_files so it appears in lists. If this fails, roll back the upload
      //    so we don't show a fake-success without persistence.
      const { error: insertError } = await supabase.from("study_files").insert({
        user_id: userId,
        room_id: workspaceRoomId,
        file_name: filename,
        file_type: "video/webm",
        file_size: blob.size,
        file_path: path,
      });
      if (insertError) {
        console.error("[recording] db insert failed — rolling back storage object", insertError);
        await supabase.storage.from("study-files").remove([path]).catch(() => undefined);
        throw new Error(insertError.message || "Database insert failed");
      }

      toast.dismiss(savingToastId);

      if (workspaceRoomId) {
        const sizeMb = (blob.size / (1024 * 1024)).toFixed(1);
        toast.success("✅ Recording saved to Workspace › Recordings", {
          description: `${filename} • ${sizeMb} MB`,
          duration: 6000,
          action: {
            label: "Open Recordings",
            onClick: () => {
              window.location.href = `/workspace?room=${workspaceRoomId}&tab=recordings`;
            },
          },
        });
      } else {
        toast.success("Recording saved");
      }

      // Broadcast so any listening view (workspace recordings tab, files list) refreshes immediately.
      try {
        window.dispatchEvent(
          new CustomEvent("sofi-recording-saved", {
            detail: { roomId: workspaceRoomId, filename, path },
          }),
        );
      } catch { /* noop */ }
    } catch (err) {
      toast.dismiss(savingToastId);
      const msg = err instanceof Error ? err.message : "Failed to save recording";
      console.error("[recording] save failed:", err);
      toast.error(`Failed to save recording: ${msg}`);
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <AnimatePresence>
            {call.activeCall && (
              <CallBar
                callUrl={call.activeCall.callUrl}
                isVideo={call.activeCall.isVideo}
                startedBy={call.activeCall.startedBy}
                elapsed={callElapsed}
                isRecording={call.isRecording}
                recordingTime={call.recordingTime}
                formatRecTime={call.formatRecTime}
                onReopen={call.focusCall}
                onEnd={call.endCall}
                onStartRecording={() => call.startRecording(handleSaveGlobalRecording)}
                onStopRecording={call.stopRecording}
              />
            )}
          </AnimatePresence>
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <VoiceNavigator />
        <GlobalCallNotifier />
        <FocusCompletionModal />
      </div>
    </SidebarProvider>
  );
}

