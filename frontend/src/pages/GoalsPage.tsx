import { useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { LeetCodeForm } from "../components/LeetCodeForm";
import { LeetCodeSync } from "../components/LeetCodeSync";
import { api } from "../lib/api";
import { formatDate } from "../lib/dates";
import { PLATFORM_LABELS } from "../lib/labels";
import type { GoalTarget, GoalType, LeetCodeLog, Period } from "../lib/types";
import { useResource } from "../lib/useResource";

const GOAL_NAMES: Record<GoalType, string> = {
  leetcode: "Coding problems (LeetCode, NeetCode, …)",
  course_modules: "Course modules",
  applications: "Applications sent (counted automatically)",
};

function hintsValue(v: boolean | null) {
  return v === null ? "" : v ? "yes" : "no";
}

export function GoalsPage() {
  const targets = useResource(() => api.listTargets());
  const logs = useResource(() => api.listLeetCode());
  const courses = useResource(() => api.listCourses());
  const settings = useResource(() => api.getSettings());
  const [courseName, setCourseName] = useState("");
  const [courseTotal, setCourseTotal] = useState("10");
  const [error, setError] = useState<string | null>(null);

  async function saveTarget(t: GoalTarget, patch: Partial<GoalTarget>) {
    try {
      await api.updateTarget(t.goal_type, patch);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
    await targets.reload();
  }

  async function addCourse(e: FormEvent) {
    e.preventDefault();
    const total = Number(courseTotal);
    if (!courseName.trim() || !Number.isInteger(total) || total < 1) {
      return setError("Course needs a name and a whole number of modules (1 or more).");
    }
    await api.createCourse({ name: courseName.trim(), total_modules: total });
    setCourseName("");
    setError(null);
    await courses.reload();
  }

  async function run(action: () => Promise<unknown>) {
    try {
      await action();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const logList: LeetCodeLog[] = logs.data ?? [];
  const courseList = courses.data ?? [];

  return (
    <div>
      <h1>Goals</h1>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}

      <section className="panel" aria-label="Targets">
        <h2>Targets</h2>
        <p className="muted small">
          Daily goals reset at local midnight; weekly goals run Monday–Sunday. A day (or week) that isn't over yet never
          breaks a streak.
        </p>
        <ul className="list">
          {(targets.data ?? []).map((t) => (
            <li key={t.goal_type}>
              <label className="check">
                <input
                  type="checkbox"
                  checked={t.enabled}
                  onChange={(e) => saveTarget(t, { enabled: e.target.checked })}
                />
                {GOAL_NAMES[t.goal_type]}
              </label>
              <span className="row">
                <input
                  type="number"
                  min={1}
                  aria-label={`${GOAL_NAMES[t.goal_type]} target`}
                  defaultValue={t.target}
                  key={`${t.goal_type}-${t.target}`}
                  style={{ width: "5rem" }}
                  onBlur={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isInteger(n) && n >= 1 && n !== t.target) void saveTarget(t, { target: n });
                  }}
                />
                <select
                  aria-label={`${GOAL_NAMES[t.goal_type]} period`}
                  value={t.period}
                  onChange={(e) => saveTarget(t, { period: e.target.value as Period })}
                >
                  <option value="daily">per day</option>
                  <option value="weekly">per week</option>
                </select>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <h2 style={{ marginTop: "1.5rem" }}>Problem log</h2>
      {settings.data?.leetcode_username && (
        <div style={{ marginBottom: "0.5rem" }}>
          <LeetCodeSync onSynced={() => void logs.reload()} />
        </div>
      )}
      <LeetCodeForm
        onLog={async (input) => {
          await api.logLeetCode(input);
          await logs.reload();
        }}
      />
      {!logs.loading && logList.length === 0 ? (
        <EmptyState title="No problems logged yet">Log your first solved problem above — only the name is required.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Problem</th>
                <th>Platform</th>
                <th>Difficulty</th>
                <th>Tags</th>
                <th>No hints?</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logList.map((l) => (
                <tr key={l.id}>
                  <td>{formatDate(l.solved_on)}</td>
                  <td>
                    {l.problem} {l.source === "sync" && <span className="badge warn">synced</span>}
                  </td>
                  <td>{PLATFORM_LABELS[l.platform]}</td>
                  <td>{l.difficulty ?? "—"}</td>
                  <td>{l.tags.join(", ")}</td>
                  <td>
                    <select
                      aria-label={`Solved without hints: ${l.problem}`}
                      value={hintsValue(l.solved_without_hints)}
                      onChange={(e) =>
                        run(async () => {
                          const v = e.target.value;
                          await api.updateLeetCode(l.id, { solved_without_hints: v === "" ? null : v === "yes" });
                          await logs.reload();
                        })
                      }
                    >
                      <option value="">unknown</option>
                      <option value="yes">yes</option>
                      <option value="no">no</option>
                    </select>
                  </td>
                  <td>{l.notes}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        run(async () => {
                          await api.deleteLeetCode(l.id);
                          await logs.reload();
                        })
                      }
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>Courses</h2>
      <form className="quick-add" onSubmit={addCourse} aria-label="Add course">
        <label className="grow">
          Course name*
          <input value={courseName} onChange={(e) => setCourseName(e.target.value)} autoComplete="off" />
        </label>
        <label>
          Total modules*
          <input
            type="number"
            min={1}
            value={courseTotal}
            onChange={(e) => setCourseTotal(e.target.value)}
            style={{ width: "6rem" }}
          />
        </label>
        <button type="submit">Add course</button>
      </form>
      {!courses.loading && courseList.length === 0 ? (
        <EmptyState title="No courses yet">Add a course to log each module you finish.</EmptyState>
      ) : (
        <div className="grid">
          {courseList.map((c) => {
            const done = c.modules_completed >= c.total_modules;
            return (
              <section key={c.id} className="panel" aria-label={c.name}>
                <h2>
                  {c.name} {c.archived && <span className="badge warn">archived</span>}
                </h2>
                <div>
                  {c.modules_completed} / {c.total_modules} modules
                </div>
                <div className={`progress${done ? " done" : ""}`}>
                  <span style={{ width: `${(c.modules_completed / c.total_modules) * 100}%` }} />
                </div>
                <div className="row">
                  <button
                    type="button"
                    disabled={done}
                    onClick={() =>
                      run(async () => {
                        await api.completeModule(c.id);
                        await courses.reload();
                      })
                    }
                  >
                    +1 module done
                  </button>
                  {c.completions.length > 0 && (
                    <button
                      type="button"
                      title={`Remove the completion logged ${formatDate(c.completions[0].completed_on)}`}
                      onClick={() =>
                        run(async () => {
                          await api.deleteCompletion(c.completions[0].id);
                          await courses.reload();
                        })
                      }
                    >
                      Undo last
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      run(async () => {
                        await api.updateCourse(c.id, { archived: !c.archived });
                        await courses.reload();
                      })
                    }
                  >
                    {c.archived ? "Unarchive" : "Archive"}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() =>
                      window.confirm(`Delete ${c.name} and its ${c.modules_completed} logged modules?`) &&
                      run(async () => {
                        await api.deleteCourse(c.id);
                        await courses.reload();
                      })
                    }
                  >
                    Delete
                  </button>
                </div>
                {c.completions.length > 0 && (
                  <p className="muted small">Last module: {formatDate(c.completions[0].completed_on)}</p>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
