import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.100.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      // If no authenticated user, try user_id from body
      const body = await req.json().catch(() => ({}));
      if (!body.user_id) {
        return new Response(JSON.stringify({ insights: [
          { type: "suggestion", title: "Sign in to get personalized insights", description: "Your study data powers smart recommendations." },
        ] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const userId = user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user data in parallel
    const [tasksRes, plansRes, notesRes] = await Promise.all([
      supabase.from("tasks").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50),
      supabase.from("plans").select("*, plan_sessions(*)").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("notes").select("id, title, category, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(30),
    ]);

    const tasks = tasksRes.data || [];
    const plans = plansRes.data || [];
    const notes = notesRes.data || [];

    const insights: any[] = [];
    const now = new Date();

    // Analyze overdue tasks
    const overdueTasks = tasks.filter((t: any) =>
      !t.completed && t.due_date && new Date(t.due_date) < now
    );
    if (overdueTasks.length > 0) {
      insights.push({
        type: "warning",
        title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? "s" : ""}`,
        description: `"${overdueTasks[0].title}" and others need attention. Let me help you prioritize.`,
        action: `I have ${overdueTasks.length} overdue tasks. Help me prioritize them: ${overdueTasks.slice(0, 3).map((t: any) => t.title).join(", ")}`,
      });
    }

    // Tasks due soon (within 3 days)
    const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const upcomingTasks = tasks.filter((t: any) =>
      !t.completed && t.due_date && new Date(t.due_date) >= now && new Date(t.due_date) <= threeDays
    );
    if (upcomingTasks.length > 0) {
      insights.push({
        type: "suggestion",
        title: `${upcomingTasks.length} task${upcomingTasks.length > 1 ? "s" : ""} due within 3 days`,
        description: `Including "${upcomingTasks[0].title}". Want a study plan to tackle them?`,
        action: `Create a study plan for my upcoming tasks: ${upcomingTasks.map((t: any) => `${t.title} (due ${t.due_date})`).join(", ")}`,
      });
    }

    // Low-progress plans
    const activePlans = plans.filter((p: any) => p.status === "active");
    const lowProgress = activePlans.filter((p: any) => (p.progress || 0) < 30);
    if (lowProgress.length > 0) {
      insights.push({
        type: "warning",
        title: `${lowProgress.length} plan${lowProgress.length > 1 ? "s" : ""} with low progress`,
        description: `"${lowProgress[0].title}" is at ${lowProgress[0].progress || 0}%. Let's create a catch-up schedule.`,
        action: `Help me catch up on my study plan "${lowProgress[0].title}" which is at ${lowProgress[0].progress || 0}% progress.`,
      });
    }

    // Completed tasks streak
    const recentCompleted = tasks.filter((t: any) => t.completed && t.completed_at && new Date(t.completed_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    if (recentCompleted.length >= 5) {
      insights.push({
        type: "strength",
        title: `${recentCompleted.length} tasks completed this week!`,
        description: "Great momentum! Keep it going. Want me to suggest what to tackle next?",
        action: "Based on my recent progress, suggest what I should study or work on next.",
      });
    }

    // Suggest study plan if no active plans
    if (activePlans.length === 0 && tasks.length > 0) {
      insights.push({
        type: "goal",
        title: "Create a study plan",
        description: "You have tasks but no study plan. Let me help you organize your learning path.",
        action: "Help me create a comprehensive study plan based on my current tasks and deadlines.",
      });
    }

    // Notes activity
    const recentNotes = notes.filter((n: any) => new Date(n.created_at) > new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    if (recentNotes.length > 0) {
      insights.push({
        type: "suggestion",
        title: "Review your recent notes",
        description: `You took ${recentNotes.length} notes this week. Want me to quiz you on them?`,
        action: `Quiz me on my recent study notes about: ${recentNotes.slice(0, 3).map((n: any) => n.title).join(", ")}`,
      });
    }

    // Fallback if no insights
    if (insights.length === 0) {
      insights.push(
        { type: "suggestion", title: "Start studying", description: "Ask me to explain any topic, create a quiz, or make a study plan!", action: "Help me start studying. What should I focus on today?" },
        { type: "goal", title: "Add tasks & plans", description: "The more data I have, the smarter my recommendations become." },
      );
    }

    return new Response(JSON.stringify({ insights: insights.slice(0, 5) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("study-advisor error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error", insights: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
