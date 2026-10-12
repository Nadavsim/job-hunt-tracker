import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { todayISO } from "../lib/dates";
import { LeetCodeForm } from "./LeetCodeForm";

describe("LeetCodeForm", () => {
  beforeEach(() => localStorage.clear());

  it("logs a problem with parsed tags from the keyboard", async () => {
    const onLog = vi.fn().mockResolvedValue(undefined);
    render(<LeetCodeForm onLog={onLog} />);
    await userEvent.type(screen.getByLabelText("Problem*"), "1. Two Sum");
    await userEvent.selectOptions(screen.getByLabelText("Difficulty"), "easy");
    await userEvent.type(screen.getByLabelText("Topic tags"), "Array, Hash Table{Enter}");
    expect(onLog).toHaveBeenCalledWith({
      problem: "1. Two Sum",
      difficulty: "easy",
      tags: ["array", "hash table"],
      solved_without_hints: true,
      solved_on: todayISO(),
      notes: null,
      platform: "leetcode",
    });
    expect(screen.getByLabelText("Problem*")).toHaveValue("");
    expect(screen.getByLabelText("Problem*")).toHaveFocus();
  });

  it("remembers the last platform used", async () => {
    const onLog = vi.fn().mockResolvedValue(undefined);
    const { unmount } = render(<LeetCodeForm onLog={onLog} />);
    await userEvent.selectOptions(screen.getByLabelText("Platform"), "neetcode");
    await userEvent.type(screen.getByLabelText("Problem*"), "Valid Anagram{Enter}");
    expect(onLog).toHaveBeenCalledWith(expect.objectContaining({ platform: "neetcode" }));
    unmount();
    render(<LeetCodeForm onLog={onLog} />);
    expect(screen.getByLabelText("Platform")).toHaveValue("neetcode");
  });

  it("requires a problem name", async () => {
    const onLog = vi.fn();
    render(<LeetCodeForm onLog={onLog} />);
    await userEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
