import { useEffect, useRef, useState, type FormEvent } from "react";
import { api } from "../lib/api";
import { formatDate } from "../lib/dates";
import { SOURCE_LABELS, STAGE_LABELS } from "../lib/labels";
import { SOURCES, STAGES, type Application, type ApplicationInput, type Contact } from "../lib/types";

interface Props {
  application: Application;
  contacts: Contact[];
  onSave: (id: number, input: ApplicationInput) => Promise<unknown>;
  onDelete: (id: number) => Promise<unknown>;
  onContactCreated: () => void;
  onClose: () => void;
}

type Draft = Required<Omit<ApplicationInput, "contact_ids">> & { contact_ids: number[] };

function toDraft(a: Application): Draft {
  return {
    company: a.company,
    role: a.role,
    job_url: a.job_url ?? "",
    location: a.location ?? "",
    source: a.source,
    stage: a.stage,
    date_applied: a.date_applied ?? "",
    notes: a.notes ?? "",
    resume_version: a.resume_version ?? "",
    next_follow_up: a.next_follow_up ?? "",
    archived: a.archived,
    contact_ids: a.contacts.map((c) => c.id),
  };
}

/** Empty inputs are sent as null so the field is cleared server-side. */
function fromDraft(d: Draft): ApplicationInput {
  const blank = (v: string | null) => (v && v.trim() ? v.trim() : null);
  return {
    ...d,
    job_url: blank(d.job_url),
    location: blank(d.location),
    date_applied: blank(d.date_applied),
    notes: blank(d.notes),
    resume_version: blank(d.resume_version),
    next_follow_up: blank(d.next_follow_up),
  };
}

export function ApplicationDetail({ application, contacts, onSave, onDelete, onContactCreated, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(application));
  const [newContact, setNewContact] = useState("");
  const [error, setError] = useState<string | null>(null);
  const firstField = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(toDraft(application)), [application]);
  useEffect(() => firstField.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await onSave(application.id, fromDraft(draft));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function addContact() {
    if (!newContact.trim()) return;
    const c = await api.createContact({ name: newContact.trim() });
    setNewContact("");
    set("contact_ids", [...draft.contact_ids, c.id]);
    onContactCreated();
  }

  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Edit ${application.company}`}
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={save} className="form-grid">
          <h2 className="span-2">
            {application.company} — {application.role}
          </h2>
          <label>
            Company*
            <input ref={firstField} required value={draft.company ?? ""} onChange={(e) => set("company", e.target.value)} />
          </label>
          <label>
            Role*
            <input required value={draft.role ?? ""} onChange={(e) => set("role", e.target.value)} />
          </label>
          <label>
            Stage
            <select value={draft.stage} onChange={(e) => set("stage", e.target.value as Draft["stage"])}>
              {STAGES.map((s) => (
                <option key={s} value={s}>
                  {STAGE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select value={draft.source} onChange={(e) => set("source", e.target.value as Draft["source"])}>
              {SOURCES.map((s) => (
                <option key={s} value={s}>
                  {SOURCE_LABELS[s]}
                </option>
              ))}
            </select>
          </label>
          <label>
            Date applied
            <input type="date" value={draft.date_applied ?? ""} onChange={(e) => set("date_applied", e.target.value)} />
          </label>
          <label>
            Next follow-up
            <input
              type="date"
              value={draft.next_follow_up ?? ""}
              onChange={(e) => set("next_follow_up", e.target.value)}
            />
          </label>
          <label>
            Location / remote
            <input value={draft.location ?? ""} onChange={(e) => set("location", e.target.value)} />
          </label>
          <label>
            Resume version
            <input
              value={draft.resume_version ?? ""}
              placeholder="e.g. v3-backend"
              onChange={(e) => set("resume_version", e.target.value)}
            />
          </label>
          <label className="span-2">
            Job URL
            <input type="url" value={draft.job_url ?? ""} onChange={(e) => set("job_url", e.target.value)} />
          </label>
          <label className="span-2">
            Salary / notes
            <textarea rows={4} value={draft.notes ?? ""} onChange={(e) => set("notes", e.target.value)} />
          </label>

          <fieldset className="span-2">
            <legend>Contacts</legend>
            {contacts.length === 0 && <p className="muted small">No contacts yet — add one below.</p>}
            <div className="checks">
              {contacts.map((c) => (
                <label key={c.id} className="check">
                  <input
                    type="checkbox"
                    checked={draft.contact_ids.includes(c.id)}
                    onChange={(e) =>
                      set(
                        "contact_ids",
                        e.target.checked ? [...draft.contact_ids, c.id] : draft.contact_ids.filter((id) => id !== c.id),
                      )
                    }
                  />
                  {c.name}
                  {c.role ? ` (${c.role})` : ""}
                </label>
              ))}
            </div>
            <div className="row">
              <input
                aria-label="New contact name"
                placeholder="New contact name"
                value={newContact}
                onChange={(e) => setNewContact(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void addContact();
                  }
                }}
              />
              <button type="button" onClick={addContact}>
                Add contact
              </button>
            </div>
          </fieldset>

          <label className="check span-2">
            <input type="checkbox" checked={draft.archived ?? false} onChange={(e) => set("archived", e.target.checked)} />
            Archived (hidden from board and table; still counted in stats)
          </label>

          <div className="span-2">
            <h3>Stage history</h3>
            <ol className="history">
              {application.history.map((h, i) => (
                <li key={i}>
                  {STAGE_LABELS[h.stage]} — {formatDate(h.changed_at)}
                </li>
              ))}
            </ol>
          </div>

          {error && (
            <p role="alert" className="error span-2">
              {error}
            </p>
          )}
          <div className="row span-2 actions">
            <button type="submit">Save</button>
            <button type="button" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="danger"
              onClick={async () => {
                if (window.confirm(`Delete ${application.company}? This cannot be undone. (Archive instead to hide it.)`)) {
                  await onDelete(application.id);
                  onClose();
                }
              }}
            >
              Delete
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
