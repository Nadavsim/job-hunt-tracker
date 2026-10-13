import type { WeekSummary } from "./types";

export function percent(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function shortDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Plain-text weekly summary, for pasting into a journal, chat, or accountability thread. */
export function weeklySummaryText(w: WeekSummary): string {
  const parts = [
    `${w.applied} applied`,
    plural(w.responses, "response"),
    plural(w.problems, "problem"),
    plural(w.modules, "module"),
  ];
  const streak = w.longest_streak
    ? `longest streak ${plural(w.longest_streak.length, w.longest_streak.period === "daily" ? "day" : "week")} (${w.longest_streak.label})`
    : "no active streak";
  return `This week (${shortDate(w.week_start)}–${shortDate(w.week_end)}): ${parts.join(", ")}, ${streak}.`;
}
