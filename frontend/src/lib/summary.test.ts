import { describe, expect, it } from "vitest";
import { percent, weeklySummaryText } from "./summary";
import type { WeekSummary } from "./types";

const week: WeekSummary = {
  week_start: "2026-03-16",
  week_end: "2026-03-22",
  applied: 6,
  responses: 2,
  problems: 9,
  modules: 1,
  mock_interviews: 2,
  outreach: 1,
  longest_streak: { goal_type: "leetcode", label: "LeetCode problems", length: 5, period: "daily" },
};

describe("weeklySummaryText", () => {
  it("matches the agreed format", () => {
    expect(weeklySummaryText(week)).toBe(
      "This week (Mar 16–Mar 22): 6 applied, 2 responses, 9 problems, 1 module, 2 mock interviews, 1 networking action, longest streak 5 days (LeetCode problems).",
    );
  });

  it("handles an empty week without a streak", () => {
    expect(
      weeklySummaryText({
        ...week,
        applied: 0,
        responses: 0,
        problems: 0,
        modules: 0,
        mock_interviews: 0,
        outreach: 0,
        longest_streak: null,
      }),
    ).toBe(
      "This week (Mar 16–Mar 22): 0 applied, 0 responses, 0 problems, 0 modules, 0 mock interviews, 0 networking actions, no active streak.",
    );
  });

  it("uses weeks for weekly goals", () => {
    const w = { ...week, longest_streak: { ...week.longest_streak!, period: "weekly" as const, length: 1 } };
    expect(weeklySummaryText(w)).toContain("longest streak 1 week (");
  });
});

describe("percent", () => {
  it("rounds and shows a dash for no data", () => {
    expect(percent(0.4)).toBe("40%");
    expect(percent(2 / 3)).toBe("67%");
    expect(percent(null)).toBe("—");
  });
});
