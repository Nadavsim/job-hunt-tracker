from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, select

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import Application
from ..schemas import ApplicationCreate, ApplicationRead, ApplicationUpdate
from ..services import applications as svc

router = APIRouter(prefix="/api/applications", tags=["applications"])


def _get_or_404(session: Session, app_id: int) -> Application:
    app = session.get(Application, app_id)
    if app is None:
        raise HTTPException(status_code=404, detail="Application not found")
    return app


@router.get("", response_model=list[ApplicationRead])
def list_applications(
    include_archived: bool = False,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
):
    # Sorting and filtering happen in the browser: a job hunt is hundreds of
    # rows at most, and it keeps the API small.
    query = select(Application).order_by(Application.updated_at.desc())
    if not include_archived:
        query = query.where(Application.archived == False)  # noqa: E712
    today = clock.today()
    return [svc.to_read(a, today) for a in session.exec(query).all()]


@router.get("/stale", response_model=list[ApplicationRead])
def list_stale(session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    today = clock.today()
    apps = session.exec(select(Application).where(Application.archived == False)).all()  # noqa: E712
    stale = [a for a in apps if svc.is_stale(a, today)]
    stale.sort(key=svc.last_stage_change)
    return [svc.to_read(a, today) for a in stale]


@router.post("", response_model=ApplicationRead, status_code=201)
def create_application(
    data: ApplicationCreate,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
):
    app = svc.create_application(session, data, clock)
    return svc.to_read(app, clock.today())


@router.get("/{app_id}", response_model=ApplicationRead)
def get_application(app_id: int, session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    return svc.to_read(_get_or_404(session, app_id), clock.today())


@router.patch("/{app_id}", response_model=ApplicationRead)
def update_application(
    app_id: int,
    data: ApplicationUpdate,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
):
    app = svc.update_application(session, _get_or_404(session, app_id), data, clock)
    return svc.to_read(app, clock.today())


@router.delete("/{app_id}", status_code=204)
def delete_application(app_id: int, session: Session = Depends(get_session)):
    session.delete(_get_or_404(session, app_id))
    session.commit()
    return Response(status_code=204)
