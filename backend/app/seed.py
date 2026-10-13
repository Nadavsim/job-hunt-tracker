"""Fill a database with obviously fake demo data.

    python -m app.seed --db data/demo.db

Refuses to touch a database that already has applications, so it can never
mix demo rows into real data. Companies and people are invented
("Example"/"Sample" names, example.com emails).
"""

import argparse
import random
from datetime import date, datetime, time, timedelta
from pathlib import Path

from sqlmodel import Session, func, select

from .db import init_db, make_engine
from .models import (
    Application,
    Contact,
    Course,
    Difficulty,
    LeetCodeLog,
    ModuleCompletion,
    Source,
    Stage,
    StageChange,
)
from .services.leetcode import normalize_tags, slugify

COMPANIES = [
    "Acme Demo Widgets", "Globex Example", "Initech Sample", "Umbrella Demo", "Hooli Placeholder",
    "Vandelay Test Co", "Stark Fictional", "Wayne Sample Labs", "Pied Piper Demo", "Contoso Example",
    "Fabrikam Sample", "Northwind Demo", "Tailspin Example", "Wingtip Sample", "Litware Demo",
]
ROLES = ["Junior Software Engineer", "Backend Engineer I", "Frontend Developer", "Graduate SWE", "Data Engineer I"]
PROBLEMS = [
    ("1. Two Sum", Difficulty.easy, ["array", "hash table"]),
    ("20. Valid Parentheses", Difficulty.easy, ["stack", "string"]),
    ("121. Best Time to Buy and Sell Stock", Difficulty.easy, ["array", "dynamic programming"]),
    ("3. Longest Substring Without Repeating Characters", Difficulty.medium, ["string", "sliding window"]),
    ("200. Number of Islands", Difficulty.medium, ["graph", "bfs"]),
    ("322. Coin Change", Difficulty.medium, ["dynamic programming"]),
    ("42. Trapping Rain Water", Difficulty.hard, ["array", "two pointers"]),
]


def seed(session: Session, today: date, rng: random.Random) -> None:
    contacts = [
        Contact(name="Alex Example", role="Recruiter", email="alex@example.com"),
        Contact(name="Sam Sample", role="Engineering Manager", linkedin="linkedin.com/in/sam-sample-demo"),
    ]
    session.add_all(contacts)

    for i, company in enumerate(COMPANIES):
        applied_on = today - timedelta(days=rng.randint(1, 45))
        app = Application(
            company=company,
            role=rng.choice(ROLES),
            source=rng.choice(list(Source)),
            date_applied=applied_on,
            resume_version=rng.choice(["v2-general", "v3-backend", "v3-backend"]),
            location=rng.choice(["Remote", "Hybrid", "On-site"]),
            notes="Demo data",
            created_at=datetime.combine(applied_on, time(9)),
        )
        app.history = [StageChange(stage=Stage.applied, changed_at=datetime.combine(applied_on, time(9)))]
        path = rng.choice([[], [], [Stage.online_assessment], [Stage.phone_screen, Stage.interview], [Stage.rejected]])
        when = applied_on
        for stage in path:
            when = min(today, when + timedelta(days=rng.randint(2, 9)))
            app.history.append(StageChange(stage=stage, changed_at=datetime.combine(when, time(12))))
            app.stage = stage
        if i % 5 == 0:
            app.next_follow_up = today - timedelta(days=i % 3)
        if i < 2:
            app.contacts = [contacts[i]]
        session.add(app)

    wish = Application(company="Example Startup", role="Founding Engineer", stage=Stage.wishlist, date_applied=None)
    wish.history = [StageChange(stage=Stage.wishlist)]
    session.add(wish)

    for days_ago in range(1, 14):
        for _ in range(rng.choice([1, 2, 2, 3])):
            name, diff, tags = rng.choice(PROBLEMS)
            session.add(
                LeetCodeLog(
                    problem=name,
                    slug=slugify(name),
                    difficulty=diff,
                    tags=normalize_tags(tags),
                    solved_without_hints=rng.random() > 0.3,
                    solved_on=today - timedelta(days=days_ago),
                )
            )

    course = Course(name="Example Algorithms Course", total_modules=20)
    course.completions = [ModuleCompletion(completed_on=today - timedelta(days=d)) for d in range(1, 8)]
    session.add(course)
    session.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--db", type=Path, required=True, help="path of the demo database file")
    args = parser.parse_args()
    engine = make_engine(args.db)
    init_db(engine)
    with Session(engine) as session:
        if session.exec(select(func.count()).select_from(Application)).one():
            raise SystemExit(f"{args.db} already has applications - refusing to add demo data.")
        seed(session, date.today(), random.Random(42))
    print(f"Demo data written to {args.db}. Run it with:  JOBTRACKER_DB_PATH={args.db} python -m app")


if __name__ == "__main__":
    main()
