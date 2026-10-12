import { useRef, useState, type FormEvent } from "react";
import { EmptyState } from "../components/EmptyState";
import { api } from "../lib/api";
import { formatDate, todayISO } from "../lib/dates";
import { MOCK_KIND_LABELS } from "../lib/labels";
import { MOCK_KINDS, type MockKind } from "../lib/types";
import { useResource } from "../lib/useResource";

const RATINGS = [1, 2, 3, 4, 5];

/** Log practice interviews: what kind, with whom, how it went, what to fix. */
export function MockInterviewsPage() {
  const mocks = useResource(() => api.listMocks());
  const [kind, setKind] = useState<MockKind>("technical");
  const [partner, setPartner] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [heldOn, setHeldOn] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const kindRef = useRef<HTMLSelectElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.logMock({
        kind,
        partner: partner.trim() || null,
        self_rating: rating,
        held_on: heldOn || undefined,
        notes: notes.trim() || null,
      });
      setNotes("");
      setRating(null);
      setError(null);
      kindRef.current?.focus();
      await mocks.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  const list = mocks.data ?? [];

  return (
    <div>
      <h1>Mock interviews</h1>
      <p className="muted small">
        Coding rounds are only part of the loop. Log practice interviews (Pramp, interviewing.io, a friend, a
        recorded self-mock) and what to fix next time; they count toward the weekly mock-interview goal.
      </p>
      <form className="quick-add" onSubmit={submit} aria-label="Log mock interview">
        <label>
          Type
          <select ref={kindRef} value={kind} onChange={(e) => setKind(e.target.value as MockKind)}>
            {MOCK_KINDS.map((k) => (
              <option key={k} value={k}>
                {MOCK_KIND_LABELS[k]}
              </option>
            ))}
          </select>
        </label>
        <label>
          With / where
          <input value={partner} placeholder="e.g. Pramp, a friend" onChange={(e) => setPartner(e.target.value)} />
        </label>
        <fieldset className="rating">
          <legend>How did it go?</legend>
          {RATINGS.map((r) => (
            <label key={r} className="check">
              <input type="radio" name="rating" checked={rating === r} onChange={() => setRating(r)} />
              {r}
            </label>
          ))}
        </fieldset>
        <label>
          Date
          <input type="date" value={heldOn} onChange={(e) => setHeldOn(e.target.value)} />
        </label>
        <label className="grow">
          What to improve
          <input value={notes} onChange={(e) => setNotes(e.target.value)} autoComplete="off" />
        </label>
        <button type="submit">Log</button>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
      </form>

      {!mocks.loading && list.length === 0 ? (
        <EmptyState title="No mock interviews yet">
          Schedule one this week — even 30 minutes talking through a problem out loud with a friend counts.
        </EmptyState>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>With / where</th>
                <th>Rating</th>
                <th>What to improve</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((m) => (
                <tr key={m.id}>
                  <td>{formatDate(m.held_on)}</td>
                  <td>{MOCK_KIND_LABELS[m.kind]}</td>
                  <td>{m.partner}</td>
                  <td>{m.self_rating ? `${m.self_rating} / 5` : "—"}</td>
                  <td>{m.notes}</td>
                  <td>
                    <button
                      type="button"
                      className="danger"
                      onClick={async () => {
                        await api.deleteMock(m.id);
                        await mocks.reload();
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
