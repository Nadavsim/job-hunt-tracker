import type { NeetCodeTopic } from "./types";

export type NeetCodeFilter = "all" | "unsolved" | "solved";

/** Keep topic order; drop problems (and then empty topics) that don't match. */
export function filterTopics(topics: NeetCodeTopic[], filter: NeetCodeFilter): NeetCodeTopic[] {
  if (filter === "all") return topics;
  const keep = (solved: boolean) => (filter === "solved" ? solved : !solved);
  return topics
    .map((t) => ({ ...t, problems: t.problems.filter((p) => keep(p.first_solved_on !== null)) }))
    .filter((t) => t.problems.length > 0);
}

/** The first topic with anything left: where NeetCode's roadmap says to work next. */
export function nextTopic(topics: NeetCodeTopic[]): string | null {
  return topics.find((t) => t.solved < t.total)?.topic ?? null;
}
