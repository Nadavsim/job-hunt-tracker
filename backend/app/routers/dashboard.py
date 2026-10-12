from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import Application, LeetCodeLog, MockInterview, ModuleCompletion, Outreach
from ..services import neetcode, stats
from ..services.goals import goal_progress

router = APIRouter(prefix="/api", tags=["dashboard"])


@router.get("/dashboard")
def dashboard(session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    today = clock.today()
    apps = list(session.exec(select(Application)).all())  # archived included on purpose
    logs = list(session.exec(select(LeetCodeLog)).all())
    completions = list(session.exec(select(ModuleCompletion)).all())
    mocks = list(session.exec(select(MockInterview)).all())
    outreach = list(session.exec(select(Outreach)).all())

    goals = [g for g in goal_progress(session, today) if g.enabled]
    best = max(goals, key=lambda g: g.current_streak, default=None)
    week = stats.weekly_summary(apps, logs, completions, mocks, outreach, today)
    week["longest_streak"] = (
        {"goal_type": best.goal_type, "label": best.label, "length": best.current_streak, "period": best.period}
        if best and best.current_streak > 0
        else None
    )

    solved_slugs = {log.slug for log in logs}
    return {
        "applications": stats.application_stats(apps),
        "leetcode": stats.leetcode_stats(logs),
        "neetcode150": {
            "solved": sum(1 for p in neetcode.problems() if p["slug"] in solved_slugs),
            "total": len(neetcode.problems()),
        },
        "mock_interviews": stats.mock_stats(mocks),
        "networking": stats.outreach_stats(outreach),
        "week": week,
    }
