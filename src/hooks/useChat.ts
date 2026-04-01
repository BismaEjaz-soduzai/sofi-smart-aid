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
  created_at: string;
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
      return data as ChatRoom[];
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
      return data as ChatMember[];
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${roomId}` }, () => {
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
      return data as ChatMessage[];
    },
    enabled: !!roomId,
  });
}

export function useCreateRoom() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (name: string) => {
      if (!user) throw new Error("Not authenticated");
      const { data, error } = await supabase
        .from("chat_rooms")
        .insert({ name, created_by: user.id } as any)
        .select()
        .single();
      if (error) throw error;
      // Auto-join creator
      await supabase.from("chat_members").insert({
        room_id: (data as ChatRoom).id,
        user_id: user.id,
        display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      } as any);
      return data as ChatRoom;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chat-rooms"] });
      toast.success("Room created!");
    },
    onError: () => toast.error("Failed to create room"),
  });
}

export function useJoinRoom() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inviteCode: string) => {
      if (!user) throw new Error("Not authenticated");
      // Find room by invite code
      const { data: rooms, error: findErr } = await supabase
        .from("chat_rooms")
        .select("*")
        .eq("invite_code", inviteCode);
      if (findErr) throw findErr;
      if (!rooms || rooms.length === 0) throw new Error("Room not found");
      const room = rooms[0] as ChatRoom;

      // Check member count
      const { count } = await supabase
        .from("chat_members")
        .select("*", { count: "exact", head: true })
        .eq("room_id", room.id);
      if ((count || 0) >= room.max_members) throw new Error("Room is full");

      const { error } = await supabase.from("chat_members").insert({
        room_id: room.id,
        user_id: user.id,
        display_name: user.user_metadata?.full_name || user.email?.split("@")[0] || "User",
      } as any);
      if (error) {
        if (error.code === "23505") throw new Error("Already a member");
        throw error;
      }
      return room;
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
    mutationFn: async ({ roomId, content, messageType = "text", fileName, fileUrl, fileSize }: {
      roomId: string; content: string; messageType?: string; fileName?: string; fileUrl?: string; fileSize?: number;
    }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("chat_messages").insert({
        room_id: roomId,
        user_id: user.id,
        content,
        message_type: messageType,
        file_name: fileName || null,
        file_url: fileUrl || null,
        file_size: fileSize || null,
      } as any);
      if (error) throw error;
    },
    onError: () => toast.error("Failed to send message"),
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
