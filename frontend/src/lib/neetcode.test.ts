import { describe, expect, it } from "vitest";
import { filterTopics, nextTopic } from "./neetcode";
import type { NeetCodeProblem, NeetCodeTopic } from "./types";

const problem = (slug: string, solved: boolean): NeetCodeProblem => ({
  number: 1,
  title: slug,
  slug,
  topic: "T",
  difficulty: "easy",
  first_solved_on: solved ? "2026-03-01" : null,
  times_solved: solved ? 1 : 0,
});

const topics: NeetCodeTopic[] = [
  { topic: "Arrays & Hashing", total: 2, solved: 2, problems: [problem("a", true), problem("b", true)] },
  { topic: "Two Pointers", total: 2, solved: 1, problems: [problem("c", true), problem("d", false)] },
];

describe("filterTopics", () => {
  it("returns everything for 'all'", () => {
    expect(filterTopics(topics, "all")).toBe(topics);
  });

  it("drops topics with nothing left for 'unsolved'", () => {
    const result = filterTopics(topics, "unsolved");
    expect(result.map((t) => t.topic)).toEqual(["Two Pointers"]);
    expect(result[0].problems.map((p) => p.slug)).toEqual(["d"]);
    expect(result[0].total).toBe(2); // topic totals stay the real totals
  });

  it("keeps only solved problems for 'solved'", () => {
    expect(filterTopics(topics, "solved").flatMap((t) => t.problems.map((p) => p.slug))).toEqual(["a", "b", "c"]);
  });
});

describe("nextTopic", () => {
  it("is the first unfinished topic in roadmap order", () => {
    expect(nextTopic(topics)).toBe("Two Pointers");
    expect(nextTopic([topics[0]])).toBeNull();
  });
});
