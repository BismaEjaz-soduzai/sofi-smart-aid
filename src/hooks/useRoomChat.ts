import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RoomMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  sender_name: string | null;
  message_type: string;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  created_at: string;
}

export function useRoomMessages(roomId?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const messagesQuery = useQuery({
    queryKey: ["room-messages", roomId],
    queryFn: async () => {
      if (!roomId) return [];
      const { data, error } = await supabase
        .from("room_messages" as any)
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as unknown as RoomMessage[];
    },
    enabled: !!user && !!roomId,
  });

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-messages-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_messages", filter: `room_id=eq.${roomId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ["room-messages", roomId] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, queryClient]);

  return { messages: messagesQuery.data || [], isLoading: messagesQuery.isLoading };
}

export interface SendRoomMessageArgs {
  roomId: string;
  content: string;
  senderName?: string;
  messageType?: string;
  fileName?: string;
  fileUrl?: string;
  fileSize?: number;
}

export function useSendRoomMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (args: SendRoomMessageArgs) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("room_messages" as any).insert({
        room_id: args.roomId,
        user_id: user.id,
        content: args.content,
        sender_name: args.senderName ?? null,
        message_type: args.messageType ?? "text",
        file_name: args.fileName ?? null,
        file_url: args.fileUrl ?? null,
        file_size: args.fileSize ?? null,
      } as any);
      if (error) throw error;
    },
    onError: (err: Error) => toast.error(err.message || "Failed to send"),
  });
}

export function useUploadRoomFile() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const path = `${user.id}/room-files/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("study-files").upload(path, file);
      if (error) throw error;
      const { data } = await supabase.storage.from("study-files").createSignedUrl(path, 60 * 60 * 24 * 365);
      return { url: data?.signedUrl || "", name: file.name, size: file.size, path };
    },
    onError: (err: Error) => toast.error(err.message || "Upload failed"),
  });
}
