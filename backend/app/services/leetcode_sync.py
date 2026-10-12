"""Optional, opt-in LeetCode sync - the ONLY code that talks to the internet.

It uses LeetCode's public (unofficial, undocumented) GraphQL endpoint, which
can change or break at any time. Every failure becomes a `SyncError` with a
human-readable message; manual logging never depends on this module.

Only the public username is sent - no data from the tracker leaves the machine.
"""

import re
from collections.abc import Iterator
from dataclasses import dataclass
from datetime import datetime

import httpx
from sqlmodel import Session, select

from ..models import Difficulty, LeetCodeLog, LogSource
from .leetcode import normalize_tags, parse_number

GRAPHQL_URL = "https://leetcode.com/graphql"
RECENT_LIMIT = 20  # the public endpoint only returns a recent window anyway
USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{1,40}$")

RECENT_QUERY = """
query recentAcSubmissions($username: String!, $limit: Int!) {
  recentAcSubmissionList(username: $username, limit: $limit) { id title titleSlug timestamp }
}
"""
QUESTION_QUERY = """
query questionData($titleSlug: String!) {
  question(titleSlug: $titleSlug) { questionFrontendId difficulty topicTags { name } }
}
"""


class SyncError(Exception):
    """A failure we can explain to the user."""


@dataclass
class SyncResult:
    fetched: int
    imported: int
    skipped_duplicates: int


def http_client() -> Iterator[httpx.Client]:
    """FastAPI dependency; tests override it with an httpx.MockTransport client."""
    with httpx.Client(
        timeout=10.0,
        headers={"Referer": "https://leetcode.com", "User-Agent": "job-hunt-tracker (personal use)"},
    ) as client:
        yield client


def _post(client: httpx.Client, query: str, variables: dict) -> dict:
    try:
        res = client.post(GRAPHQL_URL, json={"query": query, "variables": variables})
    except httpx.TimeoutException as exc:
        raise SyncError("LeetCode did not answer in time. Try again later.") from exc
    except httpx.HTTPError as exc:
        raise SyncError("Could not reach LeetCode (are you offline?).") from exc
    if res.status_code == 429:
        raise SyncError("LeetCode is rate-limiting requests. Wait a few minutes and try again.")
    if res.status_code != 200:
        raise SyncError(f"LeetCode returned HTTP {res.status_code}. The unofficial API may have changed.")
    try:
        body = res.json()
    except ValueError as exc:
        raise SyncError("LeetCode returned something that isn't JSON. The unofficial API may have changed.") from exc
    if not isinstance(body, dict):
        raise SyncError("Unexpected response from LeetCode. The unofficial API may have changed.")
    if body.get("errors"):
        first = body["errors"][0]
        message = first.get("message") if isinstance(first, dict) else str(first)
        raise SyncError(f"LeetCode said: {message}")
    return body.get("data") or {}


def fetch_recent_accepted(client: httpx.Client, username: str) -> list[dict]:
    data = _post(client, RECENT_QUERY, {"username": username, "limit": RECENT_LIMIT})
    items = data.get("recentAcSubmissionList")
    if items is None:
        raise SyncError(f"No public submissions found for '{username}'. Check the username in Settings.")
    if not isinstance(items, list) or not all(
        isinstance(i, dict) and {"title", "titleSlug", "timestamp"} <= i.keys() for i in items
    ):
        raise SyncError("Unexpected response from LeetCode. The unofficial API may have changed.")
    return items


def fetch_question(client: httpx.Client, slug: str) -> dict:
    """Best effort: difficulty/tags are nice-to-have, so failures return {}."""
    try:
        return _post(client, QUESTION_QUERY, {"titleSlug": slug}).get("question") or {}
    except SyncError:
        return {}


def _difficulty(value: object) -> Difficulty | None:
    try:
        return Difficulty(str(value).lower())
    except ValueError:
        return None


def sync(session: Session, client: httpx.Client, username: str) -> SyncResult:
    if not USERNAME_RE.match(username):
        raise SyncError("That doesn't look like a LeetCode username.")
    items = fetch_recent_accepted(client, username)

    # Dedupe key: same problem on the same local day. Manual logs carry a slug
    # derived from the typed name, so "1. Two Sum" logged by hand matches the
    # synced "two-sum". Re-solving a problem on a later day is new practice.
    existing = {(slug, day) for slug, day in session.exec(select(LeetCodeLog.slug, LeetCodeLog.solved_on)).all()}

    imported = skipped = 0
    for item in sorted(items, key=lambda i: int(i["timestamp"])):
        solved_on = datetime.fromtimestamp(int(item["timestamp"])).date()  # local time
        key = (item["titleSlug"], solved_on)
        if key in existing:
            skipped += 1
            continue
        existing.add(key)
        question = fetch_question(client, item["titleSlug"])
        session.add(
            LeetCodeLog(
                problem=item["title"],
                number=_number(question.get("questionFrontendId")) or parse_number(item["title"]),
                slug=item["titleSlug"],
                difficulty=_difficulty(question.get("difficulty")),
                tags=normalize_tags([t.get("name", "") for t in question.get("topicTags") or [] if isinstance(t, dict)]),
                solved_without_hints=None,  # LeetCode can't know; editable in the UI
                solved_on=solved_on,
                source=LogSource.sync,
            )
        )
        imported += 1
    session.commit()
    return SyncResult(fetched=len(items), imported=imported, skipped_duplicates=skipped)


def _number(value: object) -> int | None:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return None
