import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Square, Volume2, VolumeX, RotateCcw,
  Sparkles, Brain, ChevronDown, MessageCircle, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import ReactMarkdown from "react-markdown";

type VoiceState = "idle" | "listening" | "thinking" | "speaking";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/voice-query`;

const VOICE_COMMANDS: Record<string, string> = {
  stop: "STOP", repeat: "REPEAT", simplify: "SIMPLIFY",
  "say that again": "REPEAT", "make it simpler": "SIMPLIFY", "explain simpler": "SIMPLIFY",
  "start focus session": "START_FOCUS", "start timer": "START_FOCUS",
  "explain topic": "EXPLAIN", "summarize notes": "SUMMARIZE",
  "quiz me": "QUIZ", "how am i doing": "PROGRESS",
};

// Select best available voice
function getBestVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Prefer high-quality voices
  const preferred = [
    "Google UK English Female", "Google UK English Male",
    "Microsoft Zira", "Microsoft David", "Samantha", "Karen",
    "Google US English", "Microsoft Mark",
  ];

  for (const name of preferred) {
    const v = voices.find((v) => v.name.includes(name));
    if (v) return v;
  }

  // Fallback: any English voice
  const english = voices.filter((v) => v.lang.startsWith("en"));
  if (english.length) return english[0];
  return voices[0];
}

export default function VoiceMode({ onSwitchToText }: { onSwitchToText: () => void }) {
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [lastAssistantText, setLastAssistantText] = useState("");
  const [continuousMode, setContinuousMode] = useState(true);
  const [speechRate, setSpeechRate] = useState(0.95);
  const [selectedVoice, setSelectedVoice] = useState<SpeechSynthesisVoice | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);

  const recognitionRef = useRef<any>(null);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const shouldResumeListening = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load voices
  useEffect(() => {
    const loadVoices = () => {
      const voices = speechSynthesis.getVoices();
      setAvailableVoices(voices.filter((v) => v.lang.startsWith("en")));
      if (!selectedVoice) setSelectedVoice(getBestVoice());
    };
    loadVoices();
    speechSynthesis.onvoiceschanged = loadVoices;
    return () => { recognitionRef.current?.stop(); speechSynthesis.cancel(); abortRef.current?.abort(); };
  }, []);

  // Auto-scroll
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const startListening = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error("Speech recognition not supported"); return; }

    // Interrupt speaking if active
    if (voiceState === "speaking") { speechSynthesis.cancel(); }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) finalTranscript += transcript;
        else interimTranscript += transcript;
      }

      if (interimTranscript) setCurrentTranscript(interimTranscript);

      if (finalTranscript) {
        const trimmed = finalTranscript.trim().toLowerCase();
        for (const [phrase, command] of Object.entries(VOICE_COMMANDS)) {
          if (trimmed === phrase || trimmed.includes(phrase)) {
            handleVoiceCommand(command);
            setCurrentTranscript("");
            return;
          }
        }
        recognition.stop();
        setCurrentTranscript("");
        handleUserInput(finalTranscript.trim());
      }
    };

    recognition.onerror = (e: any) => {
      if (e.error !== "aborted" && e.error !== "no-speech") toast.error("Voice recognition error");
      setVoiceState("idle");
    };

    recognition.onend = () => {
      if (voiceState === "listening" && shouldResumeListening.current) {
        try { recognition.start(); } catch {}
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setVoiceState("listening");
    shouldResumeListening.current = true;
  }, [voiceState, messages]);

  const stopListening = useCallback(() => {
    shouldResumeListening.current = false;
    recognitionRef.current?.stop();
    setVoiceState("idle");
    setCurrentTranscript("");
  }, []);

  const handleVoiceCommand = useCallback((command: string) => {
    switch (command) {
      case "STOP":
        speechSynthesis.cancel(); abortRef.current?.abort();
        setVoiceState("idle"); shouldResumeListening.current = false;
        toast("Stopped", { icon: "⏹️" }); break;
      case "REPEAT":
        if (lastAssistantText) speakText(lastAssistantText);
        else toast("Nothing to repeat"); break;
      case "SIMPLIFY":
        if (lastAssistantText) handleUserInput("Please simplify your last response. Make it shorter and easier to understand.");
        break;
    }
  }, [lastAssistantText]);

  const speakText = useCallback((text: string) => {
    speechSynthesis.cancel();
    setVoiceState("speaking");

    const clean = text.replace(/[#*`_~\[\]()>|]/g, "").replace(/\n+/g, ". ");
    const chunks = clean.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [clean];

    let chunkIndex = 0;
    const speakNext = () => {
      if (chunkIndex >= chunks.length) {
        setVoiceState(continuousMode ? "listening" : "idle");
        if (continuousMode) setTimeout(() => startListening(), 400);
        return;
      }

      const utterance = new SpeechSynthesisUtterance(chunks[chunkIndex].trim());
      utterance.rate = speechRate;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onend = () => { chunkIndex++; speakNext(); };
      utterance.onerror = () => setVoiceState("idle");
      utteranceRef.current = utterance;
      speechSynthesis.speak(utterance);
    };
    speakNext();
  }, [continuousMode, startListening, speechRate, selectedVoice]);

  const handleUserInput = useCallback(async (text: string) => {
    if (!text.trim()) return;
    shouldResumeListening.current = false;
    recognitionRef.current?.stop();

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setVoiceState("thinking");

    abortRef.current = new AbortController();
    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages.map((m) => ({ role: m.role, content: m.content })), voice_mode: true }),
        signal: abortRef.current.signal,
      });

      if (!resp.ok) { await throwIfBadResponse(resp, "SOFI Voice"); }
      if (!resp.body) throw new Error("No body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
            if (c) {
              assistantContent += c;
              setMessages((prev) => {
                const last = prev[prev.length - 1];
                if (last?.role === "assistant")
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                return [...prev, { id: crypto.randomUUID(), role: "assistant", content: assistantContent }];
              });
            }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }

      if (assistantContent) {
        setLastAssistantText(assistantContent);
        speakText(assistantContent);
      }
    } catch (e: any) {
      if (e.name !== "AbortError") { handleAiError(e, "SOFI Voice"); setVoiceState("idle"); }
    }
  }, [messages, speakText]);

  const toggleVoice = () => {
    if (voiceState === "idle") startListening();
    else if (voiceState === "listening") stopListening();
    else if (voiceState === "speaking") { speechSynthesis.cancel(); setVoiceState("idle"); }
    else if (voiceState === "thinking") { abortRef.current?.abort(); setVoiceState("idle"); }
  };

  const stateConfig = {
    idle: { color: "bg-muted", ring: "ring-muted", label: "Tap to speak", pulseColor: "" },
    listening: { color: "bg-primary", ring: "ring-primary/30", label: currentTranscript || "Listening...", pulseColor: "bg-primary/20" },
    thinking: { color: "bg-accent-foreground", ring: "ring-accent/30", label: "Thinking...", pulseColor: "bg-accent/20" },
    speaking: { color: "bg-primary", ring: "ring-primary/20", label: "Speaking...", pulseColor: "bg-primary/10" },
  };

  const config = stateConfig[voiceState];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between p-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">SOFI Voice</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
            {voiceState === "idle" ? "Ready" : voiceState}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowSettings(!showSettings)} className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-muted transition-colors"><Settings2 className="w-3.5 h-3.5" /></button>
          <button onClick={() => setContinuousMode(!continuousMode)}
            className={`text-xs px-2 py-1 rounded-md transition-colors ${continuousMode ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
            {continuousMode ? "Continuous" : "Single"}
          </button>
          <button onClick={onSwitchToText} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
            <MessageCircle className="w-3 h-3" /> Text
          </button>
        </div>
      </div>

      {/* Voice settings panel */}
      <AnimatePresence>
        {showSettings && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-b border-border">
            <div className="p-3 space-y-3 bg-muted/30">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Voice</label>
                <select value={selectedVoice?.name || ""} onChange={(e) => setSelectedVoice(availableVoices.find((v) => v.name === e.target.value) || null)}
                  className="w-full mt-1 bg-background border border-border rounded-lg px-2 py-1.5 text-xs text-foreground outline-none">
                  {availableVoices.map((v) => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Speed: {speechRate.toFixed(2)}</label>
                <input type="range" min="0.7" max="1.3" step="0.05" value={speechRate} onChange={(e) => setSpeechRate(parseFloat(e.target.value))} className="w-full mt-1 accent-primary" />
              </div>
              <button onClick={() => { const test = "Hello! I'm SOFI, your study assistant. How can I help you today?"; speakText(test); }} className="text-xs text-primary hover:underline">🔊 Test voice</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Conversation */}
      <div className="flex-1 overflow-auto px-4 py-3 space-y-3">
        {messages.length === 0 && voiceState === "idle" && (
          <div className="text-center pt-12 space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto"><Sparkles className="w-7 h-7 text-primary" /></div>
            <h3 className="text-base font-bold text-foreground">Voice Mode Active</h3>
            <p className="text-sm text-muted-foreground max-w-xs mx-auto">
              Tap the mic and speak naturally. Say <strong>"stop"</strong>, <strong>"repeat"</strong>, or <strong>"simplify"</strong> anytime.
            </p>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {["Explain sorting algorithms", "Quiz me on chapter 3", "Help me study today"].map((s) => (
                <button key={s} onClick={() => handleUserInput(s)} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">{s}</button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                ) : msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      {/* Voice Control */}
      <div className="flex-shrink-0 p-6 flex flex-col items-center gap-4 border-t border-border bg-card/60 backdrop-blur-sm">
        <motion.p key={config.label} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
          className="text-sm text-muted-foreground font-medium text-center min-h-[1.5rem] max-w-xs truncate">{config.label}</motion.p>

        <div className="relative">
          {voiceState !== "idle" && (
            <>
              <motion.div className={`absolute inset-0 rounded-full ${config.pulseColor}`} animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }} transition={{ duration: 2, repeat: Infinity }} style={{ margin: "-16px" }} />
              <motion.div className={`absolute inset-0 rounded-full ${config.pulseColor}`} animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0, 0.4] }} transition={{ duration: 2, repeat: Infinity, delay: 0.5 }} style={{ margin: "-8px" }} />
            </>
          )}
          <motion.button onClick={toggleVoice} whileTap={{ scale: 0.9 }}
            className={`relative z-10 w-20 h-20 rounded-full ${config.color} text-primary-foreground flex items-center justify-center shadow-lg transition-colors ring-4 ${config.ring}`}>
            {voiceState === "idle" && <Mic className="w-8 h-8" />}
            {voiceState === "listening" && <Mic className="w-8 h-8 animate-pulse" />}
            {voiceState === "thinking" && <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}><Sparkles className="w-8 h-8" /></motion.div>}
            {voiceState === "speaking" && <Volume2 className="w-8 h-8" />}
          </motion.button>
        </div>

        <div className="flex items-center gap-3">
          {voiceState === "speaking" && (
            <button onClick={() => { speechSynthesis.cancel(); setVoiceState("idle"); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive text-xs font-medium hover:bg-destructive/20 transition-colors"><Square className="w-3 h-3" /> Stop</button>
          )}
          {lastAssistantText && voiceState === "idle" && (
            <button onClick={() => speakText(lastAssistantText)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors"><RotateCcw className="w-3 h-3" /> Repeat</button>
          )}
          {messages.length > 0 && voiceState === "idle" && (
            <button onClick={() => { setMessages([]); setLastAssistantText(""); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground text-xs font-medium hover:text-foreground transition-colors">Clear</button>
          )}
        </div>
      </div>
    </div>
  );
}
