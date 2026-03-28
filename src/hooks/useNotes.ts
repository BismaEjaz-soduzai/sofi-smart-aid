import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Note {
  id: string;
  user_id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  updated_at: string;
}

export interface NoteInsert {
  title: string;
  content?: string;
  category?: string;
}

export function useNotes() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["notes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
    enabled: !!user,
  });
}

export function useCreateNote() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (note: NoteInsert) => {
      const { data, error } = await supabase
        .from("notes")
        .insert({ ...note, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<NoteInsert> & { id: string }) => {
      const { data, error } = await supabase
        .from("notes")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notes"] }),
  });
}
