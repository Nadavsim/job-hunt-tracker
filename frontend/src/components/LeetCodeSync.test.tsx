import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "../lib/api";
import { LeetCodeSync } from "./LeetCodeSync";

vi.mock("../lib/api", async (importOriginal) => {
  const real = await importOriginal<typeof import("../lib/api")>();
  return { ...real, api: { syncLeetCode: vi.fn() } };
});
const mocked = vi.mocked(api);

describe("LeetCodeSync", () => {
  beforeEach(() => vi.resetAllMocks());

  it("reports what was imported and notifies the parent", async () => {
    mocked.syncLeetCode.mockResolvedValue({ fetched: 5, imported: 2, skipped_duplicates: 1, last_sync: "" });
    const onSynced = vi.fn();
    render(<LeetCodeSync onSynced={onSynced} />);
    await userEvent.click(screen.getByRole("button", { name: /Sync/ }));
    expect(await screen.findByRole("status")).toHaveTextContent("Imported 2 new problems, skipped 1 already logged.");
    expect(onSynced).toHaveBeenCalled();
  });

  it("shows a clear message on failure and stays usable", async () => {
    mocked.syncLeetCode.mockRejectedValue(new ApiError(502, "Could not reach LeetCode. Manual logging still works."));
    const onSynced = vi.fn();
    render(<LeetCodeSync onSynced={onSynced} />);
    await userEvent.click(screen.getByRole("button", { name: /Sync/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Manual logging still works");
    expect(onSynced).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: /Sync/ })).toBeEnabled();
  });
});
