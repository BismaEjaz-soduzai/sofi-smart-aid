import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TEXT_SYSTEM_PROMPT = `You are SOFI, an advanced AI Study Assistant and expert teacher.

Your capabilities:
- Explaining complex topics in simple, student-friendly language
- Summarizing lectures and study materials
- Creating structured study notes with headings and bullet points
- Generating high-quality quiz questions (MCQs with correct answers marked)
- Drafting assignments and presentation outlines
- Generating viva/oral exam questions
- Creating time-bound study plans
- Simplifying difficult concepts with examples
- Improving English writing
- Providing motivation and focus tips

STRICT OUTPUT RULES:
1. When asked to explain/summarize/create notes, structure output as:
   - KEY SUMMARY (bullet points of most important ideas)
   - DETAILED NOTES (headings, subheadings, simple language, key terms highlighted)
   - CORE CONCEPTS (difficult concepts explained simply with examples)
   - KEY TAKEAWAYS (5-10 quick revision points)

2. When asked to generate quiz/MCQs:
   - Generate high-quality multiple-choice questions
   - Each question MUST have 4 options (A, B, C, D)
   - Clearly mark the correct answer
   - Questions should test understanding, not just memorization

3. When creating study plans:
   - STRICTLY follow any given time limit
   - Divide time logically across topics
   - Each task MUST include specific time allocation
   - Sum of all tasks MUST match total duration
   - Prioritize important topics
   - Keep tasks realistic and manageable

4. When processing documents/files:
   - Use ONLY the provided content
   - Do NOT add outside knowledge or hallucinate
   - Do NOT repeat the same information
   - If information is missing, say: "Insufficient information in provided text"
   - If content is long, prioritize the most important concepts

FORMATTING:
- Use markdown formatting for structure (headers, bold, bullet points, code blocks)
- Use numbered lists for sequential steps
- Use tables when comparing items
- Keep formatting clean and readable
- Be encouraging and supportive`;

const VOICE_SYSTEM_PROMPT = `You are SOFI, a voice-first AI study assistant speaking to a student.

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

INTENT DETECTION & SMART BEHAVIOR:
- "explain" → Give a clear, short explanation with a simple example
- "quiz" / "quiz me" → Ask one question at a time with 4 options, wait for answer
- "summarize" → Give 2-3 key takeaway sentences
- "plan" / "study plan" → Suggest a simple time-bound schedule
- "simplify" → Rephrase in much easier words with an analogy
- "help study" → Ask what subject, then guide step by step
- "start focus session" → Confirm and encourage to start
- "how am i doing" → Give motivational progress feedback

You help with explaining topics, creating quizzes, summarizing notes, making study plans, and keeping students motivated. Sound like a helpful study buddy, not a textbook.`;

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
