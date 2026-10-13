"""LeetCode logs, courses + module completions, and goal targets."""

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlmodel import Session, func, select

from ..clock import Clock, get_clock
from ..db import get_session
from ..models import Course, GoalTarget, GoalType, LeetCodeLog, LogSource, ModuleCompletion
from ..schemas import (
    CourseCreate,
    CourseRead,
    CourseUpdate,
    GoalProgressRead,
    GoalTargetRead,
    GoalTargetUpdate,
    LeetCodeLogCreate,
    LeetCodeLogRead,
    LeetCodeLogUpdate,
    ModuleCompletionCreate,
)
from ..services import leetcode as lc
from ..services.goals import goal_progress

router = APIRouter(prefix="/api", tags=["goals"])


# ---------------------------------------------------------------- leetcode


@router.get("/leetcode", response_model=list[LeetCodeLogRead])
def list_leetcode(limit: int = 200, session: Session = Depends(get_session)):
    query = select(LeetCodeLog).order_by(LeetCodeLog.solved_on.desc(), LeetCodeLog.id.desc()).limit(limit)
    return [lc.to_read(log) for log in session.exec(query).all()]


@router.post("/leetcode", response_model=LeetCodeLogRead, status_code=201)
def create_leetcode(data: LeetCodeLogCreate, session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    log = LeetCodeLog(
        **data.model_dump(exclude={"tags", "solved_on", "number"}),
        number=data.number or lc.parse_number(data.problem),
        slug=lc.slugify(data.problem),
        tags=lc.normalize_tags(data.tags),
        solved_on=data.solved_on or clock.today(),
        source=LogSource.manual,
    )
    session.add(log)
    session.commit()
    session.refresh(log)
    return lc.to_read(log)


@router.patch("/leetcode/{log_id}", response_model=LeetCodeLogRead)
def update_leetcode(log_id: int, data: LeetCodeLogUpdate, session: Session = Depends(get_session)):
    log = session.get(LeetCodeLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    changes = data.model_dump(exclude_unset=True)
    if "tags" in changes:
        changes["tags"] = lc.normalize_tags(changes["tags"] or [])
    for key in ("problem", "solved_on"):
        if key in changes and changes[key] is None:
            changes.pop(key)
    if "problem" in changes and log.source == LogSource.manual:
        changes["slug"] = lc.slugify(changes["problem"])
    for key, value in changes.items():
        setattr(log, key, value)
    session.add(log)
    session.commit()
    session.refresh(log)
    return lc.to_read(log)


@router.delete("/leetcode/{log_id}", status_code=204)
def delete_leetcode(log_id: int, session: Session = Depends(get_session)):
    log = session.get(LeetCodeLog, log_id)
    if log is None:
        raise HTTPException(status_code=404, detail="Log not found")
    session.delete(log)
    session.commit()
    return Response(status_code=204)


# ----------------------------------------------------------------- courses


def _course_read(course: Course) -> CourseRead:
    completions = sorted(course.completions, key=lambda c: (c.completed_on, c.id), reverse=True)
    return CourseRead.model_validate(
        {**course.model_dump(), "modules_completed": len(course.completions), "completions": completions}
    )


def _get_course(session: Session, course_id: int) -> Course:
    course = session.get(Course, course_id)
    if course is None:
        raise HTTPException(status_code=404, detail="Course not found")
    return course


@router.get("/courses", response_model=list[CourseRead])
def list_courses(session: Session = Depends(get_session)):
    courses = session.exec(select(Course).order_by(Course.archived, Course.created_at.desc())).all()
    return [_course_read(c) for c in courses]


@router.post("/courses", response_model=CourseRead, status_code=201)
def create_course(data: CourseCreate, session: Session = Depends(get_session)):
    course = Course(**data.model_dump())
    session.add(course)
    session.commit()
    session.refresh(course)
    return _course_read(course)


@router.patch("/courses/{course_id}", response_model=CourseRead)
def update_course(course_id: int, data: CourseUpdate, session: Session = Depends(get_session)):
    course = _get_course(session, course_id)
    changes = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "total_modules" in changes and changes["total_modules"] < len(course.completions):
        raise HTTPException(status_code=422, detail="Total modules cannot be less than modules already completed")
    for key, value in changes.items():
        setattr(course, key, value)
    session.add(course)
    session.commit()
    session.refresh(course)
    return _course_read(course)


@router.delete("/courses/{course_id}", status_code=204)
def delete_course(course_id: int, session: Session = Depends(get_session)):
    session.delete(_get_course(session, course_id))
    session.commit()
    return Response(status_code=204)


@router.post("/courses/{course_id}/completions", response_model=CourseRead, status_code=201)
def complete_module(
    course_id: int,
    data: ModuleCompletionCreate,
    session: Session = Depends(get_session),
    clock: Clock = Depends(get_clock),
):
    course = _get_course(session, course_id)
    done = session.exec(
        select(func.count()).select_from(ModuleCompletion).where(ModuleCompletion.course_id == course_id)
    ).one()
    if done >= course.total_modules:
        raise HTTPException(status_code=422, detail="All modules of this course are already completed")
    session.add(ModuleCompletion(course_id=course_id, completed_on=data.completed_on or clock.today(), note=data.note))
    session.commit()
    session.refresh(course)
    return _course_read(course)


@router.delete("/completions/{completion_id}", status_code=204)
def delete_completion(completion_id: int, session: Session = Depends(get_session)):
    completion = session.get(ModuleCompletion, completion_id)
    if completion is None:
        raise HTTPException(status_code=404, detail="Completion not found")
    session.delete(completion)
    session.commit()
    return Response(status_code=204)


# ----------------------------------------------------------------- targets


@router.get("/goals/targets", response_model=list[GoalTargetRead])
def list_targets(session: Session = Depends(get_session)):
    order = list(GoalType)
    return sorted(session.exec(select(GoalTarget)).all(), key=lambda t: order.index(t.goal_type))


@router.patch("/goals/targets/{goal_type}", response_model=GoalTargetRead)
def update_target(goal_type: GoalType, data: GoalTargetUpdate, session: Session = Depends(get_session)):
    target = session.get(GoalTarget, goal_type)
    if target is None:  # defaults are seeded at startup, but be safe
        target = GoalTarget(goal_type=goal_type)
    for key, value in data.model_dump(exclude_unset=True).items():
        if value is not None:
            setattr(target, key, value)
    session.add(target)
    session.commit()
    session.refresh(target)
    return target


@router.get("/goals/progress", response_model=list[GoalProgressRead])
def progress(session: Session = Depends(get_session), clock: Clock = Depends(get_clock)):
    return goal_progress(session, clock.today())
