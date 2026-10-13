import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { makeApp } from "../test/fixtures";
import { ApplicationsPage } from "./ApplicationsPage";

vi.mock("../lib/api", () => ({
  api: {
    listApplications: vi.fn(),
    listContacts: vi.fn(),
    createApplication: vi.fn(),
    updateApplication: vi.fn(),
    deleteApplication: vi.fn(),
  },
}));

const mocked = vi.mocked(api);

function renderPage() {
  return render(
    <MemoryRouter>
      <ApplicationsPage />
    </MemoryRouter>,
  );
}

describe("ApplicationsPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listContacts.mockResolvedValue([]);
  });

  it("guides a brand-new user with an empty state", async () => {
    mocked.listApplications.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText("No applications yet")).toBeInTheDocument();
  });

  it("adds an application and reloads the board", async () => {
    mocked.listApplications.mockResolvedValueOnce([]).mockResolvedValue([makeApp({ company: "Acme Widgets" })]);
    mocked.createApplication.mockResolvedValue(makeApp());
    renderPage();
    await screen.findByText("No applications yet");
    await userEvent.type(screen.getByLabelText("Company*"), "Acme Widgets");
    await userEvent.type(screen.getByLabelText("Role*"), "Dev{Enter}");
    expect(mocked.createApplication).toHaveBeenCalled();
    expect(await screen.findByText("Acme Widgets")).toBeInTheDocument();
  });

  it("changes stage from the board", async () => {
    const app = makeApp({ company: "Acme Widgets" });
    mocked.listApplications.mockResolvedValue([app]);
    mocked.updateApplication.mockResolvedValue({ ...app, stage: "offer" });
    renderPage();
    await userEvent.selectOptions(await screen.findByLabelText("Stage for Acme Widgets"), "offer");
    expect(mocked.updateApplication).toHaveBeenCalledWith(app.id, { stage: "offer" });
  });
});
