import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, Timer, Play, Pause, RotateCcw,
  Calendar, BookOpen, Lightbulb, PenLine, Languages, Zap,
  Presentation, GraduationCap, MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

// ─── Types ────────────────────────────────────────────
interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

type Section = "chat" | "focus" | "tools";
type SessionType = "Study Session" | "Assignment Work" | "Reading" | "Project Work" | "Revision";

const SESSION_TYPES: SessionType[] = ["Study Session", "Assignment Work", "Reading", "Project Work", "Revision"];
const DURATIONS = [15, 25, 45, 60];

const QUICK_TOOLS = [
  { label: "Plan My Day", icon: Calendar, prompt: "Help me plan my day productively" },
  { label: "Study Plan", icon: BookOpen, prompt: "Create a study plan for my upcoming exams" },
  { label: "Explain Topic", icon: Lightbulb, prompt: "Explain this topic in simple words: " },
  { label: "Rewrite Notes", icon: PenLine, prompt: "Rewrite and improve these notes: " },
  { label: "Summarize Text", icon: Sparkles, prompt: "Summarize the following text: " },
  { label: "Motivation", icon: Zap, prompt: "Give me a motivational productivity boost" },
  { label: "Presentation Help", icon: Presentation, prompt: "Help me structure a presentation on: " },
  { label: "Improve English", icon: Languages, prompt: "Improve the English of this text: " },
];

const SUGGESTED_PROMPTS = [
  "Help me plan my day",
  "Make me a study plan for finals",
  "Explain cloud computing simply",
  "Give me viva questions on OOP",
  "Rewrite these notes more clearly",
  "Help me stay productive today",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

export default function SofiAssistant() {
  const [section, setSection] = useState<Section>("chat");

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Section tabs */}
      <div className="flex gap-1 p-2 border-b border-border bg-card/60 backdrop-blur-sm">
        {([
          { key: "chat" as Section, label: "Assistant Chat", icon: MessageCircle },
          { key: "focus" as Section, label: "Focus Zone", icon: Timer },
          { key: "tools" as Section, label: "Quick Tools", icon: Sparkles },
        ]).map((s) => (
          <button
            key={s.key}
            onClick={() => setSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              section === s.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" />
            {s.label}
          </button>
        ))}
      </div>

      {section === "chat" && <ChatSection />}
      {section === "focus" && <FocusSection />}
      {section === "tools" && <ToolsSection onUsePrompt={(p) => { setSection("chat"); }} />}
    </div>
  );
}

// ─── CHAT SECTION ─────────────────────────────────────
function ChatSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);

    let assistantContent = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages.map((m) => ({ role: m.role, content: m.content })) }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const upsert = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") {
            return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
          }
          return [...prev, { id: crypto.randomUUID(), role: "assistant", content: assistantContent }];
        });
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) upsert(content);
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed to get response");
      if (!assistantContent) setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally {
      setIsLoading(false);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isEmpty ? (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
            <div className="text-center pt-8 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">Hey! I'm SOFI</h2>
              <p className="text-sm text-muted-foreground mt-1">Your personal AI assistant for study & productivity</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Lightbulb className="w-3 h-3" /> Try asking</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((p) => (
                  <button key={p} onClick={() => sendMessage(p)} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">{p}</button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-3xl mx-auto">
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
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start"><div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div></div>
            )}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-2 max-w-3xl mx-auto">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask SOFI anything..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-32"
            style={{ minHeight: "1.5rem" }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── FOCUS SECTION ────────────────────────────────────
function FocusSection() {
  const [duration, setDuration] = useState(25);
  const [seconds, setSeconds] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessionType, setSessionType] = useState<SessionType>("Study Session");
  const [goal, setGoal] = useState("");
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (running && seconds > 0) {
      intervalRef.current = window.setInterval(() => setSeconds((s) => s - 1), 1000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, seconds]);

  useEffect(() => { if (seconds === 0) { setRunning(false); toast.success("Focus session complete! 🎉"); } }, [seconds]);

  const handleDurationChange = (d: number) => {
    if (running) return;
    setDuration(d);
    setSeconds(d * 60);
  };

  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const progress = ((duration * 60 - seconds) / (duration * 60)) * 100;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center">
          <h2 className="text-lg font-bold text-foreground">Focus Zone</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Stay focused and productive</p>
        </div>

        {/* Session type */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Session Type</label>
          <div className="flex flex-wrap gap-1.5">
            {SESSION_TYPES.map((t) => (
              <button key={t} onClick={() => setSessionType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sessionType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>
            ))}
          </div>
        </div>

        {/* Goal */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Session Goal (optional)</label>
          <input value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Complete chapter 5 revision" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
        </div>

        {/* Duration pills */}
        <div className="flex justify-center gap-2">
          {DURATIONS.map((d) => (
            <button key={d} onClick={() => handleDurationChange(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${duration === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{d} min</button>
          ))}
        </div>

        {/* Timer */}
        <div className="relative w-48 h-48 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="3" />
            <circle cx="50" cy="50" r="45" fill="none" className="stroke-primary transition-all duration-1000" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`} />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-4xl font-light font-mono text-foreground tracking-tight">{mins}:{secs}</span>
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => setRunning(!running)} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">
            {running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}
          </button>
          <button onClick={() => { setRunning(false); setSeconds(duration * 60); }} className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors">
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">Stay focused. You've got this. 💪</p>
      </div>
    </div>
  );
}

// ─── QUICK TOOLS SECTION ──────────────────────────────
function ToolsSection({ onUsePrompt }: { onUsePrompt: (prompt: string) => void }) {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("");
  const [loading, setLoading] = useState(false);

  const run = async (prompt?: string) => {
    const text = prompt || input;
    if (!text.trim() || loading) return;
    setLoading(true);
    setOutput("");

    let content = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      if (!resp.ok) { const err = await resp.json().catch(() => ({})); throw new Error(err.error || `Error ${resp.status}`); }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") break;
          try {
            const parsed = JSON.parse(json);
            const c = parsed.choices?.[0]?.delta?.content;
            if (c) { content += c; setOutput(content); }
          } catch { buffer = line + "\n" + buffer; break; }
        }
      }
    } catch (e: any) {
      toast.error(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold text-foreground">Quick Assistant Tools</h2>
        <p className="text-sm text-muted-foreground mt-0.5">One-click smart actions</p>
      </div>

      {/* Tool grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_TOOLS.map((tool) => (
          <button key={tool.label} onClick={() => { setInput(tool.prompt); }} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-center group">
            <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
              <tool.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </div>
            <span className="text-[11px] font-medium text-foreground">{tool.label}</span>
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-3">
        <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }} placeholder="Type or select a tool above..." rows={2} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
        <button onClick={() => run()} disabled={!input.trim() || loading} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>

      {/* Output */}
      {output && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4">
          <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            <ReactMarkdown>{output}</ReactMarkdown>
          </div>
        </motion.div>
      )}
    </div>
  );
}
