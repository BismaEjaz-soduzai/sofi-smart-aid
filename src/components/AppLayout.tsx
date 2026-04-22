import { useEffect, useRef } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { AppHeader } from "@/components/AppHeader";
import { Outlet } from "react-router-dom";
import VoiceNavigator from "@/components/VoiceNavigator";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const IDLE_WARN_MS = 30 * 60 * 1000; // 30 min
const IDLE_LOGOUT_MS = 5 * 60 * 1000; // additional 5 min

export default function AppLayout() {
  const { signOut, session } = useAuth();
  const warnTimer = useRef<number | null>(null);
  const logoutTimer = useRef<number | null>(null);
  const toastIdRef = useRef<string | number | null>(null);

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
        action: {
          label: "Keep me signed in",
          onClick: () => reset(),
        },
      });
      logoutTimer.current = window.setTimeout(() => {
        void signOut();
      }, IDLE_LOGOUT_MS);
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
