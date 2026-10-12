import { Link } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { GoalCard } from "../components/GoalCard";
import { LeetCodeForm } from "../components/LeetCodeForm";
import { api } from "../lib/api";
import { addDays, formatDate } from "../lib/dates";
import { STAGE_LABELS } from "../lib/labels";
import { useResource } from "../lib/useResource";

export function TodayPage() {
  const today = useResource(() => api.today());
  const courses = useResource(() => api.listCourses());

  if (today.error) return <p role="alert" className="error">Could not load today: {today.error}</p>;
  if (!today.data) return <p className="muted">Loading…</p>;

  const { goals, follow_ups, stale, date } = today.data;
  const enabled = goals.filter((g) => g.enabled);
  const activeCourses = (courses.data ?? []).filter((c) => !c.archived && c.modules_completed < c.total_modules);
  const reload = () => Promise.all([today.reload(), courses.reload()]);

  return (
    <div>
      <h1>Today · {formatDate(date)}</h1>

      {enabled.length === 0 ? (
        <EmptyState title="No goals enabled">
          Turn some on under <Link to="/goals">Goals</Link>.
        </EmptyState>
      ) : (
        <div className="grid">
          {enabled.map((g) => (
            <GoalCard key={g.goal_type} goal={g} />
          ))}
        </div>
      )}

      <h2>Log a problem</h2>
      <LeetCodeForm
        compact
        onLog={async (input) => {
          await api.logLeetCode(input);
          await today.reload();
        }}
      />

      <h2>Course modules</h2>
      {activeCourses.length === 0 ? (
        <EmptyState title="No active courses">
          Add a course on the <Link to="/goals">Goals</Link> page to track module progress.
        </EmptyState>
      ) : (
        <ul className="list panel">
          {activeCourses.map((c) => (
            <li key={c.id}>
              <span>
                {c.name} <span className="muted small">({c.modules_completed}/{c.total_modules})</span>
              </span>
              <button
                type="button"
                onClick={async () => {
                  await api.completeModule(c.id);
                  await reload();
                }}
              >
                +1 module done
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="grid" style={{ marginTop: "1rem" }}>
        <section className="panel" aria-label="Follow-ups">
          <h2>Follow-ups due</h2>
          {follow_ups.length === 0 ? (
            <p className="muted small">Nothing due. Set a follow-up date on an application to see it here.</p>
          ) : (
            <ul className="list">
              {follow_ups.map((a) => (
                <li key={a.id}>
                  <span>
                    <strong>{a.company}</strong> — {a.role}{" "}
                    <span className={a.next_follow_up! < date ? "badge warn" : "muted small"}>
                      {a.next_follow_up! < date ? `overdue since ${formatDate(a.next_follow_up)}` : "today"}
                    </span>
                  </span>
                  <span className="row">
                    <button
                      type="button"
                      title="Mark followed up and remind me again in a week"
                      onClick={async () => {
                        await api.updateApplication(a.id, { next_follow_up: addDays(date, 7) });
                        await today.reload();
                      }}
                    >
                      Done, again in 7d
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateApplication(a.id, { next_follow_up: null });
                        await today.reload();
                      }}
                    >
                      Clear
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="panel" aria-label="Possibly ghosted">
          <h2>No reply in 21+ days</h2>
          {stale.length === 0 ? (
            <p className="muted small">No stale applications. Anything in “Applied” for 21+ days with no change shows up here.</p>
          ) : (
            <>
              <p className="muted small">Suggestions only — nothing is marked ghosted unless you say so.</p>
              <ul className="list">
                {stale.map((a) => (
                  <li key={a.id}>
                    <span>
                      <strong>{a.company}</strong> — {a.role}{" "}
                      <span className="muted small">
                        {STAGE_LABELS[a.stage]} for {a.days_in_stage} days
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={async () => {
                        await api.updateApplication(a.id, { stage: "ghosted" });
                        await today.reload();
                      }}
                    >
                      Mark ghosted
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
