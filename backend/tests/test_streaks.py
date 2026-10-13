"""Streak edge cases. 2026-03-18 is a Wednesday."""

from datetime import date, timedelta

import pytest

from app.models import Period
from app.services.streaks import compute_streak, period_start

WED = date(2026, 3, 18)
D = lambda n: WED - timedelta(days=n)  # noqa: E731  D(1) = yesterday


def daily(days, target=1, today=WED):
    return compute_streak(days, target, Period.daily, today)


def weekly(days, target=1, today=WED):
    return compute_streak(days, target, Period.weekly, today)


def test_no_activity_is_zero():
    r = daily([])
    assert (r.current, r.longest, r.period_count, r.period_met) == (0, 0, 0, False)


def test_today_not_done_yet_does_not_break_streak():
    r = daily([D(1), D(2), D(3)])
    assert r.current == 3
    assert r.period_met is False


def test_today_done_extends_streak():
    assert daily([D(0), D(1), D(2)]).current == 3


def test_missed_yesterday_breaks_streak():
    assert daily([D(2), D(3)]).current == 0


def test_missed_yesterday_but_done_today_is_one():
    assert daily([D(0), D(2), D(3)]).current == 1


def test_streak_breaks_once_the_day_has_ended():
    # Done on Tuesday only. On Wednesday the streak is 1 (Wed still in progress);
    # on Thursday Wednesday has ended unmet, so it is 0.
    assert daily([D(1)], today=WED).current == 1
    assert daily([D(1)], today=WED + timedelta(days=1)).current == 0


def test_below_target_does_not_count():
    # target 2: yesterday had 2, day before only 1.
    r = daily([D(1), D(1), D(2)], target=2)
    assert r.current == 1


def test_period_count_and_met_for_today():
    r = daily([D(0), D(0)], target=2)
    assert (r.period_count, r.period_met, r.current) == (2, True, 1)


def test_backfilling_a_gap_restores_streak():
    assert daily([D(1), D(3)]).current == 1
    assert daily([D(1), D(2), D(3)]).current == 3


def test_future_dates_are_ignored():
    r = daily([WED + timedelta(days=1), D(1)])
    assert r.current == 1 and r.period_count == 0


def test_longest_streak_over_history():
    history = [D(10), D(9), D(8), D(7), D(5), D(1)]  # run of 4, gap, 1, gap, 1
    r = daily(history)
    assert r.longest == 4
    assert r.current == 1


def test_longest_includes_current_run():
    r = daily([D(0), D(1), D(2), D(10)])
    assert r.longest == 3 == r.current


def test_target_must_be_positive():
    with pytest.raises(ValueError):
        daily([], target=0)


# ------------------------------------------------------------------ weekly


def test_week_starts_on_monday():
    assert period_start(WED, Period.weekly) == date(2026, 3, 16)
    assert period_start(date(2026, 3, 22), Period.weekly) == date(2026, 3, 16)  # Sunday
    assert period_start(date(2026, 3, 23), Period.weekly) == date(2026, 3, 23)  # Monday


def test_weekly_current_week_in_progress_does_not_break():
    last_week = [date(2026, 3, 10)] * 10
    week_before = [date(2026, 3, 3)] * 10
    r = weekly(last_week + week_before, target=10)
    assert r.current == 2
    assert r.period_count == 0


def test_weekly_counts_across_days_of_the_week():
    this_week = [date(2026, 3, 16)] * 4 + [date(2026, 3, 18)] * 6
    r = weekly(this_week, target=10)
    assert r.period_met is True and r.current == 1


def test_weekly_breaks_after_week_ends():
    last_week = [date(2026, 3, 10)] * 10
    assert weekly(last_week, target=10, today=date(2026, 3, 22)).current == 1  # Sunday: still in progress
    assert weekly(last_week, target=10, today=date(2026, 3, 23)).current == 0  # Monday: last week ended unmet


def test_weekly_sunday_activity_belongs_to_that_week():
    r = weekly([date(2026, 3, 15)] * 3, target=3)  # Sunday of the previous week
    assert r.current == 1


def test_streak_crosses_month_and_year_boundaries():
    today = date(2026, 1, 1)
    r = compute_streak([date(2025, 12, 30), date(2025, 12, 31)], 1, Period.daily, today)
    assert r.current == 2
