"""Runtime configuration, read from environment variables.

Only two things are configurable on purpose: where the database lives and
where the built frontend is. Everything else is a code-level decision.
"""

import os
from pathlib import Path

# Repository root: backend/app/config.py -> parents[2]
REPO_ROOT = Path(__file__).resolve().parents[2]

DEFAULT_DB_PATH = REPO_ROOT / "data" / "tracker.db"
FRONTEND_DIST = REPO_ROOT / "frontend" / "dist"

# Local-only, single-user app: never listen on all interfaces.
HOST = "127.0.0.1"
PORT = int(os.environ.get("JOBTRACKER_PORT", "8000"))


def db_path() -> Path:
    """Path to the SQLite file. Override with JOBTRACKER_DB_PATH."""
    return Path(os.environ.get("JOBTRACKER_DB_PATH", str(DEFAULT_DB_PATH)))
