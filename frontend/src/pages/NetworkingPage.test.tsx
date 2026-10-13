import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "../lib/api";
import { todayISO } from "../lib/dates";
import type { Contact } from "../lib/types";
import { NetworkingPage } from "./NetworkingPage";

vi.mock("../lib/api", () => ({
  api: {
    listContacts: vi.fn(),
    listApplications: vi.fn(),
    listOutreach: vi.fn(),
    logOutreach: vi.fn(),
    deleteOutreach: vi.fn(),
    createContact: vi.fn(),
    updateContact: vi.fn(),
    deleteContact: vi.fn(),
  },
}));
const mocked = vi.mocked(api);

const sam: Contact = {
  id: 7,
  name: "Sam Sample",
  role: "Recruiter",
  email: null,
  linkedin: null,
  notes: null,
  application_ids: [],
  outreach_count: 2,
  last_contacted: "2026-03-10",
};

describe("NetworkingPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocked.listApplications.mockResolvedValue([]);
    mocked.listOutreach.mockResolvedValue([]);
    mocked.logOutreach.mockResolvedValue({} as never);
  });

  it("shows empty guidance for a new user", async () => {
    mocked.listContacts.mockResolvedValue([]);
    render(<NetworkingPage />);
    expect(await screen.findByText("No contacts yet")).toBeInTheDocument();
  });

  it("logs outreach to a brand-new contact in one step", async () => {
    mocked.listContacts.mockResolvedValue([]);
    render(<NetworkingPage />);
    await screen.findByText("No contacts yet");
    await userEvent.selectOptions(screen.getByLabelText("Who"), "new");
    await userEvent.type(screen.getByLabelText("New contact name*"), "Alex Example");
    await userEvent.selectOptions(screen.getByLabelText("What"), "coffee_chat");
    await userEvent.click(screen.getAllByRole("button", { name: "Log" })[0]);
    expect(mocked.logOutreach).toHaveBeenCalledWith({
      contact_id: null,
      new_contact_name: "Alex Example",
      kind: "coffee_chat",
      happened_on: todayISO(),
      notes: null,
    });
    expect(mocked.listContacts).toHaveBeenCalledTimes(2); // reloaded so the new contact appears
  });

  it("requires a name when 'new contact' is chosen", async () => {
    mocked.listContacts.mockResolvedValue([]);
    render(<NetworkingPage />);
    await screen.findByText("No contacts yet");
    await userEvent.selectOptions(screen.getByLabelText("Who"), "new");
    await userEvent.click(screen.getAllByRole("button", { name: "Log" })[0]);
    expect(mocked.logOutreach).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("name");
  });

  it("shows last contacted and logs a quick message per contact", async () => {
    mocked.listContacts.mockResolvedValue([sam]);
    render(<NetworkingPage />);
    expect(await screen.findByText("(2×)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Log a message to Sam Sample today" }));
    expect(mocked.logOutreach).toHaveBeenCalledWith({ contact_id: 7, kind: "message" });
  });
});
