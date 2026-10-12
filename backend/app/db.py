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


# Columns added after a table first shipped. create_all() creates missing
# *tables* but never alters existing ones, so each added column is listed here
# and added in place. Additive-only; the first non-additive change is the
# trigger to introduce Alembic (see CLAUDE.md).
ADDED_COLUMNS: list[tuple[str, str, str]] = [
    ("leetcodelog", "platform", "VARCHAR(8) NOT NULL DEFAULT 'leetcode'"),
]


def add_missing_columns(engine: Engine) -> None:
    with engine.begin() as conn:
        for table, column, ddl in ADDED_COLUMNS:
            existing = {row[1] for row in conn.exec_driver_sql(f"PRAGMA table_info({table})")}
            if existing and column not in existing:
                conn.exec_driver_sql(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}")


def init_db(engine: Engine) -> None:
    """Create tables, add any newer columns, and seed default targets."""
    SQLModel.metadata.create_all(engine)
    add_missing_columns(engine)
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
