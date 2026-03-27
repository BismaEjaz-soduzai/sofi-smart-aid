import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import {
  X,
  Calendar as CalendarIcon,
  Clock,
  Flag,
  Tag,
  Type,
  AlignLeft,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskInsert, TaskUpdate, Task } from "@/hooks/useTasks";

const priorities = [
  { value: "low", label: "Low", color: "bg-muted text-muted-foreground" },
  { value: "medium", label: "Medium", color: "bg-warning/10 text-warning" },
  { value: "high", label: "High", color: "bg-destructive/10 text-destructive" },
];

const categories = [
  { value: "personal", label: "Personal" },
  { value: "study", label: "Study" },
  { value: "assignment", label: "Assignment" },
  { value: "exam", label: "Exam" },
  { value: "work", label: "Work" },
  { value: "fyp", label: "FYP" },
];

interface TaskModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<TaskInsert, "user_id">) => void;
  loading?: boolean;
  initial?: Task | null;
}

export default function TaskModal({ open, onClose, onSubmit, loading, initial }: TaskModalProps) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [dueDate, setDueDate] = useState<Date | undefined>(
    initial?.due_date ? new Date(initial.due_date) : undefined
  );
  const [dueTime, setDueTime] = useState(initial?.due_time?.slice(0, 5) || "");
  const [priority, setPriority] = useState(initial?.priority || "medium");
  const [category, setCategory] = useState(initial?.category || "personal");
  const [titleError, setTitleError] = useState("");

  const handleSubmit = () => {
    if (!title.trim()) { setTitleError("Title is required"); return; }
    setTitleError("");
    onSubmit({
      title: title.trim(),
      description: description.trim() || null,
      due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : null,
      due_time: dueTime || null,
      priority,
      category,
    });
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-foreground/20 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="relative z-10 w-full max-w-lg mx-4 glass-card p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-foreground">
              {initial ? "Edit Task" : "New Task"}
            </h2>
            <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Type className="w-3 h-3" /> Title
            </label>
            <input
              value={title}
              onChange={(e) => { setTitle(e.target.value); setTitleError(""); }}
              placeholder="What needs to be done?"
              className={`w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-ring/20 ${
                titleError ? "border-destructive" : "border-border"
              }`}
              autoFocus
            />
            {titleError && <p className="text-xs text-destructive">{titleError}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <AlignLeft className="w-3 h-3" /> Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add details..."
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground placeholder:text-muted-foreground/60 outline-none resize-none focus:ring-2 focus:ring-ring/20"
            />
          </div>

          {/* Date & Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <CalendarIcon className="w-3 h-3" /> Due Date
              </label>
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(
                    "w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-left outline-none hover:bg-muted/60 transition-colors",
                    !dueDate && "text-muted-foreground/60"
                  )}>
                    {dueDate ? format(dueDate, "MMM d, yyyy") : "Pick date"}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={dueDate}
                    onSelect={setDueDate}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-3 h-3" /> Due Time
              </label>
              <input
                type="time"
                value={dueTime}
                onChange={(e) => setDueTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-muted/40 border border-border text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/20"
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Flag className="w-3 h-3" /> Priority
            </label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <button
                  key={p.value}
                  onClick={() => setPriority(p.value)}
                  className={cn(
                    "px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    priority === p.value
                      ? `${p.color} border-current`
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
              <Tag className="w-3 h-3" /> Category
            </label>
            <div className="flex flex-wrap gap-2">
              {categories.map((c) => (
                <button
                  key={c.value}
                  onClick={() => setCategory(c.value)}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-medium transition-all border",
                    category === c.value
                      ? "bg-primary/10 text-primary border-primary/30"
                      : "bg-muted/40 text-muted-foreground border-transparent hover:bg-muted"
                  )}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : initial ? "Save Changes" : "Add Task"}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
