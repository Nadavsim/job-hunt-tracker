// Mirrors backend/app/schemas.py. Dates are ISO strings ("2026-03-18"),
// datetimes are local wall-clock ISO strings without a timezone.

export const STAGES = [
  "wishlist",
  "applied",
  "online_assessment",
  "phone_screen",
  "interview",
  "offer",
  "rejected",
  "ghosted",
  "withdrawn",
] as const;
export type Stage = (typeof STAGES)[number];

export const SOURCES = ["linkedin", "referral", "company_site", "other"] as const;
export type Source = (typeof SOURCES)[number];

export interface StageChange {
  stage: Stage;
  changed_at: string;
}

export interface ContactRef {
  id: number;
  name: string;
}

export interface Application {
  id: number;
  company: string;
  role: string;
  job_url: string | null;
  location: string | null;
  source: Source;
  stage: Stage;
  date_applied: string | null;
  notes: string | null;
  resume_version: string | null;
  next_follow_up: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
  history: StageChange[];
  contacts: ContactRef[];
  days_in_stage: number;
  is_stale: boolean;
}

export type ApplicationInput = Partial<
  Omit<Application, "id" | "created_at" | "updated_at" | "history" | "contacts" | "days_in_stage" | "is_stale">
> & { contact_ids?: number[] };

export interface Contact {
  id: number;
  name: string;
  role: string | null;
  email: string | null;
  linkedin: string | null;
  notes: string | null;
  application_ids: number[];
  outreach_count: number;
  last_contacted: string | null;
}

export type ContactInput = Partial<Omit<Contact, "id" | "outreach_count" | "last_contacted">>;

// ------------------------------------------------------------------ goals

export type Difficulty = "easy" | "medium" | "hard";
export const PLATFORMS = ["leetcode", "neetcode", "other"] as const;
export type Platform = (typeof PLATFORMS)[number];
export type GoalType = "leetcode" | "course_modules" | "applications" | "mock_interviews" | "networking";
export type Period = "daily" | "weekly";

export interface LeetCodeLog {
  id: number;
  problem: string;
  number: number | null;
  slug: string;
  difficulty: Difficulty | null;
  tags: string[];
  solved_without_hints: boolean | null;
  notes: string | null;
  solved_on: string;
  source: "manual" | "sync";
  platform: Platform;
}

export type LeetCodeInput = Partial<Omit<LeetCodeLog, "id" | "slug" | "source">>;

export interface ModuleCompletion {
  id: number;
  course_id: number;
  completed_on: string;
  note: string | null;
}

export interface Course {
  id: number;
  name: string;
  total_modules: number;
  archived: boolean;
  modules_completed: number;
  completions: ModuleCompletion[];
}

export interface GoalTarget {
  goal_type: GoalType;
  period: Period;
  target: number;
  enabled: boolean;
}

export interface GoalProgress extends GoalTarget {
  label: string;
  period_start: string;
  count: number;
  met: boolean;
  today_count: number;
  current_streak: number;
  longest_streak: number;
}

export interface TodayData {
  date: string;
  goals: GoalProgress[];
  follow_ups: Application[];
  stale: Application[];
}

// --------------------------------------------------------------- dashboard

export interface RateRow {
  applied: number;
  responded: number;
  rate: number | null;
}

export interface DashboardData {
  applications: {
    wishlist: number;
    total_applied: number;
    total_responded: number;
    response_rate: number | null;
    median_days_to_response: number | null;
    funnel: { stage: Stage; count: number }[];
    outcomes: { stage: Stage; count: number }[];
    by_source: (RateRow & { source: Source })[];
    by_resume: (RateRow & { resume_version: string; enough_data: boolean })[];
    min_resume_sample: number;
  };
  leetcode: {
    total: number;
    by_difficulty: { difficulty: Difficulty | "unknown"; count: number }[];
    by_platform: { platform: Platform; count: number }[];
    by_tag: { tag: string; count: number }[];
    without_hints: number;
    hints_known: number;
    without_hints_rate: number | null;
  };
  neetcode150: { solved: number; total: number };
  mock_interviews: { total: number; by_kind: { kind: MockKind; count: number; avg_rating: number | null }[] };
  networking: { total: number; people_reached: number; by_kind: { kind: OutreachKind; count: number }[] };
  week: WeekSummary;
}

export interface WeekSummary {
  week_start: string;
  week_end: string;
  applied: number;
  responses: number;
  problems: number;
  modules: number;
  mock_interviews: number;
  outreach: number;
  longest_streak: { goal_type: GoalType; label: string; length: number; period: Period } | null;
}

// ---------------------------------------------------------------- settings

export interface Settings {
  leetcode_username: string | null;
  leetcode_last_sync: string | null;
}

export interface SyncResult {
  fetched: number;
  imported: number;
  skipped_duplicates: number;
  last_sync: string;
}

// ---------------------------------------------------------------- neetcode

export interface NeetCodeProblem {
  number: number;
  title: string;
  slug: string;
  topic: string;
  difficulty: Difficulty;
  first_solved_on: string | null;
  times_solved: number;
}

export interface NeetCodeTopic {
  topic: string;
  total: number;
  solved: number;
  problems: NeetCodeProblem[];
}

export interface NeetCodeChecklist {
  total: number;
  solved: number;
  topics: NeetCodeTopic[];
}

// ------------------------------------------------- mock interviews / networking

export const MOCK_KINDS = ["technical", "behavioral", "system_design", "other"] as const;
export type MockKind = (typeof MOCK_KINDS)[number];

export interface MockInterview {
  id: number;
  held_on: string;
  kind: MockKind;
  partner: string | null;
  self_rating: number | null;
  notes: string | null;
}

export type MockInterviewInput = Partial<Omit<MockInterview, "id">>;

export const OUTREACH_KINDS = ["message", "coffee_chat", "referral_ask", "follow_up", "other"] as const;
export type OutreachKind = (typeof OUTREACH_KINDS)[number];

export interface Outreach {
  id: number;
  contact_id: number | null;
  contact_name: string | null;
  kind: OutreachKind;
  happened_on: string;
  notes: string | null;
}

export interface OutreachInput {
  contact_id?: number | null;
  new_contact_name?: string | null;
  kind?: OutreachKind;
  happened_on?: string;
  notes?: string | null;
}
