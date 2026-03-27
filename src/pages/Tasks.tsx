import PageShell from "@/components/PageShell";
import { CheckSquare, Plus } from "lucide-react";

export default function Tasks() {
  const tasks = [
    { id: 1, title: "Complete React project", done: false, priority: "high" },
    { id: 2, title: "Read chapter 5", done: true, priority: "medium" },
    { id: 3, title: "Submit lab report", done: false, priority: "high" },
    { id: 4, title: "Review pull request", done: false, priority: "low" },
  ];

  return (
    <PageShell title="Tasks" description="Manage your to-do list" icon={CheckSquare}>
      <div className="space-y-3">
        <button className="glass-card-hover px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground w-full">
          <Plus className="w-4 h-4" />
          Add new task
        </button>
        {tasks.map((task) => (
          <div key={task.id} className="glass-card p-4 flex items-center gap-3">
            <div className={`w-4 h-4 rounded border-2 flex-shrink-0 ${task.done ? "bg-primary border-primary" : "border-muted-foreground/30"}`} />
            <span className={`text-sm flex-1 ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
              {task.title}
            </span>
            <span className={`text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded-full ${
              task.priority === "high" ? "bg-destructive/10 text-destructive" :
              task.priority === "medium" ? "bg-warning/10 text-warning" :
              "bg-muted text-muted-foreground"
            }`}>
              {task.priority}
            </span>
          </div>
        ))}
      </div>
    </PageShell>
  );
}
