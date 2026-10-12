"""Shared fixtures. Every test gets a fresh in-memory SQLite database - the
real data file is never opened (enforced by `_guard_real_db` below)."""

from datetime import datetime

import pytest
import httpx
from fastapi.testclient import TestClient

from app import config
from app.clock import FixedClock, get_clock
from app.db import make_engine
from app.main import create_app
from app.services.leetcode_sync import http_client

# A fixed "now" for tests: Wednesday 2026-03-18, 10:00 local time.
NOW = datetime(2026, 3, 18, 10, 0, 0)


@pytest.fixture(autouse=True)
def _guard_real_db(monkeypatch, tmp_path):
    # Belt and braces: if anything falls back to the configured path, it lands
    # in a throwaway temp dir instead of data/tracker.db.
    monkeypatch.setenv("JOBTRACKER_DB_PATH", str(tmp_path / "should-not-be-used.db"))
    assert config.db_path().parent == tmp_path


class Clock:
    """Mutable test clock: `clock.set(datetime(...))` moves time."""

    def __init__(self, now: datetime):
        self.fixed = FixedClock(now)

    def set(self, now: datetime) -> None:
        self.fixed.fixed = now


@pytest.fixture
def clock() -> Clock:
    return Clock(NOW)


@pytest.fixture
def engine():
    return make_engine(in_memory=True)


def _no_network(request: httpx.Request) -> httpx.Response:
    raise AssertionError(f"Test tried to reach the network: {request.url}")


@pytest.fixture
def leetcode_transport():
    """Tests replace `.handler` to fake LeetCode; by default any call fails the test."""

    class Transport:
        handler = staticmethod(_no_network)

    return Transport


@pytest.fixture
def client(engine, clock, leetcode_transport):
    app = create_app(engine=engine, frontend_dist=None)
    app.dependency_overrides[get_clock] = lambda: clock.fixed

    def fake_http_client():
        transport = httpx.MockTransport(lambda req: leetcode_transport.handler(req))
        with httpx.Client(transport=transport) as c:
            yield c

    app.dependency_overrides[http_client] = fake_http_client
    with TestClient(app) as c:
        yield c


@pytest.fixture
def make_app(client):
    """Helper: create an application with sensible defaults."""

    def _make(**fields):
        body = {"company": "Acme Widgets", "role": "Junior Engineer", **fields}
        res = client.post("/api/applications", json=body)
        assert res.status_code == 201, res.text
        return res.json()

    return _make
