import { useState } from "react";
import { motion } from "framer-motion";
import { Timer, X, Pause, Play, RotateCcw } from "lucide-react";
import { useFocusTimerOptional } from "@/contexts/FocusTimerContext";
import { useLocation } from "react-router-dom";

export default function FloatingFocusTimer() {
  const ctx = useFocusTimerOptional();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);

  if (!ctx) return null;
  const { seconds, running, setRunning, reset, duration, sessionType } = ctx;

  // Only show when running and not on the assistant/focus page
  if (!running || location.pathname === "/assistant" || dismissed) return null;

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const progress = ((duration * 60 - seconds) / (duration * 60)) * 100;

  return (
    <motion.div
      drag
      dragMomentum={false}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="fixed bottom-6 right-6 z-50 bg-card border border-border rounded-2xl shadow-lg p-3 cursor-grab active:cursor-grabbing select-none"
      style={{ touchAction: "none" }}
    >
      <div className="flex items-center gap-3">
        <div className="relative w-12 h-12">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="17" fill="none" className="stroke-muted" strokeWidth="2.5" />
            <circle cx="20" cy="20" r="17" fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 17}`} strokeDashoffset={`${2 * Math.PI * 17 * (1 - progress / 100)}`} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <Timer className="w-4 h-4 text-primary" />
          </div>
        </div>
        <div>
          <span className="text-lg font-mono font-bold text-foreground">{mins}:{secs}</span>
          <p className="text-[10px] text-muted-foreground">{sessionType}</p>
        </div>
        <div className="flex flex-col gap-1 ml-1">
          <button onClick={() => setRunning(!running)} className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center hover:bg-primary/20">
            {running ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
          </button>
          <button onClick={reset} className="w-6 h-6 rounded-full bg-muted text-muted-foreground flex items-center justify-center hover:bg-muted/80">
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
        <button onClick={() => setDismissed(true)} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center text-muted-foreground hover:text-foreground">
          <X className="w-3 h-3" />
        </button>
      </div>
    </motion.div>
  );
}
