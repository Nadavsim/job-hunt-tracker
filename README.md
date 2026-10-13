# Job Hunt Tracker

A personal, local-only job-search tracker with daily learning goals. It tracks
applications through their stages, nudges you about follow-ups and silent
companies, keeps daily LeetCode / course / application goals with streaks, and
shows which channels and resume versions actually get responses.

Single user, runs on your own machine, no accounts, no cloud. All data lives in
one SQLite file that is git-ignored.

## Features

**Applications (M1)**
- Quick-add form: only company + role are required; Enter submits; press `n` anywhere to jump to it
- Kanban board by stage (drag-and-drop, or the stage dropdown on each card) and a sortable, filterable table
- Stages: wishlist, applied, online assessment, phone screen, interview(s), offer, rejected, ghosted, withdrawn
- Every stage change is recorded with a timestamp (stage history)
- Fields: job URL, location/remote, source, date applied, salary/notes, resume version, next follow-up date, archived
- Contacts (recruiters, referrers…) linked to any number of applications
- Applications sitting in "applied" for 21+ days are *suggested* as possibly ghosted — never changed automatically

**Daily goals + Today (M2)**
- Log LeetCode problems (name/number, difficulty, topic tags, solved without hints, notes, date)
- Courses with a module count; each finished module is logged with a date
- Applications sent are counted automatically
- Daily or weekly targets per goal (defaults: 2 problems/day, 1 module/day, 10 applications/week)
- Streaks per goal; today (or this week) not being done yet never breaks a streak
- **Today** is the landing page: goal progress and streaks, quick problem log, "+1 module", follow-ups due or overdue, and stale-application suggestions

**Dashboard (M3)**
- Funnel (how many applications got at least as far as each stage)
- Response rate overall and per source; median days from applying to first response
- Response rate by resume version (only once a version has 5+ applications)
- LeetCode by difficulty and topic, and solved-without-hints rate
- Weekly summary card with a copy-to-clipboard plain-text version

**LeetCode sync (M4, optional)**
- Off by default. Set your LeetCode username in Settings, then press "Sync now" to import recent accepted
  submissions. Deduplicated against problems you logged by hand. Uses LeetCode's unofficial public API, so it
  may break; if it does you get a clear message and manual logging keeps working.

Also: light/dark theme following your OS, empty-state guidance on every page, usable at narrow widths.

## Requirements

- Python 3.11+
- Node.js 20+ (with npm)

## Setup and run (Windows PowerShell, macOS, Linux)

All commands are run from the repository root. `run.py` uses only the Python
standard library, so it works before anything is installed.

```powershell
python run.py setup    # creates backend\.venv and installs Python + npm dependencies (once)
python run.py dev      # development: API on http://127.0.0.1:8000, UI on http://127.0.0.1:5173
python run.py start    # "production": builds the UI, then serves everything on http://127.0.0.1:8000
python run.py test     # runs backend and frontend test suites
```

(On macOS/Linux use `python3` if `python` is not Python 3.)

In dev mode open http://127.0.0.1:5173 — Vite hot-reloads the UI and proxies
`/api` to FastAPI, which auto-reloads on Python changes. Ctrl+C stops both.

### Doing it by hand (two terminals)

```powershell
# terminal 1 - API
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1          # macOS/Linux: source .venv/bin/activate
pip install -r requirements-dev.txt
python -m app --reload

# terminal 2 - UI
cd frontend
npm install
npm run dev
```

### Where the data lives

By default `data/tracker.db` in the repo root (created on first run, git-ignored).
To use another file:

```powershell
$env:JOBTRACKER_DB_PATH = "C:\Users\me\Documents\jobhunt.db"   # PowerShell
python run.py start
```

Back up by copying that file while the app is stopped.

### Demo data

To try the app without touching your real data, create a separate demo database
filled with obviously fake companies and people:

```powershell
cd backend
.\.venv\Scripts\python -m app.seed --db ..\data\demo.db
$env:JOBTRACKER_DB_PATH = "..\data\demo.db"; .\.venv\Scripts\python -m app
```

The seed script refuses to write into a database that already has applications.

## Tests

```powershell
python run.py test
# or individually:
cd backend;  .\.venv\Scripts\python -m pytest
cd frontend; npm test
```

- Backend: pytest. Every test gets a fresh in-memory SQLite database and a fixed
  clock; the real database file is never opened, and any attempt to reach the
  network fails the test.
- Frontend: Vitest + React Testing Library (jsdom) for the pure logic in
  `src/lib` and the key components/pages, with the API module mocked.

## Architecture

```
backend/                 FastAPI + SQLModel (SQLite)
  app/
    main.py              app factory: routers, serves frontend/dist with SPA fallback
    __main__.py          `python -m app` → uvicorn on 127.0.0.1
    config.py            env config (JOBTRACKER_DB_PATH, JOBTRACKER_PORT)
    db.py                engine, create_all, per-request session dependency
    clock.py             injectable "now" so time rules are testable
    models.py            ALL tables (one module → easy to add Alembic later)
    schemas.py           API request/response models
    routers/             thin HTTP layer: applications, contacts, goals, today, dashboard, settings
    services/            business rules, mostly pure functions:
      applications.py    stage history, stale rule
      streaks.py         streak calculation
      goals.py           goal progress from logged activity
      stats.py           dashboard metrics + weekly summary
      leetcode.py        tag/slug helpers
      leetcode_sync.py   the only code that talks to the internet (opt-in)
    seed.py              fake demo data
  tests/
frontend/                React + TypeScript + Vite
  src/
    lib/                 API client, types, pure helpers (filter/sort, dates, goal labels, summary text)
    components/          QuickAdd, KanbanBoard, ApplicationTable, ApplicationDetail, GoalCard, …
    pages/               Today, Applications, Goals, Dashboard, Contacts, Settings
run.py                   cross-platform setup/dev/start/test helper
```

Request flow: React page → `src/lib/api.ts` → `/api/...` (Vite proxy in dev,
same origin in production) → FastAPI router → service function → SQLModel → SQLite.

The server only listens on `127.0.0.1`: there is no authentication, so it must
not be reachable from other machines.

See `CLAUDE.md` for the design decisions and their reasons.
