import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useReadReceipts() {
  const { user } = useAuth();

  const markAsRead = useCallback(
    async (messageIds: string[]) => {
      if (!user || messageIds.length === 0) return;

      for (const id of messageIds) {
        await supabase.rpc("mark_message_read" as never, {
          _message_id: id,
          _user_id: user.id,
        } as never);
      }
    },
    [user]
  );

  return { markAsRead };
}
