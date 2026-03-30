import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Plan {
  id: string;
  user_id: string;
  title: string;
  goal: string;
  category: string;
  emoji: string;
  color_tag: string;
  start_date: string | null;
  end_date: string | null;
  duration: string;
  description: string;
  progress: number;
  status: string;
  source_type: string;
  created_at: string;
  updated_at: string;
}

export interface PlanSession {
  id: string;
  plan_id: string;
  title: string;
  date: string | null;
  start_time: string | null;
  end_time: string | null;
  note: string;
  is_completed: boolean;
  created_at: string;
}

export interface PlanInsert {
  title: string;
  goal?: string;
  category?: string;
  emoji?: string;
  color_tag?: string;
  start_date?: string | null;
  end_date?: string | null;
  duration?: string;
  description?: string;
  source_type?: string;
}

export interface SessionInsert {
  plan_id: string;
  title: string;
  date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  note?: string;
}

export function usePlans() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["plans", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Plan[];
    },
    enabled: !!user,
  });
}

export function usePlanSessions(planId?: string) {
  return useQuery({
    queryKey: ["plan_sessions", planId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plan_sessions")
        .select("*")
        .eq("plan_id", planId!)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as PlanSession[];
    },
    enabled: !!planId,
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (plan: PlanInsert) => {
      const { data, error } = await supabase
        .from("plans")
        .insert({ ...plan, user_id: user!.id } as any)
        .select()
        .single();
      if (error) throw error;
      return data as Plan;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useUpdatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PlanInsert> & { id: string; progress?: number; status?: string }) => {
      const { data, error } = await supabase
        .from("plans")
        .update(updates as any)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useDeletePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["plans"] }),
  });
}

export function useCreateSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (session: SessionInsert) => {
      const { data, error } = await supabase
        .from("plan_sessions")
        .insert(session as any)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["plan_sessions", vars.plan_id] }),
  });
}

export function useToggleSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_completed, plan_id }: { id: string; is_completed: boolean; plan_id: string }) => {
      const { error } = await supabase
        .from("plan_sessions")
        .update({ is_completed } as any)
        .eq("id", id);
      if (error) throw error;
      return { plan_id };
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["plan_sessions", data.plan_id] });
      qc.invalidateQueries({ queryKey: ["plans"] });
    },
  });
}
