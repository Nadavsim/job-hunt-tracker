import { useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { formatDate, todayISO } from "../lib/dates";
import { OUTREACH_KIND_LABELS } from "../lib/labels";
import { OUTREACH_KINDS, type Contact, type OutreachKind } from "../lib/types";
import { useResource } from "../lib/useResource";

const NEW_CONTACT = "new";

/** Log one networking action. Pick a contact, type a new name, or leave it general. */
function OutreachForm({ contacts, onLogged }: { contacts: Contact[]; onLogged: () => Promise<unknown> }) {
  const [who, setWho] = useState(""); // "" = nobody in particular, NEW_CONTACT, or a contact id
  const [newName, setNewName] = useState("");
  const [kind, setKind] = useState<OutreachKind>("message");
  const [happenedOn, setHappenedOn] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (who === NEW_CONTACT && !newName.trim()) return setError("Type the new contact's name.");
    try {
      await api.logOutreach({
        contact_id: who && who !== NEW_CONTACT ? Number(who) : null,
        new_contact_name: who === NEW_CONTACT ? newName.trim() : null,
        kind,
        happened_on: happenedOn || undefined,
        notes: notes.trim() || null,
      });
      setNewName("");
      setNotes("");
      if (who === NEW_CONTACT) setWho("");
      setError(null);
      await onLogged();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className="quick-add" onSubmit={submit} aria-label="Log networking">
      <label>
        Who
        <select value={who} onChange={(e) => setWho(e.target.value)}>
          <option value="">— nobody in particular —</option>
          <option value={NEW_CONTACT}>+ New contact…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {who === NEW_CONTACT && (
        <label>
          New contact name*
          <input value={newName} onChange={(e) => setNewName(e.target.value)} autoComplete="off" autoFocus />
        </label>
      )}
      <label>
        What
        <select value={kind} onChange={(e) => setKind(e.target.value as OutreachKind)}>
          {OUTREACH_KINDS.map((k) => (
            <option key={k} value={k}>
              {OUTREACH_KIND_LABELS[k]}
            </option>
          ))}
        </select>
      </label>
      <label>
        Date
        <input type="date" value={happenedOn} onChange={(e) => setHappenedOn(e.target.value)} />
      </label>
      <label className="grow">
        Notes
        <input value={notes} onChange={(e) => setNotes(e.target.value)} autoComplete="off" />
      </label>
      <button type="submit">Log</button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}

const EMPTY = { name: "", role: "", email: "", linkedin: "", notes: "" };

export function NetworkingPage() {
  const contacts = useResource(() => api.listContacts());
  const apps = useResource(() => api.listApplications(true));
  const outreach = useResource(() => api.listOutreach());
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const companyOf = (id: number) => apps.data?.find((a) => a.id === id)?.company ?? `#${id}`;
  const clean = (v: string) => (v.trim() ? v.trim() : null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return setError("Name is required.");
    const body = {
      name: form.name.trim(),
      role: clean(form.role),
      email: clean(form.email),
      linkedin: clean(form.linkedin),
      notes: clean(form.notes),
    };
    try {
      if (editing) await api.updateContact(editing, body);
      else await api.createContact(body);
      setForm(EMPTY);
      setEditing(null);
      setError(null);
      await contacts.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function edit(c: Contact) {
    setEditing(c.id);
    setForm({
      name: c.name,
      role: c.role ?? "",
      email: c.email ?? "",
      linkedin: c.linkedin ?? "",
      notes: c.notes ?? "",
    });
  }

  const list = contacts.data ?? [];
  const recent = (outreach.data ?? []).slice(0, 10);
  const reloadAll = () => Promise.all([contacts.reload(), outreach.reload()]);

  return (
    <div>
      <h1>Networking</h1>
      <p className="muted small">
        Referrals often get more replies than cold applications; “Response rate by source” on the Dashboard
        shows whether that's true for you. Every message, chat or referral ask you log counts toward the weekly networking goal.
      </p>
      <OutreachForm contacts={list} onLogged={reloadAll} />

      {recent.length > 0 && (
        <section className="panel" aria-label="Recent networking" style={{ marginBottom: "1rem" }}>
          <h2>Recent</h2>
          <ul className="list">
            {recent.map((o) => (
              <li key={o.id}>
                <span>
                  {formatDate(o.happened_on)} · {OUTREACH_KIND_LABELS[o.kind]}
                  {o.contact_name ? ` · ${o.contact_name}` : ""}
                  {o.notes ? <span className="muted small"> — {o.notes}</span> : null}
                </span>
                <button
                  type="button"
                  className="danger"
                  aria-label={`Delete networking entry from ${formatDate(o.happened_on)}`}
                  onClick={async () => {
                    await api.deleteOutreach(o.id);
                    await reloadAll();
                  }}
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2>Contacts</h2>
      <form className="quick-add" onSubmit={submit} aria-label={editing ? "Edit contact" : "Add contact"}>
        {(["name", "role", "email", "linkedin", "notes"] as const).map((k) => (
          <label key={k} className={k === "notes" ? "grow" : undefined}>
            {k === "linkedin" ? "LinkedIn" : k[0].toUpperCase() + k.slice(1)}
            {k === "name" ? "*" : ""}
            <input value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
          </label>
        ))}
        <button type="submit">{editing ? "Save" : "Add"}</button>
        {editing && (
          <button
            type="button"
            onClick={() => {
              setEditing(null);
              setForm(EMPTY);
            }}
          >
            Cancel
          </button>
        )}
        {error && <p role="alert" className="error">{error}</p>}
      </form>
      <p className="muted small">Link contacts to applications from the application's edit dialog.</p>
      {!contacts.loading && list.length === 0 ? (
        <EmptyState title="No contacts yet">Recruiters, referrers and interviewers you meet go here.</EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Email / LinkedIn</th>
                <th>Applications</th>
                <th>Last contacted</th>
                <th>Notes</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.role}</td>
                  <td>{[c.email, c.linkedin].filter(Boolean).join(" · ")}</td>
                  <td>{c.application_ids.map(companyOf).join(", ")}</td>
                  <td>
                    {c.last_contacted ? formatDate(c.last_contacted) : "—"}
                    {c.outreach_count > 1 ? <span className="muted small"> ({c.outreach_count}×)</span> : null}
                  </td>
                  <td>{c.notes}</td>
                  <td className="row">
                    <button
                      type="button"
                      title="Log a message to this contact today"
                      aria-label={`Log a message to ${c.name} today`}
                      onClick={async () => {
                        await api.logOutreach({ contact_id: c.id, kind: "message" });
                        await reloadAll();
                      }}
                    >
                      +1 message
                    </button>
                    <button type="button" onClick={() => edit(c)}>
                      Edit
                    </button>
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        if (window.confirm(`Delete ${c.name}?`)) {
                          await api.deleteContact(c.id);
                          await contacts.reload();
                        }
                      }}
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
    </div>
  );
}
