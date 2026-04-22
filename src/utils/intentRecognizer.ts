import { supabase } from "@/integrations/supabase/client";
import { APP_ROUTE_MAP } from "@/config/routeMap";

export type IntentResult = {
  route: string | null;
  name: string | null;
  confidence: "high" | "medium" | "low" | "none";
};

/**
 * Send the spoken / typed phrase to the AI intent recognizer edge function.
 * Returns a route to navigate to, or { route: null } if unclear.
 * Never throws — always resolves so the UI can show a friendly error.
 */
export async function recognizeIntent(speech: string): Promise<IntentResult> {
  const text = (speech || "").trim();
  if (!text) return { route: null, name: null, confidence: "none" };

  try {
    const { data, error } = await supabase.functions.invoke("recognize-intent", {
      body: { speech: text, routes: APP_ROUTE_MAP },
    });
    if (error) {
      console.warn("recognizeIntent invoke error", error);
      return { route: null, name: null, confidence: "none" };
    }
    if (!data || typeof data !== "object") {
      return { route: null, name: null, confidence: "none" };
    }
    const route = typeof data.route === "string" && data.route.startsWith("/") ? data.route : null;
    const name = typeof data.name === "string" ? data.name : null;
    const confidence = (["high", "medium", "low", "none"] as const).includes(data.confidence)
      ? data.confidence
      : "none";
    return { route, name, confidence };
  } catch (err) {
    console.error("recognizeIntent failed", err);
    return { route: null, name: null, confidence: "none" };
  }
}
