import { useState } from "react";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { formatDate } from "../lib/dates";
import { filterTopics, nextTopic, type NeetCodeFilter } from "../lib/neetcode";
import type { NeetCodeProblem } from "../lib/types";
import { useResource } from "../lib/useResource";

const FILTERS: { value: NeetCodeFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unsolved", label: "Unsolved" },
  { value: "solved", label: "Solved" },
];

/**
 * NeetCode 150 checklist. Progress comes from the normal problem log, so
 * ticking a problem here also counts towards the daily goal and streak.
 */
export function NeetCodePage() {
  const list = useResource(() => api.neetcode150());
  const [filter, setFilter] = useState<NeetCodeFilter>("all");
  // null = the user hasn't expanded/collapsed anything: show the topic to work on next.
  const [open, setOpen] = useState<Set<string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const next = list.data ? nextTopic(list.data.topics) : null;
  const openTopics = open ?? new Set(next ? [next] : []);

  async function log(p: NeetCodeProblem, withoutHints: boolean) {
    setOpen(openTopics); // freeze the layout so finishing a topic doesn't collapse it under the cursor
    try {
      await api.logNeetCode(p.slug, withoutHints);
      setError(null);
      await list.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function toggle(topic: string, isOpen: boolean) {
    setOpen((prev) => {
      const updated = new Set(prev ?? openTopics);
      if (isOpen) updated.add(topic);
      else updated.delete(topic);
      return updated;
    });
  }

  if (list.error) return <p role="alert" className="error">Could not load the NeetCode 150: {list.error}</p>;
  if (!list.data) return <p className="muted">Loading…</p>;

  const { solved, total, topics } = list.data;
  const shown = filterTopics(topics, filter);
  const pct = Math.round((solved / total) * 100);

  return (
    <div>
      <div className="page-header">
        <h1>NeetCode 150</h1>
        <div role="group" aria-label="Show" className="segmented">
          {FILTERS.map((f) => (
            <button key={f.value} type="button" aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <section className="panel" aria-label="Overall progress">
        <div className="big">
          {solved} / {total}
        </div>
        <div className={`progress${solved === total ? " done" : ""}`}>
          <span style={{ width: `${pct}%` }} />
        </div>
        <p className="muted small">
          {solved === 0
            ? "Start with Arrays & Hashing — NeetCode's roadmap goes topic by topic. "
            : `${pct}% done. `}
          A problem counts as solved if it's in your problem log from any platform. “Solved” logs it for today
          (platform: NeetCode) and counts towards your daily goal.
        </p>
      </section>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      {shown.length === 0 && (
        <EmptyState title={filter === "solved" ? "Nothing solved yet" : "All 150 solved!"}>
          {filter === "solved" ? "Problems you log will show up here." : "Time for mock interviews."}
        </EmptyState>
      )}

      {shown.map((t) => (
        <details
          key={t.topic}
          className="panel topic"
          open={filter !== "all" || openTopics.has(t.topic)}
          onToggle={(e) => filter === "all" && toggle(t.topic, (e.target as HTMLDetailsElement).open)}
        >
          <summary>
            <span className="topic-name">{t.topic}</span>
            <span className="muted small">
              {t.solved} / {t.total}
            </span>
            <span className={`progress topic-bar${t.solved === t.total ? " done" : ""}`} aria-hidden="true">
              <span style={{ width: `${(t.solved / t.total) * 100}%` }} />
            </span>
          </summary>
          <ul className="list">
            {t.problems.map((p) => (
              <li key={p.slug}>
                <span>
                  <span className={p.first_solved_on ? "good" : "muted"} aria-hidden="true">
                    {p.first_solved_on ? "✓ " : "○ "}
                  </span>
                  {p.title}{" "}
                  <span className={`badge diff-${p.difficulty}`}>{p.difficulty}</span>{" "}
                  <a
                    className="small"
                    href={`https://leetcode.com/problems/${p.slug}/`}
                    target="_blank"
                    rel="noreferrer noopener"
                    title="Open the problem on LeetCode"
                  >
                    LeetCode ↗
                  </a>
                  {p.first_solved_on && (
                    <span className="muted small">
                      {" "}
                      · first solved {formatDate(p.first_solved_on)}
                      {p.times_solved > 1 ? ` · ${p.times_solved}×` : ""}
                    </span>
                  )}
                </span>
                <span className="row">
                  <button type="button" aria-label={`${p.title}: solved without hints`} onClick={() => log(p, true)}>
                    {p.first_solved_on ? "Solved again" : "Solved"}
                  </button>
                  <button type="button" aria-label={`${p.title}: solved with hints`} onClick={() => log(p, false)}>
                    With hints
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </details>
      ))}
    </div>
  );
}
