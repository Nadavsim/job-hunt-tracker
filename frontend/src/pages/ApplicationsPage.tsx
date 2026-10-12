import { useEffect, useRef, useState } from "react";
import { ApplicationDetail } from "../components/ApplicationDetail";
import { ApplicationTable } from "../components/ApplicationTable";
import { EmptyState } from "../components/EmptyState";
import { KanbanBoard } from "../components/KanbanBoard";
import { QuickAdd } from "../components/QuickAdd";
import { api } from "../lib/api";
import type { Application, Stage } from "../lib/types";
import { useResource } from "../lib/useResource";

type View = "board" | "table";

function loadView(): View {
  try {
    return localStorage.getItem("applications.view") === "table" ? "table" : "board";
  } catch {
    return "board";
  }
}

export function ApplicationsPage() {
  const [view, setView] = useState<View>(loadView);
  const [showArchived, setShowArchived] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const apps = useResource(() => api.listApplications(showArchived), [showArchived]);
  const contacts = useResource(() => api.listContacts());
  const companyInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("applications.view", view);
    } catch {
      /* storage unavailable - not important */
    }
  }, [view]);

  // "n" anywhere outside a field jumps to the quick-add form.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (e.key === "n" && !e.ctrlKey && !e.metaKey && !["INPUT", "TEXTAREA", "SELECT"].includes(tag)) {
        e.preventDefault();
        companyInput.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function move(app: Application, stage: Stage) {
    // Optimistic update so the board feels instant; reload to get history/derived fields.
    apps.setData((list) => list?.map((a) => (a.id === app.id ? { ...a, stage } : a)));
    try {
      await api.updateApplication(app.id, { stage });
    } finally {
      await apps.reload();
    }
  }

  const list = apps.data ?? [];
  const open = list.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <div className="page-header">
        <h1>Applications</h1>
        <div className="row">
          <div role="group" aria-label="View" className="segmented">
            <button type="button" aria-pressed={view === "board"} onClick={() => setView("board")}>
              Board
            </button>
            <button type="button" aria-pressed={view === "table"} onClick={() => setView("table")}>
              Table
            </button>
          </div>
          <label className="check small">
            <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
            Show archived
          </label>
        </div>
      </div>

      <QuickAdd
        ref={companyInput}
        onAdd={async (input) => {
          await api.createApplication(input);
          await apps.reload();
        }}
      />

      {apps.error && <p role="alert" className="error">Could not load applications: {apps.error}</p>}
      {!apps.loading && !apps.error && list.length === 0 ? (
        <EmptyState title="No applications yet">
          <p>
            Add your first one above — only company and role are required. Tip: press <kbd>n</kbd> to jump to the form.
          </p>
        </EmptyState>
      ) : view === "board" ? (
        <KanbanBoard applications={list} onMove={move} onOpen={(a) => setOpenId(a.id)} />
      ) : (
        <ApplicationTable applications={list} onMove={move} onOpen={(a) => setOpenId(a.id)} />
      )}

      {open && (
        <ApplicationDetail
          application={open}
          contacts={contacts.data ?? []}
          onSave={async (id, input) => {
            await api.updateApplication(id, input);
            await Promise.all([apps.reload(), contacts.reload()]);
          }}
          onDelete={async (id) => {
            await api.deleteApplication(id);
            await apps.reload();
          }}
          onContactCreated={() => void contacts.reload()}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  );
}
