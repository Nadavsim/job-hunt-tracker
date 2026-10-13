from collections import Counter

from sqlmodel import Session, select

from app.db import init_db, make_engine
from app.models import LeetCodeLog, Platform
from app.services import neetcode
from conftest import NOW

TODAY = NOW.date().isoformat()


# ------------------------------------------------------------- bundled data


def test_list_is_the_150_unique_problems():
    problems = neetcode.problems()
    assert len(problems) == 150
    assert len({p["slug"] for p in problems}) == 150
    assert len(Counter(p["topic"] for p in problems)) == 18
    assert {p["difficulty"] for p in problems} == {"easy", "medium", "hard"}
    assert problems[0]["slug"] == "contains-duplicate"  # roadmap order starts with Arrays & Hashing


# ----------------------------------------------------------------- platform


def test_platform_defaults_to_leetcode_and_can_be_set(client):
    a = client.post("/api/leetcode", json={"problem": "Two Sum"}).json()
    b = client.post("/api/leetcode", json={"problem": "Valid Anagram", "platform": "neetcode"}).json()
    assert a["platform"] == "leetcode" and b["platform"] == "neetcode"
    res = client.patch(f"/api/leetcode/{a['id']}", json={"platform": "other"})
    assert res.json()["platform"] == "other"
    assert client.post("/api/leetcode", json={"problem": "X", "platform": "hackerrank"}).status_code == 422


def test_dashboard_counts_by_platform(client):
    client.post("/api/leetcode", json={"problem": "A", "platform": "neetcode"})
    client.post("/api/leetcode", json={"problem": "B", "platform": "neetcode"})
    client.post("/api/leetcode", json={"problem": "C"})
    by_platform = {p["platform"]: p["count"] for p in client.get("/api/dashboard").json()["leetcode"]["by_platform"]}
    assert by_platform == {"leetcode": 1, "neetcode": 2, "other": 0}


def test_platform_column_is_added_to_an_existing_database(tmp_path):
    # Simulate a database created before the platform column existed.
    engine = make_engine(tmp_path / "old.db")
    init_db(engine)
    with engine.begin() as conn:
        conn.exec_driver_sql("ALTER TABLE leetcodelog DROP COLUMN platform")
        conn.exec_driver_sql(
            "INSERT INTO leetcodelog (problem, slug, tags, solved_on, source, created_at) "
            "VALUES ('Two Sum', 'two-sum', '', '2026-03-01', 'manual', '2026-03-01 09:00:00')"
        )
    init_db(engine)  # what app startup does
    init_db(engine)  # and it is safe to run again
    with Session(engine) as session:
        log = session.exec(select(LeetCodeLog)).one()
    assert log.platform == Platform.leetcode


# ---------------------------------------------------------------- checklist


def test_empty_checklist(client):
    body = client.get("/api/neetcode150").json()
    assert body["total"] == 150 and body["solved"] == 0
    assert body["topics"][0]["topic"] == "Arrays & Hashing"
    assert sum(t["total"] for t in body["topics"]) == 150
    first = body["topics"][0]["problems"][0]
    assert first["first_solved_on"] is None and first["times_solved"] == 0


def test_tick_off_creates_a_neetcode_log_that_counts_toward_goals(client):
    res = client.post("/api/neetcode150/contains-duplicate/log", json={"solved_without_hints": True})
    assert res.status_code == 201
    log = res.json()
    assert log["platform"] == "neetcode"
    assert log["number"] == 217 and log["difficulty"] == "easy"
    assert log["tags"] == ["arrays & hashing"]
    assert log["solved_on"] == TODAY

    body = client.get("/api/neetcode150").json()
    assert body["solved"] == 1
    assert body["topics"][0]["solved"] == 1
    goal = next(g for g in client.get("/api/goals/progress").json() if g["goal_type"] == "leetcode")
    assert goal["count"] == 1
    assert client.get("/api/dashboard").json()["neetcode150"] == {"solved": 1, "total": 150}


def test_logs_from_any_platform_count_as_solved(client):
    # Typed by hand on the LeetCode platform, matched by slug.
    client.post("/api/leetcode", json={"problem": "217. Contains Duplicate", "solved_on": "2026-03-01"})
    client.post("/api/leetcode", json={"problem": "Contains Duplicate", "solved_on": "2026-03-10"})
    p = client.get("/api/neetcode150").json()["topics"][0]["problems"][0]
    assert p["first_solved_on"] == "2026-03-01" and p["times_solved"] == 2


def test_unknown_problem_is_404(client):
    assert client.post("/api/neetcode150/not-a-problem/log", json={}).status_code == 404
