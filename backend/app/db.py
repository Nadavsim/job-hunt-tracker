"""Database engine and session handling."""

from collections.abc import Iterator
from pathlib import Path

from fastapi import Request
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlmodel import Session, SQLModel, create_engine, select

from . import models
from .config import db_path


def make_engine(path: Path | None = None, *, in_memory: bool = False) -> Engine:
    if in_memory:
        from sqlalchemy.pool import StaticPool

        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )
    else:
        path = path or db_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        engine = create_engine(f"sqlite:///{path}", connect_args={"check_same_thread": False})

    @event.listens_for(engine, "connect")
    def _enable_foreign_keys(dbapi_conn, _record):  # SQLite has FKs off by default
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    return engine


def init_db(engine: Engine) -> None:
    """Create tables (no migrations yet - see CLAUDE.md) and default targets."""
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        existing = {t.goal_type for t in session.exec(select(models.GoalTarget)).all()}
        for default in models.DEFAULT_TARGETS:
            if default.goal_type not in existing:
                session.add(models.GoalTarget.model_validate(default.model_dump()))
        session.commit()


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session per request, on the app's engine."""
    with Session(request.app.state.engine) as session:
        yield session
