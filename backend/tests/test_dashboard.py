from datetime import timedelta

from conftest import NOW

TODAY = NOW.date()  # Wednesday 2026-03-18


def iso(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def dash(client):
    return client.get("/api/dashboard").json()


def move(client, app, *stages):
    for s in stages:
        client.patch(f"/api/applications/{app['id']}", json={"stage": s})


def test_empty_dashboard(client):
    d = dash(client)
    a = d["applications"]
    assert a["total_applied"] == 0
    assert a["response_rate"] is None
    assert a["median_days_to_response"] is None
    assert all(f["count"] == 0 for f in a["funnel"])
    assert d["leetcode"]["total"] == 0 and d["leetcode"]["without_hints_rate"] is None
    assert d["week"]["applied"] == 0 and d["week"]["longest_streak"] is None


def test_funnel_uses_furthest_stage_ever_reached(client, make_app):
    make_app(stage="wishlist")  # not applied: excluded
    make_app()  # applied only
    skipped_oa = make_app()
    move(client, skipped_oa, "interview", "rejected")  # skipped OA + phone screen
    oa = make_app()
    move(client, oa, "online_assessment")
    offer = make_app()
    move(client, offer, "phone_screen", "interview", "offer")

    a = dash(client)["applications"]
    funnel = {f["stage"]: f["count"] for f in a["funnel"]}
    assert funnel == {
        "applied": 4,
        "online_assessment": 3,
        "phone_screen": 2,
        "interview": 2,
        "offer": 1,
    }
    assert {o["stage"]: o["count"] for o in a["outcomes"]} == {"rejected": 1, "ghosted": 0, "withdrawn": 0}
    assert a["wishlist"] == 1


def test_response_rate_excludes_ghosted_and_withdrawn(client, make_app):
    move(client, make_app(), "ghosted")
    move(client, make_app(), "withdrawn")
    move(client, make_app(), "rejected")
    move(client, make_app(), "phone_screen")
    a = dash(client)["applications"]
    assert a["total_applied"] == 4
    assert a["total_responded"] == 2
    assert a["response_rate"] == 0.5


def test_per_source_response_rate(client, make_app):
    move(client, make_app(source="referral"), "phone_screen")
    make_app(source="referral")
    make_app(source="linkedin")
    make_app(source="linkedin")
    make_app(source="linkedin")
    by_source = {s["source"]: s for s in dash(client)["applications"]["by_source"]}
    assert by_source["referral"] == {"source": "referral", "applied": 2, "responded": 1, "rate": 0.5}
    assert by_source["linkedin"]["rate"] == 0.0
    assert "company_site" not in by_source


def test_median_days_to_first_response(client, make_app, clock):
    # Applied 10 and 4 days ago and 2 days ago; responses arrive "now".
    for days in (10, 4, 2):
        move(client, make_app(date_applied=iso(days)), "online_assessment")
    make_app(date_applied=iso(1))  # no response: ignored
    assert dash(client)["applications"]["median_days_to_response"] == 4


def test_first_response_is_the_earliest_response_stage(client, make_app, clock):
    app = make_app(date_applied=iso(10))
    clock.set(NOW - timedelta(days=7))
    move(client, app, "online_assessment")
    clock.set(NOW)
    move(client, app, "interview")
    assert dash(client)["applications"]["median_days_to_response"] == 3


def test_resume_version_rate_hidden_below_five(client, make_app):
    for i in range(5):
        app = make_app(resume_version="v3-backend")
        if i < 2:
            move(client, app, "phone_screen")
    for _ in range(4):
        make_app(resume_version="v1-general")
    make_app()  # no version: not listed
    rows = {r["resume_version"]: r for r in dash(client)["applications"]["by_resume"]}
    assert rows["v3-backend"]["enough_data"] is True
    assert rows["v3-backend"]["rate"] == 0.4
    assert rows["v1-general"]["enough_data"] is False
    assert rows["v1-general"]["rate"] is None
    assert rows["v1-general"]["applied"] == 4
    assert "" not in rows


def test_archived_applications_still_count(client, make_app):
    app = make_app()
    client.patch(f"/api/applications/{app['id']}", json={"archived": True})
    assert dash(client)["applications"]["total_applied"] == 1


def test_leetcode_breakdown(client):
    logs = [
        {"problem": "A", "difficulty": "easy", "tags": ["array"], "solved_without_hints": True},
        {"problem": "B", "difficulty": "medium", "tags": ["array", "dp"], "solved_without_hints": False},
        {"problem": "C", "difficulty": "medium", "tags": ["dp"], "solved_without_hints": True},
        {"problem": "D", "tags": ["graph"]},  # unknown difficulty and hints
    ]
    for body in logs:
        client.post("/api/leetcode", json=body)
    lc = dash(client)["leetcode"]
    assert lc["total"] == 4
    assert {d["difficulty"]: d["count"] for d in lc["by_difficulty"]} == {"easy": 1, "medium": 2, "hard": 0, "unknown": 1}
    assert lc["by_tag"] == [
        {"tag": "array", "count": 2},
        {"tag": "dp", "count": 2},
        {"tag": "graph", "count": 1},
    ]
    # Unknown hint status is excluded from the rate: 2 of 3 known.
    assert lc["hints_known"] == 3
    assert lc["without_hints_rate"] == round(2 / 3, 4)


def test_weekly_summary(client, make_app, clock):
    # Week of Mon 2026-03-16 .. Sun 2026-03-22.
    make_app(date_applied="2026-03-16")
    make_app(date_applied="2026-03-18")
    old = make_app(date_applied="2026-03-02")  # applied before this week ...
    move(client, old, "phone_screen")  # ... but responded this week: counts as a response
    make_app(date_applied="2026-03-15")  # last Sunday: not this week
    for day in ("2026-03-16", "2026-03-17", "2026-03-15"):
        client.post("/api/leetcode", json={"problem": f"P {day}", "solved_on": day})
    course = client.post("/api/courses", json={"name": "Example Course", "total_modules": 9}).json()
    client.post(f"/api/courses/{course['id']}/completions", json={"completed_on": "2026-03-17"})

    week = dash(client)["week"]
    assert week["week_start"] == "2026-03-16" and week["week_end"] == "2026-03-22"
    assert week["applied"] == 2
    assert week["responses"] == 1
    assert week["problems"] == 2
    assert week["modules"] == 1


def test_weekly_summary_longest_current_streak(client):
    client.patch("/api/goals/targets/leetcode", json={"target": 1})
    for days in (1, 2, 3):
        client.post("/api/leetcode", json={"problem": f"P{days}", "solved_on": iso(days)})
    streak = dash(client)["week"]["longest_streak"]
    assert streak["goal_type"] == "leetcode"
    assert streak["length"] == 3 and streak["period"] == "daily"
