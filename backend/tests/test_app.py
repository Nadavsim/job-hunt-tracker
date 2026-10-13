from fastapi.testclient import TestClient

from app import config
from app.db import make_engine
from app.main import create_app


def test_binds_to_localhost_only():
    assert config.HOST == "127.0.0.1"


def test_db_path_from_env(monkeypatch, tmp_path):
    monkeypatch.setenv("JOBTRACKER_DB_PATH", str(tmp_path / "x.db"))
    assert config.db_path() == tmp_path / "x.db"


def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_serves_built_frontend_with_spa_fallback(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("<html>app</html>")
    (dist / "assets" / "main.js").write_text("console.log(1)")
    app = create_app(engine=make_engine(in_memory=True), frontend_dist=dist)
    with TestClient(app) as c:
        assert c.get("/").text == "<html>app</html>"
        assert c.get("/dashboard").text == "<html>app</html>"  # client-side route
        assert c.get("/assets/main.js").text == "console.log(1)"
        assert c.get("/api/does-not-exist").status_code == 404
        assert c.get("/api/health").status_code == 200
