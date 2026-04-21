import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, Timer, Play, Pause, RotateCcw,
  Calendar, BookOpen, Lightbulb, PenLine, Languages, Zap,
  Presentation, GraduationCap, MessageCircle, Mic, MicOff,
  Volume2, VolumeX, Square, Brain, Upload, FileText, X, Paperclip,
} from "lucide-react";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import ReactMarkdown from "react-markdown";
import VoiceMode from "@/components/sofi/VoiceMode";
import AdaptiveInsights from "@/components/sofi/AdaptiveInsights";
import { useFocusTimer } from "@/contexts/FocusTimerContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; type: string };
}

type Section = "chat" | "voice" | "focus" | "tools";
type SessionType = "Study Session" | "Assignment Work" | "Reading" | "Project Work" | "Revision";

const SESSION_TYPES: SessionType[] = ["Study Session", "Assignment Work", "Reading", "Project Work", "Revision"];
const DURATIONS = [15, 25, 45, 60];

const QUICK_TOOLS = [
  { label: "Plan My Day", icon: Calendar, prompt: "You are an intelligent study planner. Create a detailed, time-bound daily plan for me. Divide the day into blocks with specific time allocations. Prioritize important tasks. Keep tasks realistic. The sum of all time blocks should fill a productive day (8-10 hours). Include breaks." },
  { label: "Study Plan", icon: BookOpen, prompt: "You are an intelligent study planner. Create a comprehensive study plan for my upcoming exams. Requirements:\n1. Strictly follow realistic time limits\n2. Divide time logically across topics\n3. Each task must include specific time allocation\n4. Prioritize important and weak topics\n5. Include revision sessions\n6. Keep tasks manageable\n\nAsk me about my subjects and exam dates to customize the plan." },
  { label: "Explain Topic", icon: Lightbulb, prompt: "You are an advanced AI Study Assistant. Explain this topic with:\n1. Clear definition\n2. Simple explanation with real-world analogy\n3. Why it matters\n4. Common misconceptions\n5. Key takeaways\n\nTopic: " },
  { label: "Rewrite Notes", icon: PenLine, prompt: "You are an advanced AI Study Assistant. Rewrite and improve these notes into a structured format:\n1. KEY SUMMARY — bullet points\n2. DETAILED NOTES — with headings, subheadings, highlighted key terms\n3. CORE CONCEPTS — simplified explanations\n4. KEY TAKEAWAYS — 5-10 revision points\n\nNotes to rewrite: " },
  { label: "Summarize Text", icon: Sparkles, prompt: "You are an advanced AI Study Assistant. Summarize with:\n1. Executive summary (3-5 sentences)\n2. All key points as bullets\n3. Important terms defined\n4. Quick revision takeaways\n\nText to summarize: " },
  { label: "Motivation", icon: Zap, prompt: "You are SOFI, a motivational study coach. Give me an energizing, personalized productivity boost. Include: 1) An inspiring thought, 2) A practical tip I can use right now, 3) A mini-challenge for the next hour. Keep it genuine and encouraging!" },
  { label: "Presentation Help", icon: Presentation, prompt: "You are an advanced AI Study Assistant. Help me structure a 10-slide presentation:\n- Title slide, overview, 6-8 content slides, summary\n- Each slide: title + 3-5 concise bullets + speaker notes\n- Keep text presentation-friendly\n\nPresentation topic: " },
  { label: "Improve English", icon: Languages, prompt: "You are an expert English writing tutor. Improve this text by:\n1. Fixing grammar and spelling\n2. Improving sentence structure and flow\n3. Using more academic/professional vocabulary\n4. Maintaining the original meaning\n5. Show the improved version, then list changes made\n\nText to improve: " },
];

const SUGGESTED_PROMPTS = [
  "Help me plan my day productively",
  "Create a study plan for my finals",
  "Explain cloud computing in simple words with examples",
  "Generate 10 viva questions on OOP with answers",
  "Rewrite my notes into structured study format",
  "Quiz me on any topic — 10 MCQs with answers",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

export default function SofiAssistant() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialSection = (searchParams.get("section") as Section) || "chat";
  const [section, setSection] = useState<Section>(initialSection);
  const [sharedPrompt, setSharedPrompt] = useState("");

  useEffect(() => {
    const s = searchParams.get("section") as Section | null;
    if (s && s !== section) setSection(s);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const changeSection = (s: Section) => {
    setSection(s);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("section", s);
      return next;
    }, { replace: true });
  };

  const handleAskSofi = (prompt: string) => {
    setSharedPrompt(prompt);
    changeSection("chat");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      <div className="flex gap-1 p-2 border-b border-border bg-card/60 backdrop-blur-sm">
        {([
          { key: "chat" as Section, label: "Chat", icon: MessageCircle },
          { key: "voice" as Section, label: "Voice", icon: Mic },
          { key: "focus" as Section, label: "Focus", icon: Timer },
          { key: "tools" as Section, label: "Tools", icon: Sparkles },
        ]).map((s) => (
          <button
            key={s.key}
            onClick={() => changeSection(s.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
              section === s.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <s.icon className="w-3.5 h-3.5" /> {s.label}
          </button>
        ))}
      </div>

      {section === "chat" && (
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col">
            <ChatSection initialPrompt={sharedPrompt} onPromptConsumed={() => setSharedPrompt("")} />
          </div>
          <div className="hidden lg:block w-72 border-l border-border p-4 overflow-auto bg-card/30">
            <AdaptiveInsights onAskSofi={handleAskSofi} />
          </div>
        </div>
      )}
      {section === "voice" && <VoiceMode onSwitchToText={() => changeSection("chat")} />}
      {section === "focus" && <FocusSection />}
      {section === "tools" && <ToolsSection onUsePrompt={(p) => { setSharedPrompt(p); changeSection("chat"); }} />}
    </div>
  );
}

// ─── Helpers for file text extraction ──────────────────
async function extractTextFromFile(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  
  if (["txt", "md", "csv", "text", "json", "xml", "html", "css", "js", "ts", "py"].includes(ext)) {
    return await file.text();
  }
  
  if (ext === "pdf") {
    // Read as ArrayBuffer and extract text from PDF
    const buffer = await file.arrayBuffer();
    return extractPdfText(buffer, file.name);
  }
  
  if (ext === "docx" || ext === "doc") {
    const buffer = await file.arrayBuffer();
    return extractDocxText(buffer, file.name);
  }
  
  // Fallback: try reading as text
  try {
    const text = await file.text();
    if (text && text.length > 10 && !text.includes("\u0000")) return text;
  } catch {}
  
  return `[Could not extract text from ${file.name}. File type: ${ext}]`;
}

async function extractPdfText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  // Simple PDF text extraction - parse text objects from the raw PDF
  try {
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder("latin1").decode(bytes);
    
    // Extract text between BT and ET markers (text objects)
    const textParts: string[] = [];
    const regex = /\(([^)]*)\)/g;
    let match;
    
    // Find stream content and extract readable strings
    const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let streamMatch;
    while ((streamMatch = streamRegex.exec(text)) !== null) {
      const content = streamMatch[1];
      while ((match = regex.exec(content)) !== null) {
        const decoded = match[1]
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\\\/g, "\\")
          .replace(/\\([()])/g, "$1");
        if (decoded.trim().length > 0) {
          textParts.push(decoded);
        }
      }
    }
    
    // Also try to get text from Tj and TJ operators
    const tjRegex = /\(([^)]+)\)\s*Tj/g;
    while ((match = tjRegex.exec(text)) !== null) {
      const decoded = match[1].replace(/\\([()])/g, "$1");
      if (decoded.trim().length > 0 && !textParts.includes(decoded)) {
        textParts.push(decoded);
      }
    }
    
    if (textParts.length > 0) {
      return `[Extracted from PDF: ${fileName}]\n\n${textParts.join(" ")}`;
    }
    
    return `[PDF file: ${fileName} - Text extraction limited. The document may contain scanned images. Content was uploaded for reference.]`;
  } catch {
    return `[PDF file: ${fileName} - Could not extract text content.]`;
  }
}

async function extractDocxText(buffer: ArrayBuffer, fileName: string): Promise<string> {
  // DOCX is a ZIP containing XML files. Extract text from word/document.xml
  try {
    const bytes = new Uint8Array(buffer);
    // Find PK zip entries and locate word/document.xml
    // Simple approach: find XML text content patterns
    const text = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
    
    // Extract text between <w:t> tags (Word XML)
    const wtRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    const parts: string[] = [];
    let match;
    while ((match = wtRegex.exec(text)) !== null) {
      if (match[1].trim()) parts.push(match[1]);
    }
    
    if (parts.length > 0) {
      return `[Extracted from DOCX: ${fileName}]\n\n${parts.join(" ")}`;
    }
    
    // Fallback: extract any readable text
    const readable = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const cleaned = readable.replace(/[^\x20-\x7E\n]/g, "").trim();
    if (cleaned.length > 50) {
      return `[Extracted from DOCX: ${fileName}]\n\n${cleaned.slice(0, 15000)}`;
    }
    
    return `[DOCX file: ${fileName} - Limited text extraction. Content uploaded for reference.]`;
  } catch {
    return `[DOCX file: ${fileName} - Could not extract text content.]`;
  }
}

// ─── CHAT ──────────────────────────────────────────────
function ChatSection({ initialPrompt, onPromptConsumed }: { initialPrompt: string; onPromptConsumed: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [attachedFile, setAttachedFile] = useState<{ name: string; content: string } | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
      onPromptConsumed();
    }
  }, [initialPrompt]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const maxSize = 20 * 1024 * 1024; // 20MB
    if (file.size > maxSize) { toast.error("File too large (max 20MB)"); return; }

    const allowedExts = [".txt", ".md", ".csv", ".text", ".pdf", ".docx", ".doc", ".json", ".xml", ".html", ".py", ".js", ".ts"];
    const ext = "." + file.name.split(".").pop()?.toLowerCase();

    if (!allowedExts.includes(ext)) {
      toast.error("Supported: TXT, PDF, DOCX, MD, CSV, JSON, code files");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      const truncated = text.slice(0, 15000);
      setAttachedFile({ name: file.name, content: truncated });
      toast.success(`Attached: ${file.name} (${Math.round(truncated.length / 1000)}KB text extracted)`);
    } catch {
      toast.error("Could not read file");
    } finally {
      setIsExtracting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const toggleListening = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) { toast.error("Speech recognition not supported"); return; }
    if (isListening) { recognitionRef.current?.stop(); setIsListening(false); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US"; recognition.continuous = false; recognition.interimResults = true;
    recognition.onresult = (e: any) => { const transcript = Array.from(e.results).map((r: any) => r[0].transcript).join(""); setInput(transcript); };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); toast.error("Voice recognition failed"); };
    recognition.start(); recognitionRef.current = recognition; setIsListening(true);
  };

  const speakText = (text: string) => {
    if (isSpeaking) { speechSynthesis.cancel(); setIsSpeaking(false); return; }
    const clean = text.replace(/[#*`_~\[\]()>]/g, "");
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 0.95; utterance.onend = () => setIsSpeaking(false);
    speechSynthesis.speak(utterance); setIsSpeaking(true);
  };

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    let messageContent = text.trim();
    let attachment: Message["attachment"] | undefined;

    if (attachedFile) {
      messageContent = `[Document: ${attachedFile.name}]\n\n${attachedFile.content}\n\n---\n\nUser question: ${text.trim()}`;
      attachment = { name: attachedFile.name, type: "document" };
      setAttachedFile(null);
    }

    const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text.trim(), attachment };
    const allMessages = [...messages, userMsg];
    setMessages(allMessages);
    setInput("");
    setIsLoading(true);
    let assistantContent = "";

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: allMessages.map((m) => ({
            role: m.role,
            content: m === userMsg ? messageContent : m.content,
          })),
        }),
      });
      if (!resp.ok) { await throwIfBadResponse(resp, "SOFI Chat"); }
      if (!resp.body) throw new Error("No response body");

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      const upsert = (chunk: string) => {
        assistantContent += chunk;
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === "assistant") return prev.map((m, i) => (i === prev.length - 1 ? { ...m, content: assistantContent } : m));
          return [...prev, { id: crypto.randomUUID(), role: "assistant", content: assistantContent }];
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
    } catch (e: any) {
      handleAiError(e, "SOFI Chat");
      if (!assistantContent) setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
    } finally { setIsLoading(false); }
  };

  const isEmpty = messages.length === 0;

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isEmpty ? (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
            <div className="text-center pt-8 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Sparkles className="w-6 h-6 text-primary" /></div>
              <h2 className="text-lg font-bold text-foreground">Hey! I'm SOFI</h2>
              <p className="text-sm text-muted-foreground mt-1">Your personal AI assistant for study & productivity</p>
              <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1 justify-center"><Upload className="w-3 h-3" /> Attach PDF, DOCX, TXT files to ask about their content</p>
            </div>
            <div className="lg:hidden"><AdaptiveInsights onAskSofi={(p) => sendMessage(p)} /></div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><Lightbulb className="w-3 h-3" /> Try asking</p>
              <div className="flex flex-wrap gap-2">
                {SUGGESTED_PROMPTS.map((p) => (<button key={p} onClick={() => sendMessage(p)} className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">{p}</button>))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div key={msg.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm relative group ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted text-foreground rounded-bl-md"}`}>
                    {msg.attachment && (
                      <div className="flex items-center gap-1.5 mb-2 text-xs opacity-80">
                        <FileText className="w-3 h-3" /> {msg.attachment.name}
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <>
                        <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                        <button onClick={() => speakText(msg.content)} className="absolute -bottom-1 -right-1 opacity-0 group-hover:opacity-100 w-7 h-7 rounded-full bg-card border border-border shadow-sm flex items-center justify-center transition-opacity">
                          {isSpeaking ? <VolumeX className="w-3 h-3 text-muted-foreground" /> : <Volume2 className="w-3 h-3 text-muted-foreground" />}
                        </button>
                      </>
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

      {/* Attached file preview */}
      {(attachedFile || isExtracting) && (
        <div className="px-4 py-2 border-t border-border bg-muted/30">
          <div className="flex items-center gap-2 max-w-3xl mx-auto">
            {isExtracting ? (
              <>
                <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                <span className="text-xs text-muted-foreground">Extracting text from file...</span>
              </>
            ) : attachedFile ? (
              <>
                <FileText className="w-4 h-4 text-primary flex-shrink-0" />
                <span className="text-xs text-foreground truncate flex-1">{attachedFile.name}</span>
                <span className="text-[10px] text-muted-foreground">{Math.round(attachedFile.content.length / 1000)}KB text</span>
                <button onClick={() => setAttachedFile(null)} className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground hover:text-destructive"><X className="w-3 h-3" /></button>
              </>
            ) : null}
          </div>
        </div>
      )}

      <div className="p-4 border-t border-border flex-shrink-0">
        <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-2 max-w-3xl mx-auto">
          <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.md,.csv,.text,.pdf,.docx,.doc,.json,.xml,.html,.py,.js,.ts" className="hidden" />
          <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all disabled:opacity-40" title="Attach PDF, DOCX, TXT, or code files">
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <button onClick={toggleListening} className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${isListening ? "bg-destructive text-destructive-foreground animate-pulse" : "bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80"}`}>
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
          </button>
          <textarea
            value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder={isListening ? "Listening..." : attachedFile ? `Ask about ${attachedFile.name}...` : "Ask SOFI anything..."}
            rows={1} className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-32" style={{ minHeight: "1.5rem" }}
          />
          <button onClick={() => sendMessage(input)} disabled={!input.trim() || isLoading} className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </>
  );
}

// ─── FOCUS ─────────────────────────────────────────────
function FocusSection() {
  const timer = useFocusTimer();
  const mins = Math.floor(timer.seconds / 60).toString().padStart(2, "0");
  const secs = (timer.seconds % 60).toString().padStart(2, "0");
  const progress = ((timer.duration * 60 - timer.seconds) / (timer.duration * 60)) * 100;

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-lg mx-auto p-6 space-y-6">
        <div className="text-center"><h2 className="text-lg font-bold text-foreground">Focus Zone</h2><p className="text-sm text-muted-foreground mt-0.5">Timer persists even when you switch tabs</p></div>
        <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Session Type</label><div className="flex flex-wrap gap-1.5">{SESSION_TYPES.map((t) => (<button key={t} onClick={() => timer.setSessionType(t)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${timer.sessionType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{t}</button>))}</div></div>
        <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Session Goal (optional)</label><input value={timer.goal} onChange={(e) => timer.setGoal(e.target.value)} placeholder="e.g. Complete chapter 5 revision" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" /></div>
        <div className="flex justify-center gap-2">{DURATIONS.map((d) => (<button key={d} onClick={() => timer.setDuration(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${timer.duration === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{d} min</button>))}</div>
        <div className="relative w-48 h-48 mx-auto">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" className="stroke-muted" strokeWidth="3" /><circle cx="50" cy="50" r="45" fill="none" className="stroke-primary transition-all duration-1000" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 45}`} strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`} /></svg>
          <div className="absolute inset-0 flex items-center justify-center"><span className="text-4xl font-light font-mono text-foreground tracking-tight">{mins}:{secs}</span></div>
        </div>
        <div className="flex items-center justify-center gap-3">
          <button onClick={() => timer.setRunning(!timer.running)} className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:opacity-90 transition-opacity">{timer.running ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5 ml-0.5" />}</button>
          <button onClick={timer.reset} className="w-10 h-10 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center hover:bg-secondary/80 transition-colors"><RotateCcw className="w-4 h-4" /></button>
        </div>
        {timer.running && (
          <p className="text-center text-xs text-primary/80">⏱️ Timer keeps running when you navigate away — look for the floating timer!</p>
        )}
        <p className="text-center text-sm text-muted-foreground">Stay focused. You've got this. 💪</p>
      </div>
    </div>
  );
}

// ─── QUICK TOOLS ───────────────────────────────────────
function ToolsSection({ onUsePrompt }: { onUsePrompt: (prompt: string) => void }) {
  return (
    <div className="flex-1 overflow-auto p-4 lg:p-6 max-w-3xl mx-auto space-y-5">
      <div className="text-center"><h2 className="text-lg font-bold text-foreground">Quick Assistant Tools</h2><p className="text-sm text-muted-foreground mt-0.5">One-click smart actions</p></div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {QUICK_TOOLS.map((tool) => (
          <button key={tool.label} onClick={() => onUsePrompt(tool.prompt)} className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-center group">
            <div className="w-10 h-10 rounded-xl bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors"><tool.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" /></div>
            <span className="text-xs font-medium text-foreground">{tool.label}</span>
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">Click a tool to start a conversation with SOFI</p>
    </div>
  );
}
