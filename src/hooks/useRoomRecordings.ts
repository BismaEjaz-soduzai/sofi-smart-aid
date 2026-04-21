import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RoomRecording {
  name: string;
  path: string;
  size: number;
  createdAt: string;
  signedUrl: string;
}

/**
 * Lists all webm recordings stored under `rooms/<roomId>/recordings/` in the
 * `study-files` bucket so every member of the workspace room can play them back.
 */
export function useRoomRecordings(roomId: string | undefined | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const query = useQuery({
    queryKey: ["room-recordings", roomId],
    queryFn: async () => {
      if (!roomId) return [] as RoomRecording[];
      const folder = `rooms/${roomId}/recordings`;
      const { data, error } = await supabase.storage
        .from("study-files")
        .list(folder, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      const items = (data || []).filter((d) => d.name && !d.name.startsWith("."));
      const signed = await Promise.all(
        items.map(async (it) => {
          const path = `${folder}/${it.name}`;
          const { data: signedData } = await supabase.storage
            .from("study-files")
            .createSignedUrl(path, 60 * 60 * 24);
          return {
            name: it.name,
            path,
            size: (it.metadata as any)?.size ?? 0,
            createdAt: (it as any).created_at ?? new Date().toISOString(),
            signedUrl: signedData?.signedUrl || "",
          } as RoomRecording;
        }),
      );
      return signed;
    },
    enabled: !!user && !!roomId,
  });

  const remove = useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.storage.from("study-files").remove([path]);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-recordings", roomId] });
      toast.success("Recording deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    recordings: query.data || [],
    isLoading: query.isLoading,
    refetch: query.refetch,
    remove,
  };
}
