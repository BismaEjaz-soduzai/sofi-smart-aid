import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { user_text, context, messages } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const systemPrompt = `You are SOFI, a voice-first AI study assistant speaking naturally to a student.

VOICE RULES (CRITICAL):
1. Keep responses to 2-3 sentences MAX per thought
2. Use natural spoken language — no markdown, no bullet points, no formatting
3. Never say "asterisk", "hash", or describe formatting
4. Use simple words and short sentences
5. Pause naturally with periods
6. After explaining something complex, ask "Should I continue?" or "Want more detail?"

COMMAND HANDLING:
- "Start focus session" → Say something like "Let's go! Starting your focus session now. Stay locked in, you've got this!"
- "Explain [topic]" → Give a clear 2-3 sentence explanation, then offer to go deeper
- "Summarize notes" → Provide 2-3 key takeaway sentences from context
- "Quiz me" → Ask ONE multiple choice question with 4 options, wait for the answer
- "How am I doing" → Give encouraging motivational feedback about their progress
- "Plan my study" → Suggest a simple schedule with specific times

PERSONALITY:
- Sound like a smart, encouraging study buddy
- Be warm and motivational
- Celebrate small wins
- Keep energy positive but not over the top
${context ? `\nContext: ${context}` : ""}`;

    const chatMessages = messages || [{ role: "user", content: user_text }];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...chatMessages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited, please try again later." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI gateway error");
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("voice-query error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
