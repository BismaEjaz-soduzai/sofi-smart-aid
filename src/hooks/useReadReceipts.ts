import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useReadReceipts(roomId?: string) {
  const { user } = useAuth();

  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!user || !roomId || messageIds.length === 0) return;

      // Update each unread message to include current user in read_by
      for (const id of messageIds) {
        await supabase.rpc("mark_message_read" as any, {
          _message_id: id,
          _user_id: user.id,
        });
      }
    },
    [user, roomId]
  );

  return { markAsRead };
}
