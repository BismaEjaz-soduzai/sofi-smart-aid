// SOFI Study Chat — multi-provider streaming edge function
// Streams SSE in OpenAI-compatible format: data: {"choices":[{"delta":{"content":"..."}}]}\n\n
// Provider priority: Groq → Gemini → OpenAI → Anthropic

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEFAULT_SYSTEM =
  "You are SOFI, an intelligent AI study assistant for university students. You help with studying, explaining concepts, creating study plans, generating quizzes, viva preparation, oral exam questions, essay outlines, flashcards, and general academic questions. Be concise, friendly, encouraging, and accurate. When asked to return JSON for structured tasks like grading or diagram data, return ONLY valid JSON with no markdown fences.";

const VOICE_SYSTEM =
  "You are SOFI voice tutor. MAX 3-4 short sentences. Zero markdown. Natural speech: 'Think of it like...', 'Here is the key thing...'. After each point say Want me to continue? For quizzes say Here is your question: then ONE question. Always encouraging.";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

const encoder = new TextEncoder();

function encodeChunk(text: string): Uint8Array {
  const payload = JSON.stringify({ choices: [{ delta: { content: text } }] });
  return encoder.encode(`data: ${payload}\n\n`);
}

const DONE_CHUNK = encoder.encode("data: [DONE]\n\n");

function errorResponse(message: string, status = 500) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const sseHeaders = {
  ...corsHeaders,
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
};

// ── Groq (OpenAI-compatible) ────────────────────────────────────────────────
async function streamGroq(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<Response> {
  const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      stream: true,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    if (upstream.status === 429) return errorResponse("Rate limit reached — please wait a moment", 429);
    const text = await upstream.text();
    return errorResponse(`Groq error: ${text}`, upstream.status);
  }
  return new Response(upstream.body, { headers: sseHeaders });
}

// ── Gemini (Google AI Studio) ───────────────────────────────────────────────
async function streamGemini(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxOutputTokens: number,
): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:streamGenerateContent?key=${apiKey}&alt=sse`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: messages.map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    })),
    generationConfig: { maxOutputTokens, temperature: 0.7 },
  };

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!upstream.ok || !upstream.body) {
    return errorResponse(`Gemini error: ${await upstream.text()}`, upstream.status);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (text) controller.enqueue(encodeChunk(text));
            } catch { /* skip */ }
          }
        }
        controller.enqueue(DONE_CHUNK);
      } catch (err) {
        console.error("Gemini stream error", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}

// ── OpenAI ──────────────────────────────────────────────────────────────────
async function streamOpenAI(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<Response> {
  const upstream = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return errorResponse(`OpenAI error: ${await upstream.text()}`, upstream.status);
  }
  return new Response(upstream.body, { headers: sseHeaders });
}

// ── Anthropic ───────────────────────────────────────────────────────────────
async function streamAnthropic(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<Response> {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: maxTokens,
      temperature: 0.7,
      system: systemPrompt,
      stream: true,
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    }),
  });

  if (!upstream.ok || !upstream.body) {
    return errorResponse(`Anthropic error: ${await upstream.text()}`, upstream.status);
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed.startsWith("data:")) continue;
            const data = trimmed.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (
                parsed.type === "content_block_delta" &&
                parsed.delta?.type === "text_delta" &&
                parsed.delta.text
              ) {
                controller.enqueue(encodeChunk(parsed.delta.text));
              }
            } catch { /* skip */ }
          }
        }
        controller.enqueue(DONE_CHUNK);
      } catch (err) {
        console.error("Anthropic stream error", err);
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders });
}

// ── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: { messages?: ChatMessage[]; voice_mode?: boolean; system?: string };
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const incoming = Array.isArray(payload.messages) ? payload.messages : [];
  if (incoming.length === 0) {
    return errorResponse("messages array is required", 400);
  }

  const voiceMode = !!payload.voice_mode;

  // Honor a system message provided in the messages array, then explicit `system`, then defaults.
  const messages: ChatMessage[] = [];
  let systemPrompt = "";
  for (const m of incoming) {
    if (m.role === "system" && !systemPrompt) systemPrompt = m.content;
    else messages.push(m);
  }
  if (!systemPrompt && typeof payload.system === "string" && payload.system.trim()) {
    systemPrompt = payload.system;
  }
  if (!systemPrompt) systemPrompt = voiceMode ? VOICE_SYSTEM : DEFAULT_SYSTEM;

  const maxTokens = voiceMode ? 300 : 1500;

  const groqKey = Deno.env.get("GROQ_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    if (groqKey) return await streamGroq(groqKey, systemPrompt, messages, maxTokens);
    if (geminiKey) return await streamGemini(geminiKey, systemPrompt, messages, maxTokens);
    if (openaiKey) return await streamOpenAI(openaiKey, systemPrompt, messages, maxTokens);
    if (anthropicKey) return await streamAnthropic(anthropicKey, systemPrompt, messages, maxTokens);
  } catch (err) {
    console.error("Provider error", err);
    return errorResponse(err instanceof Error ? err.message : "Provider error");
  }

  return errorResponse(
    "No AI API key configured. Add GROQ_API_KEY to Supabase Edge Function Secrets at console.supabase.com",
  );
});
