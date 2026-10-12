from datetime import timedelta

import pytest

from app.services.leetcode import normalize_tags, parse_number, slugify
from conftest import NOW

TODAY = NOW.date()


def iso(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def progress(client, goal_type):
    return next(g for g in client.get("/api/goals/progress").json() if g["goal_type"] == goal_type)


# ----------------------------------------------------------------- helpers


@pytest.mark.parametrize(
    "problem, slug",
    [
        ("Two Sum", "two-sum"),
        ("1. Two Sum", "two-sum"),
        ("#42: Trapping Rain Water", "trapping-rain-water"),
        ("Pow(x, n)", "powx-n"),
        ("  Best Time to Buy and Sell Stock II ", "best-time-to-buy-and-sell-stock-ii"),
        ("Hard-ish problem", "hard-ish-problem"),
    ],
)
def test_slugify(problem, slug):
    assert slugify(problem) == slug


def test_parse_number():
    assert parse_number("1. Two Sum") == 1
    assert parse_number("Two Sum") is None


def test_normalize_tags():
    assert normalize_tags(["Dynamic Programming", " arrays ", "Arrays", ""]) == "arrays,dynamic programming"


# ---------------------------------------------------------------- leetcode


def test_log_leetcode_defaults_to_today(client):
    res = client.post(
        "/api/leetcode",
        json={"problem": "1. Two Sum", "difficulty": "easy", "tags": ["Array", "Hash Table"], "solved_without_hints": True},
    )
    assert res.status_code == 201
    log = res.json()
    assert log["solved_on"] == TODAY.isoformat()
    assert log["number"] == 1
    assert log["slug"] == "two-sum"
    assert log["tags"] == ["array", "hash table"]
    assert log["source"] == "manual"


def test_leetcode_backdate_edit_delete(client):
    log = client.post("/api/leetcode", json={"problem": "Valid Parentheses", "solved_on": iso(2)}).json()
    assert log["solved_on"] == iso(2)
    res = client.patch(f"/api/leetcode/{log['id']}", json={"tags": ["Stack"], "difficulty": "easy"})
    assert res.json()["tags"] == ["stack"]
    assert client.delete(f"/api/leetcode/{log['id']}").status_code == 204
    assert client.get("/api/leetcode").json() == []


def test_leetcode_requires_problem(client):
    assert client.post("/api/leetcode", json={"problem": " "}).status_code == 422


# ----------------------------------------------------------------- courses


def test_course_module_completions(client):
    course = client.post("/api/courses", json={"name": "Example Algorithms Course", "total_modules": 2}).json()
    assert course["modules_completed"] == 0
    c = client.post(f"/api/courses/{course['id']}/completions", json={}).json()
    assert c["modules_completed"] == 1
    assert c["completions"][0]["completed_on"] == TODAY.isoformat()
    client.post(f"/api/courses/{course['id']}/completions", json={"completed_on": iso(1)})
    # Cannot exceed total.
    assert client.post(f"/api/courses/{course['id']}/completions", json={}).status_code == 422
    # Cannot shrink below what is done.
    assert client.patch(f"/api/courses/{course['id']}", json={"total_modules": 1}).status_code == 422
    # Undo a completion.
    comp_id = c["completions"][0]["id"]
    assert client.delete(f"/api/completions/{comp_id}").status_code == 204
    assert client.get("/api/courses").json()[0]["modules_completed"] == 1


def test_course_needs_positive_total(client):
    assert client.post("/api/courses", json={"name": "X", "total_modules": 0}).status_code == 422


# ----------------------------------------------------------------- targets


def test_default_targets(client):
    targets = {t["goal_type"]: t for t in client.get("/api/goals/targets").json()}
    assert targets["leetcode"] == {"goal_type": "leetcode", "period": "daily", "target": 2, "enabled": True}
    assert targets["course_modules"]["target"] == 1
    assert targets["applications"] == {"goal_type": "applications", "period": "weekly", "target": 10, "enabled": True}


def test_update_target(client):
    res = client.patch("/api/goals/targets/leetcode", json={"period": "weekly", "target": 10})
    assert res.json()["period"] == "weekly" and res.json()["target"] == 10
    assert client.patch("/api/goals/targets/leetcode", json={"target": 0}).status_code == 422
    assert client.patch("/api/goals/targets/nope", json={"target": 1}).status_code == 422


# ---------------------------------------------------------------- progress


def test_leetcode_progress_and_streak(client):
    for days_ago in (0, 1, 1, 2, 2):
        client.post("/api/leetcode", json={"problem": f"Problem {days_ago}", "solved_on": iso(days_ago)})
    g = progress(client, "leetcode")  # target 2/day
    assert g["count"] == 1 and g["met"] is False
    assert g["current_streak"] == 2  # today in progress doesn't break it
    assert g["today_count"] == 1


def test_applications_goal_counts_automatically(client, make_app):
    # 2026-03-18 is a Wednesday; week started Monday 03-16.
    make_app(date_applied="2026-03-16")
    make_app(date_applied="2026-03-18")
    make_app(date_applied="2026-03-15")  # previous week
    make_app(stage="wishlist")  # not sent - does not count
    g = progress(client, "applications")
    assert g["period"] == "weekly"
    assert g["period_start"] == "2026-03-16"
    assert g["count"] == 2
    assert g["today_count"] == 1


def test_course_goal_counts_completions(client):
    course = client.post("/api/courses", json={"name": "Example Course", "total_modules": 5}).json()
    client.post(f"/api/courses/{course['id']}/completions", json={"completed_on": iso(1)})
    g = progress(client, "course_modules")
    assert g["count"] == 0 and g["current_streak"] == 1


# ------------------------------------------------------------------- today


def test_today_view_brand_new_user(client):
    body = client.get("/api/today").json()
    assert body["date"] == TODAY.isoformat()
    assert len(body["goals"]) == 3
    assert body["follow_ups"] == [] and body["stale"] == []


def test_today_follow_ups_due_and_overdue(client, make_app):
    make_app(company="Due Today Co", next_follow_up=iso(0))
    make_app(company="Overdue Co", next_follow_up=iso(3))
    make_app(company="Later Co", next_follow_up=(TODAY + timedelta(days=1)).isoformat())
    make_app(company="Closed Co", next_follow_up=iso(1), stage="rejected")
    archived = make_app(company="Archived Co", next_follow_up=iso(1))
    client.patch(f"/api/applications/{archived['id']}", json={"archived": True})

    body = client.get("/api/today").json()
    assert [a["company"] for a in body["follow_ups"]] == ["Overdue Co", "Due Today Co"]


def test_today_includes_stale_suggestions(client, make_app):
    make_app(company="Silent Co", date_applied=iso(30))
    make_app(company="Recent Co", date_applied=iso(3))
    assert [a["company"] for a in client.get("/api/today").json()["stale"]] == ["Silent Co"]
