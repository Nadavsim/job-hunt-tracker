from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlmodel import Session

from ..clock import Clock, get_clock
from ..db import get_session
from ..schemas import LeetCodeLogRead
from ..services import leetcode as lc
from ..services import neetcode

router = APIRouter(prefix="/api/neetcode150", tags=["neetcode"])


class LogRequest(BaseModel):
    solved_without_hints: Optional[bool] = None


@router.get("")
def get_checklist(session: Session = Depends(get_session)):
    return neetcode.checklist(session)


@router.post("/{slug}/log", response_model=LeetCodeLogRead, status_code=201)
def log_solved(
    slug: str,
    data: LogRequest,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
):
    problem = neetcode.by_slug(slug)
    if problem is None:
        raise HTTPException(status_code=404, detail="Not a NeetCode 150 problem")
    return lc.to_read(neetcode.log_problem(session, problem, clock.today(), data.solved_without_hints))
