import { useState, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, File, Presentation, FileType, Search,
  Trash2, Sparkles, BookOpen, ClipboardList, HelpCircle, LayoutList, X,
  GraduationCap, Lightbulb, Loader2, Send, Download, Eye,
} from "lucide-react";
import { useStudyFiles, StudyFile } from "@/hooks/useStudyFiles";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { toast } from "sonner";
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

const ACTIONS = [
  { label: "Explain", icon: HelpCircle, prompt: "Explain this document in simple words" },
  { label: "Summarize", icon: BookOpen, prompt: "Summarize this document" },
  { label: "Notes", icon: ClipboardList, prompt: "Generate study notes from this document" },
  { label: "Quiz", icon: Sparkles, prompt: "Create quiz questions from this document" },
  { label: "Assignment", icon: LayoutList, prompt: "Create an assignment draft from this document" },
  { label: "Outline", icon: Presentation, prompt: "Create presentation outline from this document" },
  { label: "Viva", icon: GraduationCap, prompt: "Generate viva questions from this document" },
];

const AI_TOOLS = [
  { label: "Explain Topic", icon: HelpCircle, prompt: "Explain this topic in simple words: " },
  { label: "Summarize", icon: BookOpen, prompt: "Summarize the following: " },
  { label: "Generate Notes", icon: ClipboardList, prompt: "Create detailed study notes on: " },
  { label: "Quiz Questions", icon: Sparkles, prompt: "Generate 10 quiz questions with answers on: " },
  { label: "Assignment Draft", icon: LayoutList, prompt: "Create an assignment draft on: " },
  { label: "Presentation Outline", icon: Presentation, prompt: "Create a presentation outline on: " },
  { label: "Viva Questions", icon: GraduationCap, prompt: "Generate viva questions on: " },
  { label: "Simplify Topic", icon: Lightbulb, prompt: "Simplify this difficult topic step by step: " },
];

const ACCEPTED = ".pdf,.docx,.doc,.ppt,.pptx,.txt";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

type Tab = "uploads" | "ai-tools" | "generated";

interface GeneratedItem {
  id: string;
  prompt: string;
  content: string;
  createdAt: string;
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Download a file from storage and return its text content (for text-based files) */
async function fetchFileContent(file: StudyFile): Promise<string | null> {
  try {
    const { data, error } = await supabase.storage
      .from("study-files")
      .download(file.file_path);
    if (error || !data) {
      console.error("Failed to download file:", error);
      return null;
    }
    const text = await data.text();
    if (text && text.length > 20 && !text.includes("\u0000")) {
      return text;
    }
    return `[Binary file: ${file.file_name} (${file.file_type}, ${formatSize(file.file_size)}). Content cannot be extracted client-side. Please describe what you'd like to know about this file.]`;
  } catch (e) {
    console.error("Error fetching file:", e);
    return null;
  }
}

/** Read a local File object as text */
async function readLocalFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsText(file);
  });
}

async function getSignedUrl(file: StudyFile): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("study-files")
    .createSignedUrl(file.file_path, 3600);
  if (error) { console.error("Signed URL error:", error); return null; }
  return data?.signedUrl || null;
}

export default function SmartWorkspace() {
  const { files, isLoading, uploadFile, deleteFile } = useStudyFiles();
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

  const filtered = files.filter((f) =>
    f.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      // Upload to cloud
      droppedFiles.forEach((f) => uploadFile.mutate(f));
      // Also keep local references for immediate AI processing
      setLocalFiles((prev) => [...prev, ...droppedFiles]);
    },
    [uploadFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      selected.forEach((f) => uploadFile.mutate(f));
      setLocalFiles((prev) => [...prev, ...selected]);
    }
    e.target.value = "";
  };

  /** Process a local file with AI directly (no cloud needed) */
  const handleLocalFileAction = async (file: File, prompt: string) => {
    setAiLoading(true);
    setIsStreaming(true);
    setCurrentOutput("");
    setTab("generated");
    try {
      const content = await readLocalFile(file);
      const fullPrompt = `${prompt}\n\nFile: "${file.name}"\n\nContent:\n${content.slice(0, 15000)}`;
      await runAiStream(fullPrompt);
    } catch {
      toast.error("Could not read file. It may be a binary format.");
      setAiLoading(false);
      setIsStreaming(false);
    }
  };

  /** Add local files for AI processing without uploading */
  const handleAddLocalFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setLocalFiles((prev) => [...prev, ...Array.from(e.target.files!)]);
      toast.success(`${e.target.files.length} file(s) added for AI processing`);
    }
    e.target.value = "";
  };

  const [viewingFile, setViewingFile] = useState<{ url: string; name: string; type: string } | null>(null);

  const handleOpenFile = async (file: StudyFile) => {
    const url = await getSignedUrl(file);
    if (url) {
      setViewingFile({ url, name: file.file_name, type: file.file_type });
    } else {
      toast.error("Could not open file. Try downloading instead.");
    }
  };

  const handleDownloadFile = async (file: StudyFile) => {
    const url = await getSignedUrl(file);
    if (!url) { toast.error("Could not generate download link"); return; }
    const a = document.createElement("a");
    a.href = url;
    a.download = file.file_name;
    a.click();
  };

  const handleFileAction = async (file: StudyFile, prompt: string) => {
    setAiLoading(true);
    setIsStreaming(true);
    setCurrentOutput("");
    setTab("generated");

    // Fetch actual file content
    const content = await fetchFileContent(file);
    const fullPrompt = content
      ? `${prompt}\n\nFile: "${file.file_name}"\n\nContent:\n${content.slice(0, 15000)}`
      : `${prompt}: "${file.file_name}" (could not read file content — please provide general guidance)`;

    await runAiStream(fullPrompt);
  };

  const handleAiSubmit = async (prompt?: string) => {
    const text = prompt || aiInput;
    if (!text.trim() || aiLoading) return;
    setAiLoading(true);
    setIsStreaming(true);
    setCurrentOutput("");
    setTab("generated");
    await runAiStream(text);
  };

  const runAiStream = async (text: string) => {
    let content = "";
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: [{ role: "user", content: text }] }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({}));
        throw new Error(err.error || `Error ${resp.status}`);
      }
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
            if (c) { content += c; setCurrentOutput(content); }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }

      setGeneratedItems((prev) => [
        { id: crypto.randomUUID(), prompt: text.slice(0, 200), content, createdAt: new Date().toISOString() },
        ...prev,
      ]);
    } catch (e: any) {
      toast.error(e.message || "Failed to generate content");
    } finally {
      setAiLoading(false);
      setIsStreaming(false);
      setAiInput("");
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: "uploads", label: "Uploads" },
    { key: "ai-tools", label: "AI Tools" },
    { key: "generated", label: "Generated" },
  ];

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl font-bold text-foreground">Smart Workspace</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload materials, use AI tools, and generate academic content</p>
      </div>

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
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 bg-card"}`}
          >
            <input type="file" accept={ACCEPTED} multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" />
            <div className="flex flex-col items-center gap-3">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Upload className="w-5 h-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">{dragOver ? "Drop files here" : "Drag & drop files or click to upload"}</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPT, PPTX, TXT — up to 20MB</p>
              </div>
            </div>
            {uploadFile.isPending && (
              <div className="absolute inset-0 bg-card/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <div className="flex items-center gap-2 text-sm text-primary font-medium">
                  <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" /> Uploading...
                </div>
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
              <p className="text-sm font-medium text-foreground">{files.length === 0 ? "No files uploaded yet" : "No matching files"}</p>
              <p className="text-xs text-muted-foreground mt-1">{files.length === 0 ? "Upload study materials to get started" : "Try a different search term"}</p>
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
                          
                          {/* Open / Download buttons */}
                          <div className="flex gap-2 mt-2 mb-2">
                            <button onClick={() => handleOpenFile(file)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                              <Eye className="w-3 h-3" /> Open
                            </button>
                            <button onClick={() => handleDownloadFile(file)} className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                              <Download className="w-3 h-3" /> Download
                            </button>
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
            <textarea
              value={aiInput}
              onChange={(e) => setAiInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAiSubmit(); } }}
              placeholder="Enter a topic or paste content to process..."
              rows={2}
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none resize-none"
            />
            <button onClick={() => handleAiSubmit()} disabled={!aiInput.trim() || aiLoading} className="w-9 h-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40 hover:opacity-90 transition-opacity flex-shrink-0">
              {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </div>
          {/* Local files for AI processing */}
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
                        <button key={action.label} onClick={() => handleLocalFileAction(file, action.prompt)} className="px-2 py-1 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                          {action.label}
                        </button>
                      ))}
                      <button onClick={() => setLocalFiles((prev) => prev.filter((_, i) => i !== idx))} className="px-1.5 py-1 rounded text-[10px] text-destructive/70 hover:bg-destructive/10">
                        <X className="w-3 h-3" />
                      </button>
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

      {/* TAB: Generated Content */}
      {tab === "generated" && (
        <div className="space-y-4">
          {isStreaming && currentOutput && (
            <div className="bg-card border border-primary/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs font-medium text-primary">Generating...</span>
              </div>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{currentOutput}</ReactMarkdown>
              </div>
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
                <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                  <ReactMarkdown>{item.content}</ReactMarkdown>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* In-App File Viewer Modal */}
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
                <a href={viewingFile.url} download={viewingFile.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                  <Download className="w-3.5 h-3.5" /> Download
                </a>
                <a href={viewingFile.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground hover:bg-muted/80 transition-colors">
                  <Eye className="w-3.5 h-3.5" /> New Tab
                </a>
                <button onClick={() => setViewingFile(null)} className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-hidden">
              {["PDF", "TXT"].includes(viewingFile.type) || viewingFile.name.endsWith(".pdf") || viewingFile.name.endsWith(".txt") ? (
                <iframe src={viewingFile.url} className="w-full h-full border-0" title={viewingFile.name} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-foreground font-medium">Preview not available for {viewingFile.type} files</p>
                  <p className="text-xs text-muted-foreground">Download the file or open in a new tab to view</p>
                  <a href={viewingFile.url} download={viewingFile.name} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
                    <Download className="w-4 h-4 inline mr-1.5" /> Download File
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
