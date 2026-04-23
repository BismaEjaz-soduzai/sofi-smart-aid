import { format } from "date-fns";

const LEDGER_KEY = "sofi_rewards_ledger";
const REWARDS_KEY = "sofi_rewards";

function loadLedger(): Set<string> {
  try {
    const raw = localStorage.getItem(LEDGER_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function saveLedger(set: Set<string>) {
  try {
    // bound the ledger to the most recent 500 entries
    const arr = Array.from(set).slice(-500);
    localStorage.setItem(LEDGER_KEY, JSON.stringify(arr));
  } catch {
    /* noop */
  }
}

/**
 * Award XP idempotently. Same key never increments twice — safe across
 * fast double-toggles, page revisits, or remounts.
 *
 * Returns true if XP was awarded, false if it was a duplicate.
 */
export function awardXpOnce(key: string, xp: number): boolean {
  const ledger = loadLedger();
  if (ledger.has(key)) return false;
  ledger.add(key);
  saveLedger(ledger);

  try {
    const raw = localStorage.getItem(REWARDS_KEY);
    const cur = raw ? JSON.parse(raw) : { xp: 0, sessions: 0, lastDate: "", streak: 0 };
    const today = format(new Date(), "yyyy-MM-dd");
    let streak = cur.streak || 0;
    if (cur.lastDate !== today) {
      const yesterday = format(new Date(Date.now() - 86_400_000), "yyyy-MM-dd");
      streak = cur.lastDate === yesterday ? streak + 1 : 1;
    }
    const next = {
      xp: (cur.xp || 0) + xp,
      sessions: (cur.sessions || 0) + 1,
      lastDate: today,
      streak,
    };
    localStorage.setItem(REWARDS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("sofi-rewards-updated", { detail: next }));
  } catch {
    /* noop */
  }
  return true;
}

/** Remove an entry from the ledger (e.g. when user un-completes a session) */
export function revokeXpKey(key: string) {
  const ledger = loadLedger();
  if (ledger.delete(key)) saveLedger(ledger);
}
