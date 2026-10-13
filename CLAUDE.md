# CLAUDE.md

Guidance for Claude sessions working on this repo. The owner is a new CS grad;
this is a daily-use tool **and** a portfolio project. Prefer clear, defensible,
explainable code over cleverness. The owner is on **Windows + PowerShell**;
any command you document must work there.

## What this is

Local-only, single-user job-search tracker: applications + stage history +
contacts (M1), daily goals with streaks and a Today page (M2), dashboard and
weekly summary (M3), optional on-demand LeetCode sync (M4). See README.md for
the feature list.

## Run / test

From the repo root (works in PowerShell):

```
python run.py setup   # venv + pip + npm install
python run.py dev     # API :8000 (reload) + Vite :5173 (proxies /api)
python run.py start   # npm run build, then FastAPI serves frontend/dist on :8000
python run.py test    # pytest + vitest
```

Individually: `cd backend; .\.venv\Scripts\python -m pytest` and
`cd frontend; npm test` / `npm run typecheck` / `npm run build`.

Before committing: backend tests, frontend tests, and `npm run build` (which
runs `tsc -b`) must all pass.

## Layout

- `backend/app/models.py` — **every** table. Keep it that way (Alembic later only needs this module).
- `backend/app/schemas.py` — API shapes, separate from tables.
- `backend/app/routers/*` — thin HTTP layer. No business rules here beyond validation/404s.
- `backend/app/services/*` — business rules. `streaks.py` and `stats.py` are pure functions over plain data; keep them pure so they stay easy to test.
- `backend/app/clock.py` — routes get "now" via `Depends(get_clock)`; never call `date.today()` / `datetime.now()` in a route or service that a route uses.
- `backend/app/services/leetcode_sync.py` — the only module allowed to make outbound HTTP calls.
- `backend/tests/conftest.py` — `client` fixture: in-memory SQLite + fixed clock (Wed 2026-03-18 10:00) + a fake HTTP client that fails the test on any network call. `clock.set(...)` moves time.
- `frontend/src/lib/` — API client (`api.ts`), types mirroring `schemas.py` (`types.ts`), and pure helpers with unit tests.
- `frontend/src/components/`, `frontend/src/pages/` — UI. Page tests mock `../lib/api` with `vi.mock`.
- `run.py` — stdlib-only cross-platform task runner (replaces a Makefile, which doesn't work on Windows).

## Conventions

- Python: type hints, SQLModel tables, Pydantic v2 schemas. PATCH endpoints use `model_dump(exclude_unset=True)`; explicit `null` clears optional fields, but required fields (company, role, …) ignore `null`.
- Dates over the API are ISO strings. Frontend builds local dates with `lib/dates.ts` — never `new Date("YYYY-MM-DD")` (that is UTC midnight and shifts a day west of UTC).
- Enum values are snake_case strings (`online_assessment`); display labels live in `frontend/src/lib/labels.ts`.
- Styling: plain CSS with variables in `styles.css`; dark mode via `prefers-color-scheme`. No CSS framework.
- Every view needs an empty state that tells a new user what to do.
- Forms: only truly required fields are required; Enter submits; focus returns to the first field after a successful add.
- Tests are written with each feature, not afterwards. Test data must be obviously fake ("Example Co", "Sam Sample", example.com).
- Never commit `data/`, `*.db`, `.env*`, `exports/` (already in `.gitignore`).
  The `data/` rule matches a folder named `data` *anywhere*, on purpose. Don't put files that must be committed in a folder named `data` (bundled reference files live in `backend/app/reference/`).

## Conventions / decisions (don't "fix" these without asking)

1. **Stage-history table (`StageChange`), plus `Application.stage` denormalised.** History powers the funnel, "days to first response", and the stale rule; the denormalised current stage keeps board/table queries trivial. Both are written in one place (`services/applications.py`).
2. **"Ghosted" is never set automatically.** Silence isn't proof (some companies reply after 6 weeks), and an automatic status change would corrupt the stats with a guess. The app only *suggests*: an application in `applied` whose last stage change is 21+ local days ago shows up on Today and is flagged on the board. The user clicks "Mark ghosted".
3. **Back-dated applications get history on the real date.** Creating an application with an earlier `date_applied` records its `applied` history entry at that date (midnight), and later stages at "now". Editing `date_applied` while still in `applied` moves that entry too. Otherwise logging last month's applications today would make them look fresh.
4. **Leaving the wishlist sets `date_applied` to today** if empty (except moving to `withdrawn`). "Applied" everywhere means "has a `date_applied`"; wishlist items never count as applied.
5. **Local time everywhere.** Timestamps are naive local datetimes (columns annotated `NaiveDatetime` so SQLModel doesn't convert to UTC), dates are local dates. The app runs on the user's machine, and every question it answers is "in my day/week". Trade-off: if you travel across time zones, history is in whatever zone the machine was in.
6. **Streak rules** (`services/streaks.py`, tested in `tests/test_streaks.py`):
   - Period = local calendar day, or ISO week Monday–Sunday.
   - The current period, if not yet met, does **not** break the streak — counting starts from the previous period. It only becomes a miss once it ends. If already met, it is included.
   - Activity dated in the future is ignored. Back-filling a missed day restores the streak.
   - Longest streak = longest run of met periods ever, including the current run.
   - Targets are **not versioned**: changing a target re-evaluates history against the new number. Simple, and honest about what the user wants now; versioning was judged not worth the complexity.
7. **Applications goal is counted from `date_applied`**, not from creation time, so back-filled entries count on the day they were actually sent.
8. **Course progress = count of `ModuleCompletion` rows**, not a stored number, so every module has a date and can feed daily streaks. Completions can't exceed `total_modules`.
9. **Response = ever reached OA, phone screen, interview, offer or rejected.** Ghosted and withdrawn are not responses (a rejection *is* a response). Response rate = responded / applied.
10. **Funnel counts "got at least this far"** using the furthest pipeline stage ever reached. Companies skip stages (no OA), and being rejected after an interview still means you reached the interview.
11. **Resume-version response rate is withheld (`rate: null`) below 5 applications** — enforced in the API, not just hidden in the UI — and the UI says how many more are needed. Applications without a resume version aren't listed as a "version".
12. **Archived applications are still counted in stats and goals.** Archiving declutters the board/table; it doesn't rewrite what happened.
13. **Follow-ups are not shown for closed applications** (offer/rejected/ghosted/withdrawn) or archived ones.
14. **"Longest streak" in the weekly summary = the longest *current* streak among enabled goals**, with the goal named. (See Open questions in the PR — could instead mean all-time best.)
15. **A response counts in the weekly summary in the week it arrived**, regardless of when the application was sent.
16. **Tags are a comma-separated lowercase column**, not a tag table. Data volume is tiny and breakdowns are computed in Python. Move to a link table only if tag queries are ever needed in SQL.
17. **Filtering/sorting of applications happens in the browser.** A job hunt is hundreds of rows at most; it keeps the API to plain CRUD.
18. **`solved_without_hints` is nullable.** `null` = unknown (synced problems); the rate on the dashboard only uses known values and says how many that is.
19. **LeetCode sync** (opt-in, on demand, no polling): dedupe key is `(slug, local solved date)`. Manual logs get a slug derived from the typed name (`"1. Two Sum"` → `two-sum`) so they match synced ones. Solving the same problem again on a different day is new practice and is imported. Any failure → HTTP 502 with a human message, `session.rollback()`, nothing half-imported. Only the username is sent.
20. **Bind to `127.0.0.1` only** (hard-coded in `config.py`). No auth exists, and the DB holds personal data.
21. **No Alembic yet.** `SQLModel.metadata.create_all` creates missing tables but does **not** alter existing ones. Purely *additive* columns are listed in `db.ADDED_COLUMNS` and added at startup with `ALTER TABLE … ADD COLUMN` if missing (idempotent, tested against an old-schema database). Anything else (rename, type change, drop, data migration) is the trigger to introduce Alembic.
22. **SPA fallback**: FastAPI serves `frontend/dist` and returns `index.html` for unknown non-`/api` paths so client routes survive refresh. Unknown `/api/*` paths stay 404.
23. **Recharts, single-series horizontal bars only**, one accent colour from the theme; rates are shown in tables rather than charts. Keep charts few.
24. **One problem log for every platform.** `LeetCodeLog` has a `platform` column (leetcode / neetcode / other). The table, the `/api/leetcode` routes and the `leetcode` goal-type value keep their names because they are stored in existing databases; user-facing text says "coding problems" / "problem log".
25. **NeetCode 150 progress is derived, not stored.** A checklist problem is solved if any problem log has its slug, from any platform, so logging by hand or syncing from LeetCode ticks it off, and there is no second source of truth. "Solved" on the checklist creates a normal log (platform `neetcode`, slug taken from the list, topic as its tag), so it counts toward the daily goal. There is no "untick": delete the log entry instead.
26. **The NeetCode 150 list is bundled data** (`backend/app/reference/neetcode150.json`, one problem per line), extracted from `.problemSiteData.json` in the public `neetcode-gh/leetcode` GitHub repo (entries flagged `neetcode150`). It's not fetched at runtime: NeetCode has no public API, and the app must not depend on the network. Problem links go to LeetCode, because that file only has LeetCode URLs.

## Planned next (not yet implemented)

- Alembic migrations (first schema change to an existing table should introduce it).
- Export/import (CSV/JSON) for backups — exports must go to the git-ignored `exports/` folder.
- "Snooze" for stale suggestions (currently they stay until the stage changes or the app is archived).
- Refreshing the bundled NeetCode 150 list if NeetCode changes it (re-extract from the repo file above; keep the format).
- Inline editing of problem logs beyond the "solved without hints" dropdown (problem/tags/difficulty), and editing module completion dates.
- Contact ↔ application linking from the Contacts page (currently done from the application dialog).
- Versioned goal targets, if changing targets retroactively ever becomes a problem.
- `run.py dev` on Windows: `terminate()` stops `npm.cmd` but may leave the Vite child running; if that happens, kill the process tree (e.g. `taskkill /T`).
- Playwright end-to-end tests (none yet; current UI tests are component-level with a mocked API).
