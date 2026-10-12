import { useState } from "react";
import { api } from "../lib/api";

/**
 * "Sync now" button. Sync is opt-in and on demand only (no background polling);
 * any failure is shown as a message and nothing else on the page is affected.
 */
export function LeetCodeSync({ onSynced }: { onSynced?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function sync() {
    setBusy(true);
    setMessage(null);
    try {
      const r = await api.syncLeetCode();
      const text =
        r.imported === 0
          ? `Up to date — no new accepted problems (checked ${r.fetched} recent).`
          : `Imported ${r.imported} new problem${r.imported === 1 ? "" : "s"}` +
            (r.skipped_duplicates ? `, skipped ${r.skipped_duplicates} already logged.` : ".");
      setMessage({ kind: "ok", text });
      onSynced?.();
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="row">
      <button type="button" onClick={sync} disabled={busy}>
        {busy ? "Syncing…" : "Sync from LeetCode now"}
      </button>
      {message && (
        <span role={message.kind === "error" ? "alert" : "status"} className={`small ${message.kind === "error" ? "error" : "good"}`}>
          {message.text}
        </span>
      )}
    </div>
  );
}
