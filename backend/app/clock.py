"""The single source of "now" for request handlers.

Routes depend on `get_clock` instead of calling date.today() directly, so tests
can pin time with `app.dependency_overrides[get_clock] = lambda: FixedClock(...)`.
"""

from dataclasses import dataclass
from datetime import date, datetime


class Clock:
    def now(self) -> datetime:
        return datetime.now().replace(microsecond=0)

    def today(self) -> date:
        return self.now().date()


@dataclass
class FixedClock(Clock):
    fixed: datetime

    def now(self) -> datetime:
        return self.fixed


def get_clock() -> Clock:
    return Clock()
