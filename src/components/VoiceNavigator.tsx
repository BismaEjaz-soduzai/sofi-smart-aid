import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, Loader2, Volume2, Compass, X } from "lucide-react";
import { useTasks, useToggleTask } from "@/hooks/useTasks";
import { useNotes, useDeleteNote } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { useFocusTimer } from "@/contexts/FocusTimerContext";
import { toast } from "sonner";
import { handleAiError } from "@/lib/aiError";

type ActionState = "idle" | "listening" | "processing" | "speaking";

const ROUTE_MAP: Record<string, { path: string; label: string }> = {
  dashboard: { path: "/dashboard", label: "Dashboard" },
  home: { path: "/dashboard", label: "Dashboard" },
  planner: { path: "/planner", label: "Planner" },
  organizer: { path: "/organizer", label: "Organizer" },
  tasks: { path: "/organizer", label: "Organizer" },
  notes: { path: "/organizer", label: "Organizer" },
  workspace: { path: "/workspace", label: "Smart Workspace" },
  "smart workspace": { path: "/workspace", label: "Smart Workspace" },
  assistant: { path: "/assistant", label: "SOFI Assistant" },
  sofi: { path: "/assistant", label: "SOFI Assistant" },
  analytics: { path: "/analytics", label: "Analytics" },
  settings: { path: "/settings", label: "Settings" },
  chat: { path: "/chat", label: "Chat Rooms" },
  rooms: { path: "/chat", label: "Chat Rooms" },
};

const PAGE_NAMES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/planner": "Planner",
  "/organizer": "Organizer",
  "/workspace": "Smart Workspace",
  "/assistant": "SOFI Assistant",
  "/analytics": "Analytics",
  "/settings": "Settings",
  "/chat": "Chat Rooms",
  "/profile": "Profile",
  "/notes": "Notes",
  "/tasks": "Tasks",
};

const EXAMPLE_COMMANDS = [
  "Go to planner",
  "Start timer",
  "Mark task complete",
  "Read my analytics",
  "Delete note shopping",
  "Where am I",
];

function stripMarkdown(s: string) {
  return s
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~#>]+/g, "")
    .replace(/\n{2,}/g, ". ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const preferred = voices.find((v) => v.name === "Google UK English Female");
  if (preferred) return preferred;
  const en = voices.find((v) => v.lang?.toLowerCase().startsWith("en") && /female|samantha|jenny|aria/i.test(v.name));
  if (en) return en;
  return voices.find((v) => v.lang?.toLowerCase().startsWith("en")) || voices[0];
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

export default function VoiceNavigator() {
  const navigate = useNavigate();
  const location = useLocation();
  const tasksQuery = useTasks();
  const toggleTask = useToggleTask();
  const notesQuery = useNotes();
  const deleteNote = useDeleteNote();
  usePlans();
  const timer = useFocusTimer();

  // Hide on /assistant — that page has its own voice interface
  if (location.pathname === "/assistant") return null;

  const [actionState, setActionState] = useState<ActionState>("idle");
  const [transcript, setTranscript] = useState("");
  const [lastAction, setLastAction] = useState("");
  const [expanded, setExpanded] = useState(false);

  const recognitionRef = useRef<any>(null);
  const speakingRef = useRef(false);

  // Warm up voices on mount
  useEffect(() => {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
      window.speechSynthesis.onvoiceschanged = () => window.speechSynthesis.getVoices();
    }
  }, []);

  const speak = useCallback((text: string) => {
    if (!text || typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = stripMarkdown(text);
    if (!clean) return;
    setLastAction(clean);
    setActionState("speaking");
    speakingRef.current = true;
    try { window.speechSynthesis.cancel(); } catch { /* noop */ }
    const utter = new SpeechSynthesisUtterance(clean);
    const v = pickVoice();
    if (v) utter.voice = v;
    utter.lang = v?.lang || "en-US";
    utter.rate = 0.95;
    utter.pitch = 1;
    utter.onend = () => {
      speakingRef.current = false;
      setActionState("idle");
    };
    utter.onerror = () => {
      speakingRef.current = false;
      setActionState("idle");
    };
    window.speechSynthesis.speak(utter);
  }, []);

  const callStudyChat = useCallback(async (text: string): Promise<string> => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
        voice_mode: true,
      }),
    });
    if (!resp.ok || !resp.body) {
      const err = await resp.json().catch(() => ({}));
      throw new Error(err.error || `Error ${resp.status}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let content = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const json = line.slice(6).trim();
        if (json === "[DONE]") break;
        try {
          const p = JSON.parse(json);
          const c = p.choices?.[0]?.delta?.content;
          if (c) content += c;
        } catch { /* partial chunk */ }
      }
    }
    return content.trim();
  }, []);

  const executeCommand = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    const lower = text.toLowerCase();
    setActionState("processing");

    try {
      // Navigation
      const navMatch = lower.match(/^(?:go to|open|navigate to|take me to)\s+(?:the\s+)?(.+?)[?.!]?$/);
      if (navMatch) {
        const target = navMatch[1].trim();
        const route = ROUTE_MAP[target] || Object.entries(ROUTE_MAP).find(([k]) => target.includes(k))?.[1];
        if (route) {
          navigate(route.path);
          speak(`Opening ${route.label}`);
          return;
        }
      }

      // Timer controls
      if (/(start|begin|resume).*(timer|focus)|^start focus$/.test(lower)) {
        timer.setRunning(true);
        speak("Focus timer started");
        return;
      }
      if (/(stop|pause).*(timer)/.test(lower)) {
        timer.setRunning(false);
        speak("Timer paused");
        return;
      }
      if (/reset.*(timer)/.test(lower)) {
        timer.reset();
        speak("Timer reset");
        return;
      }
      const setTimerMatch = lower.match(/set (?:the )?timer (?:to|for) (\d{1,3})/);
      if (setTimerMatch) {
        const n = Math.max(1, Math.min(180, parseInt(setTimerMatch[1], 10)));
        timer.setDuration(n);
        speak(`Timer set to ${n} minutes`);
        return;
      }

      // Task complete
      if (/^(mark|complete|finish|done)/.test(lower) && /(task|done|complete)/.test(lower)) {
        const tasks = tasksQuery.data || [];
        const pending = tasks.filter((t) => !t.completed);
        if (pending.length === 0) {
          speak("You have no pending tasks");
          return;
        }
        // try keyword match
        const keyword = lower
          .replace(/^(mark|complete|finish|done)/, "")
          .replace(/(task|complete|done|as)/g, "")
          .trim();
        let target = pending[0];
        if (keyword) {
          const found = pending.find((t) => t.title.toLowerCase().includes(keyword));
          if (found) target = found;
        }
        await toggleTask.mutateAsync({ id: target.id, completed: true });
        speak(`Marked ${target.title} as complete`);
        return;
      }

      // List tasks
      if (/(list|read|tell me).*(tasks|todo)/.test(lower)) {
        const tasks = (tasksQuery.data || []).filter((t) => !t.completed);
        navigate("/organizer");
        if (tasks.length === 0) {
          speak("You have no pending tasks. Great job!");
        } else {
          const titles = tasks.slice(0, 3).map((t) => t.title).join(", ");
          speak(`You have ${tasks.length} pending task${tasks.length === 1 ? "" : "s"}. Top items: ${titles}`);
        }
        return;
      }

      // Analytics
      if (/(read|show|tell).*(analytics|progress|stats)|how am i doing/.test(lower)) {
        navigate("/analytics");
        const tasks = tasksQuery.data || [];
        const done = tasks.filter((t) => t.completed).length;
        const rate = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        speak(`You have completed ${done} of ${tasks.length} tasks. That is ${rate} percent. Keep it up!`);
        return;
      }

      // Delete note
      const delNoteMatch = lower.match(/delete (?:the )?note (.+)/);
      if (delNoteMatch) {
        const keyword = delNoteMatch[1].trim();
        const notes = notesQuery.data || [];
        const found = notes.find((n) => n.title.toLowerCase().includes(keyword));
        if (!found) {
          speak(`I could not find a note matching ${keyword}`);
          return;
        }
        await deleteNote.mutateAsync(found.id);
        speak(`Deleted note ${found.title}`);
        return;
      }

      // Where am I
      if (/where am i|what page|current page/.test(lower)) {
        const name = PAGE_NAMES[location.pathname] || "an unknown page";
        speak(`You are on ${name}`);
        return;
      }

      // Fallback to AI
      const reply = await callStudyChat(text);
      if (reply) speak(reply);
      else speak("I did not get a response. Please try again.");
    } catch (err: any) {
      console.error("Voice command failed", err);
      handleAiError(err, "Voice command");
      speak("Sorry, something went wrong");
    }
  }, [navigate, location.pathname, timer, tasksQuery.data, notesQuery.data, toggleTask, deleteNote, callStudyChat, speak]);

  const startListening = useCallback(() => {
    const SR: any =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice recognition not supported in this browser");
      return;
    }
    if (actionState === "listening") return;
    if (speakingRef.current) {
      try { window.speechSynthesis.cancel(); } catch { /* noop */ }
      speakingRef.current = false;
    }

    const recognition = new SR();
    recognition.lang = "en-US";
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    setTranscript("");
    setActionState("listening");

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript(final || interim);
      if (final) {
        recognition.stop();
        executeCommand(final);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech error", e?.error);
      setActionState("idle");
      if (e?.error === "not-allowed") toast.error("Microphone permission denied");
    };

    recognition.onend = () => {
      setActionState((s) => (s === "listening" ? "idle" : s));
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("recognition.start failed", err);
      setActionState("idle");
    }
  }, [actionState, executeCommand]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setActionState("idle");
  }, []);

  const mainColor =
    actionState === "listening"
      ? "bg-destructive text-destructive-foreground"
      : actionState === "processing"
      ? "bg-warning text-warning-foreground"
      : actionState === "speaking"
      ? "bg-success text-success-foreground"
      : "bg-primary text-primary-foreground";

  const Icon =
    actionState === "listening" ? MicOff
    : actionState === "processing" ? Loader2
    : actionState === "speaking" ? Volume2
    : Mic;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {/* Transcript / last action bubble */}
      <AnimatePresence>
        {(transcript || (lastAction && actionState === "speaking")) && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="max-w-xs glass-card px-3 py-2 rounded-xl text-xs text-foreground shadow-lg"
          >
            {actionState === "speaking" ? `🔊 ${lastAction}` : `“${transcript}”`}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Examples tooltip */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="glass-card p-3 rounded-xl shadow-lg w-56"
          >
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Try saying</p>
              <button onClick={() => setExpanded(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <ul className="space-y-1">
              {EXAMPLE_COMMANDS.map((c) => (
                <li key={c} className="text-[11px] text-muted-foreground bg-muted/40 rounded-md px-2 py-1">
                  “{c}”
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-10 h-10 rounded-full bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors flex items-center justify-center shadow-md"
          title="Voice commands"
          aria-label="Show voice commands"
        >
          <Compass className="w-4 h-4" />
        </button>

        <div className="relative">
          {actionState === "listening" && (
            <>
              <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
              <span className="absolute inset-0 rounded-full bg-destructive/20 animate-pulse" />
            </>
          )}
          <button
            onClick={actionState === "listening" ? stopListening : startListening}
            disabled={actionState === "processing" || actionState === "speaking"}
            className={`relative w-14 h-14 rounded-full flex items-center justify-center shadow-xl transition-colors disabled:opacity-90 ${mainColor}`}
            aria-label={actionState === "listening" ? "Stop listening" : "Start voice command"}
            title={actionState === "listening" ? "Listening — click to stop" : "Click and speak"}
          >
            <Icon className={`w-6 h-6 ${actionState === "processing" ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
    </div>
  );
}
