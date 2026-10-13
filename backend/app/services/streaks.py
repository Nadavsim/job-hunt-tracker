"""Streak calculation - pure functions, no database.

Rules (all dates are local dates):

* A period is a calendar day (daily goals) or an ISO week, Monday-Sunday
  (weekly goals). A period is "met" when its count reaches the target.
* The current streak is the number of consecutive met periods ending at the
  current period.
* The current period is still in progress: if it is not met *yet*, it does not
  break the streak - we count back from the previous period instead. It only
  counts as a miss once it has ended. (So at 9am, yesterday's streak is still
  shown; at 00:00 the day after a miss, it drops to 0.)
* If the current period is already met, it is included in the streak.
* Activity dated after today is ignored (e.g. a typo'd future date).
* Longest streak is the longest run of met periods ever, including the
  current one.
"""

from collections import Counter
from collections.abc import Iterable
from dataclasses import dataclass
from datetime import date, timedelta

from ..models import Period


@dataclass(frozen=True)
class StreakResult:
    current: int
    longest: int
    period_count: int  # activity so far in the current period
    period_met: bool


def period_start(day: date, period: Period) -> date:
    if period == Period.weekly:
        return day - timedelta(days=day.weekday())  # Monday
    return day


def _step(period: Period) -> timedelta:
    return timedelta(days=7 if period == Period.weekly else 1)


def counts_by_period(days: Iterable[date], period: Period, today: date) -> Counter[date]:
    """Bucket one-entry-per-activity dates into period start dates."""
    return Counter(period_start(d, period) for d in days if d <= today)


def compute_streak(days: Iterable[date], target: int, period: Period, today: date) -> StreakResult:
    if target < 1:
        raise ValueError("target must be >= 1")
    counts = counts_by_period(days, period, today)
    step = _step(period)
    current_start = period_start(today, period)

    def met(start: date) -> bool:
        return counts.get(start, 0) >= target

    # Current streak: include the current period only if it is already met.
    streak = 1 if met(current_start) else 0
    cursor = current_start - step
    while met(cursor):
        streak += 1
        cursor -= step

    # Longest streak: walk every period from the first activity to now.
    longest = 0
    run = 0
    if counts:
        cursor = min(counts)
        while cursor <= current_start:
            run = run + 1 if met(cursor) else 0
            longest = max(longest, run)
            cursor += step
    longest = max(longest, streak)

    return StreakResult(
        current=streak,
        longest=longest,
        period_count=counts.get(current_start, 0),
        period_met=met(current_start),
    )
