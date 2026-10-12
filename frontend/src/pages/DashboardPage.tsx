import { Link } from "react-router-dom";
import { BarChartCard } from "../components/BarChartCard";
import { EmptyState } from "../components/EmptyState";
import { WeeklySummaryCard } from "../components/WeeklySummaryCard";
import { api } from "../lib/api";
import { SOURCE_LABELS, STAGE_LABELS } from "../lib/labels";
import { percent } from "../lib/summary";
import { useResource } from "../lib/useResource";

const TOP_TAGS = 12;

export function DashboardPage() {
  const dash = useResource(() => api.dashboard());
  if (dash.error) return <p role="alert" className="error">Could not load dashboard: {dash.error}</p>;
  if (!dash.data) return <p className="muted">Loading…</p>;

  const { applications: a, leetcode: lc, week } = dash.data;

  return (
    <div>
      <h1>Dashboard</h1>
      <WeeklySummaryCard week={week} />

      <h2 style={{ marginTop: "1.5rem" }}>Applications</h2>
      {a.total_applied === 0 ? (
        <EmptyState title="No applications sent yet">
          The funnel and response rates appear once you've logged applications on the{" "}
          <Link to="/applications">Applications</Link> page.
        </EmptyState>
      ) : (
        <>
          <div className="grid">
            <section className="panel" aria-label="Response rate">
              <div className="big">{percent(a.response_rate)}</div>
              <div className="muted small">
                response rate ({a.total_responded} of {a.total_applied})
              </div>
            </section>
            <section className="panel" aria-label="Median days to first response">
              <div className="big">{a.median_days_to_response ?? "—"}</div>
              <div className="muted small">
                median days from applied to first response
                {a.median_days_to_response === null ? " (no responses yet)" : ""}
              </div>
            </section>
            <section className="panel" aria-label="Outcomes">
              <div className="small">
                {a.outcomes.map((o) => `${STAGE_LABELS[o.stage]}: ${o.count}`).join(" · ")}
              </div>
              <div className="muted small">Wishlist (not yet applied): {a.wishlist}</div>
            </section>
          </div>
          <p className="muted small">
            A “response” is reaching online assessment, phone screen, interview, offer or rejection. Ghosted and
            withdrawn don't count. Archived applications are included.
          </p>

          <div className="grid">
            <section className="panel" aria-label="Funnel">
              <h2>Funnel — got at least this far</h2>
              <BarChartCard
                valueName="Applications"
                data={a.funnel.map((f) => ({ label: STAGE_LABELS[f.stage], value: f.count }))}
              />
            </section>

            <section className="panel" aria-label="By source">
              <h2>Response rate by source</h2>
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Applied</th>
                    <th>Responses</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {a.by_source.map((s) => (
                    <tr key={s.source}>
                      <td>{SOURCE_LABELS[s.source]}</td>
                      <td>{s.applied}</td>
                      <td>{s.responded}</td>
                      <td>{percent(s.rate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>

            <section className="panel" aria-label="By resume version">
              <h2>Response rate by resume version</h2>
              {a.by_resume.length === 0 ? (
                <p className="muted small">
                  Fill in “Resume version” on applications (e.g. v3-backend) to compare versions.
                </p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>Version</th>
                      <th>Applied</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {a.by_resume.map((r) => (
                      <tr key={r.resume_version}>
                        <td>{r.resume_version}</td>
                        <td>{r.applied}</td>
                        <td>
                          {r.enough_data ? (
                            percent(r.rate)
                          ) : (
                            <span className="muted small">
                              needs {a.min_resume_sample - r.applied} more to show a rate
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <p className="muted small">Rates are hidden until a version has {a.min_resume_sample}+ applications — fewer is noise.</p>
            </section>
          </div>
        </>
      )}

      <h2 style={{ marginTop: "1.5rem" }}>LeetCode</h2>
      {lc.total === 0 ? (
        <EmptyState title="No problems logged yet">
          Log problems from <Link to="/">Today</Link> or <Link to="/goals">Goals</Link> to see breakdowns here.
        </EmptyState>
      ) : (
        <div className="grid">
          <section className="panel" aria-label="Solved without hints">
            <div className="big">{percent(lc.without_hints_rate)}</div>
            <div className="muted small">
              solved without hints ({lc.without_hints} of {lc.hints_known} with known hint status; {lc.total} total)
            </div>
          </section>
          <section className="panel" aria-label="By difficulty">
            <h2>By difficulty</h2>
            <BarChartCard
              valueName="Problems"
              data={lc.by_difficulty
                .filter((d) => d.difficulty !== "unknown" || d.count > 0)
                .map((d) => ({ label: d.difficulty[0].toUpperCase() + d.difficulty.slice(1), value: d.count }))}
            />
          </section>
          <section className="panel" aria-label="By topic">
            <h2>By topic tag{lc.by_tag.length > TOP_TAGS ? ` (top ${TOP_TAGS})` : ""}</h2>
            {lc.by_tag.length === 0 ? (
              <p className="muted small">Add topic tags when logging problems to see which areas you practise.</p>
            ) : (
              <BarChartCard
                valueName="Problems"
                data={lc.by_tag.slice(0, TOP_TAGS).map((t) => ({ label: t.tag, value: t.count }))}
              />
            )}
          </section>
        </div>
      )}
    </div>
  );
}
