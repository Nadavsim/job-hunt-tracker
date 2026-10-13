"""Goal progress: turns logged activity into per-period counts and streaks."""

from datetime import date

from sqlmodel import Session, select

from ..models import Application, GoalTarget, GoalType, LeetCodeLog, ModuleCompletion
from ..schemas import GoalProgressRead
from .streaks import compute_streak, period_start

GOAL_LABELS = {
    GoalType.leetcode: "LeetCode problems",
    GoalType.course_modules: "Course modules",
    GoalType.applications: "Applications sent",
}


def activity_dates(session: Session, goal_type: GoalType) -> list[date]:
    """One date per unit of activity. Applications are counted automatically
    from date_applied (wishlist items have none, so they never count)."""
    if goal_type == GoalType.leetcode:
        return list(session.exec(select(LeetCodeLog.solved_on)).all())
    if goal_type == GoalType.course_modules:
        return list(session.exec(select(ModuleCompletion.completed_on)).all())
    return list(
        session.exec(select(Application.date_applied).where(Application.date_applied.is_not(None))).all()
    )


def goal_progress(session: Session, today: date) -> list[GoalProgressRead]:
    targets = session.exec(select(GoalTarget)).all()
    order = list(GoalType)
    result = []
    for target in sorted(targets, key=lambda t: order.index(t.goal_type)):
        days = activity_dates(session, target.goal_type)
        streak = compute_streak(days, target.target, target.period, today)
        result.append(
            GoalProgressRead(
                goal_type=target.goal_type,
                label=GOAL_LABELS[target.goal_type],
                period=target.period,
                period_start=period_start(today, target.period),
                target=target.target,
                enabled=target.enabled,
                count=streak.period_count,
                met=streak.period_met,
                today_count=sum(1 for d in days if d == today),
                current_streak=streak.current,
                longest_streak=streak.longest,
            )
        )
    return result
