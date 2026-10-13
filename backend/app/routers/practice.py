"""Mock interviews and networking (outreach) logs."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import Contact, MockInterview, Outreach
from ..schemas import (
    MockInterviewCreate,
    MockInterviewRead,
    MockInterviewUpdate,
    OutreachCreate,
    OutreachRead,
    OutreachUpdate,
)

router = APIRouter(prefix="/api", tags=["practice"])

# PATCH: these may not be cleared with an explicit null.
_REQUIRED = {"held_on", "kind", "happened_on"}


def _apply(row, changes: dict) -> None:
    for key, value in changes.items():
        if value is None and key in _REQUIRED:
            continue
        setattr(row, key, value)


# ---------------------------------------------------------- mock interviews


@router.get("/mocks", response_model=list[MockInterviewRead])
def list_mocks(session: Session = Depends(get_session)):
    query = select(MockInterview).order_by(MockInterview.held_on.desc(), MockInterview.id.desc())
    return session.exec(query).all()


@router.post("/mocks", response_model=MockInterviewRead, status_code=201)
def create_mock(data: MockInterviewCreate, session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    mock = MockInterview(**data.model_dump(exclude={"held_on"}), held_on=data.held_on or clock.today())
    session.add(mock)
    session.commit()
    session.refresh(mock)
    return mock


def _get_mock(session: Session, mock_id: int) -> MockInterview:
    mock = session.get(MockInterview, mock_id)
    if mock is None:
        raise HTTPException(status_code=404, detail="Mock interview not found")
    return mock


@router.patch("/mocks/{mock_id}", response_model=MockInterviewRead)
def update_mock(mock_id: int, data: MockInterviewUpdate, session: Session = Depends(get_session)):
    mock = _get_mock(session, mock_id)
    _apply(mock, data.model_dump(exclude_unset=True))
    session.add(mock)
    session.commit()
    session.refresh(mock)
    return mock


@router.delete("/mocks/{mock_id}", status_code=204)
def delete_mock(mock_id: int, session: Session = Depends(get_session)):
    session.delete(_get_mock(session, mock_id))
    session.commit()
    return Response(status_code=204)


# ----------------------------------------------------------------- outreach


def _outreach_read(session: Session, row: Outreach) -> OutreachRead:
    contact = session.get(Contact, row.contact_id) if row.contact_id else None
    return OutreachRead.model_validate({**row.model_dump(), "contact_name": contact.name if contact else None})


def _check_contact(session: Session, contact_id: int | None) -> None:
    if contact_id is not None and session.get(Contact, contact_id) is None:
        raise HTTPException(status_code=422, detail=f"Unknown contact id: {contact_id}")


@router.get("/outreach", response_model=list[OutreachRead])
def list_outreach(contact_id: int | None = None, session: Session = Depends(get_session)):
    query = select(Outreach).order_by(Outreach.happened_on.desc(), Outreach.id.desc())
    if contact_id is not None:
        query = query.where(Outreach.contact_id == contact_id)
    return [_outreach_read(session, row) for row in session.exec(query).all()]


@router.post("/outreach", response_model=OutreachRead, status_code=201)
def create_outreach(data: OutreachCreate, session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    if data.contact_id is not None and data.new_contact_name:
        raise HTTPException(status_code=422, detail="Pick an existing contact or type a new name, not both")
    contact_id = data.contact_id
    _check_contact(session, contact_id)
    if data.new_contact_name:
        contact = Contact(name=data.new_contact_name)
        session.add(contact)
        session.flush()  # assigns contact.id; committed together with the outreach row
        contact_id = contact.id
    row = Outreach(
        contact_id=contact_id,
        kind=data.kind,
        happened_on=data.happened_on or clock.today(),
        notes=data.notes,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _outreach_read(session, row)


def _get_outreach(session: Session, outreach_id: int) -> Outreach:
    row = session.get(Outreach, outreach_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Outreach entry not found")
    return row


@router.patch("/outreach/{outreach_id}", response_model=OutreachRead)
def update_outreach(outreach_id: int, data: OutreachUpdate, session: Session = Depends(get_session)):
    row = _get_outreach(session, outreach_id)
    changes = data.model_dump(exclude_unset=True)
    _check_contact(session, changes.get("contact_id"))
    _apply(row, changes)
    session.add(row)
    session.commit()
    session.refresh(row)
    return _outreach_read(session, row)


@router.delete("/outreach/{outreach_id}", status_code=204)
def delete_outreach(outreach_id: int, session: Session = Depends(get_session)):
    session.delete(_get_outreach(session, outreach_id))
    session.commit()
    return Response(status_code=204)
