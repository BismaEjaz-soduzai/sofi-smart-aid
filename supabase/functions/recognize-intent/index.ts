// Voice intent recognizer — uses Lovable AI Gateway (Gemini).
// Returns { route, name, confidence } or { route: null, ... } when unclear.

import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

interface RouteEntry { route: string; name: string; keywords: string[] }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { speech, routes } = await req.json() as { speech?: string; routes?: RouteEntry[] };
    if (!speech || typeof speech !== "string" || !speech.trim()) {
      return new Response(JSON.stringify({ route: null, name: null, confidence: "none" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!Array.isArray(routes) || routes.length === 0) {
      return new Response(JSON.stringify({ error: "routes array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const routeLines = routes
      .map((r) => `- route: "${r.route}" | name: "${r.name}" | keywords: ${r.keywords.join(", ")}`)
      .join("\n");

    const systemPrompt = `You are a voice navigation assistant for a Smart Learning Assistant app.
The user may speak in English, Urdu, or Urdu-English mix (Roman Urdu also).
Understand their intent and return which page to open.

Here are all available destinations:
${routeLines}

Rules:
- Understand natural speech, not just exact keywords.
- Urdu words are valid (e.g. "kholo" = open, "dikhao" = show, "kaam" = tasks/work, "awaz" = voice).
- If multiple destinations could match, pick the most specific one (e.g. "show recordings" → Workspace · Recordings, not Smart Workspace).
- If the user mentions a tab inside a page (e.g. "pinboard in workspace"), pick the deep route.
- If completely unclear or unrelated to navigation, return null.
- Respond with ONLY raw JSON, no markdown, no code fences.

Format:
{"route":"/path","name":"Page Name","confidence":"high"}
or
{"route":null,"name":null,"confidence":"none"}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `User said: "${speech.trim()}"` },
        ],
        tools: [{
          type: "function",
          function: {
            name: "navigate",
            description: "Navigate to a route in the app, or null if unclear.",
            parameters: {
              type: "object",
              properties: {
                route: { type: ["string", "null"] },
                name: { type: ["string", "null"] },
                confidence: { type: "string", enum: ["high", "medium", "low", "none"] },
              },
              required: ["route", "name", "confidence"],
              additionalProperties: false,
            },
          },
        }],
        tool_choice: { type: "function", function: { name: "navigate" } },
      }),
    });

    if (!resp.ok) {
      const status = resp.status;
      const errBody = await resp.text().catch(() => "");
      console.error("AI gateway error", status, errBody);
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`AI gateway ${status}`);
    }

    const data = await resp.json();
    const call = data?.choices?.[0]?.message?.tool_calls?.[0];
    const argsRaw = call?.function?.arguments;
    let parsed: { route: string | null; name: string | null; confidence: string } =
      { route: null, name: null, confidence: "none" };
    if (argsRaw) {
      try {
        parsed = typeof argsRaw === "string" ? JSON.parse(argsRaw) : argsRaw;
      } catch (e) {
        console.warn("Failed to parse tool args", argsRaw);
      }
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("recognize-intent error", err);
    return new Response(
      JSON.stringify({ route: null, name: null, confidence: "none", error: err instanceof Error ? err.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
