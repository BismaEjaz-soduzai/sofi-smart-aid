import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isPast } from "date-fns";
import { StickyNote, Plus, Search, Trash2, X, Loader2, Inbox, Tag, Bell, BellOff } from "lucide-react";
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from "@/hooks/useNotes";
import type { Note } from "@/hooks/useNotes";
import { toast } from "sonner";

const CATEGORIES = [
  { value: "general", label: "General" },
  { value: "study", label: "Study" },
  { value: "lecture", label: "Lecture" },
  { value: "research", label: "Research" },
  { value: "meeting", label: "Meeting" },
  { value: "personal", label: "Personal" },
];

const categoryColors: Record<string, string> = {
  general: "bg-muted text-muted-foreground",
  study: "bg-primary/10 text-primary",
  lecture: "bg-info/10 text-info",
  research: "bg-warning/10 text-warning",
  meeting: "bg-success/10 text-success",
  personal: "bg-accent text-accent-foreground",
};

export default function NotesTab() {
  const { data: notes = [], isLoading } = useNotes();
  const createNote = useCreateNote();
  const updateNote = useUpdateNote();
  const deleteNote = useDeleteNote();

  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [editing, setEditing] = useState<Note | null>(null);
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    let list = notes;
    if (catFilter !== "all") list = list.filter((n) => n.category === catFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q));
    }
    return list;
  }, [notes, catFilter, search]);

  const openEditor = editing || creating;

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center">
            <StickyNote className="w-4.5 h-4.5 text-accent-foreground" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground tracking-tight">Notes</h2>
            <p className="text-xs text-muted-foreground">Capture and organize your thoughts</p>
          </div>
        </div>
        <button onClick={() => { setCreating(true); setEditing(null); }} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity">
          <Plus className="w-4 h-4" /> New Note
        </button>
      </div>

      {/* Search + Category */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes..." className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none" />
          {search && <button onClick={() => setSearch("")} className="text-muted-foreground hover:text-foreground"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 flex-shrink-0 overflow-x-auto">
          <FilterBtn active={catFilter === "all"} onClick={() => setCatFilter("all")}>All</FilterBtn>
          {CATEGORIES.map((c) => <FilterBtn key={c.value} active={catFilter === c.value} onClick={() => setCatFilter(c.value)}>{c.label}</FilterBtn>)}
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {openEditor && (
          <NoteEditor
            initial={editing}
            onClose={() => { setEditing(null); setCreating(false); }}
            onSave={async (data) => {
              try {
                if (editing) { await updateNote.mutateAsync({ id: editing.id, ...data }); toast.success("Note updated"); }
                else { await createNote.mutateAsync(data); toast.success("Note created"); }
                setEditing(null); setCreating(false);
              } catch { toast.error("Failed to save note"); }
            }}
            loading={createNote.isPending || updateNote.isPending}
          />
        )}
      </AnimatePresence>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto"><Inbox className="w-6 h-6 text-muted-foreground/40" /></div>
          <h3 className="text-sm font-medium text-foreground">{notes.length === 0 ? "No notes yet" : "No matching notes"}</h3>
          <p className="text-xs text-muted-foreground">{notes.length === 0 ? "Create your first note" : "Try a different search"}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <AnimatePresence mode="popLayout">
            {filtered.map((note) => (
              <motion.div key={note.id} layout initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
                className="bg-card border border-border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer group"
                onClick={() => { setEditing(note); setCreating(false); }}>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-medium text-foreground line-clamp-1 flex-1">{note.title}</h3>
                  <button onClick={(e) => { e.stopPropagation(); deleteNote.mutate(note.id, { onSuccess: () => toast.success("Note deleted") }); }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/5 transition-all flex-shrink-0"><Trash2 className="w-3 h-3" /></button>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3 mt-1.5 min-h-[3rem]">{note.content || "No content"}</p>
                {note.reminder_at && (
                  <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium ${isPast(new Date(note.reminder_at)) ? "bg-muted text-muted-foreground" : "bg-warning/10 text-warning"}`}>
                    <Bell className="w-2.5 h-2.5" />
                    {format(new Date(note.reminder_at), "MMM d, h:mm a")}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border">
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryColors[note.category] || categoryColors.general}`}>{CATEGORIES.find((c) => c.value === note.category)?.label || note.category}</span>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(note.updated_at), "MMM d")}</span>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap ${active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{children}</button>
  );
}

function NoteEditor({ initial, onClose, onSave, loading }: { initial: Note | null; onClose: () => void; onSave: (data: { title: string; content: string; category: string; reminder_at: string | null }) => void; loading: boolean }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [category, setCategory] = useState(initial?.category || "general");
  // Convert ISO -> "yyyy-MM-ddTHH:mm" for <input type="datetime-local">
  const [reminderAt, setReminderAt] = useState<string>(() => {
    if (!initial?.reminder_at) return "";
    const d = new Date(initial.reminder_at);
    if (isNaN(d.getTime())) return "";
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const requestNotifPermission = () => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission().catch(() => {});
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-foreground/20 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }} transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative z-10 w-full max-w-lg mx-4 bg-card border border-border rounded-2xl shadow-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{initial ? "Edit Note" : "New Note"}</h2>
          <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Note title" className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring/20" autoFocus />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="Write your note..." rows={8} className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none focus:ring-2 focus:ring-ring/20" />
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Tag className="w-3 h-3" /> Category</label>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => (
              <button key={c.value} onClick={() => setCategory(c.value)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${category === c.value ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"}`}>{c.label}</button>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><Bell className="w-3 h-3" /> Reminder (optional)</label>
          <div className="flex items-center gap-2">
            <input
              type="datetime-local"
              value={reminderAt}
              onChange={(e) => { setReminderAt(e.target.value); requestNotifPermission(); }}
              className="flex-1 px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring/20"
            />
            {reminderAt && (
              <button
                type="button"
                onClick={() => setReminderAt("")}
                className="px-2.5 py-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 text-xs"
                title="Clear reminder"
              >
                <BellOff className="w-3.5 h-3.5" /> Clear
              </button>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">You'll get an in-app & browser notification at this time.</p>
        </div>
        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">Cancel</button>
          <button onClick={() => {
            if (!title.trim()) { toast.error("Title is required"); return; }
            const reminderIso = reminderAt ? new Date(reminderAt).toISOString() : null;
            onSave({ title: title.trim(), content, category, reminder_at: reminderIso });
          }} disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initial ? "Save" : "Create"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
