import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { BellOff, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useChatRooms } from "@/hooks/useChat";
import { useCallContext } from "@/contexts/CallContext";
import { playRingtone, showBrowserNotification } from "@/lib/notificationSounds";

const SEEN_KEY = "sofi-global-seen-call-signals";
const MUTE_KEY = "sofi-call-notifier-muted";
const STALE_MS = 90_000;
const ROOM_COOLDOWN_MS = 30_000;

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

function loadMuted(): boolean {
  try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
}

/**
 * Global incoming-call notifier with:
 *  - Per-room cooldown (no repeat ring within 30s for the same room)
 *  - Persistent mute toggle (floating button, remembered across sessions)
 *  - Already-seen signal dedup
 */
export function GlobalCallNotifier() {
  const { user } = useAuth();
  const { data: rooms = [] } = useChatRooms();
  const call = useCallContext();
  const seenRef = useRef<Set<string>>(loadSeen());
  const stopRingRef = useRef<(() => void) | null>(null);
  const mountedAt = useRef<number>(Date.now());
  const lastRingByRoomRef = useRef<Map<string, number>>(new Map());
  const [muted, setMuted] = useState<boolean>(loadMuted);
  const mutedRef = useRef(muted);

  useEffect(() => {
    mutedRef.current = muted;
    try { localStorage.setItem(MUTE_KEY, muted ? "1" : "0"); } catch { /* noop */ }
  }, [muted]);

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
            if (mutedRef.current) return;

            const createdMs = new Date(m.created_at).getTime();
            if (Number.isNaN(createdMs)) return;
            if (createdMs < mountedAt.current - 5_000) return;
            if (Date.now() - createdMs > STALE_MS) return;

            // Per-room cooldown
            const lastRing = lastRingByRoomRef.current.get(roomId) || 0;
            if (Date.now() - lastRing < ROOM_COOLDOWN_MS) return;
            lastRingByRoomRef.current.set(roomId, Date.now());

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

  if (!user) return null;
  return (
    <button
      onClick={() => {
        const next = !muted;
        setMuted(next);
        if (next) {
          stopRingRef.current?.();
          stopRingRef.current = null;
        }
        toast(next ? "Call alerts muted" : "Call alerts on");
      }}
      title={muted ? "Call alerts muted — click to unmute" : "Mute call alerts"}
      className="fixed bottom-4 left-4 z-40 w-10 h-10 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
      aria-label={muted ? "Unmute call alerts" : "Mute call alerts"}
    >
      {muted ? <BellOff className="w-4 h-4 text-destructive" /> : <Bell className="w-4 h-4" />}
    </button>
  );
}
