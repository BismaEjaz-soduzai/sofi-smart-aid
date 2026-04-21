import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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
