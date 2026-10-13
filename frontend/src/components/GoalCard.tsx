import { Link } from "react-router-dom";
import { GOAL_LOG_LINKS, progressLabel, progressPercent, streakHint, streakLabel } from "../lib/goals";
import type { GoalProgress } from "../lib/types";

export function GoalCard({ goal }: { goal: GoalProgress }) {
  const pct = progressPercent(goal);
  return (
    <section className="panel" aria-label={goal.label}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h2>{goal.label}</h2>
        <Link className="small" to={GOAL_LOG_LINKS[goal.goal_type]} aria-label={`Log ${goal.label.toLowerCase()}`}>
          Log →
        </Link>
      </div>
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
        <strong>{goal.current_streak > 0 ? "🔥 " : ""}{streakLabel(goal)}</strong>
        <span className="muted">best: {goal.longest_streak}</span>
      </div>
      <p className={`small ${goal.met ? "good" : "muted"}`}>{streakHint(goal)}</p>
    </section>
  );
}
