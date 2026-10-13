import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import type { NeetCodeChecklist, NeetCodeProblem } from "../lib/types";
import { NeetCodePage } from "./NeetCodePage";

vi.mock("../lib/api", () => ({ api: { neetcode150: vi.fn(), logNeetCode: vi.fn() } }));
const mocked = vi.mocked(api);

const p = (slug: string, title: string, topic: string, solvedOn: string | null = null): NeetCodeProblem => ({
  number: 1,
  title,
  slug,
  topic,
  difficulty: "easy",
  first_solved_on: solvedOn,
  times_solved: solvedOn ? 1 : 0,
});

function checklist(): NeetCodeChecklist {
  return {
    total: 150,
    solved: 1,
    topics: [
      {
        topic: "Arrays & Hashing",
        total: 1,
        solved: 1,
        problems: [p("contains-duplicate", "Contains Duplicate", "Arrays & Hashing", "2026-03-01")],
      },
      { topic: "Two Pointers", total: 1, solved: 0, problems: [p("valid-palindrome", "Valid Palindrome", "Two Pointers")] },
    ],
  };
}

describe("NeetCodePage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.neetcode150.mockResolvedValue(checklist());
  });

  it("shows overall progress and opens the next unfinished topic", async () => {
    render(<NeetCodePage />);
    expect(await screen.findByText("1 / 150")).toBeInTheDocument();
    const topics = document.querySelectorAll("details");
    expect(topics[0]).not.toHaveAttribute("open"); // finished topic stays collapsed
    expect(topics[1]).toHaveAttribute("open");
    expect(screen.getByText(/first solved/)).toBeInTheDocument();
  });

  it("logs a problem as solved without hints", async () => {
    mocked.logNeetCode.mockResolvedValue({} as never);
    render(<NeetCodePage />);
    await userEvent.click(await screen.findByRole("button", { name: "Valid Palindrome: solved without hints" }));
    expect(mocked.logNeetCode).toHaveBeenCalledWith("valid-palindrome", true);
    expect(mocked.neetcode150).toHaveBeenCalledTimes(2); // reloaded
  });

  it("logs with hints", async () => {
    mocked.logNeetCode.mockResolvedValue({} as never);
    render(<NeetCodePage />);
    await userEvent.click(await screen.findByRole("button", { name: "Valid Palindrome: solved with hints" }));
    expect(mocked.logNeetCode).toHaveBeenCalledWith("valid-palindrome", false);
  });

  it("filters to unsolved problems", async () => {
    render(<NeetCodePage />);
    await screen.findByText("1 / 150");
    await userEvent.click(screen.getByRole("button", { name: "Unsolved" }));
    expect(screen.queryByText("Contains Duplicate")).not.toBeInTheDocument();
    const topic = screen.getByText("Two Pointers").closest("details")!;
    expect(within(topic).getByText("Valid Palindrome")).toBeInTheDocument();
  });

  it("shows a clear error when logging fails", async () => {
    mocked.logNeetCode.mockRejectedValue(new Error("Not a NeetCode 150 problem"));
    render(<NeetCodePage />);
    await userEvent.click(await screen.findByRole("button", { name: "Valid Palindrome: solved with hints" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Not a NeetCode 150 problem");
  });
});
