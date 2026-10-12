"""All database tables live in this one module.

Keeping every table here means adding Alembic later is a matter of pointing
its `target_metadata` at `SQLModel.metadata` after importing this module.

Time convention: the app is single-user and runs on the user's own machine, so
all timestamps are naive *local* wall-clock datetimes and all dates are local
dates. "Today" means today on this machine. (Columns are annotated
NaiveDatetime so SQLModel stores them as-is instead of converting to UTC.)
"""

from datetime import date, datetime
from enum import Enum
from typing import Optional

from pydantic import NaiveDatetime
from sqlmodel import Field, Relationship, SQLModel


def now_local() -> datetime:
    return datetime.now().replace(microsecond=0)


# --------------------------------------------------------------------------
# Applications
# --------------------------------------------------------------------------


class Stage(str, Enum):
    wishlist = "wishlist"
    applied = "applied"
    online_assessment = "online_assessment"
    phone_screen = "phone_screen"
    interview = "interview"
    offer = "offer"
    rejected = "rejected"
    ghosted = "ghosted"
    withdrawn = "withdrawn"


# Order used by the board and the funnel. The first six are the "pipeline";
# the last three are outcomes that can happen from any pipeline stage.
STAGE_ORDER: list[Stage] = list(Stage)
PIPELINE_STAGES: list[Stage] = [
    Stage.wishlist,
    Stage.applied,
    Stage.online_assessment,
    Stage.phone_screen,
    Stage.interview,
    Stage.offer,
]
# Stages that mean the company answered. Ghosted/withdrawn are not responses.
RESPONSE_STAGES: set[Stage] = {
    Stage.online_assessment,
    Stage.phone_screen,
    Stage.interview,
    Stage.offer,
    Stage.rejected,
}
# Stages where the application is finished; no follow-ups are suggested.
CLOSED_STAGES: set[Stage] = {Stage.offer, Stage.rejected, Stage.ghosted, Stage.withdrawn}


class Source(str, Enum):
    linkedin = "linkedin"
    referral = "referral"
    company_site = "company_site"
    other = "other"


class ApplicationContactLink(SQLModel, table=True):
    application_id: int = Field(foreign_key="application.id", primary_key=True, ondelete="CASCADE")
    contact_id: int = Field(foreign_key="contact.id", primary_key=True, ondelete="CASCADE")


class Application(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company: str = Field(index=True)
    role: str
    job_url: Optional[str] = None
    location: Optional[str] = None  # free text, e.g. "Remote", "Tel Aviv (hybrid)"
    source: Source = Source.other
    date_applied: Optional[date] = Field(default=None, index=True)
    stage: Stage = Field(default=Stage.applied, index=True)
    notes: Optional[str] = None  # salary notes and anything else, free text
    resume_version: Optional[str] = None
    next_follow_up: Optional[date] = None
    archived: bool = False
    created_at: NaiveDatetime = Field(default_factory=now_local)
    updated_at: NaiveDatetime = Field(default_factory=now_local)

    history: list["StageChange"] = Relationship(
        back_populates="application",
        sa_relationship_kwargs={"cascade": "all, delete-orphan", "order_by": "StageChange.changed_at"},
    )
    contacts: list["Contact"] = Relationship(back_populates="applications", link_model=ApplicationContactLink)


class StageChange(SQLModel, table=True):
    """One row per stage an application entered. The current stage is also
    denormalised onto Application.stage for cheap board/table queries."""

    id: Optional[int] = Field(default=None, primary_key=True)
    application_id: int = Field(foreign_key="application.id", index=True, ondelete="CASCADE")
    stage: Stage
    changed_at: NaiveDatetime = Field(default_factory=now_local)

    application: Optional[Application] = Relationship(back_populates="history")


class Contact(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    linkedin: Optional[str] = None
    notes: Optional[str] = None
    created_at: NaiveDatetime = Field(default_factory=now_local)

    applications: list[Application] = Relationship(back_populates="contacts", link_model=ApplicationContactLink)


# --------------------------------------------------------------------------
# Daily goals
# --------------------------------------------------------------------------


class Difficulty(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class LogSource(str, Enum):
    manual = "manual"
    sync = "sync"


class Platform(str, Enum):
    """Where a problem was practised. The table is still called LeetCodeLog
    (renaming it would orphan existing data), but it holds any coding problem."""

    leetcode = "leetcode"
    neetcode = "neetcode"
    other = "other"


class LeetCodeLog(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    problem: str  # name as typed, e.g. "Two Sum"
    number: Optional[int] = None  # LeetCode problem number, if known
    # Normalised identifier used to deduplicate manual vs synced entries.
    slug: str = Field(index=True)
    difficulty: Optional[Difficulty] = None
    tags: str = ""  # comma-separated, lowercase; see services.tags
    # None = unknown (e.g. synced from LeetCode, which cannot know this).
    solved_without_hints: Optional[bool] = None
    notes: Optional[str] = None
    solved_on: date = Field(default_factory=date.today, index=True)
    source: LogSource = LogSource.manual
    platform: Platform = Platform.leetcode
    created_at: NaiveDatetime = Field(default_factory=now_local)


class Course(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str
    total_modules: int = Field(ge=1)
    archived: bool = False
    created_at: NaiveDatetime = Field(default_factory=now_local)

    completions: list["ModuleCompletion"] = Relationship(
        back_populates="course", sa_relationship_kwargs={"cascade": "all, delete-orphan"}
    )


class ModuleCompletion(SQLModel, table=True):
    """One row per finished module. "Modules completed" is a COUNT of these,
    so progress is dated and can feed daily streaks."""

    id: Optional[int] = Field(default=None, primary_key=True)
    course_id: int = Field(foreign_key="course.id", index=True, ondelete="CASCADE")
    completed_on: date = Field(default_factory=date.today, index=True)
    note: Optional[str] = None

    course: Optional[Course] = Relationship(back_populates="completions")


class GoalType(str, Enum):
    leetcode = "leetcode"
    course_modules = "course_modules"
    applications = "applications"


class Period(str, Enum):
    daily = "daily"
    weekly = "weekly"  # ISO weeks, Monday to Sunday


class GoalTarget(SQLModel, table=True):
    """One target per goal type. Targets are not versioned: changing one
    re-evaluates past streaks against the new number (documented trade-off)."""

    goal_type: GoalType = Field(primary_key=True)
    period: Period = Period.daily
    target: int = Field(default=1, ge=1)
    enabled: bool = True


DEFAULT_TARGETS: list[GoalTarget] = [
    GoalTarget(goal_type=GoalType.leetcode, period=Period.daily, target=2),
    GoalTarget(goal_type=GoalType.course_modules, period=Period.daily, target=1),
    GoalTarget(goal_type=GoalType.applications, period=Period.weekly, target=10),
]


# --------------------------------------------------------------------------
# Settings
# --------------------------------------------------------------------------


class Setting(SQLModel, table=True):
    """Tiny key/value store for user settings (e.g. leetcode_username)."""

    key: str = Field(primary_key=True)
    value: str
