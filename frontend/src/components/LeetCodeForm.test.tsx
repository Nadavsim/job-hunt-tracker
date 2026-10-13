import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { todayISO } from "../lib/dates";
import { LeetCodeForm } from "./LeetCodeForm";

describe("LeetCodeForm", () => {
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
    });
    expect(screen.getByLabelText("Problem*")).toHaveValue("");
    expect(screen.getByLabelText("Problem*")).toHaveFocus();
  });

  it("requires a problem name", async () => {
    const onLog = vi.fn();
    render(<LeetCodeForm onLog={onLog} />);
    await userEvent.click(screen.getByRole("button", { name: "Log" }));
    expect(onLog).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });
});
