import type { GoalProgress, Period } from "./types";

/** "Dynamic Programming, arrays,, " -> ["dynamic programming", "arrays"] */
export function parseTags(input: string): string[] {
  const seen = new Set<string>();
  for (const raw of input.split(",")) {
    const t = raw.trim().toLowerCase();
    if (t) seen.add(t);
  }
  return [...seen];
}

const unit = (period: Period) => (period === "daily" ? "day" : "week");

export function progressLabel(g: Pick<GoalProgress, "count" | "target" | "period">): string {
  return `${g.count} / ${g.target} ${g.period === "daily" ? "today" : "this week"}`;
}

export function progressPercent(g: Pick<GoalProgress, "count" | "target">): number {
  return Math.min(100, Math.round((g.count / g.target) * 100));
}

export function streakLabel(g: Pick<GoalProgress, "current_streak" | "period">): string {
  const n = g.current_streak;
  if (n === 0) return "No streak yet";
  return `${n}-${unit(g.period)} streak`;
}

/** Message under a goal: encourage while the period is still open. */
export function streakHint(g: Pick<GoalProgress, "met" | "current_streak" | "period" | "count" | "target">): string {
  if (g.met) return "Target met — nice.";
  const left = g.target - g.count;
  const when = g.period === "daily" ? "today" : "this week";
  return g.current_streak > 0
    ? `${left} more ${when} to extend your streak.`
    : `${left} more ${when} to start a streak.`;
}
