// Pure helpers for the applications table: filtering and sorting run in the
// browser because the data set is small (a job hunt is hundreds of rows).
import { STAGES, type Application, type Source, type Stage } from "./types";

export interface ApplicationFilter {
  text: string;
  stages: Stage[]; // empty = all
  source: Source | "";
}

export const EMPTY_FILTER: ApplicationFilter = { text: "", stages: [], source: "" };

export type SortKey = "company" | "role" | "stage" | "source" | "date_applied" | "next_follow_up" | "days_in_stage";
export interface Sort {
  key: SortKey;
  dir: "asc" | "desc";
}

export function filterApplications(apps: Application[], f: ApplicationFilter): Application[] {
  const needle = f.text.trim().toLowerCase();
  return apps.filter((a) => {
    if (f.stages.length && !f.stages.includes(a.stage)) return false;
    if (f.source && a.source !== f.source) return false;
    if (!needle) return true;
    return [a.company, a.role, a.location, a.notes, a.resume_version]
      .filter(Boolean)
      .some((s) => s!.toLowerCase().includes(needle));
  });
}

function sortValue(a: Application, key: SortKey): string | number | null {
  if (key === "stage") return STAGES.indexOf(a.stage);
  if (key === "days_in_stage") return a.days_in_stage;
  const v = a[key];
  return typeof v === "string" ? v.toLowerCase() : v;
}

/** Stable sort; empty values always go last regardless of direction. */
export function sortApplications(apps: Application[], sort: Sort): Application[] {
  const mult = sort.dir === "asc" ? 1 : -1;
  return [...apps].sort((a, b) => {
    const va = sortValue(a, sort.key);
    const vb = sortValue(b, sort.key);
    if (va === vb) return 0;
    if (va === null || va === "") return 1;
    if (vb === null || vb === "") return -1;
    return (va < vb ? -1 : 1) * mult;
  });
}

export function groupByStage(apps: Application[]): Record<Stage, Application[]> {
  const groups = Object.fromEntries(STAGES.map((s) => [s, [] as Application[]])) as Record<Stage, Application[]>;
  for (const a of apps) groups[a.stage].push(a);
  return groups;
}
