"""Dashboard statistics. Pure functions over already-loaded rows, so each
metric is easy to test and to explain.

Definitions (also shown in the UI):
* "Applied" = has a date_applied (wishlist items never count).
* "Responded" = ever reached online assessment, phone screen, interview,
  offer, or rejected. Ghosted and withdrawn are not responses.
* Response rate = responded / applied.
* Funnel = how many applications got *at least as far as* each stage. It uses
  the furthest stage ever reached (from stage history), because companies
  skip stages (no OA, straight to interview) and a later rejection should not
  erase the fact that you got an interview.
* Archived applications are included: archiving declutters views, it does not
  rewrite history.
"""

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import date, timedelta
from statistics import median
from typing import Optional

from ..models import (
    PIPELINE_STAGES,
    RESPONSE_STAGES,
    Application,
    Difficulty,
    LeetCodeLog,
    ModuleCompletion,
    Stage,
)
from .leetcode import split_tags

# Below this many applications, a per-resume response rate is noise.
MIN_RESUME_SAMPLE = 5

FUNNEL_STAGES = PIPELINE_STAGES[1:]  # applied .. offer
OUTCOME_STAGES = [Stage.rejected, Stage.ghosted, Stage.withdrawn]


def _stages_reached(app: Application) -> set[Stage]:
    return {h.stage for h in app.history} | {app.stage}


def first_response_date(app: Application) -> Optional[date]:
    times = [h.changed_at for h in app.history if h.stage in RESPONSE_STAGES]
    return min(times).date() if times else None


def furthest_pipeline_index(app: Application) -> int:
    """Index into FUNNEL_STAGES of the furthest stage reached; -1 if never applied."""
    reached = _stages_reached(app)
    best = 0 if app.date_applied is not None else -1
    for i, stage in enumerate(FUNNEL_STAGES):
        if stage in reached:
            best = max(best, i)
    return best


def has_responded(app: Application) -> bool:
    return app.date_applied is not None and bool(_stages_reached(app) & RESPONSE_STAGES)


def _rate(num: int, den: int) -> Optional[float]:
    return round(num / den, 4) if den else None


@dataclass
class Group:
    applied: int = 0
    responded: int = 0


def application_stats(apps: list[Application]) -> dict:
    applied = [a for a in apps if a.date_applied is not None]
    responded = [a for a in applied if has_responded(a)]

    furthest = [furthest_pipeline_index(a) for a in applied]
    funnel = [
        {"stage": stage, "count": sum(1 for f in furthest if f >= i)} for i, stage in enumerate(FUNNEL_STAGES)
    ]
    outcomes = [{"stage": s, "count": sum(1 for a in applied if a.stage == s)} for s in OUTCOME_STAGES]

    by_source: dict[str, Group] = defaultdict(Group)
    by_resume: dict[str, Group] = defaultdict(Group)
    for a in applied:
        resp = has_responded(a)
        for bucket, key in ((by_source, a.source.value), (by_resume, (a.resume_version or "").strip())):
            bucket[key].applied += 1
            bucket[key].responded += resp

    days_to_response = []
    for a in responded:
        first = first_response_date(a)
        if first is not None:
            days_to_response.append(max(0, (first - a.date_applied).days))

    return {
        "wishlist": sum(1 for a in apps if a.date_applied is None and a.stage == Stage.wishlist),
        "total_applied": len(applied),
        "total_responded": len(responded),
        "response_rate": _rate(len(responded), len(applied)),
        "median_days_to_response": median(days_to_response) if days_to_response else None,
        "funnel": funnel,
        "outcomes": outcomes,
        "by_source": [
            {"source": k, "applied": g.applied, "responded": g.responded, "rate": _rate(g.responded, g.applied)}
            for k, g in sorted(by_source.items(), key=lambda kv: -kv[1].applied)
        ],
        "by_resume": [
            {
                "resume_version": k,
                "applied": g.applied,
                "responded": g.responded,
                "enough_data": g.applied >= MIN_RESUME_SAMPLE,
                # Withheld below the threshold so the UI cannot show a noisy %.
                "rate": _rate(g.responded, g.applied) if g.applied >= MIN_RESUME_SAMPLE else None,
            }
            for k, g in sorted(by_resume.items(), key=lambda kv: -kv[1].applied)
            if k  # applications without a resume version are not a "version"
        ],
        "min_resume_sample": MIN_RESUME_SAMPLE,
    }


def leetcode_stats(logs: list[LeetCodeLog]) -> dict:
    difficulty = Counter(l.difficulty.value if l.difficulty else "unknown" for l in logs)
    tags = Counter(t for l in logs for t in split_tags(l.tags))
    known = [l for l in logs if l.solved_without_hints is not None]
    clean = sum(1 for l in known if l.solved_without_hints)
    return {
        "total": len(logs),
        "by_difficulty": [
            {"difficulty": d, "count": difficulty.get(d, 0)} for d in [*(x.value for x in Difficulty), "unknown"]
        ],
        "by_tag": [{"tag": t, "count": c} for t, c in sorted(tags.items(), key=lambda kv: (-kv[1], kv[0]))],
        "without_hints": clean,
        "hints_known": len(known),
        "without_hints_rate": _rate(clean, len(known)),
    }


def week_bounds(today: date) -> tuple[date, date]:
    start = today - timedelta(days=today.weekday())
    return start, start + timedelta(days=6)


def weekly_summary(
    apps: list[Application], logs: list[LeetCodeLog], completions: list[ModuleCompletion], today: date
) -> dict:
    start, end = week_bounds(today)

    def in_week(day: Optional[date]) -> bool:
        return day is not None and start <= day <= end

    return {
        "week_start": start,
        "week_end": end,
        "applied": sum(1 for a in apps if in_week(a.date_applied)),
        # A response counts in the week it arrived, whenever the application was sent.
        "responses": sum(1 for a in apps if a.date_applied and in_week(first_response_date(a))),
        "problems": sum(1 for l in logs if in_week(l.solved_on)),
        "modules": sum(1 for c in completions if in_week(c.completed_on)),
    }
