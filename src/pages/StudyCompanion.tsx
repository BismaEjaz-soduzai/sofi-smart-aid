import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "react-router-dom";
import {
  BookOpen, Send, Sparkles, FileText, HelpCircle, ClipboardList,
  LayoutList, Presentation, GraduationCap, Calendar, Lightbulb, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const STUDY_TOOLS = [
  { label: "Explain Topic", icon: HelpCircle, prompt: "Explain this topic in simple words: " },
  { label: "Summarize", icon: BookOpen, prompt: "Summarize the following topic: " },
  { label: "Generate Notes", icon: ClipboardList, prompt: "Create detailed study notes on: " },
  { label: "Quiz Questions", icon: Sparkles, prompt: "Generate 10 quiz questions with answers on: " },
  { label: "Assignment Draft", icon: LayoutList, prompt: "Create an assignment draft on: " },
  { label: "Presentation Outline", icon: Presentation, prompt: "Create a presentation outline on: " },
  { label: "Viva Questions", icon: GraduationCap, prompt: "Generate viva/oral exam questions on: " },
  { label: "Study Plan", icon: Calendar, prompt: "Create a study plan for: " },
];

const QUICK_PROMPTS = [
  "Explain software testing in simple words",
  "Create quiz questions on OOP concepts",
  "Make an assignment draft on cloud computing",
  "Generate viva questions on database normalization",
  "Create presentation points on machine learning",
  "Teach me about data structures step by step",
];

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

export default function StudyCompanion() {
  const location = useLocation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Handle incoming action from Learning Hub
  useEffect(() => {
    const state = location.state as { prompt?: string; fileName?: string } | null;
    if (state?.prompt) {
      setInput(state.prompt);
      window.history.replaceState({}, "");
    }
  }, [location.state]);

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
        body: JSON.stringify({
          messages: allMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
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
      if (!assistantContent) {
        setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleToolClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus();
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center gap-3 flex-shrink-0">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <BookOpen className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">Study Companion</h1>
          <p className="text-[10px] text-muted-foreground">AI-powered academic assistant</p>
        </div>
      </div>

      {/* Messages or Empty State */}
      <div ref={scrollRef} className="flex-1 overflow-auto">
        {isEmpty ? (
          <div className="p-4 lg:p-6 max-w-3xl mx-auto space-y-6">
            {/* Greeting */}
            <div className="text-center pt-6 pb-2">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-6 h-6 text-primary" />
              </div>
              <h2 className="text-lg font-bold text-foreground">How can I help you study?</h2>
              <p className="text-sm text-muted-foreground mt-1">Pick a tool or ask me anything academic</p>
            </div>

            {/* Study Tools Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {STUDY_TOOLS.map((tool) => (
                <button
                  key={tool.label}
                  onClick={() => handleToolClick(tool.prompt)}
                  className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-center group"
                >
                  <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <tool.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{tool.label}</span>
                </button>
              ))}
            </div>

            {/* Quick Prompts */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                <Lightbulb className="w-3 h-3" /> Try asking
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => sendMessage(p)}
                    className="px-3 py-1.5 rounded-lg bg-muted/60 text-xs text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-4 max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    }`}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {isLoading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
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
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask SOFI about any topic..."
            rows={1}
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none max-h-32"
            style={{ minHeight: "1.5rem" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
