import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PenTool, Sparkles, Loader2, Download, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import html2canvas from "html2canvas";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

type Box = { type: "box"; id: string; x: number; y: number; w: number; h: number; label: string; color?: string };
type Arrow = { type: "arrow"; from: string; to: string; label?: string };
type Note = { type: "note"; x: number; y: number; text: string };
type Element = Box | Arrow | Note;

const COLOR_MAP: Record<string, string> = {
  primary: "hsl(var(--primary))",
  info: "hsl(var(--accent))",
  success: "hsl(142 76% 45%)",
  warning: "hsl(38 92% 50%)",
  danger: "hsl(var(--destructive))",
  muted: "hsl(var(--muted-foreground))",
};

function colorOf(c?: string) {
  if (!c) return COLOR_MAP.primary;
  return COLOR_MAP[c] || COLOR_MAP.primary;
}

function tryParseJson(text: string): Element[] | null {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  const slice = text.slice(start, end + 1);
  try {
    const parsed = JSON.parse(slice);
    if (Array.isArray(parsed)) return parsed as Element[];
  } catch {}
  return null;
}

// Auto-layout: if boxes from the AI overlap or sit out of bounds,
// re-flow them onto a clean grid so nothing overlaps.
const CANVAS_W = 800;
const CANVAS_H = 500;
const PAD = 30;
const GAP = 24;

function rectsOverlap(a: Box, b: Box) {
  return !(a.x + a.w + GAP <= b.x || b.x + b.w + GAP <= a.x || a.y + a.h + GAP <= b.y || b.y + b.h + GAP <= a.y);
}

function relayoutIfNeeded(els: Element[]): Element[] {
  const boxes = els.filter((e): e is Box => e.type === "box");
  if (boxes.length === 0) return els;

  let bad = false;
  for (let i = 0; i < boxes.length && !bad; i++) {
    const b = boxes[i];
    if (b.x < 0 || b.y < 0 || b.x + b.w > CANVAS_W || b.y + b.h > CANVAS_H) bad = true;
    for (let j = i + 1; j < boxes.length && !bad; j++) {
      if (rectsOverlap(b, boxes[j])) bad = true;
    }
  }
  if (!bad) return els;

  // Re-flow on a grid
  const n = boxes.length;
  const cols = n <= 3 ? n : n <= 6 ? 3 : 4;
  const rows = Math.ceil(n / cols);
  const cellW = (CANVAS_W - PAD * 2) / cols;
  const cellH = (CANVAS_H - PAD * 2) / rows;
  const boxW = Math.min(160, cellW - GAP);
  const boxH = Math.min(64, cellH - GAP);

  const newBoxes: Box[] = boxes.map((b, i) => {
    const r = Math.floor(i / cols);
    const c = i % cols;
    return {
      ...b,
      x: Math.round(PAD + c * cellW + (cellW - boxW) / 2),
      y: Math.round(PAD + r * cellH + (cellH - boxH) / 2),
      w: Math.round(boxW),
      h: Math.round(boxH),
    };
  });

  const boxMap = new Map(newBoxes.map((b) => [b.id, b]));
  return els.map((e) => {
    if (e.type === "box") return boxMap.get(e.id) || e;
    if (e.type === "note") {
      // clamp notes inside canvas
      return { ...e, x: Math.max(10, Math.min(CANVAS_W - 10, e.x)), y: Math.max(20, Math.min(CANVAS_H - 10, e.y)) };
    }
    return e;
  });
}

const DIAGRAM_SYSTEM = `You are a diagram generator. Given a topic, respond with ONLY a valid JSON array (no markdown, no prose) of diagram elements describing a clear visual explanation of the topic.

Schema (each element is one of):
{ "type": "box", "id": "1", "x": 100, "y": 100, "w": 140, "h": 60, "label": "Text", "color": "primary" }
{ "type": "arrow", "from": "1", "to": "2", "label": "optional" }
{ "type": "note", "x": 100, "y": 200, "text": "italic note text" }

Rules:
- Canvas is 800 wide x 500 tall. Keep all coords inside.
- 3 to 8 boxes max, well spaced (min 40px gap).
- Use colors: primary, info, success, warning, danger, muted.
- IDs must be unique strings.
- Respond with the JSON array ONLY. No code fences. No commentary.`;

const EXPLAIN_SYSTEM = `You are SOFI, a study tutor. Explain the topic clearly in 4-6 short paragraphs using markdown. Reference the diagram concepts the user is seeing.`;

export default function Whiteboard() {
  const [topic, setTopic] = useState("");
  const [elements, setElements] = useState<Element[]>([]);
  const [explanation, setExplanation] = useState("");
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const visualize = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setElements([]);
    setExplanation("");

    // 1) Diagram JSON (non-streaming consume)
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: DIAGRAM_SYSTEM },
            { role: "user", content: topic.trim() },
          ],
        }),
      });
      if (!resp.ok) await throwIfBadResponse(resp, "Whiteboard");
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let raw = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try { const p = JSON.parse(j); const c = p.choices?.[0]?.delta?.content; if (c) raw += c; } catch {}
        }
      }
      const parsed = tryParseJson(raw);
      if (parsed) setElements(parsed);
      else toast.message("Diagram unavailable", { description: "Showing explanation only." });
    } catch (e) {
      handleAiError(e, "Whiteboard");
      setLoading(false);
      return;
    }

    // 2) Streaming explanation
    setStreaming(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: [
            { role: "system", content: EXPLAIN_SYSTEM },
            { role: "user", content: `Explain: ${topic.trim()}` },
          ],
        }),
      });
      if (!resp.ok) await throwIfBadResponse(resp, "Whiteboard");
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, idx); buffer = buffer.slice(idx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const j = line.slice(6).trim();
          if (j === "[DONE]") break;
          try { const p = JSON.parse(j); const c = p.choices?.[0]?.delta?.content; if (c) setExplanation((prev) => prev + c); } catch {}
        }
      }
    } catch (e) {
      handleAiError(e, "Whiteboard");
    } finally {
      setStreaming(false);
      setLoading(false);
    }
  };

  const clear = () => {
    setTopic("");
    setElements([]);
    setExplanation("");
  };

  const exportPng = async () => {
    if (!canvasRef.current) return;
    try {
      const canvas = await html2canvas(canvasRef.current, { backgroundColor: "#ffffff", scale: 2 });
      const link = document.createElement("a");
      link.download = `whiteboard-${Date.now()}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      toast.success("Exported as PNG");
    } catch {
      toast.error("Export failed");
    }
  };

  const boxes = elements.filter((e): e is Box => e.type === "box");
  const arrows = elements.filter((e): e is Arrow => e.type === "arrow");
  const notes = elements.filter((e): e is Note => e.type === "note");
  const boxById = new Map(boxes.map((b) => [b.id, b]));

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-5xl mx-auto p-4 lg:p-6 space-y-5">
        <header className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <PenTool className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI Whiteboard</h1>
            <p className="text-xs text-muted-foreground">Visualize any concept as an animated diagram</p>
          </div>
        </header>

        <div className="glass-card rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-3 flex flex-col sm:flex-row gap-2">
          <input
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") visualize(); }}
            placeholder='Try: "Explain recursion" or "How does TCP/IP work"'
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none px-3 py-2"
          />
          <div className="flex gap-2">
            <button
              onClick={visualize}
              disabled={!topic.trim() || loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Visualize
            </button>
            <button
              onClick={exportPng}
              disabled={elements.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium disabled:opacity-40 hover:bg-muted/80 transition-colors"
              title="Export as PNG"
            >
              <Download className="w-4 h-4" />
            </button>
            <button
              onClick={clear}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-muted text-foreground text-sm font-medium hover:bg-muted/80 transition-colors"
              title="Clear"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div ref={canvasRef} className="rounded-2xl border border-border bg-card overflow-hidden">
          {elements.length === 0 && !loading ? (
            <div className="flex flex-col items-center justify-center h-72 text-muted-foreground gap-2">
              <Sparkles className="w-8 h-8 opacity-50" />
              <p className="text-sm">Type a topic and click Visualize</p>
            </div>
          ) : (
            <svg viewBox="0 0 800 500" className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
              <defs>
                <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto" markerUnits="strokeWidth">
                  <path d="M0,0 L0,6 L9,3 z" fill="hsl(var(--muted-foreground))" />
                </marker>
              </defs>

              {/* Arrows */}
              <AnimatePresence>
                {arrows.map((a, i) => {
                  const from = boxById.get(a.from);
                  const to = boxById.get(a.to);
                  if (!from || !to) return null;
                  const x1 = from.x + from.w / 2;
                  const y1 = from.y + from.h / 2;
                  const x2 = to.x + to.w / 2;
                  const y2 = to.y + to.h / 2;
                  const mx = (x1 + x2) / 2;
                  const my = (y1 + y2) / 2;
                  const delay = (boxes.length + i) * 0.3;
                  return (
                    <motion.g key={`a-${i}`} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.4 }}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="hsl(var(--muted-foreground))" strokeWidth="2" markerEnd="url(#arrowhead)" />
                      {a.label && (
                        <text x={mx} y={my - 6} textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="500">
                          {a.label}
                        </text>
                      )}
                    </motion.g>
                  );
                })}
              </AnimatePresence>

              {/* Boxes */}
              <AnimatePresence>
                {boxes.map((b, i) => (
                  <motion.g key={b.id} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.3, duration: 0.4 }}>
                    <rect
                      x={b.x} y={b.y} width={b.w} height={b.h} rx="10"
                      fill={colorOf(b.color)} fillOpacity="0.15"
                      stroke={colorOf(b.color)} strokeWidth="2"
                    />
                    <text
                      x={b.x + b.w / 2} y={b.y + b.h / 2 + 4}
                      textAnchor="middle" className="fill-foreground"
                      fontSize="13" fontWeight="600"
                    >
                      {b.label}
                    </text>
                  </motion.g>
                ))}
              </AnimatePresence>

              {/* Notes */}
              <AnimatePresence>
                {notes.map((n, i) => (
                  <motion.text
                    key={`n-${i}`}
                    x={n.x} y={n.y}
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    transition={{ delay: (boxes.length + arrows.length + i) * 0.3, duration: 0.4 }}
                    fontSize="12" fontStyle="italic"
                    className="fill-muted-foreground"
                  >
                    {n.text}
                  </motion.text>
                ))}
              </AnimatePresence>
            </svg>
          )}
        </div>

        {(explanation || streaming) && (
          <div className="glass-card rounded-2xl border border-border bg-card/60 backdrop-blur-sm p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" /> SOFI explains
            </h2>
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown>{explanation || "..."}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
