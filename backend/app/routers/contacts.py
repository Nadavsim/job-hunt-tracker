from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from ..db import get_session
from ..models import Application, Contact, Outreach
from ..schemas import ContactCreate, ContactRead, ContactUpdate

router = APIRouter(prefix="/api/contacts", tags=["contacts"])


def _to_read(contact: Contact, session: Session) -> ContactRead:
    dates = session.exec(select(Outreach.happened_on).where(Outreach.contact_id == contact.id)).all()
    return ContactRead.model_validate(
        {
            **contact.model_dump(),
            "application_ids": [a.id for a in contact.applications],
            "outreach_count": len(dates),
            "last_contacted": max(dates, default=None),
        }
    )


def _load_applications(session: Session, ids: list[int]) -> list[Application]:
    if not ids:
        return []
    apps = session.exec(select(Application).where(Application.id.in_(ids))).all()
    missing = set(ids) - {a.id for a in apps}
    if missing:
        raise HTTPException(status_code=422, detail=f"Unknown application id(s): {sorted(missing)}")
    return list(apps)


def _get_or_404(session: Session, contact_id: int) -> Contact:
    contact = session.get(Contact, contact_id)
    if contact is None:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.get("", response_model=list[ContactRead])
def list_contacts(session: Session = Depends(get_session)):
    return [_to_read(c, session) for c in session.exec(select(Contact).order_by(Contact.name)).all()]


@router.post("", response_model=ContactRead, status_code=201)
def create_contact(data: ContactCreate, session: Session = Depends(get_session)):
    contact = Contact(**data.model_dump(exclude={"application_ids"}))
    contact.applications = _load_applications(session, data.application_ids)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return _to_read(contact, session)


@router.patch("/{contact_id}", response_model=ContactRead)
def update_contact(contact_id: int, data: ContactUpdate, session: Session = Depends(get_session)):
    contact = _get_or_404(session, contact_id)
    changes = data.model_dump(exclude_unset=True)
    app_ids = changes.pop("application_ids", None)
    if changes.get("name", "") is None:
        changes.pop("name")
    for key, value in changes.items():
        setattr(contact, key, value)
    if app_ids is not None:
        contact.applications = _load_applications(session, app_ids)
    session.add(contact)
    session.commit()
    session.refresh(contact)
    return _to_read(contact, session)


@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, session: Session = Depends(get_session)):
    session.delete(_get_or_404(session, contact_id))
    session.commit()
    return Response(status_code=204)
