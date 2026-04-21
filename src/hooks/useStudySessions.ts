import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";

export interface StudySession {
  id: string;
  user_id: string;
  date: string;
  session_duration: number; // minutes
  subject: string;
  completed: boolean;
  created_at: string;
}

export function useStudySessions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["study_sessions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("study_sessions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as StudySession[];
    },
    enabled: !!user,
    refetchInterval: 30_000,
  });
}

export function useDailyActivity(days = 7) {
  const { data: sessions = [] } = useStudySessions();
  const buckets: Record<string, { date: string; label: string; minutes: number; count: number }> = {};
  for (let i = days - 1; i >= 0; i--) {
    const d = subDays(new Date(), i);
    const key = format(d, "yyyy-MM-dd");
    buckets[key] = { date: key, label: format(d, "EEE"), minutes: 0, count: 0 };
  }
  sessions.forEach((s) => {
    const key = format(new Date(s.created_at), "yyyy-MM-dd");
    if (buckets[key]) {
      buckets[key].minutes += s.session_duration;
      buckets[key].count += 1;
    }
  });
  return Object.values(buckets);
}
