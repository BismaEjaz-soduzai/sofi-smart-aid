import { supabase } from "@/integrations/supabase/client";
import { APP_ROUTE_MAP, type AppRouteEntry } from "@/config/routeMap";

export type IntentResult = {
  route: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low" | "none";
  source?: "local" | "ai";
};

/**
 * Normalize a phrase for matching: lowercase, remove punctuation, collapse spaces.
 * Also fold common Roman-Urdu / Urdu suffixes ("kholo", "dikhao", "le chal", "mein", etc.)
 * so they don't dilute the keyword score.
 */
const FILLER_WORDS = new Set([
  // English
  "open", "show", "go", "to", "the", "a", "an", "me", "my", "please", "now",
  "take", "navigate", "view", "see", "page", "section", "tab", "into",
  // Roman Urdu
  "kholo", "kholdo", "kholdo", "dikhao", "dikha", "dikhayein", "lao", "le",
  "chal", "chalo", "chalein", "jao", "jaayein", "kar", "karo", "kr", "krdo",
  "mein", "mai", "main", "ko", "ka", "ki", "ke", "par", "pe", "wala",
  "mujhe", "mujhko", "hum", "hamein", "ap", "aap", "yaar",
]);

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[.,!?;:'"`~()[\]{}<>/\\|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length > 0 && !FILLER_WORDS.has(t));
}

/**
 * Score one route entry against the user phrase.
 * - +5 for full keyword phrase match (multi-word like "ai room")
 * - +3 for token-level keyword hit
 * - +2 for token in route name
 * Returns numeric score; higher = better.
 */
function scoreEntry(entry: AppRouteEntry, phrase: string, phraseTokens: string[]): number {
  const phraseNorm = normalize(phrase);
  let score = 0;

  for (const kw of entry.keywords) {
    const kwNorm = normalize(kw);
    if (!kwNorm) continue;
    // Full multi-word match
    if (kwNorm.includes(" ") && phraseNorm.includes(kwNorm)) {
      score += 6;
      continue;
    }
    // Single-token match
    if (phraseTokens.includes(kwNorm)) {
      score += 4;
    } else if (kwNorm.length > 4 && phraseNorm.includes(kwNorm)) {
      // Substring match for longer keywords (handles "recordings" vs "recording")
      score += 3;
    }
  }

  // Bonus: words from the human-friendly name
  const nameTokens = tokens(entry.name);
  for (const t of nameTokens) {
    if (phraseTokens.includes(t)) score += 2;
  }

  return score;
}

/**
 * Fast on-device matcher. Returns a high-confidence match if one entry
 * clearly wins, otherwise null so the caller can fall back to the AI.
 */
export function matchIntentLocally(speech: string): IntentResult | null {
  const phrase = normalize(speech);
  if (!phrase) return null;
  const phraseTokens = tokens(speech);
  if (phraseTokens.length === 0) return null;

  let best: { entry: AppRouteEntry; score: number } | null = null;
  let runnerUp = 0;

  for (const entry of APP_ROUTE_MAP) {
    const s = scoreEntry(entry, speech, phraseTokens);
    if (!best || s > best.score) {
      runnerUp = best?.score ?? 0;
      best = { entry, score: s };
    } else if (s > runnerUp) {
      runnerUp = s;
    }
  }

  if (!best || best.score < 4) return null;

  // Confidence: clear winner = high, narrow win = medium
  const margin = best.score - runnerUp;
  const confidence: IntentResult["confidence"] =
    best.score >= 6 && margin >= 2 ? "high" : best.score >= 4 ? "medium" : "low";

  return {
    route: best.entry.route,
    name: best.entry.name,
    confidence,
    source: "local",
  };
}

/**
 * Recognize intent from a free-form phrase.
 *  1. Try the fast local matcher first (instant, no network, no credits).
 *  2. If that doesn't yield a confident match, ask the AI edge function.
 *
 * Always resolves — never throws.
 */
export async function recognizeIntent(speech: string): Promise<IntentResult> {
  const text = (speech || "").trim();
  if (!text) return { route: null, name: null, confidence: "none" };

  // 1) Local match — covers ~90% of real phrases instantly.
  const local = matchIntentLocally(text);
  if (local && local.confidence !== "low") {
    return local;
  }

  // 2) Fall back to AI for ambiguous / natural language phrases.
  try {
    const { data, error } = await supabase.functions.invoke("recognize-intent", {
      body: { speech: text, routes: APP_ROUTE_MAP },
    });
    if (error) {
      console.warn("recognizeIntent invoke error", error);
      // If we had a low-confidence local match, return it rather than nothing.
      return local ?? { route: null, name: null, confidence: "none" };
    }
    if (!data || typeof data !== "object") {
      return local ?? { route: null, name: null, confidence: "none" };
    }
    const route = typeof data.route === "string" && data.route.startsWith("/") ? data.route : null;
    const name = typeof data.name === "string" ? data.name : null;
    const confidence = (["high", "medium", "low", "none"] as const).includes(data.confidence)
      ? data.confidence
      : "none";

    if (!route && local) return local; // prefer local low-confidence over null
    return { route, name, confidence, source: "ai" };
  } catch (err) {
    console.error("recognizeIntent failed", err);
    return local ?? { route: null, name: null, confidence: "none" };
  }
}
