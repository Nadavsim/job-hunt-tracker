import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { DashboardData } from "../lib/types";
import { DashboardPage } from "./DashboardPage";

vi.mock("../lib/api", () => ({ api: { dashboard: vi.fn() } }));
const mocked = vi.mocked(api);

// Recharts needs real layout; jsdom has none, so charts render empty - the tests
// assert on the text around them.
class RO {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = globalThis.ResizeObserver ?? (RO as unknown as typeof ResizeObserver);

function emptyDashboard(): DashboardData {
  return {
    applications: {
      wishlist: 0,
      total_applied: 0,
      total_responded: 0,
      response_rate: null,
      median_days_to_response: null,
      funnel: [],
      outcomes: [],
      by_source: [],
      by_resume: [],
      min_resume_sample: 5,
    },
    leetcode: {
      total: 0,
      by_difficulty: [],
      by_platform: [],
      by_tag: [],
      without_hints: 0,
      hints_known: 0,
      without_hints_rate: null,
    },
    neetcode150: { solved: 0, total: 150 },
    week: {
      week_start: "2026-03-16",
      week_end: "2026-03-22",
      applied: 0,
      responses: 0,
      problems: 0,
      modules: 0,
      longest_streak: null,
    },
  };
}

const renderPage = () =>
  render(
    <MemoryRouter>
      <DashboardPage />
    </MemoryRouter>,
  );

describe("DashboardPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("shows guidance instead of blank charts for a new user", async () => {
    mocked.dashboard.mockResolvedValue(emptyDashboard());
    renderPage();
    expect(await screen.findByText("No applications sent yet")).toBeInTheDocument();
    expect(screen.getByText("No problems logged yet")).toBeInTheDocument();
    expect(screen.getByText(/no active streak/)).toBeInTheDocument();
  });

  it("hides resume-version rates below the sample threshold", async () => {
    const d = emptyDashboard();
    d.applications = {
      ...d.applications,
      total_applied: 8,
      total_responded: 2,
      response_rate: 0.25,
      by_resume: [
        { resume_version: "v3-backend", applied: 5, responded: 2, rate: 0.4, enough_data: true },
        { resume_version: "v1-general", applied: 3, responded: 0, rate: null, enough_data: false },
      ],
    };
    mocked.dashboard.mockResolvedValue(d);
    renderPage();
    const table = await screen.findByRole("region", { name: "By resume version" });
    expect(within(table).getByText("40%")).toBeInTheDocument();
    expect(within(table).getByText("needs 2 more to show a rate")).toBeInTheDocument();
    expect(within(table).queryByText("0%")).not.toBeInTheDocument();
    expect(screen.getByText("25%")).toBeInTheDocument();
  });

  it("copies the weekly summary as plain text", async () => {
    const d = emptyDashboard();
    d.week = { ...d.week, applied: 6, responses: 2, problems: 9, modules: 2 };
    mocked.dashboard.mockResolvedValue(d);
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Copy as text" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("6 applied, 2 responses, 9 problems, 2 modules"));
    expect(screen.getByRole("status")).toHaveTextContent("Copied!");
  });
});
