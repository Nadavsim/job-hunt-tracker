from datetime import datetime, timedelta

from conftest import NOW


def test_quick_add_needs_only_company_and_role(client):
    res = client.post("/api/applications", json={"company": "Acme Widgets", "role": "SWE I"})
    assert res.status_code == 201
    body = res.json()
    assert body["stage"] == "applied"
    assert body["date_applied"] == NOW.date().isoformat()
    assert body["source"] == "other"
    assert [h["stage"] for h in body["history"]] == ["applied"]
    assert body["archived"] is False


def test_company_and_role_are_required_and_not_blank(client):
    assert client.post("/api/applications", json={"company": "Acme"}).status_code == 422
    assert client.post("/api/applications", json={"company": "  ", "role": "SWE"}).status_code == 422


def test_wishlist_has_no_applied_date(make_app):
    app = make_app(stage="wishlist")
    assert app["date_applied"] is None
    assert [h["stage"] for h in app["history"]] == ["wishlist"]


def test_stage_change_appends_history(client, make_app, clock):
    app = make_app()
    clock.set(NOW + timedelta(days=3))
    res = client.patch(f"/api/applications/{app['id']}", json={"stage": "phone_screen"})
    assert res.status_code == 200
    history = res.json()["history"]
    assert [h["stage"] for h in history] == ["applied", "phone_screen"]
    assert history[1]["changed_at"].startswith((NOW + timedelta(days=3)).date().isoformat())


def test_same_stage_patch_does_not_add_history(client, make_app):
    app = make_app()
    res = client.patch(f"/api/applications/{app['id']}", json={"stage": "applied", "notes": "x"})
    assert len(res.json()["history"]) == 1


def test_leaving_wishlist_sets_date_applied(client, make_app):
    app = make_app(stage="wishlist")
    res = client.patch(f"/api/applications/{app['id']}", json={"stage": "applied"})
    assert res.json()["date_applied"] == NOW.date().isoformat()


def test_withdrawing_from_wishlist_does_not_set_date_applied(client, make_app):
    app = make_app(stage="wishlist")
    res = client.patch(f"/api/applications/{app['id']}", json={"stage": "withdrawn"})
    assert res.json()["date_applied"] is None


def test_backdated_application_history_uses_real_date(make_app):
    applied = (NOW - timedelta(days=10)).date()
    app = make_app(date_applied=applied.isoformat(), stage="interview")
    stages = [(h["stage"], h["changed_at"][:10]) for h in app["history"]]
    assert stages == [("applied", applied.isoformat()), ("interview", NOW.date().isoformat())]


def test_patch_only_changes_sent_fields_and_null_clears_optional(client, make_app):
    app = make_app(notes="salary 100k", resume_version="v3-backend")
    res = client.patch(f"/api/applications/{app['id']}", json={"notes": None, "company": None})
    body = res.json()
    assert body["notes"] is None
    assert body["company"] == "Acme Widgets"  # required fields cannot be nulled
    assert body["resume_version"] == "v3-backend"


def test_archived_hidden_by_default(client, make_app):
    app = make_app()
    client.patch(f"/api/applications/{app['id']}", json={"archived": True})
    assert client.get("/api/applications").json() == []
    assert len(client.get("/api/applications?include_archived=true").json()) == 1


def test_delete_application(client, make_app):
    app = make_app()
    assert client.delete(f"/api/applications/{app['id']}").status_code == 204
    assert client.get(f"/api/applications/{app['id']}").status_code == 404


def test_invalid_stage_rejected(client, make_app):
    app = make_app()
    assert client.patch(f"/api/applications/{app['id']}", json={"stage": "hired"}).status_code == 422


# ----------------------------------------------------------------- stale rule


def test_stale_after_21_days_in_applied(client, make_app, clock):
    make_app(company="Fresh Co")
    old = make_app(company="Old Co", date_applied=(NOW - timedelta(days=21)).date().isoformat())
    almost = make_app(company="Almost Co", date_applied=(NOW - timedelta(days=20)).date().isoformat())

    stale = client.get("/api/applications/stale").json()
    assert [a["company"] for a in stale] == ["Old Co"]
    assert stale[0]["is_stale"] is True
    assert stale[0]["days_in_stage"] == 21
    # Never auto-ghosted: the stage is untouched.
    assert stale[0]["stage"] == "applied"
    assert client.get(f"/api/applications/{almost['id']}").json()["is_stale"] is False
    assert old["id"] != almost["id"]


def test_stage_change_resets_staleness(client, make_app, clock):
    app = make_app(date_applied=(NOW - timedelta(days=30)).date().isoformat())
    assert client.get(f"/api/applications/{app['id']}").json()["is_stale"] is True
    client.patch(f"/api/applications/{app['id']}", json={"stage": "online_assessment"})
    assert client.get("/api/applications/stale").json() == []


def test_only_applied_stage_is_ever_stale(client, make_app, clock):
    make_app(stage="wishlist")
    make_app(stage="interview")
    clock.set(NOW + timedelta(days=60))
    assert client.get("/api/applications/stale").json() == []


def test_archived_never_stale(client, make_app):
    app = make_app(date_applied=(NOW - timedelta(days=40)).date().isoformat())
    client.patch(f"/api/applications/{app['id']}", json={"archived": True})
    assert client.get("/api/applications/stale").json() == []


def test_correcting_date_applied_moves_staleness(client, make_app):
    app = make_app()  # applied today
    res = client.patch(
        f"/api/applications/{app['id']}",
        json={"date_applied": (NOW - timedelta(days=25)).date().isoformat()},
    )
    assert res.json()["is_stale"] is True
    assert len(res.json()["history"]) == 1


def test_stale_boundary_uses_local_dates_not_hours(client, make_app, clock):
    # Applied at 23:59 on day 0 is stale at 00:00 on day 21.
    clock.set(datetime(2026, 1, 1, 23, 59))
    app = make_app()
    clock.set(datetime(2026, 1, 22, 0, 0))
    assert client.get(f"/api/applications/{app['id']}").json()["is_stale"] is True


# ------------------------------------------------------------------- contacts


def test_contacts_link_to_applications(client, make_app):
    a1 = make_app(company="Acme Widgets")
    a2 = make_app(company="Globex Example")
    res = client.post(
        "/api/contacts",
        json={"name": "Pat Example", "role": "Recruiter", "application_ids": [a1["id"], a2["id"]]},
    )
    assert res.status_code == 201
    contact = res.json()
    assert sorted(contact["application_ids"]) == sorted([a1["id"], a2["id"]])
    app = client.get(f"/api/applications/{a1['id']}").json()
    assert app["contacts"] == [{"id": contact["id"], "name": "Pat Example"}]

    # Unlink from the application side.
    client.patch(f"/api/applications/{a1['id']}", json={"contact_ids": []})
    assert client.get(f"/api/contacts").json()[0]["application_ids"] == [a2["id"]]


def test_unknown_contact_id_rejected(client):
    res = client.post("/api/applications", json={"company": "A", "role": "B", "contact_ids": [999]})
    assert res.status_code == 422


def test_deleting_contact_keeps_application(client, make_app):
    app = make_app()
    contact = client.post("/api/contacts", json={"name": "Sam Sample", "application_ids": [app["id"]]}).json()
    assert client.delete(f"/api/contacts/{contact['id']}").status_code == 204
    assert client.get(f"/api/applications/{app['id']}").json()["contacts"] == []


def test_deleting_application_keeps_contact(client, make_app):
    app = make_app()
    client.post("/api/contacts", json={"name": "Sam Sample", "application_ids": [app["id"]]})
    client.delete(f"/api/applications/{app['id']}")
    contacts = client.get("/api/contacts").json()
    assert len(contacts) == 1 and contacts[0]["application_ids"] == []


def test_contact_update(client):
    c = client.post("/api/contacts", json={"name": "Sam Sample"}).json()
    res = client.patch(f"/api/contacts/{c['id']}", json={"email": "sam@example.com", "name": None})
    assert res.json()["email"] == "sam@example.com"
    assert res.json()["name"] == "Sam Sample"
