// Reminder dispatcher: scans tasks/plan_sessions for items due within a user's
// reminder_lead_hours window and records browser/email deliveries. Idempotent
// via notification_deliveries.delivery_key unique constraint.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

interface ReminderItem {
  user_id: string;
  entity_type: "task" | "plan_session";
  entity_id: string;
  title: string;
  due_at: string; // ISO
  is_overdue: boolean;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Optional body: { test?: boolean, user_id?: string }
    let body: any = {};
    try { body = await req.json(); } catch { /* no-op */ }
    const targetUserId: string | undefined = body?.user_id;

    // Load preference rows for users we should process
    let prefsQuery = supabase.from("notification_preferences").select("*");
    if (targetUserId) prefsQuery = prefsQuery.eq("user_id", targetUserId);
    const { data: prefsList, error: prefsErr } = await prefsQuery;
    if (prefsErr) throw prefsErr;

    const now = new Date();
    let scanned = 0;
    let queued = 0;

    for (const prefs of prefsList || []) {
      const leadMs = (prefs.reminder_lead_hours ?? 24) * 60 * 60 * 1000;
      const windowEnd = new Date(now.getTime() + leadMs);

      const items: ReminderItem[] = [];

      // Tasks
      if (prefs.task_reminders) {
        const { data: tasks } = await supabase
          .from("tasks")
          .select("id, title, due_date, due_time, completed")
          .eq("user_id", prefs.user_id)
          .eq("completed", false)
          .not("due_date", "is", null);

        for (const t of tasks || []) {
          const due = new Date(`${t.due_date}T${t.due_time || "23:59"}:00`);
          if (due <= windowEnd) {
            items.push({
              user_id: prefs.user_id,
              entity_type: "task",
              entity_id: t.id,
              title: t.title,
              due_at: due.toISOString(),
              is_overdue: due < now,
            });
          }
        }
      }

      // Plan sessions
      if (prefs.milestone_reminders) {
        const { data: sessions } = await supabase
          .from("plan_sessions")
          .select("id, title, date, start_time, is_completed, plan_id, plans!inner(user_id)")
          .eq("plans.user_id", prefs.user_id)
          .eq("is_completed", false)
          .not("date", "is", null);

        for (const s of sessions || []) {
          const due = new Date(`${s.date}T${s.start_time || "09:00"}:00`);
          if (due <= windowEnd) {
            items.push({
              user_id: prefs.user_id,
              entity_type: "plan_session",
              entity_id: s.id,
              title: s.title,
              due_at: due.toISOString(),
              is_overdue: due < now,
            });
          }
        }
      }

      scanned += items.length;

      // Insert delivery records (idempotent on delivery_key)
      for (const item of items) {
        const channels: string[] = [];
        if (prefs.browser_enabled) channels.push("browser");
        if (prefs.email_enabled) channels.push("email");
        for (const channel of channels) {
          const bucket = item.is_overdue ? "overdue" : "upcoming";
          const delivery_key = `${channel}:${item.entity_type}:${item.entity_id}:${bucket}`;
          const { error } = await supabase.from("notification_deliveries").insert({
            user_id: item.user_id,
            channel,
            entity_type: item.entity_type,
            entity_id: item.entity_id,
            notification_type: bucket,
            delivery_key,
          });
          if (!error) queued++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        scanned,
        queued,
        message: `Checked ${prefsList?.length ?? 0} user(s); ${queued} new reminder${queued === 1 ? "" : "s"} queued.`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("send-reminders error:", e);
    return new Response(
      JSON.stringify({ ok: false, error: e?.message || String(e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
