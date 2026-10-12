import { describe, expect, it } from "vitest";
import { makeApp } from "../test/fixtures";
import { EMPTY_FILTER, filterApplications, groupByStage, sortApplications } from "./applications";

describe("filterApplications", () => {
  const apps = [
    makeApp({ company: "Acme Widgets", role: "Backend Engineer", stage: "applied", source: "linkedin" }),
    makeApp({ company: "Globex Example", role: "Frontend Dev", stage: "interview", source: "referral", notes: "great team" }),
    makeApp({ company: "Initech Sample", role: "Data Analyst", stage: "rejected", source: "company_site" }),
  ];

  it("returns everything with an empty filter", () => {
    expect(filterApplications(apps, EMPTY_FILTER)).toHaveLength(3);
  });

  it("matches text case-insensitively across company, role and notes", () => {
    expect(filterApplications(apps, { ...EMPTY_FILTER, text: "BACKEND" }).map((a) => a.company)).toEqual(["Acme Widgets"]);
    expect(filterApplications(apps, { ...EMPTY_FILTER, text: "great" }).map((a) => a.company)).toEqual(["Globex Example"]);
  });

  it("filters by stages and source together", () => {
    const f = { text: "", stages: ["applied", "interview"] as const, source: "referral" as const };
    expect(filterApplications(apps, { ...f, stages: [...f.stages] }).map((a) => a.company)).toEqual(["Globex Example"]);
  });
});

describe("sortApplications", () => {
  const a = makeApp({ company: "beta", date_applied: "2026-03-05", stage: "offer" });
  const b = makeApp({ company: "Alpha", date_applied: null, stage: "wishlist" });
  const c = makeApp({ company: "gamma", date_applied: "2026-03-01", stage: "applied" });

  it("sorts strings case-insensitively", () => {
    expect(sortApplications([a, b, c], { key: "company", dir: "asc" }).map((x) => x.company)).toEqual(["Alpha", "beta", "gamma"]);
  });

  it("puts empty values last in both directions", () => {
    expect(sortApplications([a, b, c], { key: "date_applied", dir: "asc" }).map((x) => x.company)).toEqual(["gamma", "beta", "Alpha"]);
    expect(sortApplications([a, b, c], { key: "date_applied", dir: "desc" }).map((x) => x.company)).toEqual(["beta", "gamma", "Alpha"]);
  });

  it("sorts stage by pipeline order, not alphabetically", () => {
    expect(sortApplications([a, b, c], { key: "stage", dir: "asc" }).map((x) => x.stage)).toEqual(["wishlist", "applied", "offer"]);
  });

  it("does not mutate the input", () => {
    const input = [a, b, c];
    sortApplications(input, { key: "company", dir: "asc" });
    expect(input).toEqual([a, b, c]);
  });
});

describe("groupByStage", () => {
  it("has a (possibly empty) bucket for every stage", () => {
    const groups = groupByStage([makeApp({ stage: "offer" })]);
    expect(Object.keys(groups)).toHaveLength(9);
    expect(groups.offer).toHaveLength(1);
    expect(groups.applied).toHaveLength(0);
  });
});
