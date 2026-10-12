import { useState } from "react";
import { weeklySummaryText } from "../lib/summary";
import type { WeekSummary } from "../lib/types";

export function WeeklySummaryCard({ week }: { week: WeekSummary }) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const text = weeklySummaryText(week);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied("yes");
    } catch {
      setCopied("failed"); // e.g. clipboard permission denied - the text is still selectable below
    }
  }

  const stats: [string, number][] = [
    ["applied", week.applied],
    ["responses", week.responses],
    ["problems", week.problems],
    ["modules", week.modules],
  ];

  return (
    <section className="panel" aria-label="This week">
      <h2>This week</h2>
      <div className="stat-row">
        {stats.map(([label, n]) => (
          <div key={label}>
            <div className="big">{n}</div>
            <div className="muted small">{label}</div>
          </div>
        ))}
        <div>
          <div className="big">{week.longest_streak ? week.longest_streak.length : 0}</div>
          <div className="muted small">
            longest streak{week.longest_streak ? ` (${week.longest_streak.label})` : ""}
          </div>
        </div>
      </div>
      <pre className="summary">{text}</pre>
      <div className="row">
        <button type="button" onClick={copy}>
          Copy as text
        </button>
        <span role="status" className="small muted">
          {copied === "yes" ? "Copied!" : copied === "failed" ? "Couldn't access the clipboard — select the text above." : ""}
        </span>
      </div>
    </section>
  );
}
