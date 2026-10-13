import { useRef, useState, type FormEvent } from "react";
import { todayISO } from "../lib/dates";
import { parseTags } from "../lib/goals";
import { PLATFORM_LABELS } from "../lib/labels";
import { PLATFORMS, type Difficulty, type LeetCodeInput, type Platform } from "../lib/types";

const PLATFORM_KEY = "problemLog.platform";

/** Remember the last platform used, since most people practise in one place. */
function loadPlatform(): Platform {
  try {
    const saved = localStorage.getItem(PLATFORM_KEY);
    return PLATFORMS.includes(saved as Platform) ? (saved as Platform) : "leetcode";
  } catch {
    return "leetcode";
  }
}

interface Props {
  onLog: (input: LeetCodeInput) => Promise<unknown>;
  compact?: boolean;
}

/** Problem name is the only required field; Enter submits; focus returns to it.
 * Logs problems from any platform (the API still calls them "leetcode" logs). */
export function LeetCodeForm({ onLog, compact = false }: Props) {
  const [problem, setProblem] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const [platform, setPlatform] = useState<Platform>(loadPlatform);
  const [tags, setTags] = useState("");
  const [noHints, setNoHints] = useState(true);
  const [solvedOn, setSolvedOn] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const problemRef = useRef<HTMLInputElement>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!problem.trim()) return setError("Problem name is required.");
    try {
      await onLog({
        problem: problem.trim(),
        difficulty: difficulty || null,
        tags: parseTags(tags),
        solved_without_hints: noHints,
        solved_on: solvedOn || undefined,
        notes: notes.trim() || null,
        platform,
      });
      try {
        localStorage.setItem(PLATFORM_KEY, platform);
      } catch {
        /* storage unavailable - not important */
      }
      setProblem("");
      setTags("");
      setNotes("");
      setError(null);
      problemRef.current?.focus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <form className="quick-add" onSubmit={submit} aria-label="Log LeetCode problem">
      <label className="grow">
        Problem*
        <input
          ref={problemRef}
          value={problem}
          placeholder="e.g. 1. Two Sum"
          onChange={(e) => setProblem(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label>
        Difficulty
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty | "")}>
          <option value="">—</option>
          <option value="easy">Easy</option>
          <option value="medium">Medium</option>
          <option value="hard">Hard</option>
        </select>
      </label>
      <label>
        Platform
        <select value={platform} onChange={(e) => setPlatform(e.target.value as Platform)}>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {PLATFORM_LABELS[p]}
            </option>
          ))}
        </select>
      </label>
      <label className="grow">
        Topic tags
        <input
          value={tags}
          placeholder="array, hash table"
          onChange={(e) => setTags(e.target.value)}
          autoComplete="off"
        />
      </label>
      <label className="check">
        <input type="checkbox" checked={noHints} onChange={(e) => setNoHints(e.target.checked)} />
        Solved without hints
      </label>
      {!compact && (
        <>
          <label>
            Date
            <input type="date" value={solvedOn} onChange={(e) => setSolvedOn(e.target.value)} />
          </label>
          <label className="grow">
            Notes
            <input value={notes} onChange={(e) => setNotes(e.target.value)} autoComplete="off" />
          </label>
        </>
      )}
      <button type="submit">Log</button>
      {error && (
        <p role="alert" className="error">
          {error}
        </p>
      )}
    </form>
  );
}
