from datetime import timedelta

from app.db import init_db, make_engine
from conftest import NOW

TODAY = NOW.date()  # Wednesday 2026-03-18; week = Mon 03-16 .. Sun 03-22


def iso(days_ago: int) -> str:
    return (TODAY - timedelta(days=days_ago)).isoformat()


def goal(client, goal_type):
    return next(g for g in client.get("/api/goals/progress").json() if g["goal_type"] == goal_type)


# ---------------------------------------------------------- mock interviews


def test_log_mock_interview_defaults(client):
    res = client.post("/api/mocks", json={})
    assert res.status_code == 201
    m = res.json()
    assert m["held_on"] == TODAY.isoformat()
    assert m["kind"] == "technical"
    assert m["self_rating"] is None


def test_mock_interview_crud_and_validation(client):
    m = client.post(
        "/api/mocks",
        json={"kind": "behavioral", "partner": "Practice Partner", "self_rating": 3, "notes": "Too long on STAR intro"},
    ).json()
    assert client.post("/api/mocks", json={"self_rating": 6}).status_code == 422
    assert client.post("/api/mocks", json={"kind": "dance-off"}).status_code == 422
    res = client.patch(f"/api/mocks/{m['id']}", json={"self_rating": 4, "held_on": None, "notes": None})
    assert res.json()["self_rating"] == 4
    assert res.json()["held_on"] == TODAY.isoformat()  # required field not cleared by null
    assert res.json()["notes"] is None
    assert client.delete(f"/api/mocks/{m['id']}").status_code == 204
    assert client.get("/api/mocks").json() == []


def test_mock_interviews_weekly_goal_and_streak(client):
    # Default: 2 per week. Last week met, this week 1 so far (in progress).
    for day in ("2026-03-09", "2026-03-12", "2026-03-17"):
        client.post("/api/mocks", json={"held_on": day})
    g = goal(client, "mock_interviews")
    assert (g["period"], g["target"], g["count"], g["met"]) == ("weekly", 2, 1, False)
    assert g["current_streak"] == 1


# ----------------------------------------------------------------- outreach


def test_outreach_with_existing_contact(client):
    contact = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    res = client.post("/api/outreach", json={"contact_id": contact["id"], "kind": "coffee_chat"})
    assert res.status_code == 201
    row = res.json()
    assert row["contact_name"] == "Sam Sample" and row["happened_on"] == TODAY.isoformat()
    c = client.get("/api/contacts").json()[0]
    assert c["outreach_count"] == 1 and c["last_contacted"] == TODAY.isoformat()


def test_outreach_creates_new_contact_on_the_fly(client):
    row = client.post("/api/outreach", json={"new_contact_name": "  Alex Example ", "kind": "message"}).json()
    contacts = client.get("/api/contacts").json()
    assert [c["name"] for c in contacts] == ["Alex Example"]
    assert row["contact_id"] == contacts[0]["id"]


def test_outreach_without_contact_is_allowed(client):
    row = client.post("/api/outreach", json={"kind": "other", "notes": "Posted in a job-hunt community"}).json()
    assert row["contact_id"] is None and row["contact_name"] is None


def test_outreach_validation(client):
    c = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    both = {"contact_id": c["id"], "new_contact_name": "Other Person"}
    assert client.post("/api/outreach", json=both).status_code == 422
    assert client.post("/api/outreach", json={"contact_id": 999}).status_code == 422
    assert client.post("/api/outreach", json={"kind": "spam"}).status_code == 422
    row = client.post("/api/outreach", json={"contact_id": c["id"]}).json()
    assert client.patch(f"/api/outreach/{row['id']}", json={"contact_id": 999}).status_code == 422
    # Nothing half-created by the failed requests.
    assert len(client.get("/api/contacts").json()) == 1


def test_outreach_survives_contact_deletion(client):
    c = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    client.post("/api/outreach", json={"contact_id": c["id"]})
    client.delete(f"/api/contacts/{c['id']}")
    rows = client.get("/api/outreach").json()
    assert len(rows) == 1 and rows[0]["contact_id"] is None and rows[0]["contact_name"] is None
    assert goal(client, "networking")["count"] == 1


def test_outreach_filter_by_contact_and_edit_delete(client):
    a = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    b = client.post("/api/contacts", json={"name": "Alex Example"}).json()
    client.post("/api/outreach", json={"contact_id": a["id"]})
    row = client.post("/api/outreach", json={"contact_id": b["id"], "happened_on": iso(1)}).json()
    assert [r["contact_name"] for r in client.get(f"/api/outreach?contact_id={b['id']}").json()] == ["Alex Example"]
    res = client.patch(f"/api/outreach/{row['id']}", json={"kind": "follow_up", "happened_on": None})
    assert res.json()["kind"] == "follow_up" and res.json()["happened_on"] == iso(1)
    assert client.delete(f"/api/outreach/{row['id']}").status_code == 204
    assert len(client.get("/api/outreach").json()) == 1


def test_networking_goal_counts_outreach(client):
    for _ in range(5):
        client.post("/api/outreach", json={"happened_on": iso(1)})
    g = goal(client, "networking")
    assert (g["period"], g["target"], g["count"], g["met"]) == ("weekly", 5, 5, True)


# ---------------------------------------------------------------- dashboard


def test_dashboard_practice_stats_and_week(client):
    c = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    client.post("/api/mocks", json={"kind": "technical", "self_rating": 2})
    client.post("/api/mocks", json={"kind": "technical", "self_rating": 4})
    client.post("/api/mocks", json={"kind": "behavioral"})  # unrated
    client.post("/api/mocks", json={"kind": "behavioral", "held_on": "2026-03-01"})  # earlier week
    client.post("/api/outreach", json={"contact_id": c["id"], "kind": "message"})
    client.post("/api/outreach", json={"contact_id": c["id"], "kind": "coffee_chat"})
    client.post("/api/outreach", json={"kind": "message", "happened_on": "2026-03-15"})  # last Sunday

    d = client.get("/api/dashboard").json()
    mocks = {k["kind"]: k for k in d["mock_interviews"]["by_kind"]}
    assert d["mock_interviews"]["total"] == 4
    assert mocks["technical"] == {"kind": "technical", "count": 2, "avg_rating": 3.0}
    assert mocks["behavioral"]["avg_rating"] is None
    assert d["networking"]["total"] == 3
    assert d["networking"]["people_reached"] == 1
    assert {k["kind"]: k["count"] for k in d["networking"]["by_kind"]}["message"] == 2
    assert d["week"]["mock_interviews"] == 3
    assert d["week"]["outreach"] == 2


# ---------------------------------------------------------- existing databases


def test_existing_database_gets_new_tables_and_targets(tmp_path):
    """A database from before this change gains the new tables and default
    targets at startup, and keeps the user's own targets."""
    from sqlmodel import Session, select

    from app.models import GoalTarget, GoalType

    engine = make_engine(tmp_path / "old.db")
    init_db(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("DROP TABLE mockinterview")
        conn.exec_driver_sql("DROP TABLE outreach")
        conn.exec_driver_sql("DELETE FROM goaltarget WHERE goal_type IN ('mock_interviews', 'networking')")
        conn.exec_driver_sql("UPDATE goaltarget SET target = 3 WHERE goal_type = 'leetcode'")
    init_db(engine)
    with Session(engine) as session:
        targets = {t.goal_type: t for t in session.exec(select(GoalTarget)).all()}
    assert targets[GoalType.leetcode].target == 3
    assert targets[GoalType.mock_interviews].target == 2
    assert targets[GoalType.networking].target == 5
    with engine.connect() as conn:
        assert conn.exec_driver_sql("SELECT count(*) FROM outreach").scalar() == 0
