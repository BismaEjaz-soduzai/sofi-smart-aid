import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function usePerformanceMetrics() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["performance_metrics", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("performance_metrics")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddPerformanceMetric() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (metric: { subject: string; score: number; total_marks: number }) => {
      const { data, error } = await supabase
        .from("performance_metrics")
        .insert({ ...metric, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["performance_metrics"] }),
  });
}

export function useStudySessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["study_sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*")
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddStudySession() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (session: { session_duration: number; subject: string; completed: boolean }) => {
      const { data, error } = await supabase
        .from("study_sessions")
        .insert({ ...session, user_id: user!.id, date: new Date().toISOString().split("T")[0] })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["study_sessions"] }),
  });
}

export function useUserGoals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user_goals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_goals")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddUserGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (goal: { goal_title: string; target_value: number; deadline?: string }) => {
      const { data, error } = await supabase
        .from("user_goals")
        .insert({ ...goal, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_goals"] }),
  });
}

export function useUpdateGoalProgress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, current_progress }: { id: string; current_progress: number }) => {
      const { error } = await supabase
        .from("user_goals")
        .update({ current_progress })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_goals"] }),
  });
}
