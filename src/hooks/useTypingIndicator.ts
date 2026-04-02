import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useTypingIndicator(roomId?: string) {
  const { user } = useAuth();
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`typing-${roomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        const typing = Object.keys(state).filter((id) => id !== user.id);
        setTypingUsers(typing);
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomId, user]);

  const sendTyping = useCallback(() => {
    if (!channelRef.current) return;
    channelRef.current.track({ typing: true });

    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      channelRef.current?.untrack();
    }, 2000);
  }, []);

  const stopTyping = useCallback(() => {
    channelRef.current?.untrack();
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return { typingUsers, sendTyping, stopTyping };
}
