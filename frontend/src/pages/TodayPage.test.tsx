import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { makeApp, makeGoal, makeToday } from "../test/fixtures";
import { TodayPage } from "./TodayPage";

vi.mock("../lib/api", () => ({
  api: {
    today: vi.fn(),
    listCourses: vi.fn(),
    logLeetCode: vi.fn(),
    completeModule: vi.fn(),
    updateApplication: vi.fn(),
  },
}));
const mocked = vi.mocked(api);

const renderPage = () =>
  render(
    <MemoryRouter>
      <TodayPage />
    </MemoryRouter>,
  );

describe("TodayPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listCourses.mockResolvedValue([]);
  });

  it("shows guidance for a brand-new user instead of blank sections", async () => {
    mocked.today.mockResolvedValue(makeToday());
    renderPage();
    expect(await screen.findByText("0 / 2 today")).toBeInTheDocument();
    expect(screen.getByText("No active courses")).toBeInTheDocument();
    expect(screen.getByText(/Nothing due/)).toBeInTheDocument();
    expect(screen.getByText(/No stale applications/)).toBeInTheDocument();
  });

  it("shows goal progress and streaks", async () => {
    mocked.today.mockResolvedValue(
      makeToday({ goals: [makeGoal({ count: 1, current_streak: 4, longest_streak: 9 })] }),
    );
    renderPage();
    const card = await screen.findByRole("region", { name: "LeetCode problems" });
    expect(within(card).getByText("1 / 2 today")).toBeInTheDocument();
    expect(within(card).getByText(/4-day streak/)).toBeInTheDocument();
    expect(within(card).getByText("1 more today to extend your streak.")).toBeInTheDocument();
  });

  it("lists overdue follow-ups and stale suggestions; ghosting needs a click", async () => {
    mocked.today.mockResolvedValue(
      makeToday({
        follow_ups: [makeApp({ company: "Overdue Example", next_follow_up: "2026-03-10" })],
        stale: [makeApp({ id: 77, company: "Silent Example", is_stale: true, days_in_stage: 30 })],
      }),
    );
    mocked.updateApplication.mockResolvedValue(makeApp());
    renderPage();
    expect(await screen.findByText("Overdue Example")).toBeInTheDocument();
    expect(screen.getByText(/overdue since/)).toBeInTheDocument();
    expect(screen.getByText(/Applied for 30 days/)).toBeInTheDocument();
    expect(mocked.updateApplication).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Mark ghosted" }));
    expect(mocked.updateApplication).toHaveBeenCalledWith(77, { stage: "ghosted" });
  });

  it("snoozes a follow-up by a week", async () => {
    mocked.today.mockResolvedValue(makeToday({ follow_ups: [makeApp({ id: 5, next_follow_up: "2026-03-18" })] }));
    mocked.updateApplication.mockResolvedValue(makeApp());
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: /again in 7d/ }));
    expect(mocked.updateApplication).toHaveBeenCalledWith(5, { next_follow_up: "2026-03-25" });
  });

  it("logs a module for an active course", async () => {
    mocked.today.mockResolvedValue(makeToday());
    mocked.listCourses.mockResolvedValue([
      { id: 3, name: "Example Course", total_modules: 10, archived: false, modules_completed: 2, completions: [] },
    ]);
    renderPage();
    await userEvent.click(await screen.findByRole("button", { name: "+1 module done" }));
    expect(mocked.completeModule).toHaveBeenCalledWith(3);
  });
});
