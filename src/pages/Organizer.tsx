import { useState } from "react";
import { motion } from "framer-motion";
import { CheckSquare, StickyNote } from "lucide-react";
import TasksTab from "@/components/organizer/TasksTab";
import NotesTab from "@/components/organizer/NotesTab";

type Tab = "tasks" | "notes";

export default function Organizer() {
  const [tab, setTab] = useState<Tab>("tasks");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-[calc(100vh-3.5rem)]"
    >
      {/* Tab Header */}
      <div className="flex items-center gap-1 p-2 border-b border-border bg-card/60 backdrop-blur-sm">
        {([
          { key: "tasks" as Tab, label: "Tasks", icon: CheckSquare },
          { key: "notes" as Tab, label: "Notes", icon: StickyNote },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {tab === "tasks" ? <TasksTab /> : <NotesTab />}
      </div>
    </motion.div>
  );
}
