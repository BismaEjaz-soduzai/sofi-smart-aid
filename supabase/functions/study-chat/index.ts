// SOFI Study Chat — multi-provider streaming edge function
// Streams SSE in OpenAI-compatible format: data: {"choices":[{"delta":{"content":"..."}}]}\n\n

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TEXT_SYSTEM =
  "You are SOFI, a professional AI study assistant. Use markdown formatting with headers, bold, code blocks. Give concrete examples. End every response with a practice question or 2 actionable next steps. Expert in CS, Software Engineering, Math, Physics, Business.";

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

// ── Gemini (Google AI Studio, free) ─────────────────────────────────────────
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

// ── Lovable AI Gateway ──────────────────────────────────────────────────────
async function streamLovable(
  apiKey: string,
  systemPrompt: string,
  messages: ChatMessage[],
  maxTokens: number,
): Promise<Response> {
  const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      stream: true,
      temperature: 0.7,
      max_tokens: maxTokens,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
    }),
  });

  if (!upstream.ok || !upstream.body) {
    // Preserve 429 / 402 so client can show friendly toasts
    if (upstream.status === 429) {
      return errorResponse("Rate limit reached — please wait a moment", 429);
    }
    if (upstream.status === 402) {
      return errorResponse("AI credits exhausted — add credits in workspace settings", 402);
    }
    const text = await upstream.text();
    return errorResponse(`Lovable AI error: ${text}`, upstream.status);
  }
  return new Response(upstream.body, { headers: sseHeaders });
}

// ── Main handler ────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let payload: { messages?: ChatMessage[]; voice_mode?: boolean };
  try {
    payload = await req.json();
  } catch {
    return errorResponse("Invalid JSON body", 400);
  }

  const messages = Array.isArray(payload.messages) ? payload.messages : [];
  if (messages.length === 0) {
    return errorResponse("messages array is required", 400);
  }

  const voiceMode = !!payload.voice_mode;
  const systemPrompt = voiceMode ? VOICE_SYSTEM : TEXT_SYSTEM;
  const maxTokens = voiceMode ? 300 : 1500;

  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

  try {
    if (lovableKey) return await streamLovable(lovableKey, systemPrompt, messages, maxTokens);
    if (geminiKey) return await streamGemini(geminiKey, systemPrompt, messages, maxTokens);
    if (openaiKey) return await streamOpenAI(openaiKey, systemPrompt, messages, maxTokens);
    if (anthropicKey) return await streamAnthropic(anthropicKey, systemPrompt, messages, maxTokens);
  } catch (err) {
    console.error("Provider error", err);
    return errorResponse(err instanceof Error ? err.message : "Provider error");
  }

  return errorResponse("AI backend is not configured.");
});
