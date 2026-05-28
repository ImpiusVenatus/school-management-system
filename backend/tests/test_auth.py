from __future__ import annotations


def test_login_and_refresh(client, superuser):
    # Login (OAuth2PasswordRequestForm)
    r = client.post(
        "/api/auth/login",
        data={"username": superuser.email, "password": "adminpass"},
        headers={"content-type": "application/x-www-form-urlencoded"},
    )
    assert r.status_code == 200, r.text
    token = r.json()
    assert "access_token" in token
    assert "refresh_token" in token

    # Me
    r2 = client.get("/api/auth/me", headers={"authorization": f"Bearer {token['access_token']}"})
    assert r2.status_code == 200, r2.text
    me = r2.json()
    assert me["email"] == superuser.email

    # Refresh
    r3 = client.post("/api/auth/refresh", json={"refresh_token": token["refresh_token"]})
    assert r3.status_code == 200, r3.text
    refreshed = r3.json()
    assert "access_token" in refreshed
    assert "refresh_token" in refreshed
    assert refreshed["refresh_token"] != token["refresh_token"]

