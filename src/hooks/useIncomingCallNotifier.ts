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
}

/**
 * Watches a chat/room message stream and rings + toasts when ANOTHER user starts a call.
 * Recipient gets one-click "Join" via onJoin(callUrl).
 */
export function useIncomingCallNotifier(
  messages: CallSignalLike[],
  myUserId: string | undefined,
  onJoin: (callUrl: string) => void,
  alreadyInCall: boolean,
) {
  const seenRef = useRef<Set<string>>(new Set());
  const stopRingRef = useRef<(() => void) | null>(null);

  // Seed with existing messages so we don't ring on initial load
  useEffect(() => {
    messages.forEach((m) => seenRef.current.add(m.id));
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!myUserId) return;
    for (const m of messages) {
      if (seenRef.current.has(m.id)) continue;
      seenRef.current.add(m.id);

      if (m.message_type !== "system") continue;
      if (m.user_id === myUserId) continue;
      if (alreadyInCall) continue;

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

      const id = toast(`${senderName} is calling`, {
        description: displayText,
        duration: 30_000,
        action: {
          label: "📞 Join",
          onClick: () => { stop(); onJoin(callUrl); },
        },
        onDismiss: stop,
        onAutoClose: stop,
      });
      void id;
    }
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
