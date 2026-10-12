import { progressLabel, progressPercent, streakHint, streakLabel } from "../lib/goals";
import type { GoalProgress } from "../lib/types";

export function GoalCard({ goal }: { goal: GoalProgress }) {
  const pct = progressPercent(goal);
  return (
    <section className="panel" aria-label={goal.label}>
      <h2>{goal.label}</h2>
      <div className="big">{progressLabel(goal)}</div>
      <div
        className={`progress${goal.met ? " done" : ""}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={goal.target}
        aria-valuenow={Math.min(goal.count, goal.target)}
        aria-label={`${goal.label} progress`}
      >
        <span style={{ width: `${pct}%` }} />
      </div>
      <div className="row small">
        <strong>🔥 {streakLabel(goal)}</strong>
        <span className="muted">best: {goal.longest_streak}</span>
      </div>
      <p className={`small ${goal.met ? "good" : "muted"}`}>{streakHint(goal)}</p>
    </section>
  );
}
