import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuickAdd } from "./QuickAdd";

describe("QuickAdd", () => {
  it("submits with only company and role, via Enter", async () => {
    const onAdd = vi.fn().mockResolvedValue(undefined);
    render(<QuickAdd onAdd={onAdd} />);
    await userEvent.type(screen.getByLabelText("Company*"), "Acme Widgets");
    await userEvent.type(screen.getByLabelText("Role*"), "Junior SWE{Enter}");
    expect(onAdd).toHaveBeenCalledWith({
      company: "Acme Widgets",
      role: "Junior SWE",
      stage: "applied",
      source: "linkedin",
      job_url: null,
    });
    // Cleared for the next entry.
    expect(screen.getByLabelText("Company*")).toHaveValue("");
  });

  it("refuses to submit without a role", async () => {
    const onAdd = vi.fn();
    render(<QuickAdd onAdd={onAdd} />);
    await userEvent.type(screen.getByLabelText("Company*"), "Acme Widgets{Enter}");
    expect(onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("required");
  });

  it("shows server errors and keeps the input", async () => {
    const onAdd = vi.fn().mockRejectedValue(new Error("boom"));
    render(<QuickAdd onAdd={onAdd} />);
    await userEvent.type(screen.getByLabelText("Company*"), "Acme");
    await userEvent.type(screen.getByLabelText("Role*"), "Dev{Enter}");
    expect(await screen.findByRole("alert")).toHaveTextContent("boom");
    expect(screen.getByLabelText("Company*")).toHaveValue("Acme");
  });
});
