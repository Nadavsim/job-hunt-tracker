import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeApp } from "../test/fixtures";
import { KanbanBoard } from "./KanbanBoard";

describe("KanbanBoard", () => {
  it("renders a column per stage with its cards", () => {
    const apps = [makeApp({ company: "Acme Widgets", stage: "interview" }), makeApp({ company: "Globex Example" })];
    render(<KanbanBoard applications={apps} onMove={vi.fn()} onOpen={vi.fn()} />);
    expect(within(screen.getByRole("region", { name: "Interview(s)" })).getByText("Acme Widgets")).toBeInTheDocument();
    expect(within(screen.getByRole("region", { name: "Applied" })).getByText("Globex Example")).toBeInTheDocument();
    expect(screen.getAllByRole("region")).toHaveLength(9);
  });

  it("moves a card with the stage dropdown", async () => {
    const app = makeApp({ company: "Acme Widgets" });
    const onMove = vi.fn();
    render(<KanbanBoard applications={[app]} onMove={onMove} onOpen={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Stage for Acme Widgets"), "phone_screen");
    expect(onMove).toHaveBeenCalledWith(app, "phone_screen");
  });

  it("flags stale applications without changing their stage", () => {
    render(
      <KanbanBoard applications={[makeApp({ is_stale: true, days_in_stage: 25 })]} onMove={vi.fn()} onOpen={vi.fn()} />,
    );
    expect(screen.getByText(/25d, no reply/)).toBeInTheDocument();
  });
});
