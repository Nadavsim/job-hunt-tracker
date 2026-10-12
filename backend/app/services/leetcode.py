"""LeetCode log helpers: tag normalisation and problem slugs."""

import re

from ..models import LeetCodeLog
from ..schemas import LeetCodeLogRead


def normalize_tags(tags: list[str]) -> str:
    """["Dynamic Programming", " arrays ", "arrays"] -> "arrays,dynamic programming".

    Tags are stored as one comma-separated column: a tag table would be more
    normalised, but this data is tiny and every breakdown is computed in Python.
    """
    cleaned = {t.strip().lower().replace(",", " ") for t in tags}
    return ",".join(sorted(t for t in cleaned if t))


def split_tags(stored: str) -> list[str]:
    return [t for t in stored.split(",") if t]


def slugify(problem: str) -> str:
    """Approximate LeetCode's titleSlug so manual and synced logs can be matched.

    "1. Two Sum" -> "two-sum";  "Pow(x, n)" -> "powx-n".
    """
    text = re.sub(r"^\s*#?\d+\s*[.:)-]\s*", "", problem)  # drop a leading "1. "
    text = text.lower().replace("'", "")
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    return re.sub(r"[\s-]+", "-", text).strip("-") or problem.strip().lower()


def parse_number(problem: str) -> int | None:
    match = re.match(r"^\s*#?(\d+)\s*[.:)-]", problem)
    return int(match.group(1)) if match else None


def to_read(log: LeetCodeLog) -> LeetCodeLogRead:
    return LeetCodeLogRead.model_validate({**log.model_dump(), "tags": split_tags(log.tags)})
