import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { todayISO } from "../lib/dates";
import { MockInterviewsPage } from "./MockInterviewsPage";

vi.mock("../lib/api", () => ({ api: { listMocks: vi.fn(), logMock: vi.fn(), deleteMock: vi.fn() } }));
const mocked = vi.mocked(api);

describe("MockInterviewsPage", () => {
  beforeEach(() => vi.resetAllMocks());

  it("guides a new user", async () => {
    mocked.listMocks.mockResolvedValue([]);
    render(<MockInterviewsPage />);
    expect(await screen.findByText("No mock interviews yet")).toBeInTheDocument();
  });

  it("logs a mock with type, partner, rating and notes", async () => {
    mocked.listMocks.mockResolvedValue([]);
    mocked.logMock.mockResolvedValue({} as never);
    render(<MockInterviewsPage />);
    await screen.findByText("No mock interviews yet");
    await userEvent.selectOptions(screen.getByLabelText("Type"), "behavioral");
    await userEvent.type(screen.getByLabelText("With / where"), "Practice Partner");
    await userEvent.click(screen.getByRole("radio", { name: "4" }));
    await userEvent.type(screen.getByLabelText("What to improve"), "Shorter STAR intro{Enter}");
    expect(mocked.logMock).toHaveBeenCalledWith({
      kind: "behavioral",
      partner: "Practice Partner",
      self_rating: 4,
      held_on: todayISO(),
      notes: "Shorter STAR intro",
    });
    expect(screen.getByLabelText("What to improve")).toHaveValue("");
    expect(screen.getByRole("radio", { name: "4" })).not.toBeChecked();
  });

  it("lists logged mocks", async () => {
    mocked.listMocks.mockResolvedValue([
      { id: 1, held_on: "2026-03-18", kind: "system_design", partner: null, self_rating: 2, notes: "Clarify scope first" },
    ]);
    render(<MockInterviewsPage />);
    expect(await screen.findByText("System design")).toBeInTheDocument();
    expect(screen.getByText("2 / 5")).toBeInTheDocument();
  });
});
