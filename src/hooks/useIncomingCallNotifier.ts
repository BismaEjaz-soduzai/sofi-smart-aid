import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { playRingtone, showBrowserNotification } from "@/lib/notificationSounds";

interface CallSignalLike {
  user_id: string;
  content: string;
  message_type: string;
  sender_name?: string | null;
  created_at: string;
  id: string;
  room_id?: string;
}

/**
 * Watches a chat/room message stream and rings + toasts when ANOTHER user starts a call.
 * Recipient gets one-click "Join" via onJoin(callUrl).
 *
 * Anti-phantom rules:
 *  - Track a per-mount join timestamp; never ring on signals created BEFORE we joined.
 *  - Maintain a global seen-set across remounts (sessionStorage) so the same call signal
 *    never rings twice when navigating between rooms or refreshing.
 *  - Ignore signals older than 90s (stale call invites left in the DB).
 */
const SEEN_KEY = "sofi-seen-call-signals";
const STALE_MS = 90_000;

function loadSeen(): Set<string> {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    if (!raw) return new Set();
    return new Set(JSON.parse(raw) as string[]);
  } catch {
    return new Set();
  }
}

function persistSeen(s: Set<string>) {
  try {
    // Keep set bounded
    const arr = Array.from(s).slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(arr));
  } catch { /* noop */ }
}

export function useIncomingCallNotifier(
  messages: CallSignalLike[],
  myUserId: string | undefined,
  onJoin: (callUrl: string) => void,
  alreadyInCall: boolean,
) {
  const seenRef = useRef<Set<string>>(loadSeen());
  const stopRingRef = useRef<(() => void) | null>(null);
  // Anchor: any message created BEFORE this timestamp is "history" and must not ring.
  const joinedAtRef = useRef<number>(Date.now());

  // Re-anchor whenever the active room changes (detected via the first message's room_id changing)
  const lastRoomRef = useRef<string | undefined>(undefined);
  useEffect(() => {
    const currentRoom = messages[0]?.room_id;
    if (currentRoom !== lastRoomRef.current) {
      lastRoomRef.current = currentRoom;
      joinedAtRef.current = Date.now();
      // Pre-seed: mark every existing message as seen so historical call signals never ring
      messages.forEach((m) => seenRef.current.add(m.id));
      persistSeen(seenRef.current);
    }
  }, [messages]);

  useEffect(() => {
    if (!myUserId) return;
    const now = Date.now();

    for (const m of messages) {
      if (seenRef.current.has(m.id)) continue;
      seenRef.current.add(m.id);

      if (m.message_type !== "system") continue;
      if (m.user_id === myUserId) continue;
      if (alreadyInCall) continue;

      // Reject anything created before we joined or older than STALE_MS
      const createdMs = new Date(m.created_at).getTime();
      if (Number.isNaN(createdMs)) continue;
      if (createdMs < joinedAtRef.current) continue;
      if (now - createdMs > STALE_MS) continue;

      const callUrlMatch = m.content.match(/\|\|CALL_URL:(.+)$/);
      if (!callUrlMatch) continue;
      const callUrl = callUrlMatch[1].trim();
      const displayText = m.content.split("||CALL_URL:")[0].trim();
      const senderName = m.sender_name || "Someone";

      // Ring (only one at a time)
      stopRingRef.current?.();
      stopRingRef.current = playRingtone();

      showBrowserNotification(
        `${senderName} is calling`,
        displayText.replace(/^[\u{1F4DE}\u{1F4F9}]\s*/u, "") || "Incoming call",
        `incoming-call-${m.id}`,
      );

      const stop = () => {
        stopRingRef.current?.();
        stopRingRef.current = null;
      };

      toast(`${senderName} is calling`, {
        description: displayText,
        duration: 30_000,
        action: {
          label: "📞 Join",
          onClick: () => { stop(); onJoin(callUrl); },
        },
        onDismiss: stop,
        onAutoClose: stop,
      });
    }
    persistSeen(seenRef.current);
  }, [messages, myUserId, onJoin, alreadyInCall]);

  // Stop ring once user joins
  useEffect(() => {
    if (alreadyInCall) {
      stopRingRef.current?.();
      stopRingRef.current = null;
    }
  }, [alreadyInCall]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopRingRef.current?.();
      stopRingRef.current = null;
    };
  }, []);
}
