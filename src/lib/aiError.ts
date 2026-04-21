import { toast } from "sonner";

/**
 * Converts AI / edge function errors into friendly toast notifications.
 * Returns true if the error was handled (caller should not show another toast).
 */
export function handleAiError(err: unknown, context = "AI request"): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? "");
  const lower = msg.toLowerCase();

  // Rate limit
  if (msg.includes("429") || lower.includes("rate limit") || lower.includes("too many requests")) {
    toast.error("⏱️ Slow down — too many requests", {
      description: "Please wait a moment and try again.",
      duration: 5000,
    });
    return true;
  }

  // Payment / credits
  if (msg.includes("402") || lower.includes("payment required") || lower.includes("insufficient") || lower.includes("credits")) {
    toast.error("💳 AI credits exhausted", {
      description: "Add credits in workspace settings to continue.",
      duration: 8000,
    });
    return true;
  }

  // Auth
  if (msg.includes("401") || msg.includes("403") || lower.includes("unauthorized")) {
    toast.error("🔒 Not authorized", {
      description: "Please sign in again.",
      duration: 5000,
    });
    return true;
  }

  // Network
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("load failed")) {
    toast.error("📡 Connection problem", {
      description: "Check your internet and try again.",
      duration: 5000,
    });
    return true;
  }

  // Generic backend
  if (msg.includes("500") || msg.includes("502") || msg.includes("503")) {
    toast.error("🛠️ Backend hiccup", {
      description: "Our AI is taking a breath — try again in a few seconds.",
      duration: 5000,
    });
    return true;
  }

  // Fallback
  toast.error(`${context} failed`, {
    description: msg.slice(0, 140) || "Something went wrong",
    duration: 4000,
  });
  return true;
}

/**
 * Parse an edge-function fetch response and throw with a clean
 * `<status>: <body>` string so handleAiError can classify it.
 */
export async function throwIfBadResponse(resp: Response, context = "Request"): Promise<void> {
  if (resp.ok) return;
  let body = "";
  try {
    const data = await resp.clone().json();
    body = data?.error || JSON.stringify(data);
  } catch {
    body = await resp.text().catch(() => "");
  }
  throw new Error(`${resp.status}: ${body || context + " failed"}`);
}
