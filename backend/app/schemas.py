"""Request/response shapes for the API (kept separate from the tables so the
API contract does not change every time a column does)."""

from datetime import date, datetime
from typing import Annotated, Optional

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

from .models import Difficulty, GoalType, LogSource, Period, Source, Stage

NonEmpty = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=300)]
OptionalText = Optional[Annotated[str, StringConstraints(strip_whitespace=True, max_length=10_000)]]


class ORM(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------- contacts


class ContactBase(BaseModel):
    name: NonEmpty
    role: OptionalText = None
    email: OptionalText = None
    linkedin: OptionalText = None
    notes: OptionalText = None


class ContactCreate(ContactBase):
    application_ids: list[int] = []


class ContactUpdate(BaseModel):
    name: Optional[NonEmpty] = None
    role: OptionalText = None
    email: OptionalText = None
    linkedin: OptionalText = None
    notes: OptionalText = None
    application_ids: Optional[list[int]] = None


class ContactRead(ORM, ContactBase):
    id: int
    application_ids: list[int] = []


class ContactRef(ORM):
    id: int
    name: str


# ------------------------------------------------------------ applications


class ApplicationCreate(BaseModel):
    company: NonEmpty
    role: NonEmpty
    job_url: OptionalText = None
    location: OptionalText = None
    source: Source = Source.other
    stage: Stage = Stage.applied
    # Defaults to today for anything past "wishlist" (see services.applications).
    date_applied: Optional[date] = None
    notes: OptionalText = None
    resume_version: OptionalText = None
    next_follow_up: Optional[date] = None
    contact_ids: list[int] = []


class ApplicationUpdate(BaseModel):
    """PATCH semantics: only fields present in the request body are changed."""

    company: Optional[NonEmpty] = None
    role: Optional[NonEmpty] = None
    job_url: OptionalText = None
    location: OptionalText = None
    source: Optional[Source] = None
    stage: Optional[Stage] = None
    date_applied: Optional[date] = None
    notes: OptionalText = None
    resume_version: OptionalText = None
    next_follow_up: Optional[date] = None
    archived: Optional[bool] = None
    contact_ids: Optional[list[int]] = None


class StageChangeRead(ORM):
    stage: Stage
    changed_at: datetime


class ApplicationRead(ORM):
    id: int
    company: str
    role: str
    job_url: Optional[str]
    location: Optional[str]
    source: Source
    stage: Stage
    date_applied: Optional[date]
    notes: Optional[str]
    resume_version: Optional[str]
    next_follow_up: Optional[date]
    archived: bool
    created_at: datetime
    updated_at: datetime
    history: list[StageChangeRead]
    contacts: list[ContactRef]
    # Derived: days since the last stage change, and the 21-day stale rule.
    days_in_stage: int
    is_stale: bool


# ------------------------------------------------------------------- goals


class LeetCodeLogCreate(BaseModel):
    problem: NonEmpty
    number: Optional[int] = Field(default=None, ge=1)
    difficulty: Optional[Difficulty] = None
    tags: list[str] = []
    solved_without_hints: Optional[bool] = None
    notes: OptionalText = None
    solved_on: Optional[date] = None  # defaults to today


class LeetCodeLogUpdate(BaseModel):
    problem: Optional[NonEmpty] = None
    number: Optional[int] = Field(default=None, ge=1)
    difficulty: Optional[Difficulty] = None
    tags: Optional[list[str]] = None
    solved_without_hints: Optional[bool] = None
    notes: OptionalText = None
    solved_on: Optional[date] = None


class LeetCodeLogRead(ORM):
    id: int
    problem: str
    number: Optional[int]
    slug: str
    difficulty: Optional[Difficulty]
    tags: list[str]
    solved_without_hints: Optional[bool]
    notes: Optional[str]
    solved_on: date
    source: LogSource


class CourseCreate(BaseModel):
    name: NonEmpty
    total_modules: int = Field(ge=1, le=10_000)


class CourseUpdate(BaseModel):
    name: Optional[NonEmpty] = None
    total_modules: Optional[int] = Field(default=None, ge=1, le=10_000)
    archived: Optional[bool] = None


class ModuleCompletionRead(ORM):
    id: int
    course_id: int
    completed_on: date
    note: Optional[str]


class CourseRead(ORM):
    id: int
    name: str
    total_modules: int
    archived: bool
    modules_completed: int
    completions: list[ModuleCompletionRead]


class ModuleCompletionCreate(BaseModel):
    completed_on: Optional[date] = None  # defaults to today
    note: OptionalText = None


class GoalTargetRead(ORM):
    goal_type: GoalType
    period: Period
    target: int
    enabled: bool


class GoalTargetUpdate(BaseModel):
    period: Optional[Period] = None
    target: Optional[int] = Field(default=None, ge=1, le=1000)
    enabled: Optional[bool] = None
