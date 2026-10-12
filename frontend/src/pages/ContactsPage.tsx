import { useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import type { Contact } from "../lib/types";
import { useResource } from "../lib/useResource";

const EMPTY = { name: "", role: "", email: "", linkedin: "", notes: "" };

export function ContactsPage() {
  const contacts = useResource(() => api.listContacts());
  const apps = useResource(() => api.listApplications(true));
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
  return (
    <div>
      <h1>Contacts</h1>
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
                  <td>{c.notes}</td>
                  <td className="row">
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
