import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface RoomLink {
  id: string;
  room_id: string;
  user_id: string;
  title: string;
  url: string;
  note: string | null;
  created_at: string;
}

function getYouTubeId(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.slice(1) || null;
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname === "/watch") return u.searchParams.get("v");
      if (u.pathname.startsWith("/embed/")) return u.pathname.split("/")[2] || null;
      if (u.pathname.startsWith("/shorts/")) return u.pathname.split("/")[2] || null;
    }
    return null;
  } catch {
    return null;
  }
}

export function getYouTubeEmbedUrl(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://www.youtube.com/embed/${id}` : null;
}

export function getYouTubeThumbnail(url: string): string | null {
  const id = getYouTubeId(url);
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
}

export function useRoomLinks(roomId: string | undefined | null) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const linksQuery = useQuery({
    queryKey: ["room-links", roomId],
    queryFn: async () => {
      if (!roomId) return [] as RoomLink[];
      const { data, error } = await (supabase as any)
        .from("room_links")
        .select("*")
        .eq("room_id", roomId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as RoomLink[];
    },
    enabled: !!roomId && !!user,
  });

  const addLink = useMutation({
    mutationFn: async (input: { url: string; title?: string; note?: string }) => {
      if (!user || !roomId) throw new Error("Not ready");
      let url = input.url.trim();
      if (!url) throw new Error("URL is required");
      if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
      const { error } = await (supabase as any).from("room_links").insert({
        room_id: roomId,
        user_id: user.id,
        url,
        title: input.title?.trim() || url,
        note: input.note?.trim() || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-links", roomId] });
      toast.success("Link saved");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeLink = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("room_links").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-links", roomId] });
      toast.success("Link removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    links: linksQuery.data || [],
    isLoading: linksQuery.isLoading,
    addLink,
    removeLink,
  };
}
