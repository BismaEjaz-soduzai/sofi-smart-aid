import { useEffect, useRef, useState } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Outlet } from "react-router-dom";
import { AnimatePresence } from "framer-motion";
import VoiceNavigator from "@/components/VoiceNavigator";
import { GlobalCallNotifier } from "@/components/GlobalCallNotifier";
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

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <AppHeader />
          <main className="flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
        <VoiceNavigator />
      </div>
    </SidebarProvider>
  );
}
