import { motion } from "framer-motion";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function FocusMode() {
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, seconds]);

  useEffect(() => {
    if (seconds === 0) setRunning(false);
  }, [seconds]);

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const progress = ((25 * 60 - seconds) / (25 * 60)) * 100;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center justify-center min-h-[calc(100vh-3rem)]"
    >
      <div className="text-center space-y-8">
        <div className="flex items-center justify-center gap-2">
          <Timer className="w-5 h-5 text-primary" />
          <h1 className="text-lg font-medium text-foreground">Focus Mode</h1>
        </div>

        <div className="relative w-56 h-56 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="3" />
            <circle
              cx="50" cy="50" r="45" fill="none"
              className="stroke-primary transition-all duration-1000"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 45}`}
              strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-light font-mono text-foreground tracking-tight">
              {mins}:{secs}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setRunning(!running)}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity"
          >
            {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button
            onClick={() => { setRunning(false); setSeconds(25 * 60); }}
            className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground">Stay focused. You've got this.</p>
      </div>
    </motion.div>
  );
}
