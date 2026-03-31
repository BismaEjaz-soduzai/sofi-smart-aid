import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, CheckSquare, StickyNote, Calendar, ArrowRight } from "lucide-react";
import { useTasks } from "@/hooks/useTasks";
import { useNotes } from "@/hooks/useNotes";
import { usePlans } from "@/hooks/usePlans";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  type: "task" | "note" | "plan";
  route: string;
}

const typeConfig = {
  task: { icon: CheckSquare, label: "Task", color: "text-blue-500" },
  note: { icon: StickyNote, label: "Note", color: "text-amber-500" },
  plan: { icon: Calendar, label: "Plan", color: "text-violet-500" },
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const { data: tasks } = useTasks();
  const { data: notes } = useNotes();
  const { data: plans } = usePlans();

  // Keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const q = query.toLowerCase().trim();

  const results: SearchResult[] = !q ? [] : [
    ...(tasks || [])
      .filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(t => ({ id: t.id, title: t.title, subtitle: t.category, type: "task" as const, route: "/tasks" })),
    ...(notes || [])
      .filter(n => n.title.toLowerCase().includes(q) || n.content?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(n => ({ id: n.id, title: n.title, subtitle: n.category, type: "note" as const, route: "/notes" })),
    ...(plans || [])
      .filter(p => p.title.toLowerCase().includes(q) || p.goal?.toLowerCase().includes(q))
      .slice(0, 5)
      .map(p => ({ id: p.id, title: p.title, subtitle: p.category, type: "plan" as const, route: "/planner" })),
  ];

  useEffect(() => { setSelectedIdx(0); }, [query]);

  const handleSelect = (result: SearchResult) => {
    navigate(result.route);
    setOpen(false);
    setQuery("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)); }
    if (e.key === "ArrowUp") { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && results[selectedIdx]) { handleSelect(results[selectedIdx]); }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 bg-muted/60 rounded-lg px-3 py-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="text-xs hidden sm:inline">Search...</span>
        <kbd className="hidden lg:inline text-[10px] bg-background border border-border rounded px-1.5 py-0.5 ml-2 font-mono">⌘K</kbd>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40" />
      
      <div ref={containerRef} className="fixed top-16 left-1/2 -translate-x-1/2 w-full max-w-lg z-50 px-4">
        <div className="bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {/* Input */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search tasks, notes, plans..."
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 outline-none"
            />
            <button onClick={() => { setOpen(false); setQuery(""); }} className="text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {q && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                No results for "{query}"
              </div>
            )}
            {results.map((r, i) => {
              const cfg = typeConfig[r.type];
              return (
                <button
                  key={`${r.type}-${r.id}`}
                  onClick={() => handleSelect(r)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIdx ? "bg-accent" : "hover:bg-muted/50"
                  }`}
                >
                  <cfg.icon className={`w-4 h-4 flex-shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground capitalize">{r.subtitle}</p>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{cfg.label}</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground" />
                </button>
              );
            })}
            {!q && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                Type to search across tasks, notes, and plans
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
