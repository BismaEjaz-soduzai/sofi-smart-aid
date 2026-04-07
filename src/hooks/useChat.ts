import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { useEffect } from "react";

export interface ChatRoom {
  id: string;
  name: string;
  created_by: string;
  max_members: number;
  invite_code: string;
  created_at: string;
}

export interface ChatMember {
  id: string;
  room_id: string;
  user_id: string;
  display_name: string | null;
  joined_at: string;
}

export interface ChatMessage {
  id: string;
  room_id: string;
  user_id: string;
  content: string;
  message_type: string;
  file_name: string | null;
  file_url: string | null;
  file_size: number | null;
  reply_to_id: string | null;
  created_at: string;
  edited_at: string | null;
  read_by: string[];
}

export function useChatRooms() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["chat-rooms", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_rooms")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ChatRoom[];
    },
    enabled: !!user,
  });
}

export function useChatMembers(roomId?: string) {
  return useQuery({
    queryKey: ["chat-members", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_members")
        .select("*")
        .eq("room_id", roomId!);
      if (error) throw error;
      return (data || []) as ChatMember[];
    },
    enabled: !!roomId,
  });
}

export function useChatMessages(roomId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!roomId) return;
    const channel = supabase
      .channel(`room-${roomId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, () => {
        qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [roomId, qc]);

  return useQuery({
    queryKey: ["chat-messages", roomId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("room_id", roomId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as ChatMessage[];
    },
    enabled: !!roomId,
  });
}

/** Fetch last message + unread count for multiple rooms at once */
export function useRoomPreviews(roomIds: string[], userId?: string) {
  return useQuery({
    queryKey: ["room-previews", roomIds.join(","), userId],
    queryFn: async () => {
      if (roomIds.length === 0) return new Map<string, { lastMessage: ChatMessage | null; unreadCount: number }>();

      // Fetch last 50 messages per room for preview (avoids 1000 row limit issues)
      const results = new Map<string, { lastMessage: ChatMessage | null; unreadCount: number }>();

      // Batch: get all messages from all rooms the user is in
      const { data, error } = await supabase
        .from("chat_messages")
        .select("*")
        .in("room_id", roomIds)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Room previews error:", error);
        return results;
      }

      const messages = (data || []) as ChatMessage[];

      for (const roomId of roomIds) {
        const roomMsgs = messages.filter((m) => m.room_id === roomId);
        const lastMessage = roomMsgs.length > 0 ? roomMsgs[0] : null;
        const unreadCount = userId
          ? roomMsgs.filter((m) => m.user_id !== userId && !(m.read_by || []).includes(userId)).length
          : 0;
        results.set(roomId, { lastMessage, unreadCount });
      }

      return results;
    },
    enabled: roomIds.length > 0 && !!userId,
    refetchInterval: 10000, // refresh every 10s for live unread counts
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      const { data, error } = await supabase.rpc("create_chat_room", {
        _name: name,
        _display_name: displayName,
      });
      if (error) throw error;
      return data as unknown as ChatRoom;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      toast.success("Room created!");
    },
    onError: (err: Error) => toast.error(err.message || "Failed to create room"),
  });
}

export function useJoinRoom() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error("Not authenticated");
      const displayName = user.user_metadata?.full_name || user.email?.split("@")[0] || "User";
      const { data, error } = await supabase.rpc("join_chat_room_by_invite", {
        _invite_code: inviteCode.trim(),
        _display_name: displayName,
      });
      if (error) throw error;
      return data as unknown as ChatRoom;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      toast.success("Joined room!");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useSendMessage() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ roomId, content, messageType = "text", fileName, fileUrl, fileSize, replyToId }: {
      roomId: string; content: string; messageType?: string; fileName?: string; fileUrl?: string; fileSize?: number; replyToId?: string;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const payload: Record<string, unknown> = {
        room_id: roomId,
        user_id: user.id,
        content,
        message_type: messageType,
      };
      if (fileName) payload.file_name = fileName;
      if (fileUrl) payload.file_url = fileUrl;
      if (fileSize) payload.file_size = fileSize;
      if (replyToId) payload.reply_to_id = replyToId;

      const { error } = await supabase.from("chat_messages").insert(payload as any);
      if (error) throw error;
    },
    onError: (err: Error) => {
      console.error("Send message error:", err);
      toast.error("Failed to send message");
    },
  });
}

export function useUploadChatFile() {
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("chat-files").upload(filePath, file);
      if (error) throw error;
      const { data } = supabase.storage.from("chat-files").getPublicUrl(filePath);
      return { url: data.publicUrl, name: file.name, size: file.size };
    },
    onError: (err: Error) => toast.error(err.message || "Upload failed"),
  });
}

export function useEditMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, content, roomId }: { messageId: string; content: string; roomId: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .update({ content, edited_at: new Date().toISOString() } as any)
        .eq("id", messageId);
      if (error) throw error;
      return roomId;
    },
    onSuccess: (roomId) => {
      qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
      toast.success("Message edited");
    },
    onError: () => toast.error("Failed to edit message"),
  });
}

export function useDeleteMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ messageId, roomId }: { messageId: string; roomId: string }) => {
      const { error } = await supabase
        .from("chat_messages")
        .delete()
        .eq("id", messageId);
      if (error) throw error;
      return roomId;
    },
    onSuccess: (roomId) => {
      qc.invalidateQueries({ queryKey: ["chat-messages", roomId] });
      toast.success("Message deleted");
    },
    onError: () => toast.error("Failed to delete message"),
  });
}

export function useLeaveRoom() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (roomId: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("chat_members")
        .delete()
        .eq("room_id", roomId)
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      toast.success("Left room");
    },
  });
}
