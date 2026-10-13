import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { makeApp } from "../test/fixtures";
import { ApplicationTable } from "./ApplicationTable";

const companies = () => screen.getAllByRole("row").slice(1).map((r) => r.querySelector("td")!.textContent);

describe("ApplicationTable", () => {
  const apps = [
    makeApp({ company: "Bravo Example", date_applied: "2026-03-02", stage: "applied" }),
    makeApp({ company: "Alpha Example", date_applied: "2026-03-05", stage: "rejected" }),
  ];

  it("sorts by a column when its header is clicked, toggling direction", async () => {
    render(<ApplicationTable applications={apps} onMove={vi.fn()} onOpen={vi.fn()} />);
    expect(companies()).toEqual(["Alpha Example", "Bravo Example"]); // default: applied desc
    await userEvent.click(screen.getByRole("button", { name: /Company/ }));
    expect(companies()).toEqual(["Alpha Example", "Bravo Example"]);
    await userEvent.click(screen.getByRole("button", { name: /Company/ }));
    expect(companies()).toEqual(["Bravo Example", "Alpha Example"]);
  });

  it("filters to active stages", async () => {
    render(<ApplicationTable applications={apps} onMove={vi.fn()} onOpen={vi.fn()} />);
    await userEvent.selectOptions(screen.getByLabelText("Filter by stage"), "active");
    expect(companies()).toEqual(["Bravo Example"]);
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });
});
