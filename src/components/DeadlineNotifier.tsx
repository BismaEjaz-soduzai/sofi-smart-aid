import { useEffect, useRef } from "react";
import { useTasks } from "@/hooks/useTasks";
import { usePlans } from "@/hooks/usePlans";
import { isPast, isToday, isTomorrow, parseISO, differenceInHours } from "date-fns";
import { toast } from "sonner";

interface NotifPrefs {
  taskReminders?: boolean;
  taskDueReminders?: boolean;
  milestoneReminders?: boolean;
  browserEnabled?: boolean;
  browserNotifications?: boolean;
}

function readPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem("sofi-notif");
    return raw ? (JSON.parse(raw) as NotifPrefs) : {};
  } catch { return {}; }
}

function browserNotifAllowed(prefs: NotifPrefs) {
  const enabled = prefs.browserNotifications !== false && prefs.browserEnabled !== false;
  return (
    enabled &&
    typeof Notification !== "undefined" &&
    Notification.permission === "granted"
  );
}

export function DeadlineNotifier() {
  const { data: tasks } = useTasks();
  const { data: plans } = usePlans();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!("Notification" in window)) return;
    if (Notification.permission !== "default") return;

    const ask = () => {
      try { Notification.requestPermission(); } catch { /* noop */ }
      window.removeEventListener("click", ask);
      window.removeEventListener("keydown", ask);
    };
    window.addEventListener("click", ask, { once: true });
    window.addEventListener("keydown", ask, { once: true });
    return () => {
      window.removeEventListener("click", ask);
      window.removeEventListener("keydown", ask);
    };
  }, []);

  useEffect(() => {
    if (!tasks) return;
    const prefs = readPrefs();
    if (prefs.taskReminders === false || prefs.taskDueReminders === false) return;

    const now = new Date();

    tasks.filter(t => !t.completed && t.due_date).forEach(t => {
      const key = `task-${t.id}`;
      if (notifiedRef.current.has(key)) return;

      const dueDate = parseISO(t.due_date!);
      const hoursUntil = differenceInHours(dueDate, now);

      let message = "";
      let urgency: "warning" | "error" | "info" = "info";

      if (isPast(dueDate) && !isToday(dueDate)) {
        message = `⚠️ "${t.title}" is overdue!`;
        urgency = "error";
      } else if (isToday(dueDate)) {
        message = `📌 "${t.title}" is due today!`;
        urgency = "warning";
      } else if (isTomorrow(dueDate)) {
        message = `📋 "${t.title}" is due tomorrow`;
        urgency = "info";
      } else if (hoursUntil <= 48 && hoursUntil > 0) {
        message = `⏰ "${t.title}" is due in ${Math.round(hoursUntil)} hours`;
        urgency = "info";
      }

      if (message) {
        notifiedRef.current.add(key);
        if (urgency === "error") toast.error(message, { duration: 6000 });
        else if (urgency === "warning") toast.warning(message, { duration: 5000 });
        else toast.info(message, { duration: 4000 });

        if (browserNotifAllowed(prefs)) {
          new Notification("SOFI - Task Reminder", {
            body: message.replace(/[⚠️📌📋⏰]\s?/g, ""),
            icon: "/placeholder.svg",
            tag: key,
          });
        }
      }
    });
  }, [tasks]);

  useEffect(() => {
    if (!plans) return;
    const prefs = readPrefs();
    if (prefs.milestoneReminders === false) return;

    const now = new Date();
    plans.filter(p => p.status === "active" && p.end_date).forEach(p => {
      const key = `plan-${p.id}`;
      if (notifiedRef.current.has(key)) return;

      const endDate = parseISO(p.end_date!);
      const hoursUntil = differenceInHours(endDate, now);

      if (hoursUntil <= 24 && hoursUntil > 0) {
        notifiedRef.current.add(key);
        toast.warning(`📅 Plan "${p.title}" ends tomorrow!`, { duration: 5000 });
        if (browserNotifAllowed(prefs)) {
          new Notification("SOFI - Plan Reminder", {
            body: `"${p.title}" ends soon!`,
            icon: "/placeholder.svg",
            tag: key,
          });
        }
      }
    });
  }, [plans]);

  return null;
}
