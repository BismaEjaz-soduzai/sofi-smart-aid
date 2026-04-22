import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation } from "react-router-dom";
import { Mic, MicOff, Loader2, Check, X, Send, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { recognizeIntent } from "@/utils/intentRecognizer";

type ActionState =
  | "idle"
  | "listening"
  | "thinking"      // AI is recognising intent
  | "success"       // route found, about to navigate
  | "error";        // intent unclear

type Lang = "en" | "ur";

const LANG_TO_RECOGNITION: Record<Lang, string> = {
  en: "en-US",
  ur: "ur-PK",
};

const QUICK_CHIPS = [
  "Dashboard",
  "Smart Workspace",
  "Recordings",
  "My Notes",
  "FYP Room",
  "Mood Tracker",
  "Study Planner",
  "AI Tools",
  "Motivation",
];

export default function VoiceNavigator() {
  const navigate = useNavigate();
  const location = useLocation();

  const [open, setOpen] = useState(false);
  const [actionState, setActionState] = useState<ActionState>("idle");
  const [transcript, setTranscript] = useState("");
  const [statusText, setStatusText] = useState("");
  const [lang, setLang] = useState<Lang>("en");

  const recognitionRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // ----- Cleanup on unmount -----
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    };
  }, []);

  // ----- Open modal: focus input, reset state -----
  useEffect(() => {
    if (open) {
      setActionState("idle");
      setTranscript("");
      setStatusText("");
      // Tiny delay so the input exists in DOM
      setTimeout(() => inputRef.current?.focus(), 80);
    } else {
      // Stop any in-flight recognition when closing
      try { recognitionRef.current?.stop(); } catch { /* noop */ }
    }
  }, [open]);

  // ===== AI-powered command handling =====
  const handleCommand = useCallback(async (raw: string) => {
    const text = raw.trim();
    if (!text) return;
    setTranscript(text);
    setActionState("thinking");
    setStatusText("Understanding your command...");

    const result = await recognizeIntent(text);

    if (result.route) {
      setActionState("success");
      setStatusText(`Opening ${result.name || "page"}...`);
      window.setTimeout(() => {
        navigate(result.route!);
        setOpen(false);
      }, 600);
    } else {
      setActionState("error");
      setStatusText("I didn't catch that, please try again");
    }
  }, [navigate]);

  // ===== Speech recognition =====
  const startListening = useCallback(() => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice recognition not supported in this browser");
      return;
    }
    if (actionState === "listening" || actionState === "thinking") return;

    const recognition = new SR();
    recognition.lang = LANG_TO_RECOGNITION[lang];
    recognition.continuous = false;
    recognition.interimResults = true;
    recognitionRef.current = recognition;

    setTranscript("");
    setStatusText(lang === "ur" ? "اب بولیں..." : "Listening...");
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
        try { recognition.stop(); } catch { /* noop */ }
        handleCommand(final);
      }
    };

    recognition.onerror = (e: any) => {
      console.warn("Speech error", e?.error);
      if (e?.error === "not-allowed") {
        toast.error("Microphone permission denied");
      } else if (e?.error === "no-speech") {
        // Silent — user just didn't speak
      } else if (e?.error === "network") {
        toast.error("Voice recognition needs internet — please type your command");
        setStatusText("Network unavailable — type your command instead");
        inputRef.current?.focus();
      } else if (e?.error === "language-not-supported") {
        toast.error(`${lang.toUpperCase()} voice unavailable — switch language or type`);
      } else {
        toast.error("Voice recognition failed — please type instead");
      }
      setActionState("idle");
    };

    recognition.onend = () => {
      // If still listening with no final → drop back to idle
      setActionState((s) => (s === "listening" ? "idle" : s));
    };

    try {
      recognition.start();
    } catch (err) {
      console.error("recognition.start failed", err);
      setActionState("idle");
    }
  }, [actionState, lang, handleCommand]);

  const stopListening = useCallback(() => {
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setActionState("idle");
    setStatusText("");
  }, []);

  const handleMicClick = useCallback(() => {
    if (actionState === "listening") { stopListening(); return; }
    if (actionState === "thinking") return; // can't interrupt AI
    startListening();
  }, [actionState, stopListening, startListening]);

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (actionState === "thinking") return;
    if (transcript.trim()) handleCommand(transcript);
  };

  // ===== Hide on /assistant (it has its own voice UI) =====
  if (location.pathname === "/assistant") return null;

  const isProcessing = actionState === "thinking";
  const ringClass =
    actionState === "listening"
      ? "ring-4 ring-destructive/50 animate-pulse"
      : actionState === "thinking"
      ? "ring-4 ring-primary/60 animate-pulse"
      : actionState === "success"
      ? "ring-4 ring-success/60"
      : actionState === "error"
      ? "ring-4 ring-destructive/60"
      : "";

  const micBg =
    actionState === "listening"
      ? "bg-destructive text-destructive-foreground"
      : actionState === "thinking"
      ? "bg-primary text-primary-foreground"
      : actionState === "success"
      ? "bg-success text-success-foreground"
      : actionState === "error"
      ? "bg-destructive text-destructive-foreground"
      : "bg-primary text-primary-foreground";

  const MicIcon =
    actionState === "listening" ? MicOff
    : actionState === "thinking" ? Loader2
    : actionState === "success" ? Check
    : actionState === "error" ? AlertCircle
    : Mic;

  return (
    <>
      {/* ===== Floating launcher button ===== */}
      <motion.button
        onClick={() => setOpen(true)}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl hover:shadow-2xl transition-shadow"
        aria-label="Open voice navigator"
        title="Voice navigator (any language)"
      >
        <Mic className="w-6 h-6" />
      </motion.button>

      {/* ===== Modal ===== */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-50 bg-background/70 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(92vw,440px)] glass-card rounded-2xl shadow-2xl p-6"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-semibold text-foreground">Voice Navigator</h3>
                  <p className="text-xs text-muted-foreground">
                    Speak or type in English, Urdu, or mixed
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Language toggle */}
                  <div className="flex items-center bg-muted rounded-full p-0.5">
                    {(["en", "ur"] as Lang[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => setLang(l)}
                        disabled={isProcessing}
                        className={`px-3 py-1 text-[11px] font-semibold rounded-full transition-colors ${
                          lang === l
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {l.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setOpen(false)}
                    className="w-8 h-8 rounded-full hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center"
                    aria-label="Close"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Mic button (centered) */}
              <div className="flex justify-center my-4">
                <button
                  onClick={handleMicClick}
                  disabled={actionState === "thinking"}
                  className={`relative w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-all ${micBg} ${ringClass} disabled:opacity-95`}
                  aria-label={actionState === "listening" ? "Stop listening" : "Start listening"}
                >
                  <MicIcon className={`w-8 h-8 ${actionState === "thinking" ? "animate-spin" : ""}`} />
                </button>
              </div>

              {/* Text input */}
              <form onSubmit={handleTextSubmit} className="flex items-center gap-2 mb-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  disabled={isProcessing}
                  placeholder={lang === "ur" ? "یا یہاں ٹائپ کریں..." : "...or type your command"}
                  className="flex-1 px-3 py-2 rounded-lg bg-background border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={isProcessing || !transcript.trim()}
                  className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition disabled:opacity-40"
                  aria-label="Send command"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>

              {/* Status text */}
              <div className="min-h-[20px] mb-3 text-center">
                {statusText && (
                  <p
                    className={`text-xs font-medium ${
                      actionState === "error"
                        ? "text-destructive"
                        : actionState === "success"
                        ? "text-success"
                        : actionState === "thinking"
                        ? "text-primary"
                        : "text-muted-foreground"
                    }`}
                  >
                    {statusText}
                  </p>
                )}
              </div>

              {/* Quick chips */}
              <div>
                <p className="text-[11px] font-semibold text-muted-foreground mb-2 uppercase tracking-wide">
                  Quick destinations
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {QUICK_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => handleCommand(chip)}
                      disabled={isProcessing}
                      className="px-2.5 py-1 text-[11px] rounded-full bg-muted hover:bg-primary/10 hover:text-primary text-muted-foreground transition-colors disabled:opacity-50"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
