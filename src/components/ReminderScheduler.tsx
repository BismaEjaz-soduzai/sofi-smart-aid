import { useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Mounts inside the protected app shell. Periodically asks the
 * `send-reminders` edge function to scan tasks/plan_sessions and
 * queue browser/email deliveries based on the user's preferences.
 *
 * Runs once on mount, then every 15 minutes. Silent on failure.
 */
export function ReminderScheduler() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;

    const tick = async () => {
      try {
        await supabase.functions.invoke("send-reminders", {
          body: { user_id: user.id },
        });
      } catch {
        /* swallow — this is a background task */
      }
      if (!cancelled) {
        // re-arm
      }
    };

    // initial run after 5s so the page can settle
    const initial = setTimeout(tick, 5_000);
    const interval = setInterval(tick, 15 * 60 * 1000);

    return () => {
      cancelled = true;
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [user?.id]);

  return null;
}
