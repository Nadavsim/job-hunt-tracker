import { describe, expect, it } from "vitest";
import { addDays, todayISO } from "./dates";

describe("dates", () => {
  it("uses the local calendar date, not UTC", () => {
    // 23:30 local on Mar 18 must stay Mar 18 whatever the UTC offset.
    expect(todayISO(new Date(2026, 2, 18, 23, 30))).toBe("2026-03-18");
    expect(todayISO(new Date(2026, 2, 18, 0, 5))).toBe("2026-03-18");
  });

  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-03-18", 7)).toBe("2026-03-25");
    expect(addDays("2026-12-29", 7)).toBe("2027-01-05");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});
