import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePresence(roomId?: string) {
  const { user } = useAuth();
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase.channel(`presence-${roomId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnlineUsers(new Set(Object.keys(state)));
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online: true, user_id: user.id });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user]);

  const isOnline = (userId: string) => onlineUsers.has(userId);

  return { onlineUsers, isOnline };
}
