"""LeetCode sync with a faked HTTP layer - the suite never reaches leetcode.com."""

import json
from datetime import datetime

import httpx

from conftest import NOW

TS_TODAY = int(datetime(2026, 3, 18, 9, 0).timestamp())  # local time -> local date
TS_YESTERDAY = int(datetime(2026, 3, 17, 22, 0).timestamp())

QUESTIONS = {
    "two-sum": {"questionFrontendId": "1", "difficulty": "Easy", "topicTags": [{"name": "Array"}, {"name": "Hash Table"}]},
    "coin-change": {"questionFrontendId": "322", "difficulty": "Medium", "topicTags": [{"name": "Dynamic Programming"}]},
}


def fake_leetcode(submissions, question_fail=False):
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url == "https://leetcode.com/graphql"
        body = json.loads(request.content)
        if "recentAcSubmissionList" in body["query"]:
            assert body["variables"]["username"] == "example_user"
            return httpx.Response(200, json={"data": {"recentAcSubmissionList": submissions}})
        if question_fail:
            return httpx.Response(500)
        return httpx.Response(200, json={"data": {"question": QUESTIONS.get(body["variables"]["titleSlug"])}})

    return handler


def sub(slug, title, ts):
    return {"id": "1", "title": title, "titleSlug": slug, "timestamp": str(ts)}


def set_user(client, name="example_user"):
    assert client.put("/api/settings", json={"leetcode_username": name}).status_code == 200


def test_settings_roundtrip_and_validation(client):
    assert client.get("/api/settings").json() == {"leetcode_username": None, "leetcode_last_sync": None}
    set_user(client)
    assert client.get("/api/settings").json()["leetcode_username"] == "example_user"
    assert client.put("/api/settings", json={"leetcode_username": "bad name!"}).status_code == 422
    client.put("/api/settings", json={"leetcode_username": ""})
    assert client.get("/api/settings").json()["leetcode_username"] is None


def test_sync_requires_username(client):
    res = client.post("/api/leetcode/sync")
    assert res.status_code == 400
    assert "username" in res.json()["detail"]


def test_sync_imports_with_details(client, leetcode_transport):
    set_user(client)
    leetcode_transport.handler = fake_leetcode(
        [sub("two-sum", "Two Sum", TS_TODAY), sub("coin-change", "Coin Change", TS_YESTERDAY)]
    )
    res = client.post("/api/leetcode/sync")
    assert res.status_code == 200, res.text
    assert res.json()["imported"] == 2 and res.json()["skipped_duplicates"] == 0
    assert res.json()["last_sync"] == NOW.isoformat()

    logs = {l["slug"]: l for l in client.get("/api/leetcode").json()}
    assert logs["two-sum"]["difficulty"] == "easy"
    assert logs["two-sum"]["number"] == 1
    assert logs["two-sum"]["tags"] == ["array", "hash table"]
    assert logs["two-sum"]["solved_on"] == "2026-03-18"
    assert logs["two-sum"]["source"] == "sync"
    assert logs["two-sum"]["solved_without_hints"] is None
    assert logs["coin-change"]["solved_on"] == "2026-03-17"


def test_sync_is_idempotent(client, leetcode_transport):
    set_user(client)
    leetcode_transport.handler = fake_leetcode([sub("two-sum", "Two Sum", TS_TODAY)])
    client.post("/api/leetcode/sync")
    res = client.post("/api/leetcode/sync").json()
    assert res["imported"] == 0 and res["skipped_duplicates"] == 1
    assert len(client.get("/api/leetcode").json()) == 1


def test_sync_skips_problems_already_logged_manually_same_day(client, leetcode_transport):
    client.post("/api/leetcode", json={"problem": "1. Two Sum", "solved_on": "2026-03-18", "solved_without_hints": True})
    set_user(client)
    leetcode_transport.handler = fake_leetcode([sub("two-sum", "Two Sum", TS_TODAY)])
    res = client.post("/api/leetcode/sync").json()
    assert res["skipped_duplicates"] == 1
    logs = client.get("/api/leetcode").json()
    assert len(logs) == 1 and logs[0]["source"] == "manual"


def test_same_problem_on_a_different_day_is_imported(client, leetcode_transport):
    client.post("/api/leetcode", json={"problem": "Two Sum", "solved_on": "2026-03-10"})
    set_user(client)
    leetcode_transport.handler = fake_leetcode([sub("two-sum", "Two Sum", TS_TODAY)])
    assert client.post("/api/leetcode/sync").json()["imported"] == 1


def test_repeat_submissions_same_day_import_once(client, leetcode_transport):
    set_user(client)
    leetcode_transport.handler = fake_leetcode([sub("two-sum", "Two Sum", TS_TODAY), sub("two-sum", "Two Sum", TS_TODAY + 60)])
    assert client.post("/api/leetcode/sync").json() | {"last_sync": None} == {
        "fetched": 2,
        "imported": 1,
        "skipped_duplicates": 1,
        "last_sync": None,
    }


def test_question_details_failure_still_imports(client, leetcode_transport):
    set_user(client)
    leetcode_transport.handler = fake_leetcode([sub("two-sum", "Two Sum", TS_TODAY)], question_fail=True)
    assert client.post("/api/leetcode/sync").json()["imported"] == 1
    log = client.get("/api/leetcode").json()[0]
    assert log["difficulty"] is None and log["tags"] == []


def _assert_graceful(client, leetcode_transport, handler, expected_fragment):
    set_user(client)
    client.post("/api/leetcode", json={"problem": "Manual one"})
    leetcode_transport.handler = handler
    res = client.post("/api/leetcode/sync")
    assert res.status_code == 502
    detail = res.json()["detail"]
    assert expected_fragment in detail
    assert "Manual logging still works" in detail
    # Nothing was lost or half-imported, and manual logging still works.
    assert [l["problem"] for l in client.get("/api/leetcode").json()] == ["Manual one"]
    assert client.post("/api/leetcode", json={"problem": "Another manual"}).status_code == 201
    assert client.get("/api/settings").json()["leetcode_last_sync"] is None


def test_network_error(client, leetcode_transport):
    def boom(request):
        raise httpx.ConnectError("offline", request=request)

    _assert_graceful(client, leetcode_transport, boom, "Could not reach LeetCode")


def test_timeout(client, leetcode_transport):
    def slow(request):
        raise httpx.ReadTimeout("slow", request=request)

    _assert_graceful(client, leetcode_transport, slow, "did not answer in time")


def test_http_error_status(client, leetcode_transport):
    _assert_graceful(client, leetcode_transport, lambda r: httpx.Response(403, text="forbidden"), "HTTP 403")


def test_rate_limited(client, leetcode_transport):
    _assert_graceful(client, leetcode_transport, lambda r: httpx.Response(429), "rate-limiting")


def test_non_json(client, leetcode_transport):
    _assert_graceful(client, leetcode_transport, lambda r: httpx.Response(200, text="<html>"), "isn't JSON")


def test_graphql_error_unknown_user(client, leetcode_transport):
    handler = lambda r: httpx.Response(200, json={"errors": [{"message": "That user does not exist."}], "data": None})  # noqa: E731
    _assert_graceful(client, leetcode_transport, handler, "That user does not exist.")


def test_changed_schema(client, leetcode_transport):
    handler = lambda r: httpx.Response(200, json={"data": {"recentAcSubmissionList": [{"name": "x"}]}})  # noqa: E731
    _assert_graceful(client, leetcode_transport, handler, "may have changed")


def test_null_list(client, leetcode_transport):
    handler = lambda r: httpx.Response(200, json={"data": {"recentAcSubmissionList": None}})  # noqa: E731
    _assert_graceful(client, leetcode_transport, handler, "No public submissions")


def test_default_client_is_never_used_in_tests(client):
    # The autouse override makes any unexpected request fail loudly.
    set_user(client)
    res = None
    try:
        res = client.post("/api/leetcode/sync")
    except AssertionError as exc:
        assert "network" in str(exc)
    assert res is None or res.status_code != 200
