from typing import Annotated, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, StringConstraints
from sqlmodel import Session

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import Setting
from ..services import leetcode_sync

router = APIRouter(prefix="/api", tags=["settings"])

USERNAME_KEY = "leetcode_username"
LAST_SYNC_KEY = "leetcode_last_sync"

Username = Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Za-z0-9_-]{0,40}$")]


class SettingsRead(BaseModel):
    leetcode_username: Optional[str] = None
    leetcode_last_sync: Optional[str] = None


class SettingsUpdate(BaseModel):
    leetcode_username: Optional[Username] = None  # null/empty disables sync


def _get(session: Session, key: str) -> Optional[str]:
    row = session.get(Setting, key)
    return row.value if row else None


def _set(session: Session, key: str, value: Optional[str]) -> None:
    row = session.get(Setting, key)
    if value is None:
        if row:
            session.delete(row)
    elif row:
        row.value = value
    else:
        session.add(Setting(key=key, value=value))


def _read(session: Session) -> SettingsRead:
    return SettingsRead(leetcode_username=_get(session, USERNAME_KEY), leetcode_last_sync=_get(session, LAST_SYNC_KEY))


@router.get("/settings", response_model=SettingsRead)
def get_settings(session: Session = Depends(get_session)):
    return _read(session)


@router.put("/settings", response_model=SettingsRead)
def put_settings(data: SettingsUpdate, session: Session = Depends(get_session)):
    _set(session, USERNAME_KEY, data.leetcode_username or None)
    session.commit()
    return _read(session)


@router.post("/leetcode/sync")
def sync_leetcode(
    session: Session = Depends(get_session),
    client: httpx.Client = Depends(leetcode_sync.http_client),
    clock: Clock = Depends(get_clock),
):
    username = _get(session, USERNAME_KEY)
    if not username:
        raise HTTPException(status_code=400, detail="Set your LeetCode username in Settings first.")
    try:
        result = leetcode_sync.sync(session, client, username)
    except leetcode_sync.SyncError as exc:
        session.rollback()
        # 502: the upstream (LeetCode) failed, not this app.
        raise HTTPException(status_code=502, detail=f"{exc} Manual logging still works.") from exc
    _set(session, LAST_SYNC_KEY, clock.now().isoformat())
    session.commit()
    return {**result.__dict__, "last_sync": _get(session, LAST_SYNC_KEY)}
