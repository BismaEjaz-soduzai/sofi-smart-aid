import { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, File, Presentation, FileType, Search,
  Trash2, Sparkles, BookOpen, ClipboardList, HelpCircle, LayoutList, X,
  GraduationCap, Lightbulb, Loader2, Send, Download, Eye,
  FolderPlus, Folder, FolderOpen, ArrowLeft, MoreHorizontal,
  Phone, Video, Paperclip, Copy, UserPlus, MessageSquare,
} from "lucide-react";
import { useStudyFiles, useWorkspaceRooms, StudyFile } from "@/hooks/useStudyFiles";
import { useRoomMessages, useSendRoomMessage, useUploadRoomFile } from "@/hooks/useRoomChat";
import { useCallSignal } from "@/hooks/useCallSignal";
import CallBar from "@/components/chat/CallBar";
import { useAuth } from "@/contexts/AuthContext";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import ReactMarkdown from "react-markdown";

const FILE_ICONS: Record<string, typeof FileText> = {
  PDF: FileText, DOCX: File, PPT: Presentation, PPTX: Presentation, TXT: FileType,
};

const FILE_COLORS: Record<string, string> = {
  PDF: "bg-destructive/10 text-destructive",
  DOCX: "bg-primary/10 text-primary",
  PPT: "bg-warning/10 text-warning",
  PPTX: "bg-warning/10 text-warning",
  TXT: "bg-muted text-muted-foreground",
};

const ROOM_COLORS: Record<string, string> = {
  blue: "bg-primary/10 text-primary border-primary/20",
  purple: "bg-info/10 text-info border-info/20",
  green: "bg-success/10 text-success border-success/20",
  orange: "bg-warning/10 text-warning border-warning/20",
  red: "bg-destructive/10 text-destructive border-destructive/20",
  teal: "bg-primary/10 text-primary border-primary/20",
};

const ROOM_PRESETS = [
  { name: "Artificial Intelligence", emoji: "🤖", color: "purple" },
  { name: "Software Quality", emoji: "✅", color: "green" },
  { name: "Database Systems", emoji: "🗄️", color: "blue" },
  { name: "Cloud Computing", emoji: "☁️", color: "teal" },
  { name: "Data Structures", emoji: "🌳", color: "orange" },
  { name: "Web Development", emoji: "🌐", color: "red" },
];

const ACTIONS = [
  { label: "Explain", icon: HelpCircle, prompt: `You are an expert academic tutor for a Smart Learning Assistant. The student has uploaded a document and wants its key topics explained.

Your task:
1. Identify the main topics covered in the document below.
2. Explain each clearly as if teaching a student for the first time, using simple language.
3. Break complex ideas into small, digestible chunks.

Structure your response as:
- **What this document is about** (1–2 sentence overview)
- **Key Concepts** (top 5 as bullet points; bold each term, then a one-line explanation)
- **How it works / fits together** (step-by-step where applicable)
- **Real-world example or analogy** (relatable, simple)
- **Quick Summary** (2–3 lines at the end)

Rules:
- Base everything ONLY on the provided document content.
- Do NOT add outside knowledge or hallucinate.
- Avoid jargon unless you define it immediately in brackets.
- Keep tone warm, encouraging, and student-friendly.
- Format with clear markdown headings — clean and scannable.` },

  { label: "Summarize", icon: BookOpen, prompt: `You are an expert academic summarizer for a Smart Learning Assistant.

Your task:
Produce a structured, intelligent summary of the document below (around 250–400 words).

Structure:
- **Document Overview** — What is this document about? (2–3 sentences)
- **Main Themes** — Core ideas covered (3–5 bullet points)
- **Key Facts & Findings** — Important data, definitions, arguments
- **Conclusion / Takeaway** — What should the reader remember most?

Rules:
- Preserve original meaning. Never add outside information.
- Use clear headings and short paragraphs.
- Mark the most exam-relevant points with a ⭐ symbol.
- End with: **Bottom line:** [one sentence that captures the whole document].` },

  { label: "Notes", icon: ClipboardList, prompt: `You are a professional note-maker for a Smart Learning Assistant.

Your task:
Convert the document below into well-organized, exam-ready study notes.

Structure:
- **Topic Heading** for each major section
- Under each heading:
  → **Key definitions** (bold the term, then 1-line meaning)
  → **Core concepts** (short, memorable sentences)
  → **Formulas or rules** (if any) in their own block
  → **One example per concept** (where applicable)
- **Review Questions** at the end (5 questions to test understanding)

Rules:
- Notes must be scannable — use bullets, numbering, indentation.
- Each bullet point: max 1–2 lines.
- Do NOT copy-paste from the document. Rewrite in your own concise words.
- Prioritize content likely to appear in exams or viva.
- Add ⚡ before any "must-know" point.
- Use ONLY the provided content.` },

  { label: "Quiz", icon: Sparkles, prompt: `You are an expert exam question creator for a Smart Learning Assistant.

Your task:
Generate 10 high-quality MCQs at medium-to-exam-level difficulty, strictly based on the document below.

Format for each question:
Q{n}. [Question]
A) ...  B) ...  C) ...  D) ...
✅ Answer: [correct option]
💡 Explanation: [1 line why it's correct]

Rules:
- Questions must be based ONLY on the provided document.
- Vary types: recall, understanding, and application.
- Avoid trick questions — focus on real learning outcomes.
- Mix easy (3), medium (4), and hard (3).
- End with a Score Guide: "10/10 = Excellent · 7–9 = Good · below 7 = Review needed".` },

  { label: "Assignment", icon: LayoutList, prompt: `You are an expert academic writer helping a university student draft an assignment from the source material below.

Your task:
Write a complete, well-structured academic assignment (~1000–1500 words) using ONLY the provided content.

Structure:
**Title:** [Formal academic title]

**Introduction** (≈10%)
- Hook → Background → Problem statement / thesis → Roadmap

**Main Body** (≈70%)
- Clearly labeled sections with headings
- Each section: argument → evidence from document → analysis
- Smooth transitions between sections

**Conclusion** (≈15%)
- Restate thesis → Summarize findings → Limitations → Recommendations

**References** (≈5%)
- APA 7th-style entries based on the document

Rules:
- Formal academic English throughout.
- Paraphrase — no plagiarism. Every claim supported by evidence or reasoning.
- Avoid first person.
- Maintain consistent tense.
- Use ONLY the provided content.` },

  { label: "Outline", icon: Presentation, prompt: `You are a professional presentation designer and academic communication expert.

Your task:
Create a complete 10-slide presentation outline for an academic audience based on the document below.

For each slide:
📊 **Slide {n}: [Slide Title]**
- Purpose: [what this slide must achieve]
- Bullet points to include: (3–5 short phrases, never full sentences)
- Suggested visual: [chart / diagram / image / table]
- Speaker note: [what to SAY aloud — 2–3 natural, confident sentences]

Must include:
1. Title slide
2. Agenda / Overview
3–8. Content slides
9. Conclusion & Key Takeaways
10. Q&A / Thank You

Rules:
- One main idea per slide.
- Suggest a color theme and font pairing at the top.
- Use ONLY the provided content.
- End with: **"3 things the audience must remember after this presentation:"**` },

  { label: "Viva", icon: GraduationCap, prompt: `You are a senior academic examiner helping a final-year student prepare for a viva voce based on the document below.

Your task:
Generate realistic viva questions a professor would actually ask, with model answers.

Output format:
**Category: [Conceptual / Technical / Application / Critical Thinking]**

Q: [Question a professor would ask]
💬 How to answer:
- Opening line: "[suggested opener]"
- Key points to cover: [3–4 bullets, drawn from the document]
- Strong closing line: "[memorable ending]"
⚠️ Common mistake to avoid: [1 line]

Generate:
- 3 Conceptual questions
- 3 Technical questions
- 2 Application questions
- 2 Critical-thinking / "what if" questions

Rules:
- Questions must feel real — like an actual examiner.
- Model answers must sound confident and honest.
- Include one tricky question per category students often fumble.
- Use ONLY the provided content.
- End with: **"Top 3 questions most likely to be asked first:"**` },
];

const AI_TOOLS = [
  { label: "Explain Topic", icon: HelpCircle, prompt: `You are an expert academic tutor. Explain the topic below clearly for a university student seeing it for the first time.

Structure:
- **What is it?** (1–2 sentence definition, zero jargon)
- **Key Concepts** (max 5 bullet points; bold each term)
- **How it works** (step-by-step where applicable)
- **Real-world example or analogy** (relatable, simple)
- **Why it matters** (1–2 sentences)
- **Common misconceptions** (1–2 to watch out for)
- **Quick Summary** (2–3 lines)

Rules: Define jargon immediately. Warm, encouraging tone. Clean markdown formatting.

Topic: ` },

  { label: "Summarize", icon: BookOpen, prompt: `You are an expert at extracting the essence of any text quickly and clearly.

Your task: Summarize the content below into a structured study summary.

Include:
- The core argument or main idea (1 sentence)
- 3–5 most important points
- Key data, statistics, or facts worth keeping
- Important terms with 1-line definitions
- What action or conclusion the text leads to

Rules:
- Write in your own words. Never lift sentences directly.
- Shorter than the original by at least 60%.
- Every sentence must earn its place — no padding.
- End with: **Key Takeaway:** [one powerful sentence].

Content: ` },

  { label: "Generate Notes", icon: ClipboardList, prompt: `You are a professional note-maker. Create complete, exam-ready study notes on the topic below.

Structure:
- **KEY SUMMARY** — bullet points of main ideas
- **DETAILED NOTES** — headings + subheadings, simple language, **bold** key terms with short definitions
- **CORE CONCEPTS** — difficult ideas explained simply with one example each
- **FORMULAS / RULES** (if any) in their own block
- **KEY TAKEAWAYS** — 5–10 quick-revision bullet points
- **REVIEW QUESTIONS** — 5 questions to self-test

Rules: Each bullet max 1–2 lines. Mark must-knows with ⚡. Scannable formatting.

Topic: ` },

  { label: "Quiz Questions", icon: Sparkles, prompt: `You are an expert exam question creator. Generate 10 high-quality MCQs on the topic below.

Format for each:
Q{n}. [Question]
A) ...  B) ...  C) ...  D) ...
✅ Answer: [correct option]
💡 Explanation: [1 line why it's correct]

Rules:
- Vary across recall, understanding, and application.
- Mix difficulty: 3 easy, 4 medium, 3 hard (exam-level).
- Avoid trick questions.
- End with a Score Guide: "10/10 = Excellent · 7–9 = Good · below 7 = Review needed".

Topic: ` },

  { label: "Assignment Draft", icon: LayoutList, prompt: `You are an expert academic writer. Draft a complete university-level assignment (~1000–1500 words) on the topic below.

Structure:
**Title:** [Formal academic title]

**Introduction** (≈10%) — Hook → Background → Thesis → Roadmap
**Main Body** (≈70%) — Clearly labeled sections; each: argument → evidence → analysis; smooth transitions
**Conclusion** (≈15%) — Restate thesis → Summarize findings → Limitations → Recommendations
**References** (≈5%) — APA 7th-style suggestions

Rules: Formal academic English. Avoid first person. Consistent tense. Every claim supported by evidence or reasoning.

Topic: ` },

  { label: "Presentation Outline", icon: Presentation, prompt: `You are a professional presentation designer. Build a complete 10-slide outline for the topic below (academic audience).

For each slide:
📊 **Slide {n}: [Slide Title]**
- Purpose: [what this slide must achieve]
- Bullet points: 3–5 short phrases (never full sentences)
- Suggested visual: [chart / diagram / image / table]
- Speaker note: 2–3 natural, confident sentences

Must include: Title · Agenda · 6 content slides · Conclusion & Key Takeaways · Q&A.

Suggest a color theme and font pairing at the top.
End with: **"3 things the audience must remember after this presentation:"**

Topic: ` },

  { label: "Viva Questions", icon: GraduationCap, prompt: `You are a senior academic examiner. Generate realistic viva questions on the topic below, with model answers.

Output format:
**Category: [Conceptual / Technical / Application / Critical Thinking]**

Q: [Question a professor would actually ask]
💬 How to answer:
- Opening line: "[suggested opener]"
- Key points to cover: [3–4 bullets]
- Strong closing line: "[memorable ending]"
⚠️ Common mistake to avoid: [1 line]

Generate: 3 Conceptual · 3 Technical · 2 Application · 2 Critical-thinking. Include one tricky question per category.

End with: **"Top 3 questions most likely to be asked first:"**

Topic: ` },

  { label: "Simplify Topic", icon: Lightbulb, prompt: `You are a world-class teacher known for making the most complex topics easy to understand.

Explain the topic below so simply that a first-year student with no background could understand it.

Use this exact structure:
1. **The one-sentence version** — zero jargon.
2. **The analogy** — compare it to everyday life (food, sports, driving, etc.).
3. **Step-by-step breakdown** — max 5 steps, each in 1–2 simple sentences.
4. **What confuses most people** — address the #1 misconception.
5. **The "aha" moment** — one insight that makes it all click.
6. **Remember it forever** — a memory trick or mnemonic.

Rules:
- Never use a technical word without immediately explaining it in brackets.
- Write like you're texting a smart friend who knows nothing about this.
- Short paragraphs, conversational tone.

Topic: ` },
];

const ACCEPTED = ".pdf,.docx,.doc,.ppt,.pptx,.txt";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

type Tab = "uploads" | "ai-tools" | "generated" | "chat";

interface GeneratedItem {
  id: string;
  prompt: string;
  content: string;
  createdAt: string;
}

interface ViewingFile {
  url: string | null;
  name: string;
  type: string;
  previewText: string | null;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function fetchFileContent(file: StudyFile): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke("extract-file-text", {
      body: {
        filePath: file.file_path,
        fileName: file.file_name,
      },
    });

    if (error) {
      console.error("extract-file-text error", error);
      return null;
    }

    return typeof data?.text === "string" && data.text.trim().length > 0 ? data.text : null;
  } catch (error) {
    console.error("Failed to fetch file content", error);
    return null;
  }
}

async function readLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function getSignedUrl(file: StudyFile): Promise<string | null> {
  const { data, error } = await supabase.storage.from("study-files").createSignedUrl(file.file_path, 3600);
  if (error) return null;
  return data?.signedUrl || null;
}

export default function SmartWorkspace() {
  const { user } = useAuth();
  const profileQuery = useProfile();
  const myName = profileQuery.data?.display_name || user?.email?.split("@")[0] || "User";
  const { rooms, createRoom, deleteRoom, joinRoomByCode } = useWorkspaceRooms();
  const [activeRoomId, setActiveRoomId] = useState<string | undefined>(undefined);
  const activeRoom = rooms.find((r) => r.id === activeRoomId);

  // ===== Room chat / call state =====
  const roomCall = useCallSignal(activeRoomId || "no-room");
  const { messages: roomMessages } = useRoomMessages(activeRoomId);
  const sendRoomMessage = useSendRoomMessage();
  const uploadRoomFile = useUploadRoomFile();
  const [chatInput, setChatInput] = useState("");
  const [callElapsed, setCallElapsed] = useState(0);
  const [showJoinInput, setShowJoinInput] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const chatFileRef = useRef<HTMLInputElement>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!roomCall.activeCall) { setCallElapsed(0); return; }
    const start = roomCall.activeCall.startedAt;
    const tick = () => setCallElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [roomCall.activeCall]);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [roomMessages.length]);

  const handleStartRoomCall = (isVideo: boolean) => {
    if (!activeRoomId) return;
    roomCall.startCall(isVideo, myName, async (displayText, callUrl) => {
      await sendRoomMessage.mutateAsync({
        roomId: activeRoomId,
        content: `${displayText}||CALL_URL:${callUrl}`,
        senderName: myName,
        messageType: "system",
      });
    });
  };

  const handleSaveRoomRecording = async (blob: Blob, filename: string) => {
    if (!activeRoomId || !user) return;
    const path = `${user.id}/recordings/${filename}`;
    const { error } = await supabase.storage.from("study-files").upload(path, blob, { contentType: "video/webm" });
    if (error) { toast.error("Recording upload failed"); return; }
    const { data } = await supabase.storage.from("study-files").createSignedUrl(path, 60 * 60 * 24 * 365);
    await sendRoomMessage.mutateAsync({
      roomId: activeRoomId,
      content: "Shared a recording",
      senderName: myName,
      messageType: "file",
      fileName: filename,
      fileUrl: data?.signedUrl || "",
      fileSize: blob.size,
    });
    toast.success("Recording saved to chat");
  };

  const handleSendChat = async () => {
    if (!chatInput.trim() || !activeRoomId) return;
    const content = chatInput.trim();
    setChatInput("");
    await sendRoomMessage.mutateAsync({ roomId: activeRoomId, content, senderName: myName });
  };

  const handleChatFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !activeRoomId) return;
    const result = await uploadRoomFile.mutateAsync(file);
    await sendRoomMessage.mutateAsync({
      roomId: activeRoomId,
      content: `Shared ${file.name}`,
      senderName: myName,
      messageType: "file",
      fileName: result.name,
      fileUrl: result.url,
      fileSize: result.size,
    });
  };

  const handleQuickShare = async (file: StudyFile) => {
    if (!activeRoomId) return;
    const { data } = await supabase.storage.from("study-files").createSignedUrl(file.file_path, 60 * 60 * 24 * 365);
    await sendRoomMessage.mutateAsync({
      roomId: activeRoomId,
      content: `Shared ${file.file_name}`,
      senderName: myName,
      messageType: "file",
      fileName: file.file_name,
      fileUrl: data?.signedUrl || "",
      fileSize: file.file_size,
    });
  };

  const handleCopyInvite = () => {
    if (!activeRoom) return;
    navigator.clipboard.writeText(activeRoom.invite_code).then(() => toast.success(`Code ${activeRoom.invite_code} copied`));
  };

  const handleJoinByCode = async () => {
    try {
      const room = await joinRoomByCode.mutateAsync(joinCode);
      setActiveRoomId(room.id);
      setShowJoinInput(false);
      setJoinCode("");
      toast.success(`Joined ${room.name}`);
    } catch { /* error toast handled in hook */ }
  };

  // Pass room filter: null = general (unassigned) files, specific ID = room files
  const { files, isLoading, uploadFile, deleteFile, moveFile } = useStudyFiles(activeRoomId === undefined ? null : activeRoomId);
  const [tab, setTab] = useState<Tab>("uploads");
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [generatedItems, setGeneratedItems] = useState<GeneratedItem[]>([]);
  const [currentOutput, setCurrentOutput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [localFiles, setLocalFiles] = useState<File[]>([]);
  const localFileRef = useRef<HTMLInputElement>(null);
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [newRoom, setNewRoom] = useState({ name: "", emoji: "📁", color: "blue" });

  const filtered = files.filter((f) => f.file_name.toLowerCase().includes(search.toLowerCase()));

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    Array.from(e.dataTransfer.files).forEach((f) => uploadFile.mutate(f));
  }, [uploadFile]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) Array.from(e.target.files).forEach((f) => uploadFile.mutate(f));
    e.target.value = "";
  };

  const handleLocalFileAction = async (file: File, prompt: string) => {
    setAiLoading(true); setIsStreaming(true); setCurrentOutput(""); setTab("generated");
    try {
      const content = await readLocalFile(file);
      await runAiStream(`${prompt}\n\nFile: "${file.name}"\n\nContent:\n${content.slice(0, 15000)}`);
    } catch { toast.error("Could not read file"); setAiLoading(false); setIsStreaming(false); }
  };

  const handleAddLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) { setLocalFiles((prev) => [...prev, ...Array.from(e.target.files!)]); toast.success(`${e.target.files.length} file(s) added`); }
    e.target.value = "";
  };

  const [viewingFile, setViewingFile] = useState<ViewingFile | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);

  const handleOpenFile = async (file: StudyFile) => {
    setIsPreviewLoading(true);

    try {
      const [url, previewText] = await Promise.all([
        getSignedUrl(file),
        fetchFileContent(file),
      ]);

      if (!url && !previewText) {
        toast.error("Could not open file preview");
        return;
      }

      setViewingFile({
        url,
        name: file.file_name,
        type: file.file_type,
        previewText,
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleDownloadFile = async (file: StudyFile) => {
    const url = await getSignedUrl(file);
    if (!url) { toast.error("Could not generate download link"); return; }
    const a = document.createElement("a"); a.href = url; a.download = file.file_name; a.click();
  };

  const handleFileAction = async (file: StudyFile, prompt: string) => {
    setAiLoading(true); setIsStreaming(true); setCurrentOutput(""); setTab("generated");
    const content = await fetchFileContent(file);
    const fullPrompt = content
      ? `${prompt}\n\nFile: "${file.file_name}"\n\nContent:\n${content.slice(0, 15000)}`
      : `${prompt}: "${file.file_name}" (could not read content)`;
    await runAiStream(fullPrompt);
  };

  const handleAiSubmit = async (prompt?: string) => {
    const text = prompt || aiInput;
    if (!text.trim() || aiLoading) return;
    setAiLoading(true); setIsStreaming(true); setCurrentOutput(""); setTab("generated");
    await runAiStream(text);
  };

  const runAiStream = async (text: string) => {
    let content = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });
      if (!resp.ok) { await throwIfBadResponse(resp, "AI generation"); }
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
          try { const p = JSON.parse(json); const c = p.choices?.[0]?.delta?.content; if (c) { content += c; setCurrentOutput(content); } }
          catch { buffer = line + "\n" + buffer; break; }
        }
      }
      setGeneratedItems((prev) => [{ id: crypto.randomUUID(), prompt: text.slice(0, 200), content, createdAt: new Date().toISOString() }, ...prev]);
    } catch (e: any) { handleAiError(e, "AI generation"); }
    finally { setAiLoading(false); setIsStreaming(false); setAiInput(""); }
  };

  const handleCreateRoom = async () => {
    if (!newRoom.name.trim()) return;
    await createRoom.mutateAsync(newRoom);
    setNewRoom({ name: "", emoji: "📁", color: "blue" }); setShowCreateRoom(false);
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "uploads", label: "Uploads" },
    { key: "ai-tools", label: "AI Tools" },
    { key: "generated", label: "Generated" },
    { key: "chat", label: "Room Chat" },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          {activeRoom ? (
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={() => setActiveRoomId(undefined)} className="text-muted-foreground hover:text-foreground transition-colors"><ArrowLeft className="w-4 h-4" /></button>
              <span className="text-xl">{activeRoom.emoji}</span>
              <h1 className="text-xl font-bold text-foreground">{activeRoom.name}</h1>
              <button
                onClick={handleCopyInvite}
                title="Click to copy invite code"
                className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-primary/10 text-primary text-xs font-mono font-semibold hover:bg-primary/20 transition-colors"
              >
                <Copy className="w-3 h-3" /> {activeRoom.invite_code}
              </button>
            </div>
          ) : (
            <div>
              <h1 className="text-xl font-bold text-foreground">Smart Workspace</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Organize by subject, use AI tools, generate content</p>
            </div>
          )}
        </div>
        {!activeRoom && (
          <div className="flex items-center gap-2">
            <button onClick={() => setShowJoinInput((v) => !v)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-medium hover:bg-muted/80 transition-colors">
              <UserPlus className="w-3.5 h-3.5" /> Join
            </button>
            <button onClick={() => setShowCreateRoom(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity">
              <FolderPlus className="w-3.5 h-3.5" /> New Room
            </button>
          </div>
        )}
      </div>

      {/* Join by code */}
      <AnimatePresence>
        {showJoinInput && !activeRoom && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-3 flex items-center gap-2">
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="Enter code (e.g. ABC-DEF)"
                className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring uppercase"
                onKeyDown={(e) => { if (e.key === "Enter") handleJoinByCode(); }}
              />
              <button onClick={handleJoinByCode} disabled={!joinCode.trim() || joinRoomByCode.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">
                {joinRoomByCode.isPending ? "Joining..." : "Join"}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active call bar */}
      <AnimatePresence>
        {activeRoom && roomCall.activeCall && (
          <CallBar
            callUrl={roomCall.activeCall.callUrl}
            isVideo={roomCall.activeCall.isVideo}
            startedBy={roomCall.activeCall.startedBy}
            elapsed={callElapsed}
            isRecording={roomCall.isRecording}
            recordingTime={roomCall.recordingTime}
            formatRecTime={roomCall.formatRecTime}
            onReopen={() => roomCall.joinCall(roomCall.activeCall!.callUrl)}
            onEnd={roomCall.endCall}
            onStartRecording={() => roomCall.startRecording(handleSaveRoomRecording)}
            onStopRecording={roomCall.stopRecording}
          />
        )}
      </AnimatePresence>


      {/* Room creation modal */}
      <AnimatePresence>
        {showCreateRoom && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Create Subject Room</h3>
                <button onClick={() => setShowCreateRoom(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
              </div>
              <div className="flex gap-2">
                <input value={newRoom.emoji} onChange={(e) => setNewRoom({ ...newRoom, emoji: e.target.value })} className="w-12 bg-muted/50 border border-border rounded-lg px-2 py-2 text-center text-lg outline-none" maxLength={2} />
                <input value={newRoom.name} onChange={(e) => setNewRoom({ ...newRoom, name: e.target.value })} placeholder="e.g. Artificial Intelligence" className="flex-1 bg-muted/50 border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Color:</span>
                {Object.keys(ROOM_COLORS).map((c) => (
                  <button key={c} onClick={() => setNewRoom({ ...newRoom, color: c })} className={`w-6 h-6 rounded-full border-2 transition-all ${c === "blue" ? "bg-primary" : c === "purple" ? "bg-info" : c === "green" ? "bg-success" : c === "orange" ? "bg-warning" : c === "red" ? "bg-destructive" : "bg-primary"} ${newRoom.color === c ? "ring-2 ring-offset-2 ring-ring" : "opacity-50"}`} />
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROOM_PRESETS.map((p) => (
                  <button key={p.name} onClick={() => setNewRoom(p)} className="px-2 py-1 rounded-lg text-[10px] font-medium bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                    {p.emoji} {p.name}
                  </button>
                ))}
              </div>
              <button onClick={handleCreateRoom} disabled={!newRoom.name.trim()} className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity">Create Room</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Room grid (only when no room is active) */}
      {!activeRoom && rooms.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {rooms.map((room) => {
            const colorClass = ROOM_COLORS[room.color] || ROOM_COLORS.blue;
            return (
              <motion.button key={room.id} whileHover={{ y: -2 }} onClick={() => setActiveRoomId(room.id)}
                className={`flex items-center gap-3 p-3.5 rounded-xl border ${colorClass} hover:shadow-sm transition-all text-left group relative`}>
                <span className="text-2xl">{room.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">{room.name}</p>
                  <p className="text-[10px] text-muted-foreground">{format(new Date(room.created_at), "MMM d")}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); deleteRoom.mutate(room.id); }}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 rounded-md hover:bg-destructive/10 text-destructive/60 hover:text-destructive transition-all">
                  <Trash2 className="w-3 h-3" />
                </button>
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted/50 rounded-xl p-1">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all ${tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* TAB: Uploads */}
      {tab === "uploads" && (
        <div className="space-y-4">
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 bg-card"}`}>
            <input type="file" accept={ACCEPTED} multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{dragOver ? "Drop files here" : "Drag & drop files or click to upload"}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPT, PPTX, TXT — up to 20MB{activeRoom ? ` • Into ${activeRoom.name}` : ""}</p>
              </div>
            </div>
            {uploadFile.isPending && (
              <div className="absolute inset-0 bg-card/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-primary font-medium"><div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...</div>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search files..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none" />
              {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
            </div>
          )}

          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><FileText className="w-6 h-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium text-foreground">{files.length === 0 ? "No files yet" : "No matching files"}</p>
              <p className="text-xs text-muted-foreground mt-1">{files.length === 0 ? "Upload study materials to get started" : "Try a different search"}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((file) => {
                  const Icon = FILE_ICONS[file.file_type] || FileText;
                  const color = FILE_COLORS[file.file_type] || "bg-muted text-muted-foreground";
                  return (
                    <motion.div key={file.id} layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start gap-3">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}><Icon className="w-4.5 h-4.5" /></div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-foreground truncate">{file.file_name}</h3>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>{file.file_type}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{formatSize(file.file_size)} · {format(new Date(file.created_at), "MMM d, yyyy")}</p>
                          <div className="flex gap-2 mt-2 mb-2">
                             <button onClick={() => handleOpenFile(file)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors" disabled={isPreviewLoading}><Eye className="w-3 h-3" /> {isPreviewLoading ? "Opening..." : "Open"}</button>
                            <button onClick={() => handleDownloadFile(file)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"><Download className="w-3 h-3" /> Download</button>
                            {/* Move to room */}
                            {rooms.length > 0 && (
                              <select onChange={(e) => { moveFile.mutate({ fileId: file.id, targetRoomId: e.target.value || null }); e.target.value = ""; }}
                                className="text-[11px] bg-muted/60 border-0 rounded-lg px-2 py-1 text-muted-foreground outline-none cursor-pointer" defaultValue="">
                                <option value="" disabled>Move to...</option>
                                <option value="">📂 General</option>
                                {rooms.map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name}</option>)}
                              </select>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {ACTIONS.map((action) => (
                              <button key={action.label} onClick={() => handleFileAction(file, action.prompt)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors">
                                <action.icon className="w-3 h-3" />{action.label}
                              </button>
                            ))}
                            <button onClick={() => deleteFile.mutate(file)} className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto">
                              <Trash2 className="w-3 h-3" />Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>
      )}

      {/* TAB: AI Tools */}
      {tab === "ai-tools" && (
        <div className="space-y-5">
          <div className="flex items-end gap-2 bg-card border border-border rounded-xl px-4 py-3">
            <textarea value={aiInput} onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
              placeholder="Enter a topic or paste content to process..." rows={2}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none" />
            <button onClick={() => handleAiSubmit()} disabled={!aiInput.trim() || aiLoading} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {localFiles.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" /> Local Files (ready for AI)</p>
              <div className="space-y-2">
                {localFiles.map((file, idx) => (
                  <div key={`${file.name}-${idx}`} className="flex items-center justify-between bg-card border border-border rounded-lg p-2.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      <span className="text-sm text-foreground truncate">{file.name}</span>
                      <span className="text-[10px] text-muted-foreground">{formatSize(file.size)}</span>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      {ACTIONS.slice(0, 3).map((action) => (
                        <button key={action.label} onClick={() => handleLocalFileAction(file, action.prompt)} className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">{action.label}</button>
                      ))}
                      <button onClick={() => setLocalFiles((prev) => prev.filter((_, i) => i !== idx))} className="px-1.5 py-1 rounded text-[10px] text-destructive/70 hover:bg-destructive/10"><X className="w-3 h-3" /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input ref={localFileRef} type="file" accept={ACCEPTED + ",.csv,.md"} multiple onChange={handleAddLocalFiles} className="hidden" />
            <button onClick={() => localFileRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors border border-dashed border-border">
              <Upload className="w-3.5 h-3.5" /> Add local files for AI
            </button>
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1.5"><Sparkles className="w-3 h-3" /> Academic AI Tools</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {AI_TOOLS.map((tool) => (
                <button key={tool.label} onClick={() => setAiInput(tool.prompt)} className="flex flex-col items-center gap-2 p-3 rounded-xl bg-card border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-center group">
                  <div className="w-8 h-8 rounded-lg bg-muted group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                    <tool.icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                  <span className="text-[11px] font-medium text-foreground">{tool.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB: Generated */}
      {tab === "generated" && (
        <div className="space-y-4">
          {isStreaming && currentOutput && (
            <div className="bg-card border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3"><Loader2 className="w-4 h-4 animate-spin text-primary" /><span className="text-xs font-medium text-primary">Generating...</span></div>
              <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{currentOutput}</ReactMarkdown></div>
            </div>
          )}
          {generatedItems.length === 0 && !isStreaming ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><Sparkles className="w-6 h-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium text-foreground">No generated content yet</p>
              <p className="text-xs text-muted-foreground mt-1">Use AI Tools to generate study content</p>
            </div>
          ) : (
            generatedItems.map((item) => (
              <motion.div key={item.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-primary truncate max-w-[70%]">{item.prompt}</p>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(item.createdAt), "MMM d, h:mm a")}</span>
                </div>
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"><ReactMarkdown>{item.content}</ReactMarkdown></div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* TAB: Room Chat */}
      {tab === "chat" && (
        <div className="space-y-3">
          {!activeRoom ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3"><MessageSquare className="w-6 h-6 text-muted-foreground" /></div>
              <p className="text-sm font-medium text-foreground">Open a room to start chatting</p>
              <p className="text-xs text-muted-foreground mt-1">Pick or create a subject room above</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => handleStartRoomCall(false)}
                  disabled={!!roomCall.activeCall}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 text-success text-xs font-medium hover:bg-success/20 disabled:opacity-40 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5" /> Voice
                </button>
                <button
                  onClick={() => handleStartRoomCall(true)}
                  disabled={!!roomCall.activeCall}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 disabled:opacity-40 transition-colors"
                >
                  <Video className="w-3.5 h-3.5" /> Video
                </button>
              </div>

              <div ref={chatScrollRef} className="bg-card border border-border rounded-xl h-[420px] overflow-y-auto p-4 space-y-3">
                {roomMessages.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground pt-12">No messages yet — say hi 👋</div>
                ) : (
                  roomMessages.map((m) => {
                    const mine = m.user_id === user?.id;
                    if (m.message_type === "system") {
                      const [displayText, callPart] = m.content.split("||CALL_URL:");
                      const callUrl = callPart || null;
                      return (
                        <div key={m.id} className="flex items-center justify-center gap-2 py-1">
                          <span className="text-[11px] text-muted-foreground bg-muted/60 rounded-full px-3 py-1">{displayText}</span>
                          {callUrl && (
                            <button
                              onClick={() => roomCall.joinCall(callUrl)}
                              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-success text-success-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                            >
                              📞 Join Call
                            </button>
                          )}
                        </div>
                      );
                    }
                    if (m.message_type === "file") {
                      return (
                        <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[80%] rounded-xl p-3 border ${mine ? "bg-primary/10 border-primary/20" : "bg-muted/50 border-border"}`}>
                            {!mine && <p className="text-[10px] font-semibold text-muted-foreground mb-1">{m.sender_name || "Member"}</p>}
                            <div className="flex items-center gap-2">
                              <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium text-foreground truncate">{m.file_name}</p>
                                {m.file_size != null && <p className="text-[10px] text-muted-foreground">{formatSize(m.file_size)}</p>}
                              </div>
                              {m.file_url && (
                                <a href={m.file_url} target="_blank" rel="noopener noreferrer" download={m.file_name || undefined} className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-medium hover:opacity-90">
                                  <Download className="w-3 h-3" /> Open
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return (
                      <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] rounded-xl px-3 py-2 ${mine ? "bg-primary text-primary-foreground" : "bg-muted/60 text-foreground"}`}>
                          {!mine && <p className="text-[10px] font-semibold opacity-70 mb-0.5">{m.sender_name || "Member"}</p>}
                          <p className="text-sm whitespace-pre-wrap break-words">{m.content}</p>
                          <p className={`text-[9px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>{format(new Date(m.created_at), "h:mm a")}</p>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {files.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-medium text-muted-foreground">Quick share:</span>
                  {files.slice(0, 5).map((f) => (
                    <button
                      key={f.id}
                      onClick={() => handleQuickShare(f)}
                      className="flex items-center gap-1 px-2 py-1 rounded-md bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary text-[10px] transition-colors"
                    >
                      <FileText className="w-3 h-3" /> {f.file_name.length > 18 ? f.file_name.slice(0, 18) + "…" : f.file_name}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-2 bg-card border border-border rounded-xl px-3 py-2">
                <input ref={chatFileRef} type="file" onChange={handleChatFileUpload} className="hidden" />
                <button
                  onClick={() => chatFileRef.current?.click()}
                  disabled={uploadRoomFile.isPending}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-40"
                  title="Attach file"
                >
                  {uploadRoomFile.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(); } }}
                  placeholder="Message the room..."
                  className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
                />
                <button
                  onClick={handleSendChat}
                  disabled={!chatInput.trim() || sendRoomMessage.isPending}
                  className="w-8 h-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
        </div>
      )}


      <AnimatePresence>
        {viewingFile && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card">
              <div className="flex items-center gap-3 min-w-0">
                <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                <h3 className="text-sm font-semibold text-foreground truncate">{viewingFile.name}</h3>
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{viewingFile.type}</span>
              </div>
              <div className="flex items-center gap-2">
                <a href={viewingFile.url} download={viewingFile.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"><Download className="w-3.5 h-3.5" /> Download</a>
                <a href={viewingFile.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors"><Eye className="w-3.5 h-3.5" /> New Tab</a>
                <button onClick={() => setViewingFile(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {viewingFile.previewText ? (
                <div className="h-full overflow-y-auto p-6 bg-card">
                  <div className="max-w-4xl mx-auto space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Document preview</p>
                      <p className="text-xs text-muted-foreground">AI-readable extracted text</p>
                    </div>
                    <div className="rounded-xl border border-border bg-background p-4">
                      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground font-sans">{viewingFile.previewText}</pre>
                    </div>
                  </div>
                </div>
              ) : viewingFile.url && (["PDF", "TXT"].includes(viewingFile.type) || viewingFile.name.toLowerCase().endsWith(".pdf") || viewingFile.name.toLowerCase().endsWith(".txt")) ? (
                <iframe src={viewingFile.url} className="w-full h-full border-0" title={viewingFile.name} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center"><FileText className="w-8 h-8 text-muted-foreground" /></div>
                  <p className="text-sm text-foreground font-medium">Preview not available for {viewingFile.type} files</p>
                  {viewingFile.url && <a href={viewingFile.url} download={viewingFile.name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"><Download className="w-4 h-4 inline mr-1.5" /> Download File</a>}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
