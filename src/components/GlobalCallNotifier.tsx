import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChatRooms } from "@/hooks/useChat";
import { useCallContext } from "@/contexts/CallContext";
import { playRingtone, showBrowserNotification } from "@/lib/notificationSounds";

const SEEN_KEY = "sofi-global-seen-call-signals";
const STALE_MS = 90_000;

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch { return new Set(); }
}
function persistSeen(s: Set<string>) {
  try { sessionStorage.setItem(SEEN_KEY, JSON.stringify(Array.from(s).slice(-200))); }
  catch { /* noop */ }
}

/**
 * Global incoming-call notifier. Subscribes to ALL chat rooms the user belongs
 * to and rings + toasts when any room receives a system call signal — even when
 * the user is not on the Chat page.
 */
export function GlobalCallNotifier() {
  const { user } = useAuth();
  const { data: rooms = [] } = useChatRooms();
  const call = useCallContext();
  const seenRef = useRef<Set<string>>(loadSeen());
  const stopRingRef = useRef<(() => void) | null>(null);
  const mountedAt = useRef<number>(Date.now());

  useEffect(() => {
    if (!user || rooms.length === 0) return;
    const roomIds = rooms.map((r) => r.id);

    const channels = roomIds.map((roomId) =>
      supabase
        .channel(`global-call-${roomId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` },
          (payload) => {
            const m = payload.new as {
              id: string; user_id: string; content: string;
              message_type: string; created_at: string;
            };
            if (!m || seenRef.current.has(m.id)) return;
            seenRef.current.add(m.id);
            persistSeen(seenRef.current);

            if (m.message_type !== "system") return;
            if (m.user_id === user.id) return;
            if (call.activeCall) return;

            const createdMs = new Date(m.created_at).getTime();
            if (Number.isNaN(createdMs)) return;
            if (createdMs < mountedAt.current - 5_000) return;
            if (Date.now() - createdMs > STALE_MS) return;

            const callUrlMatch = m.content.match(/\|\|CALL_URL:(.+)$/);
            if (!callUrlMatch) return;
            const callUrl = callUrlMatch[1].trim();
            const displayText = m.content.split("||CALL_URL:")[0].trim();

            stopRingRef.current?.();
            stopRingRef.current = playRingtone();

            showBrowserNotification(
              "Incoming call",
              displayText.replace(/^[\u{1F4DE}\u{1F4F9}]\s*/u, "") || "Tap Join to answer",
              `incoming-call-${m.id}`,
            );

            const stop = () => { stopRingRef.current?.(); stopRingRef.current = null; };
            toast("Incoming call", {
              description: displayText,
              duration: 30_000,
              action: {
                label: "📞 Join",
                onClick: () => { stop(); call.joinCall(callUrl); },
              },
              onDismiss: stop,
              onAutoClose: stop,
            });
          },
        )
        .subscribe(),
    );

    return () => {
      channels.forEach((c) => { try { supabase.removeChannel(c); } catch { /* noop */ } });
      stopRingRef.current?.();
      stopRingRef.current = null;
    };
  }, [user, rooms, call]);

  // Stop ring once user joins a call
  useEffect(() => {
    if (call.activeCall) {
      stopRingRef.current?.();
      stopRingRef.current = null;
    }
  }, [call.activeCall]);

  return null;
}
