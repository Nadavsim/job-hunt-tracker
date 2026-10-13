"""The NeetCode 150 checklist.

The list itself is bundled data (app/reference/neetcode150.json, extracted from
NeetCode's public GitHub repo), so it works offline and nothing is fetched at
runtime. Progress is NOT stored separately: a problem counts as solved when any
problem log has its slug, whatever platform it was logged from. Ticking a
problem off just creates a normal log entry, so it also counts towards the
daily problem goal and streak.
"""

import json
from collections import defaultdict
from datetime import date
from functools import cache
from pathlib import Path

from sqlmodel import Session, select

from ..models import Difficulty, LeetCodeLog, LogSource, Platform
from .leetcode import normalize_tags

DATA_FILE = Path(__file__).resolve().parents[1] / "reference" / "neetcode150.json"


@cache
def problems() -> tuple[dict, ...]:
    """The 150 problems in NeetCode's roadmap order (topic by topic)."""
    with DATA_FILE.open(encoding="utf-8") as f:
        return tuple(json.load(f)["problems"])


def by_slug(slug: str) -> dict | None:
    return next((p for p in problems() if p["slug"] == slug), None)


def checklist(session: Session) -> dict:
    solved_dates: dict[str, list[date]] = defaultdict(list)
    for slug, day in session.exec(select(LeetCodeLog.slug, LeetCodeLog.solved_on)).all():
        solved_dates[slug].append(day)

    topics: dict[str, list[dict]] = {}  # dicts keep insertion order = roadmap order
    for p in problems():
        days = solved_dates.get(p["slug"], [])
        topics.setdefault(p["topic"], []).append(
            {**p, "first_solved_on": min(days) if days else None, "times_solved": len(days)}
        )

    return {
        "total": len(problems()),
        "solved": sum(1 for p in problems() if p["slug"] in solved_dates),
        "topics": [
            {
                "topic": name,
                "total": len(items),
                "solved": sum(1 for i in items if i["first_solved_on"]),
                "problems": items,
            }
            for name, items in topics.items()
        ],
    }


def log_problem(session: Session, problem: dict, today: date, solved_without_hints: bool | None) -> LeetCodeLog:
    log = LeetCodeLog(
        problem=problem["title"],
        number=problem["number"],
        slug=problem["slug"],  # the list's LeetCode slug is authoritative; matches synced logs
        difficulty=Difficulty(problem["difficulty"]),
        tags=normalize_tags([problem["topic"]]),
        solved_without_hints=solved_without_hints,
        solved_on=today,
        source=LogSource.manual,
        platform=Platform.neetcode,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return log
