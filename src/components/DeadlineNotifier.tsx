import { useEffect, useRef } from "react";
import { useTasks } from "@/hooks/useTasks";
import { usePlans } from "@/hooks/usePlans";
import { isPast, isToday, isTomorrow, parseISO, differenceInHours } from "date-fns";
import { toast } from "sonner";

export function DeadlineNotifier() {
  const { data: tasks } = useTasks();
  const { data: plans } = usePlans();
  const notifiedRef = useRef<Set<string>>(new Set());

  // Request browser notification permission on first user interaction
  // (browsers block permission prompts that fire on initial mount without a gesture)
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

        // In-app toast
        if (urgency === "error") toast.error(message, { duration: 6000 });
        else if (urgency === "warning") toast.warning(message, { duration: 5000 });
        else toast.info(message, { duration: 4000 });

        // Browser notification
        if ("Notification" in window && Notification.permission === "granted") {
          new Notification("SOFI - Task Reminder", {
            body: message.replace(/[⚠️📌📋⏰]\s?/g, ""),
            icon: "/placeholder.svg",
            tag: key,
          });
        }
      }
    });
  }, [tasks]);

  // Plan deadline notifications  
  useEffect(() => {
    if (!plans) return;
    const now = new Date();

    plans.filter(p => p.status === "active" && p.end_date).forEach(p => {
      const key = `plan-${p.id}`;
      if (notifiedRef.current.has(key)) return;

      const endDate = parseISO(p.end_date!);
      const hoursUntil = differenceInHours(endDate, now);

      if (hoursUntil <= 24 && hoursUntil > 0) {
        notifiedRef.current.add(key);
        toast.warning(`📅 Plan "${p.title}" ends tomorrow!`, { duration: 5000 });
        if ("Notification" in window && Notification.permission === "granted") {
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
