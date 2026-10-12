"""Application business rules: stage history, auto-filled dates, stale rule."""

from datetime import date, datetime, time

from fastapi import HTTPException
from sqlmodel import Session, select

from ..clock import Clock
from ..models import Application, Contact, Stage, StageChange
from ..schemas import ApplicationCreate, ApplicationRead, ApplicationUpdate

# An application sitting in "applied" this long with no stage change is
# *suggested* as possibly ghosted. It is never marked ghosted automatically.
STALE_AFTER_DAYS = 21

# Fields that may not be cleared with an explicit null in a PATCH.
_REQUIRED_FIELDS = {"company", "role", "source", "stage", "archived"}


def _start_of(day: date) -> datetime:
    return datetime.combine(day, time.min)


def last_stage_change(app: Application) -> datetime:
    return max((h.changed_at for h in app.history), default=app.created_at)


def days_in_stage(app: Application, today: date) -> int:
    return max(0, (today - last_stage_change(app).date()).days)


def is_stale(app: Application, today: date) -> bool:
    return (
        not app.archived
        and app.stage == Stage.applied
        and days_in_stage(app, today) >= STALE_AFTER_DAYS
    )


def to_read(app: Application, today: date) -> ApplicationRead:
    data = ApplicationRead.model_validate(
        {
            **app.model_dump(),
            "history": sorted(app.history, key=lambda h: h.changed_at),
            "contacts": app.contacts,
            "days_in_stage": days_in_stage(app, today),
            "is_stale": is_stale(app, today),
        }
    )
    return data


def _load_contacts(session: Session, ids: list[int]) -> list[Contact]:
    if not ids:
        return []
    contacts = session.exec(select(Contact).where(Contact.id.in_(ids))).all()
    missing = set(ids) - {c.id for c in contacts}
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown contact id(s): {sorted(missing)}")
    return list(contacts)


def create_application(session: Session, data: ApplicationCreate, clock: Clock) -> Application:
    now = clock.now()
    today = now.date()
    fields = data.model_dump(exclude={"contact_ids"})
    if data.stage != Stage.wishlist and data.date_applied is None:
        fields["date_applied"] = today

    app = Application(**fields, created_at=now, updated_at=now)
    app.contacts = _load_contacts(session, data.contact_ids)

    # Seed the history. A back-dated application gets its "applied" entry on
    # the date it was really sent, so the stale rule and the dashboard's
    # "days to first response" work for entries logged after the fact.
    applied_on = app.date_applied
    if app.stage == Stage.wishlist or applied_on is None:
        app.history = [StageChange(stage=app.stage, changed_at=now)]
    else:
        applied_at = now if applied_on >= today else _start_of(applied_on)
        app.history = [StageChange(stage=Stage.applied, changed_at=applied_at)]
        if app.stage != Stage.applied:
            app.history.append(StageChange(stage=app.stage, changed_at=now))

    session.add(app)
    session.commit()
    session.refresh(app)
    return app


def update_application(
    session: Session, app: Application, data: ApplicationUpdate, clock: Clock
) -> Application:
    now = clock.now()
    changes = data.model_dump(exclude_unset=True)
    contact_ids = changes.pop("contact_ids", None)

    for key in _REQUIRED_FIELDS:
        if key in changes and changes[key] is None:
            changes.pop(key)

    new_stage = changes.pop("stage", None)
    for key, value in changes.items():
        setattr(app, key, value)

    if "date_applied" in changes and app.date_applied is not None:
        _sync_applied_entry(app, now)

    if new_stage is not None and new_stage != app.stage:
        app.stage = new_stage
        app.history.append(StageChange(stage=new_stage, changed_at=now))
        # Leaving the wishlist means it was sent (unless it was dropped).
        if app.date_applied is None and new_stage not in (Stage.wishlist, Stage.withdrawn):
            app.date_applied = now.date()

    if contact_ids is not None:
        app.contacts = _load_contacts(session, contact_ids)

    app.updated_at = now
    session.add(app)
    session.commit()
    session.refresh(app)
    return app


def _sync_applied_entry(app: Application, now: datetime) -> None:
    """If the user corrects date_applied while the application is still in
    "applied", move that history entry too, so staleness follows the real date."""
    if app.stage != Stage.applied or not app.history:
        return
    latest = max(app.history, key=lambda h: h.changed_at)
    if latest.stage == Stage.applied:
        latest.changed_at = now if app.date_applied >= now.date() else _start_of(app.date_applied)
