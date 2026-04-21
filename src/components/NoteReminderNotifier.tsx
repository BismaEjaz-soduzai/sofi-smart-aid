import { useEffect, useRef } from "react";
import { useNotes } from "@/hooks/useNotes";
import { toast } from "sonner";

/**
 * Watches notes with `reminder_at` set and fires a toast + browser
 * notification when the time arrives. Persists across page navigations
 * because it's mounted at the layout level.
 */
export function NoteReminderNotifier() {
  const { data: notes } = useNotes();
  const firedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!notes || notes.length === 0) return;

    const check = () => {
      const now = Date.now();
      notes.forEach((n) => {
        if (!n.reminder_at) return;
        const t = new Date(n.reminder_at).getTime();
        if (isNaN(t)) return;
        const key = `note-${n.id}-${t}`;
        if (firedRef.current.has(key)) return;
        // fire if reminder is due (within last 60s window or already past)
        if (t <= now && now - t < 24 * 60 * 60 * 1000) {
          firedRef.current.add(key);
          toast.info(`📝 Reminder: ${n.title}`, {
            description: n.content ? n.content.slice(0, 120) : "Open Notes to view",
            duration: 8000,
          });
          if ("Notification" in window && Notification.permission === "granted") {
            try {
              new Notification("SOFI — Note Reminder", {
                body: n.title,
                icon: "/placeholder.svg",
                tag: key,
              });
            } catch { /* noop */ }
          }
        }
      });
    };

    check();
    const interval = setInterval(check, 30 * 1000);
    return () => clearInterval(interval);
  }, [notes]);

  return null;
}
