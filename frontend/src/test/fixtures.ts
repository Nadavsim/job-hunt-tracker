import type { Application, GoalProgress, TodayData } from "../lib/types";

let nextId = 1;

/** Clearly fake test data - never real companies or people. */
export function makeApp(overrides: Partial<Application> = {}): Application {
  const id = overrides.id ?? nextId++;
  return {
    id,
    company: `Example Co ${id}`,
    role: "Junior Engineer",
    job_url: null,
    location: null,
    source: "linkedin",
    stage: "applied",
    date_applied: "2026-03-01",
    notes: null,
    resume_version: null,
    next_follow_up: null,
    archived: false,
    created_at: "2026-03-01T09:00:00",
    updated_at: "2026-03-01T09:00:00",
    history: [{ stage: "applied", changed_at: "2026-03-01T09:00:00" }],
    contacts: [],
    days_in_stage: 0,
    is_stale: false,
    ...overrides,
  };
}

export function makeGoal(overrides: Partial<GoalProgress> = {}): GoalProgress {
  return {
    goal_type: "leetcode",
    label: "LeetCode problems",
    period: "daily",
    period_start: "2026-03-18",
    target: 2,
    enabled: true,
    count: 0,
    met: false,
    today_count: 0,
    current_streak: 0,
    longest_streak: 0,
    ...overrides,
  };
}

export function makeToday(overrides: Partial<TodayData> = {}): TodayData {
  return {
    date: "2026-03-18",
    goals: [
      makeGoal(),
      makeGoal({ goal_type: "course_modules", label: "Course modules", target: 1 }),
      makeGoal({ goal_type: "applications", label: "Applications sent", period: "weekly", target: 10 }),
    ],
    follow_ups: [],
    stale: [],
    ...overrides,
  };
}
