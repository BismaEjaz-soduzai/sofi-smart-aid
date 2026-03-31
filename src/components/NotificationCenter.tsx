import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckSquare, StickyNote, Calendar, Clock, X } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";
import { format, isToday, isTomorrow, isPast, parseISO } from "date-fns";

interface Notification {
  id: string;
  title: string;
  body: string;
  type: "task" | "note" | "plan";
  time: Date;
  route: string;
  urgent?: boolean;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    const saved = localStorage.getItem("sofi-dismissed-notifs");
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const { data: plans } = usePlans();

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const notifications = useMemo<Notification[]>(() => {
    const notifs: Notification[] = [];

    // Tasks due today/tomorrow/overdue
    (tasks || []).filter(t => !t.completed && t.due_date).forEach(t => {
      const d = parseISO(t.due_date!);
      if (isPast(d) && !isToday(d)) {
        notifs.push({ id: `task-overdue-${t.id}`, title: "Overdue Task", body: t.title, type: "task", time: d, route: "/tasks", urgent: true });
      } else if (isToday(d)) {
        notifs.push({ id: `task-today-${t.id}`, title: "Due Today", body: t.title, type: "task", time: d, route: "/tasks" });
      } else if (isTomorrow(d)) {
        notifs.push({ id: `task-tomorrow-${t.id}`, title: "Due Tomorrow", body: t.title, type: "task", time: d, route: "/tasks" });
      }
    });

    // Tasks with reminders
    (tasks || []).filter(t => !t.completed && t.reminder_enabled).forEach(t => {
      if (!notifs.find(n => n.id.includes(t.id))) {
        notifs.push({ id: `task-reminder-${t.id}`, title: "Reminder", body: t.title, type: "task", time: new Date(t.created_at), route: "/tasks" });
      }
    });

    // Recent notes
    (notes || []).slice(0, 3).forEach(n => {
      const updated = new Date(n.updated_at);
      const hourAgo = Date.now() - 3600000;
      if (updated.getTime() > hourAgo) {
        notifs.push({ id: `note-${n.id}`, title: "Note Updated", body: n.title, type: "note", time: updated, route: "/notes" });
      }
    });

    // Active plans progress
    (plans || []).filter(p => p.status === "active").forEach(p => {
      notifs.push({ id: `plan-${p.id}`, title: "Active Plan", body: `${p.title} — ${p.progress || 0}% done`, type: "plan", time: new Date(p.updated_at), route: "/planner" });
    });

    return notifs
      .filter(n => !dismissed.has(n.id))
      .sort((a, b) => b.time.getTime() - a.time.getTime());
  }, [tasks, notes, plans, dismissed]);

  const dismiss = (id: string) => {
    const next = new Set(dismissed);
    next.add(id);
    setDismissed(next);
    localStorage.setItem("sofi-dismissed-notifs", JSON.stringify([...next]));
  };

  const clearAll = () => {
    const allIds = new Set(notifications.map(n => n.id));
    const next = new Set([...dismissed, ...allIds]);
    setDismissed(next);
    localStorage.setItem("sofi-dismissed-notifs", JSON.stringify([...next]));
  };

  const iconMap = { task: CheckSquare, note: StickyNote, plan: Calendar };
  const colorMap = { task: "text-blue-500", note: "text-amber-500", plan: "text-violet-500" };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors relative"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {notifications.length > 0 && (
          <span className="absolute top-1 right-1 min-w-[14px] h-3.5 bg-destructive rounded-full flex items-center justify-center">
            <span className="text-[9px] font-bold text-destructive-foreground">{notifications.length > 9 ? "9+" : notifications.length}</span>
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl border border-border bg-card shadow-xl z-50 animate-fade-in overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {notifications.length > 0 && (
              <button onClick={clearAll} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Clear all
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <Bell className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">All caught up!</p>
              </div>
            ) : (
              notifications.map(n => {
                const Icon = iconMap[n.type];
                return (
                  <div
                    key={n.id}
                    className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer border-b border-border/50 last:border-0 ${n.urgent ? "bg-destructive/5" : ""}`}
                    onClick={() => { navigate(n.route); setOpen(false); }}
                  >
                    <div className={`mt-0.5 ${colorMap[n.type]}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs font-semibold ${n.urgent ? "text-destructive" : "text-foreground"}`}>{n.title}</p>
                      <p className="text-xs text-muted-foreground truncate">{n.body}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        {format(n.time, "MMM d, h:mm a")}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                      className="text-muted-foreground/50 hover:text-foreground mt-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
