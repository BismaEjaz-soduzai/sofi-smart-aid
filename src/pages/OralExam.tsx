import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Loader2, Send, RotateCcw, Sparkles, Download, ArrowRight, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { handleAiError, throwIfBadResponse } from "@/lib/aiError";
import { awardXpOnce } from "@/hooks/useRewardLedger";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import jsPDF from "jspdf";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/study-chat`;

type Difficulty = "Easy" | "Medium" | "Hard";
type Phase = "setup" | "exam" | "results";

interface QResult {
  question: string;
  answer: string;
  score: number;
  feedback: string;
  correct_answer: string;
}

async function callChat(messages: { role: "user" | "assistant" | "system"; content: string }[]): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages }),
  });
  if (!resp.ok) await throwIfBadResponse(resp, "Oral Exam");
  if (!resp.body) throw new Error("No response body");
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let out = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (!line.startsWith("data: ")) continue;
      const json = line.slice(6).trim();
      if (json === "[DONE]") break;
      try {
        const p = JSON.parse(json);
        const c = p.choices?.[0]?.delta?.content;
        if (c) out += c;
      } catch { /* skip */ }
    }
  }
  return out;
}

function speak(text: string, onEnd?: () => void) {
  if (!("speechSynthesis" in window)) { onEnd?.(); return; }
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 0.95;
  u.onend = () => onEnd?.();
  speechSynthesis.speak(u);
}

function gradeLetter(pct: number): string {
  if (pct >= 90) return "A";
  if (pct >= 75) return "B";
  if (pct >= 60) return "C";
  if (pct >= 45) return "D";
  return "F";
}

function scoreColor(score: number): string {
  if (score >= 7) return "bg-green-500/15 text-green-600 border-green-500/30";
  if (score >= 4) return "bg-yellow-500/15 text-yellow-600 border-yellow-500/30";
  return "bg-red-500/15 text-red-600 border-red-500/30";
}

export default function OralExam() {
  const [phase, setPhase] = useState<Phase>("setup");
  const [subject, setSubject] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Medium");
  const [count, setCount] = useState(5);

  const [qIndex, setQIndex] = useState(0);
  const [currentQ, setCurrentQ] = useState("");
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [loadingQ, setLoadingQ] = useState(false);
  const [grading, setGrading] = useState(false);
  const [lastResult, setLastResult] = useState<QResult | null>(null);
  const [results, setResults] = useState<QResult[]>([]);
  const askedRef = useRef<string[]>([]);
  const recognitionRef = useRef<any>(null);

  useEffect(() => () => { try { recognitionRef.current?.stop(); } catch {} speechSynthesis?.cancel(); }, []);

  const fetchNextQuestion = async () => {
    setLoadingQ(true);
    setTranscript("");
    setLastResult(null);
    try {
      const prior = askedRef.current.length
        ? `Already asked (do not repeat): ${askedRef.current.map((q, i) => `${i + 1}) ${q}`).join(" ")}`
        : "";
      const prompt = `Generate ONE oral exam question on "${subject}" at ${difficulty} difficulty. Return ONLY the question text, no numbering, no quotes, no preamble. ${prior}`;
      const out = await callChat([{ role: "user", content: prompt }]);
      const question = out.replace(/^["']|["']$/g, "").trim();
      askedRef.current.push(question);
      setCurrentQ(question);
      speak(question);
    } catch (e: any) {
      handleAiError(e, "Oral Exam");
    } finally {
      setLoadingQ(false);
    }
  };

  const startExam = async () => {
    if (!subject.trim()) { toast.error("Enter a subject"); return; }
    askedRef.current = [];
    setResults([]);
    setQIndex(0);
    setPhase("exam");
    await fetchNextQuestion();
  };

  const toggleMic = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { toast.error("Speech recognition not supported in this browser"); return; }
    if (listening) {
      try { recognitionRef.current?.stop(); } catch {}
      setListening(false);
      return;
    }
    speechSynthesis.cancel();
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      let final = "";
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += t;
        else interim += t;
      }
      setTranscript((prev) => (final ? (prev + " " + final).trim() : prev + (interim ? "" : "")));
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
  };

  const submitAnswer = async () => {
    if (!transcript.trim()) { toast.error("Record an answer first"); return; }
    setGrading(true);
    try { recognitionRef.current?.stop(); } catch {}
    setListening(false);
    try {
      const sys = "You are an examiner. Grade this answer out of 10. Give a score, one sentence of feedback, and the correct answer. Be encouraging. Return JSON: {score: number, feedback: string, correct_answer: string}";
      const user = `Subject: ${subject}\nDifficulty: ${difficulty}\nQuestion: ${currentQ}\nStudent Answer: ${transcript}\n\nReturn ONLY valid JSON, no markdown, no code fences.`;
      const out = await callChat([
        { role: "system", content: sys },
        { role: "user", content: user },
      ]);
      const cleaned = out.replace(/```json|```/g, "").trim();
      const match = cleaned.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : cleaned);
      const result: QResult = {
        question: currentQ,
        answer: transcript,
        score: Math.max(0, Math.min(10, Number(parsed.score) || 0)),
        feedback: String(parsed.feedback || ""),
        correct_answer: String(parsed.correct_answer || ""),
      };
      setLastResult(result);
      setResults((prev) => [...prev, result]);
      awardXpOnce(`oral-exam-q-${Date.now()}-${Math.random()}`, 10);
    } catch (e: any) {
      handleAiError(e, "Oral Exam");
    } finally {
      setGrading(false);
    }
  };

  const nextQuestion = async () => {
    if (qIndex + 1 >= count) {
      awardXpOnce(`oral-exam-complete-${Date.now()}`, 50);
      setPhase("results");
      return;
    }
    setQIndex((i) => i + 1);
    await fetchNextQuestion();
  };

  const retry = () => {
    askedRef.current = [];
    setResults([]);
    setQIndex(0);
    setLastResult(null);
    setTranscript("");
    setPhase("setup");
  };

  const exportPdf = () => {
    const doc = new jsPDF();
    const total = results.reduce((s, r) => s + r.score, 0);
    const max = results.length * 10;
    const pct = max ? Math.round((total / max) * 100) : 0;
    doc.setFontSize(18);
    doc.text("SOFI Oral Exam Results", 14, 18);
    doc.setFontSize(11);
    doc.text(`Subject: ${subject}`, 14, 28);
    doc.text(`Difficulty: ${difficulty}`, 14, 35);
    doc.text(`Score: ${total} / ${max}  (${pct}%)  Grade: ${gradeLetter(pct)}`, 14, 42);
    let y = 54;
    results.forEach((r, i) => {
      if (y > 260) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.text(`Q${i + 1} (${r.score}/10): `, 14, y);
      doc.setFont("helvetica", "normal");
      const wrap = (t: string) => doc.splitTextToSize(t, 180);
      const q = wrap(r.question); doc.text(q, 14, y + 6); y += 6 + q.length * 5;
      const a = wrap(`Your answer: ${r.answer}`); doc.text(a, 14, y + 2); y += 2 + a.length * 5;
      const f = wrap(`Feedback: ${r.feedback}`); doc.text(f, 14, y + 2); y += 2 + f.length * 5;
      const c = wrap(`Correct: ${r.correct_answer}`); doc.text(c, 14, y + 2); y += 2 + c.length * 5 + 4;
    });
    doc.save(`oral-exam-${subject.replace(/\s+/g, "-")}.pdf`);
  };

  const totalScore = results.reduce((s, r) => s + r.score, 0);
  const maxScore = results.length * 10;
  const pct = maxScore ? Math.round((totalScore / maxScore) * 100) : 0;
  const chartData = results.map((r, i) => ({ name: `Q${i + 1}`, score: r.score }));

  return (
    <div className="max-w-3xl mx-auto p-4 lg:p-8">
      {phase === "setup" && (
        <Card className="p-6 lg:p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Oral Exam with SOFI</h1>
            <p className="text-sm text-muted-foreground mt-1">Practice viva-style questions and get instant feedback.</p>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Subject</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Operating Systems" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Difficulty</Label>
                <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Easy">Easy</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="Hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Questions</Label>
                <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="3">3</SelectItem>
                    <SelectItem value="5">5</SelectItem>
                    <SelectItem value="10">10</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button onClick={startExam} className="w-full" size="lg">Start Exam</Button>
          </div>
        </Card>
      )}

      {phase === "exam" && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
              <span>Question {qIndex + 1} of {count}</span>
              <span>{subject} • {difficulty}</span>
            </div>
            <Progress value={((qIndex) / count) * 100} className="h-2" />
          </div>

          <Card className="p-6 space-y-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Question</div>
            {loadingQ ? (
              <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="w-4 h-4 animate-spin" /> Generating question…</div>
            ) : (
              <p className="text-lg font-medium leading-relaxed">{currentQ}</p>
            )}
            <Button variant="ghost" size="sm" onClick={() => speak(currentQ)} disabled={!currentQ}>🔊 Hear again</Button>
          </Card>

          <Card className="p-6 space-y-4">
            <div className="flex flex-col items-center gap-3">
              <button
                onClick={toggleMic}
                disabled={loadingQ || grading}
                className={`relative w-20 h-20 rounded-full flex items-center justify-center transition-all ${
                  listening ? "bg-red-500 text-white" : "bg-primary text-primary-foreground hover:scale-105"
                }`}
              >
                {listening && (
                  <span className="absolute inset-0 rounded-full border-4 border-red-500 animate-ping" />
                )}
                {listening ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
              </button>
              <p className="text-xs text-muted-foreground">{listening ? "Listening… tap to stop" : "Tap mic to record your answer"}</p>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Transcript</Label>
              <textarea
                value={transcript}
                onChange={(e) => setTranscript(e.target.value)}
                placeholder="Your spoken answer will appear here…"
                className="w-full min-h-24 rounded-md border border-input bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>

            <Button onClick={submitAnswer} disabled={grading || !transcript.trim()} className="w-full">
              {grading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Grading…</> : <><Send className="w-4 h-4 mr-2" /> Submit Answer</>}
            </Button>
          </Card>

          <AnimatePresence>
            {lastResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
                <Card className="p-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="text-xs uppercase tracking-wider text-muted-foreground">Result</div>
                    <Badge className={`text-base px-3 py-1 border ${scoreColor(lastResult.score)}`}>
                      {lastResult.score} / 10
                    </Badge>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Feedback</div>
                    <p className="text-sm">{lastResult.feedback}</p>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-muted-foreground mb-1">Correct answer</div>
                    <p className="text-sm">{lastResult.correct_answer}</p>
                  </div>
                  <Button onClick={nextQuestion} className="w-full" disabled={loadingQ}>
                    {qIndex + 1 >= count ? "See Results" : "Next Question"} <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {phase === "results" && (
        <Card className="p-6 lg:p-8 space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Trophy className="w-6 h-6 text-primary" />
            </div>
            <h2 className="text-2xl font-bold">Exam Complete!</h2>
            <p className="text-sm text-muted-foreground">{subject} • {difficulty}</p>
          </div>

          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="rounded-lg bg-muted/40 p-4">
              <div className="text-2xl font-bold">{totalScore}/{maxScore}</div>
              <div className="text-xs text-muted-foreground mt-1">Score</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <div className="text-2xl font-bold">{pct}%</div>
              <div className="text-xs text-muted-foreground mt-1">Percentage</div>
            </div>
            <div className="rounded-lg bg-muted/40 p-4">
              <div className="text-2xl font-bold">{gradeLetter(pct)}</div>
              <div className="text-xs text-muted-foreground mt-1">Grade</div>
            </div>
          </div>

          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis domain={[0, 10]} stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="score" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={exportPdf} variant="default"><Download className="w-4 h-4 mr-2" /> Export PDF</Button>
            <Button onClick={() => { askedRef.current = []; setResults([]); setQIndex(0); setLastResult(null); setTranscript(""); setPhase("exam"); fetchNextQuestion(); }} variant="outline"><RotateCcw className="w-4 h-4 mr-2" /> Retry</Button>
            <Button onClick={retry} variant="ghost">New Subject</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
