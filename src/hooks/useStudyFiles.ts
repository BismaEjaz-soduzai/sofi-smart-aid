import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface StudyFile {
  id: string;
  user_id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path: string;
  room_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkspaceRoom {
  id: string;
  user_id: string;
  name: string;
  emoji: string;
  color: string;
  created_at: string;
  updated_at: string;
  invite_code: string;
}

export function makeInviteCode(id: string): string {
  const clean = id.replace(/-/g, "").toUpperCase();
  return `${clean.slice(0, 3)}-${clean.slice(3, 6)}`;
}

export function useWorkspaceRooms() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const roomsQuery = useQuery({
    queryKey: ["workspace-rooms", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_rooms")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []).map((r) => ({ ...r, invite_code: makeInviteCode(r.id) })) as WorkspaceRoom[];
    },
    enabled: !!user,
  });

  const createRoom = useMutation({
    mutationFn: async (room: { name: string; emoji: string; color: string }) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase.from("workspace_rooms").insert({ ...room, user_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-rooms"] });
      toast.success("Room created");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRoom = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workspace_rooms").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspace-rooms"] });
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("Room deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const joinRoomByCode = useMutation({
    mutationFn: async (code: string) => {
      const target = code.trim().toUpperCase();
      if (!target) throw new Error("Enter a code");
      const { data, error } = await supabase.from("workspace_rooms").select("*");
      if (error) throw error;
      const found = (data || []).find((r) => makeInviteCode(r.id) === target);
      if (!found) throw new Error("Room not found");
      return { ...found, invite_code: makeInviteCode(found.id) } as WorkspaceRoom;
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { rooms: roomsQuery.data || [], isLoading: roomsQuery.isLoading, createRoom, deleteRoom, joinRoomByCode };
}

export function useStudyFiles(roomId?: string | null) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const filesQuery = useQuery({
    queryKey: ["study-files", user?.id, roomId],
    queryFn: async () => {
      let query = supabase.from("study_files").select("*").order("created_at", { ascending: false });
      if (roomId) {
        query = query.eq("room_id", roomId);
      } else if (roomId === null) {
        query = query.is("room_id", null);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as StudyFile[];
    },
    enabled: !!user,
  });

  const uploadFile = useMutation({
    mutationFn: async (file: File) => {
      if (!user) throw new Error("Not authenticated");
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from("study-files").upload(filePath, file);
      if (uploadError) throw uploadError;

      const ext = file.name.split(".").pop()?.toLowerCase() || "unknown";
      const typeMap: Record<string, string> = {
        pdf: "PDF", docx: "DOCX", doc: "DOCX", ppt: "PPT", pptx: "PPTX", txt: "TXT",
      };

      const { error: dbError } = await supabase.from("study_files").insert({
        user_id: user.id,
        file_name: file.name,
        file_type: typeMap[ext] || ext.toUpperCase(),
        file_size: file.size,
        file_path: filePath,
        room_id: roomId || null,
      } as any);
      if (dbError) throw dbError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("File uploaded successfully");
    },
    onError: (err: Error) => toast.error(err.message || "Upload failed"),
  });

  const deleteFile = useMutation({
    mutationFn: async (file: StudyFile) => {
      const { error: storageErr } = await supabase.storage.from("study-files").remove([file.file_path]);
      if (storageErr) throw storageErr;
      const { error: dbErr } = await supabase.from("study_files").delete().eq("id", file.id);
      if (dbErr) throw dbErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("File deleted");
    },
    onError: (err: Error) => toast.error(err.message || "Delete failed"),
  });

  const moveFile = useMutation({
    mutationFn: async ({ fileId, targetRoomId }: { fileId: string; targetRoomId: string | null }) => {
      const { error } = await supabase.from("study_files").update({ room_id: targetRoomId } as any).eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["study-files"] });
      toast.success("File moved");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return { files: filesQuery.data || [], isLoading: filesQuery.isLoading, uploadFile, deleteFile, moveFile };
}
