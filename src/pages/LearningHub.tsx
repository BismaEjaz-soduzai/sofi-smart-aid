import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, FileText, File, Presentation, FileType, Search,
  Trash2, Sparkles, BookOpen, ClipboardList, HelpCircle, LayoutList, X,
} from "lucide-react";
import { useStudyFiles, StudyFile } from "@/hooks/useStudyFiles";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";

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
  { label: "Explain", icon: HelpCircle, prompt: "Explain this file in simple words" },
  { label: "Summarize", icon: BookOpen, prompt: "Summarize this file" },
  { label: "Notes", icon: ClipboardList, prompt: "Generate study notes from this file" },
  { label: "Quiz", icon: Sparkles, prompt: "Create quiz questions from this file" },
  { label: "Assignment", icon: LayoutList, prompt: "Create an assignment draft from this file" },
  { label: "Outline", icon: Presentation, prompt: "Create presentation outline from this file" },
];

const ACCEPTED = ".pdf,.docx,.doc,.ppt,.pptx,.txt";

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function LearningHub() {
  const { files, isLoading, uploadFile, deleteFile } = useStudyFiles();
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const navigate = useNavigate();

  const filtered = files.filter((f) =>
    f.file_name.toLowerCase().includes(search.toLowerCase())
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const droppedFiles = Array.from(e.dataTransfer.files);
      droppedFiles.forEach((f) => uploadFile.mutate(f));
    },
    [uploadFile]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      Array.from(e.target.files).forEach((f) => uploadFile.mutate(f));
    }
    e.target.value = "";
  };

  const handleAction = (file: StudyFile, prompt: string) => {
    navigate("/study", { state: { fileId: file.id, fileName: file.file_name, prompt: `${prompt}: "${file.file_name}"` } });
  };

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Learning Hub</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Upload and manage your study materials</p>
      </div>

      {/* Upload Area */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        className={`relative rounded-2xl border-2 border-dashed transition-all duration-200 p-8 text-center ${
          dragOver
            ? "border-primary bg-primary/5 scale-[1.01]"
            : "border-border hover:border-primary/40 bg-card"
        }`}
      >
        <input
          type="file"
          accept={ACCEPTED}
          multiple
          onChange={handleFileSelect}
          className="absolute inset-0 opacity-0 cursor-pointer"
        />
        <div className="flex flex-col items-center gap-3">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-colors ${dragOver ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {dragOver ? "Drop files here" : "Drag & drop files or click to upload"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, PPT, PPTX, TXT — up to 20MB</p>
          </div>
        </div>
        {uploadFile.isPending && (
          <div className="absolute inset-0 bg-card/80 backdrop-blur-sm rounded-2xl flex items-center justify-center">
            <div className="flex items-center gap-2 text-sm text-primary font-medium">
              <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Uploading...
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      {files.length > 0 && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-xl px-3 py-2">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {search && (
            <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Files */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
            <FileText className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">
            {files.length === 0 ? "No files uploaded yet" : "No matching files"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {files.length === 0 ? "Upload study materials to get started" : "Try a different search term"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((file) => {
              const Icon = FILE_ICONS[file.file_type] || FileText;
              const color = FILE_COLORS[file.file_type] || "bg-muted text-muted-foreground";
              return (
                <motion.div
                  key={file.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}>
                      <Icon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-medium text-foreground truncate">{file.file_name}</h3>
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${color}`}>
                          {file.file_type}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {formatSize(file.file_size)} · {format(new Date(file.created_at), "MMM d, yyyy")}
                      </p>

                      {/* Action buttons */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {ACTIONS.map((action) => (
                          <button
                            key={action.label}
                            onClick={() => handleAction(file, action.prompt)}
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium bg-muted/60 text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors"
                          >
                            <action.icon className="w-3 h-3" />
                            {action.label}
                          </button>
                        ))}
                        <button
                          onClick={() => deleteFile.mutate(file)}
                          className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-medium text-destructive/70 hover:bg-destructive/10 hover:text-destructive transition-colors ml-auto"
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete
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
  );
}
