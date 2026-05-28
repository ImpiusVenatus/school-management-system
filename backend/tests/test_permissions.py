from __future__ import annotations

import uuid


def _login(client, *, email: str, password: str) -> dict:
    r = client.post(
        "/api/auth/login",
        data={"username": email, "password": password},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    return r.json()


def test_students_requires_permission(client, db, normal_user):
    # Without permission -> forbidden
    token = _login(client, email=normal_user.email, password="userpass")
    r = client.get("/api/students", headers={"authorization": f"Bearer {token['access_token']}"})
    assert r.status_code == 403

    # Grant students.read -> allowed
    from app.core.permission_catalog import ensure_permission_catalog
    from app.models import Role

    perms = ensure_permission_catalog(db)
    role = Role(id=str(uuid.uuid4()), name="test_students_reader", is_system=False)
    role.permissions = [perms["students.read"]]
    normal_user.roles = [role]
    db.add(role)
    db.commit()

    token2 = _login(client, email=normal_user.email, password="userpass")
    r2 = client.get("/api/students", headers={"authorization": f"Bearer {token2['access_token']}"})
    assert r2.status_code == 200, r2.text

