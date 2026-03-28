import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, isToday, isFuture, isPast, parseISO } from "date-fns";
import {
  CheckSquare,
  Plus,
  Search,
  Calendar,
  Clock,
  Trash2,
  Pencil,
  CheckCircle2,
  Circle,
  Loader2,
  Inbox,
  Bell,
  AlertTriangle,
} from "lucide-react";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask, useToggleTask } from "@/hooks/useTasks";
import type { Task, TaskInsert } from "@/hooks/useTasks";
import TaskModal from "@/components/TaskModal";
import { toast } from "sonner";

type FilterTab = "all" | "today" | "upcoming" | "overdue" | "completed";

const priorityConfig: Record<string, { label: string; class: string }> = {
  high: { label: "High", class: "bg-destructive/10 text-destructive" },
  medium: { label: "Medium", class: "bg-warning/10 text-warning" },
  low: { label: "Low", class: "bg-muted text-muted-foreground" },
};

const categoryConfig: Record<string, { label: string; class: string }> = {
  study: { label: "Study", class: "bg-info/10 text-info" },
  assignment: { label: "Assignment", class: "bg-primary/10 text-primary" },
  exam: { label: "Exam", class: "bg-destructive/10 text-destructive" },
  work: { label: "Work", class: "bg-success/10 text-success" },
  personal: { label: "Personal", class: "bg-accent text-accent-foreground" },
  fyp: { label: "FYP", class: "bg-warning/10 text-warning" },
};

export default function Tasks() {
  const { data: tasks = [], isLoading } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const toggleTask = useToggleTask();

  const [filter, setFilter] = useState<FilterTab>("all");
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const filtered = useMemo(() => {
    let list = tasks;

    if (filter === "today") {
      list = list.filter((t) => t.due_date && isToday(parseISO(t.due_date)));
    } else if (filter === "upcoming") {
      list = list.filter((t) => t.due_date && isFuture(parseISO(t.due_date)) && !t.completed);
    } else if (filter === "overdue") {
      list = list.filter((t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && !t.completed);
    } else if (filter === "completed") {
      list = list.filter((t) => t.completed);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category.toLowerCase().includes(q)
      );
    }

    return list;
  }, [tasks, filter, search]);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const handleCreate = async (task: Omit<TaskInsert, "user_id">) => {
    try {
      await createTask.mutateAsync(task);
      setModalOpen(false);
      toast.success("Task created!");
    } catch {
      toast.error("Failed to create task");
    }
  };

  const handleUpdate = async (task: Omit<TaskInsert, "user_id">) => {
    if (!editingTask) return;
    try {
      await updateTask.mutateAsync({ id: editingTask.id, ...task });
      setEditingTask(null);
      toast.success("Task updated!");
    } catch {
      toast.error("Failed to update task");
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTask.mutateAsync(id);
      toast.success("Task deleted");
    } catch {
      toast.error("Failed to delete task");
    }
  };

  const handleToggle = async (task: Task) => {
    try {
      await toggleTask.mutateAsync({ id: task.id, completed: !task.completed });
    } catch {
      toast.error("Failed to update task");
    }
  };

  const overdueCount = tasks.filter((t) => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && !t.completed).length;

  const tabs: { key: FilterTab; label: string; count: number }[] = [
    { key: "all", label: "All", count: tasks.length },
    { key: "today", label: "Today", count: tasks.filter((t) => t.due_date && isToday(parseISO(t.due_date))).length },
    { key: "upcoming", label: "Upcoming", count: tasks.filter((t) => t.due_date && isFuture(parseISO(t.due_date)) && !t.completed).length },
    { key: "overdue", label: "Overdue", count: overdueCount },
    { key: "completed", label: "Completed", count: completedCount },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
            <CheckSquare className="w-5 h-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground tracking-tight">Tasks</h1>
            <p className="text-sm text-muted-foreground">Manage your to-do list</p>
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="glass-card p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Progress</span>
            <span className="font-medium text-foreground">
              {completedCount}/{totalCount} completed ({progress}%)
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-primary rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>
        </div>
      )}

      {/* Tabs + Search */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 flex-shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
              <span className="ml-1 text-[10px] opacity-60">{tab.count}</span>
            </button>
          ))}
        </div>
        <div className="flex-1 flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2 border border-border">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
          />
        </div>
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState filter={filter} onAdd={() => setModalOpen(true)} />
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filtered.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={() => handleToggle(task)}
                onEdit={() => setEditingTask(task)}
                onDelete={() => handleDelete(task.id)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Modals */}
      <TaskModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSubmit={handleCreate}
        loading={createTask.isPending}
      />
      <TaskModal
        open={!!editingTask}
        onClose={() => setEditingTask(null)}
        onSubmit={handleUpdate}
        loading={updateTask.isPending}
        initial={editingTask}
      />
    </motion.div>
  );
}

/* ── Task Row ── */

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
}: {
  task: Task;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const pri = priorityConfig[task.priority] || priorityConfig.medium;
  const cat = categoryConfig[task.category] || categoryConfig.personal;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={`glass-card p-4 flex items-start gap-3 group transition-all ${
        task.completed ? "opacity-60" : ""
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={onToggle}
        className="mt-0.5 flex-shrink-0 text-primary hover:scale-110 transition-transform"
      >
        {task.completed ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <Circle className="w-5 h-5 text-muted-foreground/40 hover:text-primary transition-colors" />
        )}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className={`text-sm font-medium ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
          {task.title}
        </p>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">{task.description}</p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {task.due_date && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Calendar className="w-3 h-3" />
              {format(parseISO(task.due_date), "MMM d")}
            </span>
          )}
          {task.due_time && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground">
              <Clock className="w-3 h-3" />
              {task.due_time.slice(0, 5)}
            </span>
          )}
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${pri.class}`}>
            {pri.label}
          </span>
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${cat.class}`}>
            {cat.label}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <button
          onClick={onEdit}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="w-7 h-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </motion.div>
  );
}

/* ── Empty State ── */

function EmptyState({ filter, onAdd }: { filter: FilterTab; onAdd: () => void }) {
  const messages: Record<FilterTab, { title: string; desc: string }> = {
    all: { title: "No tasks yet", desc: "Create your first task to get started" },
    today: { title: "Nothing due today", desc: "Enjoy your free time or plan ahead" },
    upcoming: { title: "No upcoming tasks", desc: "All caught up! Add tasks for the future" },
    overdue: { title: "Nothing overdue", desc: "You're on track — great job!" },
    completed: { title: "No completed tasks", desc: "Start checking off your to-do list" },
  };
  const msg = messages[filter];

  return (
    <div className="glass-card p-12 text-center space-y-4">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto">
        <Inbox className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-medium text-foreground">{msg.title}</h3>
        <p className="text-xs text-muted-foreground">{msg.desc}</p>
      </div>
      {filter !== "completed" && (
        <button
          onClick={onAdd}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          Add Task
        </button>
      )}
    </div>
  );
}
