import { useEffect, useState, type FormEvent } from "react";
import { LeetCodeSync } from "../components/LeetCodeSync";
import { api } from "../lib/api";
import { formatDate } from "../lib/dates";
import { useResource } from "../lib/useResource";

export function SettingsPage() {
  const settings = useResource(() => api.getSettings());
  const [username, setUsername] = useState("");
  const [status, setStatus] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  useEffect(() => setUsername(settings.data?.leetcode_username ?? ""), [settings.data]);

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await api.saveSettings({ leetcode_username: username.trim() || null });
      setStatus({ kind: "ok", text: username.trim() ? "Saved." : "LeetCode sync turned off." });
      await settings.reload();
    } catch (err) {
      setStatus({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  }

  const saved = settings.data?.leetcode_username;

  return (
    <div>
      <h1>Settings</h1>
      <section className="panel" aria-label="LeetCode sync">
        <h2>LeetCode sync (optional)</h2>
        <p className="muted small">
          Off by default. When you set a username and press “Sync”, the app asks LeetCode's public, unofficial API for
          your recent accepted submissions and adds any you haven't logged that day. Only the username is sent; nothing
          from your tracker leaves this computer. The unofficial API can break at any time — manual logging always
          works.
        </p>
        <form className="row" onSubmit={save}>
          <label>
            LeetCode username
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="leave empty to disable"
              autoComplete="off"
            />
          </label>
          <button type="submit">Save</button>
          {status && (
            <span role={status.kind === "error" ? "alert" : "status"} className={`small ${status.kind === "error" ? "error" : "good"}`}>
              {status.text}
            </span>
          )}
        </form>
        {saved && (
          <div style={{ marginTop: "0.75rem" }}>
            <LeetCodeSync onSynced={() => void settings.reload()} />
            <p className="muted small">
              Last synced: {settings.data?.leetcode_last_sync ? formatDate(settings.data.leetcode_last_sync) : "never"}.
              Synced problems have “solved without hints” set to unknown — edit them on the Goals page.
            </p>
          </div>
        )}
      </section>

      <section className="panel" aria-label="Data" style={{ marginTop: "1rem" }}>
        <h2>Your data</h2>
        <p className="muted small">
          Everything is stored in one SQLite file on this computer (default <code>data/tracker.db</code>, override with
          the <code>JOBTRACKER_DB_PATH</code> environment variable). Back it up by copying that file while the app is
          stopped. It is git-ignored.
        </p>
      </section>
    </div>
  );
}
