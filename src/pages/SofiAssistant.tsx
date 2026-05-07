import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, Sparkles, Loader2, Timer, Play, Pause, RotateCcw,
  Calendar, BookOpen, Lightbulb, PenLine, Languages, Zap,
  Presentation, GraduationCap, MessageCircle, Mic, MicOff,
  Volume2, VolumeX, Square, Brain, Upload, FileText, X, Paperclip,
  FolderOpen, Mic2, CheckCircle2, ArrowRight, RefreshCw, Trophy,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip } from "recharts";
import { awardXpOnce } from "@/hooks/useRewardLedger";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import ReactMarkdown from "react-markdown";
import VoiceMode from "@/components/sofi/VoiceMode";
import AdaptiveInsights from "@/components/sofi/AdaptiveInsights";
import { useFocusTimer } from "@/contexts/FocusTimerContext";
import { useStudyFiles, type StudyFile } from "@/hooks/useStudyFiles";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachment?: { name: string; type: string };
}

type Section = "chat" | "voice" | "focus" | "tools" | "viva";
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
          { key: "viva" as Section, label: "Viva", icon: Mic2 },
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
        <div className="flex flex-1 overflow-hidden min-h-0">
          <div className="flex-1 flex flex-col min-w-0">
            <ChatSection initialPrompt={sharedPrompt} onPromptConsumed={() => setSharedPrompt("")} />
          </div>
          <aside className="hidden lg:flex w-80 flex-shrink-0 border-l border-border bg-card/30 flex-col min-h-0">
            <div className="flex-1 overflow-y-auto p-4">
              <AdaptiveInsights onAskSofi={handleAskSofi} />
            </div>
          </aside>
        </div>
      )}
      {section === "voice" && <VoiceMode onSwitchToText={() => changeSection("chat")} />}
      {section === "focus" && <FocusSection />}
      {section === "tools" && <ToolsSection onUsePrompt={(p) => { setSharedPrompt(p); changeSection("chat"); }} />}
      {section === "viva" && <VivaSection />}
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
  
  if (["docx", "doc", "ppt", "pptx"].includes(ext)) {
    return `[${file.name}] This file type is better opened through the workspace document reader so formatting and extraction stay intact.`;
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
  const [showWorkspacePicker, setShowWorkspacePicker] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const { files: workspaceFiles } = useStudyFiles();

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setShowWorkspacePicker(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const attachWorkspaceFile = async (file: StudyFile) => {
    setShowWorkspacePicker(false);
    setIsExtracting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-file-text`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ filePath: file.file_path, fileName: file.file_name }),
        },
      );
      if (!resp.ok) throw new Error("Could not read file");
      const data = await resp.json();
      const text = (data.text || "").slice(0, 15000);
      if (!text.trim()) throw new Error("No text extracted");
      setAttachedFile({ name: file.file_name, content: text });
      toast.success(`Loaded: ${file.file_name}`);
    } catch (e: any) {
      toast.error(e?.message || "Could not open file");
    } finally {
      setIsExtracting(false);
    }
  };

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
          <button onClick={() => fileInputRef.current?.click()} disabled={isExtracting} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all disabled:opacity-40" title="Attach a new file from your device">
            <Paperclip className="w-3.5 h-3.5" />
          </button>
          <div ref={pickerRef} className="relative">
            <button onClick={() => setShowWorkspacePicker((s) => !s)} disabled={isExtracting} className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-muted text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-all disabled:opacity-40" title="Open a file from your Smart Workspace">
              <FolderOpen className="w-3.5 h-3.5" />
            </button>
            {showWorkspacePicker && (
              <div className="absolute bottom-full left-0 mb-2 w-72 max-h-72 overflow-y-auto rounded-xl border border-border bg-card shadow-xl z-50 animate-fade-in">
                <div className="px-3 py-2 border-b border-border sticky top-0 bg-card">
                  <p className="text-xs font-semibold text-foreground">Workspace files</p>
                  <p className="text-[10px] text-muted-foreground">Click a file to load it for AI analysis</p>
                </div>
                {workspaceFiles.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">No files yet. Upload some in Smart Workspace.</p>
                ) : (
                  workspaceFiles.map((f) => (
                    <button key={f.id} onClick={() => attachWorkspaceFile(f)} className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 transition-colors border-b border-border/40 last:border-0">
                      <FileText className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      <span className="text-xs text-foreground truncate flex-1">{f.file_name}</span>
                      <span className="text-[10px] text-muted-foreground uppercase">{f.file_type}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
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

// ─── VIVA / ORAL EXAM ──────────────────────────────────
type VivaPhase = "setup" | "exam" | "results";
type Difficulty = "Easy" | "Medium" | "Hard";
interface VivaQA { question: string; answer: string; score: number; feedback: string; correct: string; encouragement: string; }
interface VivaHistoryEntry {
  id: string;
  date: number;
  subject: string;
  difficulty: Difficulty;
  docName: string | null;
  total: number;
  max: number;
  pct: number;
  grade: string;
  qa: VivaQA[];
}
const VIVA_HISTORY_KEY = "sofi_viva_history_v1";

function loadVivaHistory(): VivaHistoryEntry[] {
  try { return JSON.parse(localStorage.getItem(VIVA_HISTORY_KEY) || "[]"); } catch { return []; }
}
function saveVivaHistory(items: VivaHistoryEntry[]) {
  try { localStorage.setItem(VIVA_HISTORY_KEY, JSON.stringify(items.slice(0, 50))); } catch {}
}

function VivaSection() {
  const [phase, setPhase] = useState<VivaPhase>("setup");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [count, setCount] = useState<number>(5);
  const [docName, setDocName] = useState<string | null>(null);
  const [docContent, setDocContent] = useState<string>("");
  const [extracting, setExtracting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [qIndex, setQIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState("");
  const [genLoading, setGenLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [recording, setRecording] = useState(false);
  const recogRef = useRef<any>(null);
  const [grading, setGrading] = useState(false);
  const [lastGrade, setLastGrade] = useState<{ score: number; feedback: string; correct: string; encouragement: string } | null>(null);
  const [history, setHistory] = useState<VivaQA[]>([]);
  const [pastSessions, setPastSessions] = useState<VivaHistoryEntry[]>(() => loadVivaHistory());
  const [viewingPast, setViewingPast] = useState<VivaHistoryEntry | null>(null);

  const speechSupported = typeof window !== "undefined" && (("SpeechRecognition" in window) || ("webkitSpeechRecognition" in window));

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20MB)"); return; }
    setExtracting(true);
    try {
      const text = await extractTextFromFile(file);
      setDocContent(text.slice(0, 15000));
      setDocName(file.name);
      toast.success(`Loaded: ${file.name}`);
    } catch {
      toast.error("Could not read file");
    } finally {
      setExtracting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const speak = (text: string) => {
    try {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.95;
      window.speechSynthesis.speak(u);
    } catch {}
  };

  const callChat = async (system: string, user: string): Promise<string> => {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      body: JSON.stringify({ messages: [{ role: "system", content: system }, { role: "user", content: user }] }),
    });
    if (!resp.ok) await throwIfBadResponse(resp, "Viva");
    const reader = resp.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = ""; let out = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const j = line.slice(6).trim();
        if (j === "[DONE]") break;
        try { const p = JSON.parse(j); const c = p.choices?.[0]?.delta?.content; if (c) out += c; } catch {}
      }
    }
    return out;
  };

  const generateQuestion = async (idx: number) => {
    setGenLoading(true);
    setCurrentQ("");
    setTranscript("");
    setLastGrade(null);
    try {
      const ctx = docName ? `Document: ${docName}\n\nContent:\n${docContent}\n\n` : "";
      const subj = subject || "general study";
      const sys = `You are a university examiner conducting an oral exam. Generate ONE ${difficulty.toLowerCase()} difficulty viva question${docName ? " strictly from the provided document" : ` on ${subj}`}. Return ONLY the question text, no numbering, no preface.`;
      const user = `${ctx}Subject: ${subj}\nDifficulty: ${difficulty}\nQuestion ${idx + 1} of ${count}\n\nGenerate question ${idx + 1}. Avoid repeating prior questions: ${history.map((h) => h.question).join(" | ") || "none"}`;
      const q = (await callChat(sys, user)).trim().replace(/^["']|["']$/g, "");
      setCurrentQ(q);
      speak(q);
    } catch (e) {
      handleAiError(e, "Viva");
    } finally {
      setGenLoading(false);
    }
  };

  const start = () => {
    if (!docName && !subject.trim()) { toast.error("Enter a subject or upload a document"); return; }
    setHistory([]);
    setQIndex(0);
    setPhase("exam");
    generateQuestion(0);
  };

  const toggleRecord = () => {
    if (!speechSupported) return;
    if (recording) { recogRef.current?.stop(); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const r = new SR();
    r.lang = "en-US"; r.continuous = true; r.interimResults = true;
    r.onresult = (e: any) => {
      const t = Array.from(e.results).map((res: any) => res[0].transcript).join("");
      setTranscript(t);
    };
    r.onend = () => setRecording(false);
    r.onerror = () => { setRecording(false); };
    r.start();
    recogRef.current = r;
    setRecording(true);
  };

  const submitAnswer = async () => {
    if (!transcript.trim()) { toast.error("Please answer first"); return; }
    if (recording) { recogRef.current?.stop(); }
    setGrading(true);
    try {
      const ctx = docName ? `Document context:\n${docContent}\n\n` : "";
      const sys = `You are a university examiner. Grade this student answer strictly out of 10. Return ONLY valid JSON: {"score": number, "feedback": "one sentence", "correct_answer": "brief correct answer", "encouragement": "one motivating sentence"}`;
      const user = `${ctx}Question: ${currentQ}\n\nStudent answer: ${transcript.trim()}`;
      const raw = await callChat(sys, user);
      const start = raw.indexOf("{"); const end = raw.lastIndexOf("}");
      let parsed: any = null;
      if (start !== -1 && end !== -1) {
        try { parsed = JSON.parse(raw.slice(start, end + 1)); } catch {}
      }
      const grade = {
        score: Math.max(0, Math.min(10, Number(parsed?.score) || 0)),
        feedback: parsed?.feedback || "Answer recorded.",
        correct: parsed?.correct_answer || "",
        encouragement: parsed?.encouragement || "Keep going!",
      };
      setLastGrade(grade);
      setHistory((h) => [...h, { question: currentQ, answer: transcript.trim(), ...grade }]);
      awardXpOnce(`viva-q-${Date.now()}-${Math.random()}`, 10);
    } catch (e) {
      handleAiError(e, "Viva");
    } finally {
      setGrading(false);
    }
  };

  const persistSession = (qa: VivaQA[]) => {
    if (qa.length === 0) return;
    const total = qa.reduce((s, h) => s + h.score, 0);
    const max = qa.length * 10;
    const pct = max > 0 ? Math.round((total / max) * 100) : 0;
    const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F";
    const entry: VivaHistoryEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      date: Date.now(),
      subject: subject || (docName ? docName : "General"),
      difficulty,
      docName,
      total, max, pct, grade, qa,
    };
    const updated = [entry, ...pastSessions];
    setPastSessions(updated);
    saveVivaHistory(updated);
  };

  const next = () => {
    const ni = qIndex + 1;
    if (ni >= count) {
      awardXpOnce(`viva-complete-${Date.now()}`, 50);
      persistSession(history);
      setPhase("results");
      return;
    }
    setQIndex(ni);
    generateQuestion(ni);
  };

  const retrySame = () => {
    setHistory([]); setQIndex(0); setLastGrade(null); setPhase("exam"); generateQuestion(0);
  };
  const reset = () => {
    setHistory([]); setQIndex(0); setLastGrade(null); setCurrentQ(""); setTranscript(""); setPhase("setup");
  };

  // ── SETUP ─────────
  if (phase === "setup") {
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-5">
          <div className="text-center">
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Mic2 className="w-6 h-6 text-primary" /></div>
            <h2 className="text-lg font-bold text-foreground">Viva Simulator</h2>
            <p className="text-sm text-muted-foreground mt-1">Practice oral exams — by topic or from your own document</p>
          </div>

          <div className="glass-card rounded-2xl border border-border bg-card/60 p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Subject (optional)</label>
              <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder='e.g. "Data Structures", "Operating Systems"' className="w-full bg-background border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Difficulty</label>
              <div className="flex gap-1.5">
                {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
                  <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${difficulty === d ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{d}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground">Number of Questions</label>
              <div className="flex gap-1.5">
                {[3, 5, 10].map((n) => (
                  <button key={n} onClick={() => setCount(n)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${count === n ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="space-y-2 pt-2 border-t border-border">
              <label className="text-xs font-medium text-muted-foreground">Document-based (optional)</label>
              <input ref={fileRef} type="file" onChange={handleUpload} accept=".txt,.md,.csv,.pdf,.docx,.doc,.ppt,.pptx,.xls,.xlsx,.json,.xml,.html,.rtf,.odt,.png,.jpg,.jpeg,.webp" className="hidden" />
              <div className="flex items-center gap-2">
                <button onClick={() => fileRef.current?.click()} disabled={extracting} className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 disabled:opacity-40">
                  {extracting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Upload Document
                </button>
                {docName && (
                  <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs">
                    <FileText className="w-3 h-3" /> {docName}
                    <button onClick={() => { setDocName(null); setDocContent(""); }} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-muted-foreground">Questions will be generated only from this document.</p>
            </div>

            <button onClick={start} className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 transition-opacity flex items-center justify-center gap-2">
              <Play className="w-4 h-4" /> Start Viva
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── EXAM ─────────
  if (phase === "exam") {
    const progress = ((qIndex) / count) * 100;
    return (
      <div className="flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto p-6 space-y-5">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Question {qIndex + 1} of {count}</span>
              {docName && <span className="flex items-center gap-1"><FileText className="w-3 h-3" /> {docName}</span>}
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <motion.div className="h-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
            </div>
          </div>

          <div className="glass-card rounded-2xl border border-border bg-card/60 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0"><Sparkles className="w-4 h-4 text-primary" /></div>
              <div className="flex-1 min-h-[3rem]">
                {genLoading ? <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /> : (
                  <>
                    <p className="text-base font-medium text-foreground leading-relaxed">{currentQ}</p>
                    <button onClick={() => speak(currentQ)} className="mt-2 text-xs text-muted-foreground hover:text-primary flex items-center gap-1"><Volume2 className="w-3 h-3" /> Repeat</button>
                  </>
                )}
              </div>
            </div>
          </div>

          {!lastGrade && (
            <div className="flex flex-col items-center gap-3">
              {speechSupported ? (
                <motion.button
                  onClick={toggleRecord}
                  disabled={genLoading || grading}
                  className={`w-24 h-24 rounded-full flex items-center justify-center transition-all relative ${recording ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground hover:opacity-90"} disabled:opacity-40`}
                  whileTap={{ scale: 0.95 }}
                >
                  {recording && (
                    <motion.span
                      className="absolute inset-0 rounded-full border-4 border-destructive"
                      animate={{ scale: [1, 1.3, 1.3], opacity: [0.7, 0, 0] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    />
                  )}
                  {recording ? <Square className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </motion.button>
              ) : (
                <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} rows={4} placeholder="Voice not supported in this browser — type your answer" className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-ring" />
              )}
              {speechSupported && (
                <p className="text-xs text-muted-foreground">{recording ? "Listening… click to stop" : "Tap mic to record your answer"}</p>
              )}
              {transcript && (
                <div className="w-full p-3 rounded-lg bg-muted/40 text-sm text-foreground italic">{transcript}</div>
              )}
              <button onClick={submitAnswer} disabled={!transcript.trim() || grading || genLoading} className="px-5 py-2 rounded-lg bg-primary text-primary-foreground font-medium disabled:opacity-40 hover:opacity-90 flex items-center gap-2">
                {grading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit Answer
              </button>
            </div>
          )}

          {lastGrade && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-2xl border border-border bg-card/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Score</span>
                <span className={`px-3 py-1 rounded-lg text-sm font-bold ${lastGrade.score >= 7 ? "bg-green-500/15 text-green-500" : lastGrade.score >= 4 ? "bg-yellow-500/15 text-yellow-600" : "bg-destructive/15 text-destructive"}`}>{lastGrade.score}/10</span>
              </div>
              <div><p className="text-xs text-muted-foreground">Feedback</p><p className="text-sm text-foreground">{lastGrade.feedback}</p></div>
              {lastGrade.correct && <div><p className="text-xs text-muted-foreground">Correct answer</p><p className="text-sm text-foreground">{lastGrade.correct}</p></div>}
              <p className="text-sm text-primary italic">{lastGrade.encouragement}</p>
              <button onClick={next} className="w-full py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center justify-center gap-2">
                {qIndex + 1 >= count ? <>See Results <Trophy className="w-4 h-4" /></> : <>Next Question <ArrowRight className="w-4 h-4" /></>}
              </button>
            </motion.div>
          )}
        </div>
      </div>
    );
  }

  // ── RESULTS ─────────
  const total = history.reduce((s, h) => s + h.score, 0);
  const max = history.length * 10;
  const pct = max > 0 ? Math.round((total / max) * 100) : 0;
  const grade = pct >= 90 ? "A" : pct >= 75 ? "B" : pct >= 60 ? "C" : pct >= 50 ? "D" : "F";
  const data = history.map((h, i) => ({ name: `Q${i + 1}`, score: h.score }));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <div className="text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3"><Trophy className="w-7 h-7 text-primary" /></div>
          <h2 className="text-lg font-bold text-foreground">Viva Complete!</h2>
          <p className="text-sm text-muted-foreground mt-1">Here is how you did</p>
        </div>

        <div className="glass-card rounded-2xl border border-border bg-card/60 p-6 grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-muted-foreground">Score</p><p className="text-2xl font-bold text-foreground">{total}/{max}</p></div>
          <div><p className="text-xs text-muted-foreground">Percentage</p><p className="text-2xl font-bold text-foreground">{pct}%</p></div>
          <div><p className="text-xs text-muted-foreground">Grade</p><p className={`text-2xl font-bold ${grade === "A" || grade === "B" ? "text-green-500" : grade === "C" ? "text-yellow-600" : "text-destructive"}`}>{grade}</p></div>
        </div>

        <div className="glass-card rounded-2xl border border-border bg-card/60 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Per-question score</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <RTooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="flex gap-2">
          <button onClick={retrySame} className="flex-1 py-2.5 rounded-lg bg-muted text-foreground font-medium hover:bg-muted/80 flex items-center justify-center gap-2"><RefreshCw className="w-4 h-4" /> Retry Same Topic</button>
          <button onClick={reset} className="flex-1 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 flex items-center justify-center gap-2"><Sparkles className="w-4 h-4" /> New Viva</button>
        </div>
      </div>
    </div>
  );
}
