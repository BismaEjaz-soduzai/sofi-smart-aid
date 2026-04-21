import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface FocusTimerState {
  duration: number;
  seconds: number;
  running: boolean;
  sessionType: string;
  goal: string;
  setDuration: (d: number) => void;
  setRunning: (r: boolean) => void;
  setSessionType: (t: string) => void;
  setGoal: (g: string) => void;
  reset: () => void;
}

const FocusTimerContext = createContext<FocusTimerState | null>(null);

export function useFocusTimer() {
  const ctx = useContext(FocusTimerContext);
  if (!ctx) throw new Error("useFocusTimer must be used within FocusTimerProvider");
  return ctx;
}

export function useFocusTimerOptional() {
  return useContext(FocusTimerContext);
}

export function FocusTimerProvider({ children }: { children: ReactNode }) {
  const [duration, setDurationState] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionType, setSessionType] = useState("Study Session");
  const [goal, setGoal] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      const xp = Math.max(10, Math.round(duration * 2));
      toast.success(`Focus session complete! 🎉  +${xp} XP earned`, {
        description: `Great ${duration}-min ${sessionType.toLowerCase()}. Keep the streak alive! 🔥`,
        duration: 6000,
      });
      // Save completed session + reward
      (async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase.from("study_sessions").insert({
            user_id: user.id,
            session_duration: duration,
            subject: sessionType || "general",
            completed: true,
          });
        }
        // Local reward tracking (XP, streak)
        try {
          const today = new Date().toISOString().slice(0, 10);
          const raw = localStorage.getItem("sofi_rewards");
          const data = raw ? JSON.parse(raw) : { xp: 0, sessions: 0, lastDate: "", streak: 0 };
          data.xp = (data.xp || 0) + xp;
          data.sessions = (data.sessions || 0) + 1;
          if (data.lastDate === today) {
            // same day — keep streak
          } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            data.streak = data.lastDate === yesterday ? (data.streak || 0) + 1 : 1;
            data.lastDate = today;
          }
          localStorage.setItem("sofi_rewards", JSON.stringify(data));
          window.dispatchEvent(new CustomEvent("sofi-rewards-updated", { detail: data }));
        } catch {}
      })();
    }
  }, [seconds, running, duration, sessionType]);

  const setDuration = useCallback((d: number) => {
    if (running) return;
    setDurationState(d);
    setSeconds(d * 60);
  }, [running]);

  const reset = useCallback(() => {
    setRunning(false);
    setSeconds(duration * 60);
  }, [duration]);

  return (
    <FocusTimerContext.Provider value={{ duration, seconds, running, sessionType, goal, setDuration, setRunning, setSessionType, setGoal, reset }}>
      {children}
    </FocusTimerContext.Provider>
  );
}
