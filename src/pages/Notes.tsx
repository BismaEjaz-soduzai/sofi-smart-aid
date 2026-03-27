import PageShell from "@/components/PageShell";
import { StickyNote, Plus } from "lucide-react";

export default function Notes() {
  const notes = [
    { id: 1, title: "Lecture Notes — Data Structures", preview: "Binary trees, heaps, and priority queues...", date: "Today" },
    { id: 2, title: "Meeting Notes", preview: "Project timeline discussion and milestones...", date: "Yesterday" },
    { id: 3, title: "Research Ideas", preview: "Machine learning applications in education...", date: "Mar 25" },
  ];

  return (
    <PageShell title="Notes" description="Capture your thoughts" icon={StickyNote}>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <button className="glass-card-hover p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-foreground min-h-[140px]">
          <Plus className="w-6 h-6" />
          <span className="text-sm">New Note</span>
        </button>
        {notes.map((note) => (
          <div key={note.id} className="glass-card-hover p-5 space-y-2 cursor-pointer min-h-[140px]">
            <h3 className="text-sm font-medium text-foreground line-clamp-1">{note.title}</h3>
            <p className="text-xs text-muted-foreground line-clamp-3">{note.preview}</p>
            <p className="text-[10px] text-muted-foreground/60">{note.date}</p>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
