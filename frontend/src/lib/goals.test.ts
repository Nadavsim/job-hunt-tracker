import { describe, expect, it } from "vitest";
import { parseTags, progressLabel, progressPercent, streakHint, streakLabel } from "./goals";

describe("parseTags", () => {
  it("splits, trims, lowercases and dedupes", () => {
    expect(parseTags(" Dynamic Programming, arrays,,Arrays ")).toEqual(["dynamic programming", "arrays"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("goal labels", () => {
  it("formats progress for daily and weekly goals", () => {
    expect(progressLabel({ count: 1, target: 2, period: "daily" })).toBe("1 / 2 today");
    expect(progressLabel({ count: 4, target: 10, period: "weekly" })).toBe("4 / 10 this week");
  });

  it("caps the progress bar at 100%", () => {
    expect(progressPercent({ count: 3, target: 2 })).toBe(100);
    expect(progressPercent({ count: 1, target: 3 })).toBe(33);
  });

  it("names the streak unit", () => {
    expect(streakLabel({ current_streak: 0, period: "daily" })).toBe("No streak yet");
    expect(streakLabel({ current_streak: 3, period: "daily" })).toBe("3-day streak");
    expect(streakLabel({ current_streak: 2, period: "weekly" })).toBe("2-week streak");
  });

  it("explains what is left without implying the streak is already lost", () => {
    expect(streakHint({ met: false, current_streak: 4, period: "daily", count: 1, target: 2 })).toBe(
      "1 more today to extend your streak.",
    );
    expect(streakHint({ met: true, current_streak: 5, period: "daily", count: 2, target: 2 })).toBe("Target met — nice.");
  });
});

describe("GOAL_LOG_LINKS", () => {
  it("points every goal at the page where it is logged", async () => {
    const { GOAL_LOG_LINKS } = await import("./goals");
    expect(GOAL_LOG_LINKS.mock_interviews).toBe("/mocks");
    expect(GOAL_LOG_LINKS.networking).toBe("/networking");
    expect(Object.keys(GOAL_LOG_LINKS)).toHaveLength(5);
  });
});
