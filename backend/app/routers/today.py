from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import CLOSED_STAGES, Application
from ..schemas import TodayRead
from ..services import applications as apps_svc
from ..services.goals import goal_progress

router = APIRouter(prefix="/api", tags=["today"])


@router.get("/today", response_model=TodayRead)
def today_view(session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    today = clock.today()
    active = session.exec(select(Application).where(Application.archived == False)).all()  # noqa: E712

    # Follow-ups on closed applications (offer/rejected/...) are not nagged about.
    follow_ups = sorted(
        (a for a in active if a.next_follow_up and a.next_follow_up <= today and a.stage not in CLOSED_STAGES),
        key=lambda a: a.next_follow_up,
    )
    stale = sorted((a for a in active if apps_svc.is_stale(a, today)), key=apps_svc.last_stage_change)

    return TodayRead(
        date=today,
        goals=goal_progress(session, today),
        follow_ups=[apps_svc.to_read(a, today) for a in follow_ups],
        stale=[apps_svc.to_read(a, today) for a in stale],
    )
