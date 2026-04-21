import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, X, Send, MessageSquare, Volume2, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

type Mode = "voice" | "text";

interface Msg { id: string; role: "user" | "assistant"; content: string; }

export function GlobalVoiceButton() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("voice");
  const [listening, setListening] = useState(false);
  const [thinking, setThinking] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const recognitionRef = useRef<any>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const speak = (text: string) => {
    if (!("speechSynthesis" in window)) return;
    speechSynthesis.cancel();
    const clean = text.replace(/[#*`_~\[\]()>]/g, "").replace(/\n+/g, ". ");
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 0.95;
    u.onstart = () => setSpeaking(true);
    u.onend = () => setSpeaking(false);
    speechSynthesis.speak(u);
  };

  const stopSpeak = () => { speechSynthesis.cancel(); setSpeaking(false); };

  const ask = async (text: string, voiceMode: boolean) => {
    if (!text.trim() || thinking) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setThinking(true);
    let assistant = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          voice_mode: voiceMode,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok || !resp.body) throw new Error("Request failed");
      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const upsert = (chunk: string) => {
        assistant += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistant } : m);
          return [...prev, { id: crypto.randomUUID(), role: "assistant", content: assistant }];
        });
      };
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
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) upsert(c); }
          catch { buffer = line + "\n" + buffer; break; }
        }
      }
      if (voiceMode && assistant) speak(assistant);
    } catch (e: any) {
      toast.error(e.message || "Request failed");
    } finally {
      setThinking(false);
    }
  };

  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported"); return; }
    if (listening) { recognitionRef.current?.stop(); setListening(false); return; }
    stopSpeak();
    const r = new SR();
    r.lang = "en-US"; r.continuous = false; r.interimResults = true;
    let finalTranscript = "";
    r.onresult = (e: any) => {
      finalTranscript = Array.from(e.results).map((res: any) => res[0].transcript).join("");
      setInput(finalTranscript);
    };
    r.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) ask(finalTranscript, true);
    };
    r.onerror = () => { setListening(false); toast.error("Voice recognition failed"); };
    r.start();
    recognitionRef.current = r;
    setListening(true);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Open quick voice assistant"
        className="w-9 h-9 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 flex items-center justify-center transition-colors flex-shrink-0"
        title="Quick voice"
      >
        <Mic className="w-4 h-4" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40"
              onClick={() => { setOpen(false); stopSpeak(); recognitionRef.current?.stop(); }}
            />
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              className="fixed bottom-6 right-6 w-[min(420px,calc(100vw-2rem))] h-[min(560px,calc(100vh-6rem))] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <span className="text-sm font-semibold text-foreground">Quick SOFI</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setMode(mode === "voice" ? "text" : "voice")}
                    className="text-[10px] font-medium px-2 py-1 rounded-md bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {mode === "voice" ? "Switch to Text" : "Switch to Voice"}
                  </button>
                  <button onClick={() => { setOpen(false); stopSpeak(); recognitionRef.current?.stop(); }} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Messages */}
              <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2.5">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
                      {mode === "voice" ? <Mic className="w-6 h-6 text-primary" /> : <MessageSquare className="w-6 h-6 text-primary" />}
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      {mode === "voice" ? "Tap the mic and speak" : "Type your question"}
                    </p>
                    <p className="text-xs mt-1">Quick AI assistance, anywhere in the app</p>
                  </div>
                ) : (
                  messages.map((m) => (
                    <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${
                        m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
                      }`}>
                        {m.role === "assistant" ? (
                          <div className="prose prose-sm dark:prose-invert max-w-none [&>*]:my-1">
                            <ReactMarkdown>{m.content}</ReactMarkdown>
                          </div>
                        ) : m.content}
                      </div>
                    </div>
                  ))
                )}
                {thinking && (
                  <div className="flex justify-start">
                    <div className="bg-muted rounded-2xl px-3 py-2 flex gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  </div>
                )}
              </div>

              {/* Input area */}
              <div className="p-3 border-t border-border">
                {mode === "voice" ? (
                  <div className="flex flex-col items-center gap-2">
                    <button
                      onClick={startListening}
                      disabled={thinking}
                      className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                        listening ? "bg-destructive text-destructive-foreground animate-pulse" :
                        thinking ? "bg-warning text-warning-foreground" :
                        speaking ? "bg-success text-success-foreground" :
                        "bg-primary text-primary-foreground hover:scale-105"
                      }`}
                    >
                      {thinking ? <Loader2 className="w-6 h-6 animate-spin" /> :
                       speaking ? <Volume2 className="w-6 h-6" /> :
                       listening ? <MicOff className="w-6 h-6" /> :
                       <Mic className="w-6 h-6" />}
                    </button>
                    <p className="text-xs text-muted-foreground">
                      {listening ? "Listening..." : thinking ? "Thinking..." : speaking ? "Speaking..." : "Tap to speak"}
                    </p>
                    {input && listening && (
                      <p className="text-xs text-foreground italic max-w-full truncate">"{input}"</p>
                    )}
                  </div>
                ) : (
                  <form onSubmit={(e) => { e.preventDefault(); ask(input, false); }} className="flex gap-2">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="Ask SOFI anything..."
                      autoFocus
                      className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary text-foreground placeholder:text-muted-foreground"
                    />
                    <button type="submit" disabled={!input.trim() || thinking} className="w-10 h-10 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-50">
                      {thinking ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </button>
                  </form>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
