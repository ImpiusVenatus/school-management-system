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


def test_audit_logs_mutations(client, db, superuser):
    from app.models import AuditLog

    token = _login(client, email=superuser.email, password="adminpass")
    before = db.query(AuditLog).count()

    # Make a mutating request that should be audited (POST /students)
    body = {
        "first_name": "Test",
        "middle_name": None,
        "last_name": "Student",
        "student_email_id": f"student-{uuid.uuid4()}@example.com",
        "student_mobile_number": "0123456789",
        "date_of_birth": None,
        "blood_group": None,
        "gender": None,
        "nationality": None,
        "joining_date": None,
        "address_line_1": None,
        "address_line_2": None,
        "city": None,
        "state": None,
        "pincode": None,
        "country": None,
        "enabled": True,
        "guardians": [],
    }

    r = client.post(
        "/api/students",
        json=body,
        headers={"authorization": f"Bearer {token['access_token']}"},
    )
    assert r.status_code == 200, r.text

    # The middleware writes audit logs using its own session.
    # Expire current session state so we see the new rows.
    db.expire_all()
    after = db.query(AuditLog).count()
    assert after >= before + 1

