import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useEffect } from "react";

export interface Reaction {
  id: string;
  message_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
}

export function useReactions(roomId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  // Subscribe to realtime reaction changes
  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`reactions-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "message_reactions" }, () => {
        qc.invalidateQueries({ queryKey: ["reactions", roomId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, qc]);

  const reactionsQuery = useQuery({
    queryKey: ["reactions", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      // Get all message IDs for this room first
      const { data: messages } = await supabase
        .from("chat_messages")
        .select("id")
        .eq("room_id", roomId);
      if (!messages || messages.length === 0) return [];

      const messageIds = messages.map((m) => m.id);
      const { data, error } = await supabase
        .from("message_reactions" as any)
        .select("*")
        .in("message_id", messageIds);
      if (error) throw error;
      return (data || []) as unknown as Reaction[];
    },
    enabled: !!roomId && !!user,
  });

  const toggleReaction = useMutation({
    mutationFn: async ({ messageId, emoji }: { messageId: string; emoji: string }) => {
      if (!user) throw new Error("Not authenticated");

      // Check if reaction exists
      const { data: existing } = await supabase
        .from("message_reactions" as any)
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", user.id)
        .eq("emoji", emoji);

      if (existing && existing.length > 0) {
        // Remove reaction
        await supabase
          .from("message_reactions" as any)
          .delete()
          .eq("id", (existing[0] as any).id);
      } else {
        // Add reaction
        await supabase
          .from("message_reactions" as any)
          .insert({ message_id: messageId, user_id: user.id, emoji } as any);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reactions", roomId] });
    },
  });

  // Group reactions by message
  const getReactionsForMessage = (messageId: string) => {
    const reactions = reactionsQuery.data || [];
    const messageReactions = reactions.filter((r) => r.message_id === messageId);

    // Group by emoji
    const grouped = new Map<string, { count: number; users: string[]; hasReacted: boolean }>();
    for (const r of messageReactions) {
      const existing = grouped.get(r.emoji) || { count: 0, users: [], hasReacted: false };
      existing.count++;
      existing.users.push(r.user_id);
      if (r.user_id === user?.id) existing.hasReacted = true;
      grouped.set(r.emoji, existing);
    }
    return grouped;
  };

  return {
    getReactionsForMessage,
    toggleReaction: toggleReaction.mutate,
    isLoading: reactionsQuery.isLoading,
  };
}
