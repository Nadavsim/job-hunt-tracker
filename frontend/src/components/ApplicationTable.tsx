import { useMemo, useState } from "react";
import { filterApplications, sortApplications, type ApplicationFilter, type Sort, type SortKey } from "../lib/applications";
import { formatDate } from "../lib/dates";
import { SOURCE_LABELS, STAGE_LABELS } from "../lib/labels";
import { SOURCES, STAGES, type Application, type Source, type Stage } from "../lib/types";
import { StageSelect } from "./StageSelect";

interface Props {
  applications: Application[];
  onMove: (app: Application, stage: Stage) => void;
  onOpen: (app: Application) => void;
}

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "company", label: "Company" },
  { key: "role", label: "Role" },
  { key: "stage", label: "Stage" },
  { key: "source", label: "Source" },
  { key: "date_applied", label: "Applied" },
  { key: "next_follow_up", label: "Follow-up" },
  { key: "days_in_stage", label: "Days in stage" },
];

const ACTIVE_STAGES: Stage[] = ["wishlist", "applied", "online_assessment", "phone_screen", "interview", "offer"];

export function ApplicationTable({ applications, onMove, onOpen }: Props) {
  const [filter, setFilter] = useState<ApplicationFilter>({ text: "", stages: [], source: "" });
  const [sort, setSort] = useState<Sort>({ key: "date_applied", dir: "desc" });

  const rows = useMemo(
    () => sortApplications(filterApplications(applications, filter), sort),
    [applications, filter, sort],
  );

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
  }

  const stageValue = filter.stages.length === 0 ? "" : filter.stages.length === 1 ? filter.stages[0] : "active";

  return (
    <div>
      <div className="filters">
        <input
          type="search"
          placeholder="Search company, role, notes…"
          aria-label="Search applications"
          value={filter.text}
          onChange={(e) => setFilter({ ...filter, text: e.target.value })}
        />
        <select
          aria-label="Filter by stage"
          value={stageValue}
          onChange={(e) => {
            const v = e.target.value;
            setFilter({ ...filter, stages: v === "" ? [] : v === "active" ? ACTIVE_STAGES : [v as Stage] });
          }}
        >
          <option value="">All stages</option>
          <option value="active">Active (not closed)</option>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter by source"
          value={filter.source}
          onChange={(e) => setFilter({ ...filter, source: e.target.value as Source | "" })}
        >
          <option value="">All sources</option>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
        <span className="muted small">
          {rows.length} of {applications.length}
        </span>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th
                  key={c.key}
                  aria-sort={sort.key === c.key ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}
                >
                  <button type="button" className="link" onClick={() => toggleSort(c.key)}>
                    {c.label}
                    {sort.key === c.key ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.id} className={a.is_stale ? "stale" : undefined}>
                <td>
                  <button type="button" className="link" onClick={() => onOpen(a)}>
                    {a.company}
                  </button>
                </td>
                <td>{a.role}</td>
                <td>
                  <StageSelect label={`Stage for ${a.company}`} value={a.stage} onChange={(s) => onMove(a, s)} />
                </td>
                <td>{SOURCE_LABELS[a.source]}</td>
                <td>{formatDate(a.date_applied)}</td>
                <td>{formatDate(a.next_follow_up)}</td>
                <td>
                  {a.days_in_stage}
                  {a.is_stale && <span className="badge warn"> stale</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="muted">No applications match these filters.</p>}
      </div>
    </div>
  );
}
