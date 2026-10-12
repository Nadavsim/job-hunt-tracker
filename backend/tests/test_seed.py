import random
from datetime import date

import pytest
from sqlmodel import Session

from app import seed as seed_module
from app.db import init_db, make_engine


def test_seed_is_fake_and_refuses_existing_data(tmp_path, monkeypatch, capsys):
    db = tmp_path / "demo.db"
    monkeypatch.setattr("sys.argv", ["seed", "--db", str(db)])
    seed_module.main()
    with pytest.raises(SystemExit):
        seed_module.main()


def test_seed_data_uses_fake_names():
    engine = make_engine(in_memory=True)
    init_db(engine)
    with Session(engine) as session:
        seed_module.seed(session, date(2026, 3, 18), random.Random(1))
    assert all(any(w in c for w in ("Example", "Sample", "Demo", "Placeholder", "Test", "Fictional")) for c in seed_module.COMPANIES)
