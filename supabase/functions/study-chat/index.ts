import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXT_SYSTEM_PROMPT = `You are SOFI, a smart AI assistant for students and productivity users. You help with:
- Explaining complex topics in simple words
- Summarizing lectures and study materials
- Creating study notes and quiz questions
- Drafting assignments and presentation outlines
- Generating viva/oral exam questions
- Making study plans and daily productivity plans
- Simplifying difficult concepts
- Rewriting and improving notes or text
- Planning schedules and staying productive
- Providing motivation and focus tips
- Improving English writing

Be clear, concise, and helpful. Use markdown formatting for structure. When creating quizzes, number the questions. When making notes, use bullet points and headers. Always be encouraging and supportive.`;

const VOICE_SYSTEM_PROMPT = `You are SOFI, a voice-first AI study assistant. You are speaking to the student through voice, so follow these rules strictly:

VOICE RESPONSE RULES:
1. Keep responses SHORT — max 3-4 sentences per thought
2. Use natural conversational language, not academic writing
3. NEVER use markdown formatting (no #, *, **, -, bullet points, code blocks)
4. NEVER use lists with dashes or numbers unless specifically asked for a quiz
5. Use pauses naturally with periods and commas
6. Break complex explanations into digestible chunks
7. Ask "Want me to continue?" or "Should I explain more?" after key points
8. Use simple words — explain like talking to a friend
9. For quizzes: read one question at a time, pause for answer
10. Be warm, encouraging, and conversational

INTENT DETECTION:
- If asked to "explain" → Give a clear, short explanation
- If asked to "quiz" → Ask one question at a time
- If asked to "summarize" → Give 2-3 key takeaway sentences
- If asked to "plan" → Suggest a simple schedule
- If asked to "simplify" → Rephrase the last thing in easier words
- If asked to "help study" → Ask what subject, then guide step by step

You help with explaining topics, creating quizzes, summarizing notes, making study plans, and keeping students motivated. Always sound like a helpful study buddy, not a textbook.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, voice_mode } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = voice_mode ? VOICE_SYSTEM_PROMPT : TEXT_SYSTEM_PROMPT;

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
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI service error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("study-chat error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
