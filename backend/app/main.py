"""FastAPI application factory.

`create_app()` takes an optional engine so tests can pass an in-memory
database; the real app is started with `python -m app` (see __main__.py), which
uses the database file from config.
"""

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.engine import Engine

from .config import FRONTEND_DIST
from .db import init_db, make_engine
from .routers import applications, contacts


def create_app(engine: Engine | None = None, frontend_dist: Path | None = FRONTEND_DIST) -> FastAPI:
    app = FastAPI(title="Job Hunt Tracker", version="0.1.0")
    app.state.engine = engine or make_engine()
    init_db(app.state.engine)

    for module in (applications, contacts):
        app.include_router(module.router)

    @app.get("/api/health")
    def health():
        return {"status": "ok"}

    if frontend_dist is not None and (frontend_dist / "index.html").exists():
        _mount_frontend(app, frontend_dist)

    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built React app; unknown non-API paths fall back to
    index.html so client-side routes survive a page refresh."""
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str):
        if path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (dist / path).resolve()
        if path and candidate.is_file() and dist.resolve() in candidate.parents:
            return FileResponse(candidate)
        return FileResponse(dist / "index.html")

