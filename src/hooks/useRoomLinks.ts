import { useEffect } from "react";
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
  author_name?: string | null;
}

function getSafeUrl(raw: string): URL | null {
  try {
    const normalized = /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
    return new URL(normalized);
  } catch {
    return null;
  }
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

  useEffect(() => {
    if (!roomId || !user) return;

    const channel = supabase
      .channel(`room-links-${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "room_links", filter: `room_id=eq.${roomId}` },
        () => qc.invalidateQueries({ queryKey: ["room-links", roomId] }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId, user, qc]);

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
      const rows = (data || []) as RoomLink[];
      const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
      if (userIds.length === 0) return rows;
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, display_name")
        .in("user_id", userIds);
      const nameMap = new Map<string, string>(
        (profiles || []).map((p: { user_id: string; display_name: string | null }) => [p.user_id, p.display_name || "Member"]),
      );
      return rows.map((r) => ({ ...r, author_name: nameMap.get(r.user_id) || "Member" }));
    },
    enabled: !!roomId && !!user,
  });

  const addLink = useMutation({
    mutationFn: async (input: { url: string; title?: string; note?: string }) => {
      if (!user || !roomId) throw new Error("Open a room first");
      const parsedUrl = getSafeUrl(input.url);
      if (!parsedUrl) throw new Error("Enter a valid web or YouTube link");

      const cleanTitle = input.title?.trim() || parsedUrl.hostname.replace(/^www\./, "") || parsedUrl.href;
      const { error } = await (supabase as any).from("room_links").insert({
        room_id: roomId,
        user_id: user.id,
        url: parsedUrl.href,
        title: cleanTitle,
        note: input.note?.trim() || "",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["room-links", roomId] });
      toast.success("Link pinned");
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
