import type { Application } from "../lib/types";

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
