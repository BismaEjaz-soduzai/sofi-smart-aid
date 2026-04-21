import { useEffect, useState } from "react";

export interface Rewards {
  xp: number;
  sessions: number;
  lastDate: string;
  streak: number;
}

const DEFAULT: Rewards = { xp: 0, sessions: 0, lastDate: "", streak: 0 };

function read(): Rewards {
  try {
    const raw = localStorage.getItem("sofi_rewards");
    return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT;
  } catch {
    return DEFAULT;
  }
}

export function useRewards() {
  const [rewards, setRewards] = useState<Rewards>(read);

  useEffect(() => {
    const onUpdate = (e: Event) => {
      const detail = (e as CustomEvent<Rewards>).detail;
      if (detail) setRewards(detail);
      else setRewards(read());
    };
    const onStorage = () => setRewards(read());
    window.addEventListener("sofi-rewards-updated", onUpdate);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("sofi-rewards-updated", onUpdate);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Level system: every 100 XP = 1 level
  const level = Math.floor(rewards.xp / 100) + 1;
  const xpInLevel = rewards.xp % 100;
  const nextLevelXp = 100;

  return { ...rewards, level, xpInLevel, nextLevelXp };
}
