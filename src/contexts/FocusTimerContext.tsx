import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

interface FocusTimerState {
  duration: number;
  seconds: number;
  running: boolean;
  sessionType: string;
  goal: string;
  showCompletion: boolean;
  setDuration: (d: number) => void;
  setRunning: (r: boolean) => void;
  setSessionType: (t: string) => void;
  setGoal: (g: string) => void;
  reset: () => void;
  dismissCompletion: () => void;
  startAgain: () => void;
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
  const [showCompletion, setShowCompletion] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const startedAtRef = useRef<number | null>(null);
  const elapsedAccumRef = useRef<number>(0); // seconds elapsed across pauses
  const savingRef = useRef(false);
  const queryClient = useQueryClient();

  // Save a focus session (even partial — minimum 1 minute, rounded up)
  const saveSession = useCallback(async (elapsedSeconds: number, completed: boolean) => {
    if (savingRef.current) return;
    const minutes = Math.max(1, Math.round(elapsedSeconds / 60));
    if (elapsedSeconds < 30) return; // ignore < 30s blips
    savingRef.current = true;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from("study_sessions").insert({
          user_id: user.id,
          session_duration: minutes,
          subject: sessionType || "general",
          completed,
        });
        queryClient.invalidateQueries({ queryKey: ["study_sessions"] });
      }
      const xp = Math.max(5, Math.round(minutes * 2));
      try {
        const today = new Date().toISOString().slice(0, 10);
        const raw = localStorage.getItem("sofi_rewards");
        const data = raw ? JSON.parse(raw) : { xp: 0, sessions: 0, lastDate: "", streak: 0 };
        data.xp = (data.xp || 0) + xp;
        data.sessions = (data.sessions || 0) + 1;
        if (data.lastDate !== today) {
          const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
          data.streak = data.lastDate === yesterday ? (data.streak || 0) + 1 : 1;
          data.lastDate = today;
        }
        localStorage.setItem("sofi_rewards", JSON.stringify(data));
        window.dispatchEvent(new CustomEvent("sofi-rewards-updated", { detail: data }));
      } catch {}
    } finally {
      savingRef.current = false;
    }
  }, [sessionType, queryClient]);

  // Tick
  useEffect(() => {
    if (running && seconds > 0) {
      if (startedAtRef.current === null) startedAtRef.current = Date.now();
      intervalRef.current = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  // Track elapsed time on pause / running change
  const handleSetRunning = useCallback((next: boolean) => {
    if (running && !next) {
      // pausing: accumulate elapsed and save partial session
      if (startedAtRef.current !== null) {
        const delta = Math.floor((Date.now() - startedAtRef.current) / 1000);
        elapsedAccumRef.current += delta;
        startedAtRef.current = null;
        if (elapsedAccumRef.current >= 30) {
          saveSession(elapsedAccumRef.current, false);
          toast.success(`Saved ${Math.max(1, Math.round(elapsedAccumRef.current / 60))} min focus session`);
          elapsedAccumRef.current = 0;
        }
      }
    }
    setRunning(next);
  }, [running, saveSession]);

  // Completion (timer reached zero)
  useEffect(() => {
    if (seconds === 0 && running) {
      setRunning(false);
      let total = elapsedAccumRef.current;
      if (startedAtRef.current !== null) {
        total += Math.floor((Date.now() - startedAtRef.current) / 1000);
        startedAtRef.current = null;
      }
      elapsedAccumRef.current = 0;
      const finalSeconds = total > 0 ? total : duration * 60;
      saveSession(finalSeconds, true);
      const xp = Math.max(10, Math.round(duration * 2));
      toast.success(`Focus session complete! 🎉  +${xp} XP earned`, {
        description: `Great ${duration}-min ${sessionType.toLowerCase()}. Keep the streak alive! 🔥`,
        duration: 6000,
      });
      setShowCompletion(true);
    }
  }, [seconds, running, duration, sessionType, saveSession]);

  const setDuration = useCallback((d: number) => {
    if (running) return;
    setDurationState(d);
    setSeconds(d * 60);
    elapsedAccumRef.current = 0;
    startedAtRef.current = null;
  }, [running]);

  const reset = useCallback(() => {
    // save partial before reset
    let total = elapsedAccumRef.current;
    if (startedAtRef.current !== null) {
      total += Math.floor((Date.now() - startedAtRef.current) / 1000);
      startedAtRef.current = null;
    }
    if (total >= 30) {
      saveSession(total, false);
      toast.success(`Saved ${Math.max(1, Math.round(total / 60))} min focus session`);
    }
    elapsedAccumRef.current = 0;
    setRunning(false);
    setSeconds(duration * 60);
  }, [duration, saveSession]);

  const dismissCompletion = useCallback(() => {
    setShowCompletion(false);
    setSeconds(duration * 60);
  }, [duration]);

  const startAgain = useCallback(() => {
    setShowCompletion(false);
    elapsedAccumRef.current = 0;
    startedAtRef.current = null;
    setSeconds(duration * 60);
    setRunning(true);
  }, [duration]);

  return (
    <FocusTimerContext.Provider value={{
      duration, seconds, running, sessionType, goal, showCompletion,
      setDuration, setRunning: handleSetRunning, setSessionType, setGoal,
      reset, dismissCompletion, startAgain,
    }}>
      {children}
    </FocusTimerContext.Provider>
  );
}
