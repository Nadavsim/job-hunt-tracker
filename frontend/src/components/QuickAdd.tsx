import { forwardRef, useState, type FormEvent } from "react";
import { SOURCE_LABELS, STAGE_LABELS } from "../lib/labels";
import { SOURCES, STAGES, type ApplicationInput, type Source, type Stage } from "../lib/types";

interface Props {
  onAdd: (input: ApplicationInput) => Promise<unknown>;
}

/**
 * Speed-first entry: only company + role are required, Enter submits from any
 * field, and focus returns to "Company" so several can be logged in a row.
 */
export const QuickAdd = forwardRef<HTMLInputElement, Props>(function QuickAdd({ onAdd }, companyRef) {
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [stage, setStage] = useState<Stage>("applied");
  const [source, setSource] = useState<Source>("linkedin");
  const [jobUrl, setJobUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!company.trim() || !role.trim()) {
      setError("Company and role are required.");
      return;
    }
    setBusy(true);
    try {
      await onAdd({ company: company.trim(), role: role.trim(), stage, source, job_url: jobUrl.trim() || null });
      setCompany("");
      setRole("");
      setJobUrl("");
      setError(null);
      if (companyRef && typeof companyRef === "object") companyRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="quick-add" onSubmit={submit} aria-label="Quick add application">
      <label>
        Company*
        <input ref={companyRef} value={company} onChange={(e) => setCompany(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Role*
        <input value={role} onChange={(e) => setRole(e.target.value)} autoComplete="off" />
      </label>
      <label>
        Stage
        <select value={stage} onChange={(e) => setStage(e.target.value as Stage)}>
          {STAGES.map((s) => (
            <option key={s} value={s}>
              {STAGE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source
        <select value={source} onChange={(e) => setSource(e.target.value as Source)}>
          {SOURCES.map((s) => (
            <option key={s} value={s}>
              {SOURCE_LABELS[s]}
            </option>
          ))}
        </select>
      </label>
      <label className="grow">
        Job URL
        <input value={jobUrl} onChange={(e) => setJobUrl(e.target.value)} type="url" autoComplete="off" />
      </label>
      <button type="submit" disabled={busy}>
        Add
      </button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
});
