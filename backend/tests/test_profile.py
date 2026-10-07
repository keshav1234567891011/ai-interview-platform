def test_default_profile_and_real_empty_dashboard(client, account):
    response = client.get("/api/profile")
    assert response.status_code == 200
    assert response.json()["completion"] == 25
    dashboard = client.get("/api/dashboard").json()
    assert dashboard["recent_interviews"] == []
    assert dashboard["interview_count"] == 0
    assert len(client.get("/api/skills").json()) >= 16


def test_profile_updates_and_normalizes_skills(client, account):
    response = client.put(
        "/api/profile",
        json={
            "display_name": "Updated Candidate",
            "target_role": "Backend Developer",
            "experience_level": "entry",
            "summary": "Building useful APIs.",
            "skill_ids": ["python", "sql", "python"],
        },
    )
    assert response.status_code == 200
    assert response.json()["completion"] == 100
    assert len(response.json()["skills"]) == 2
    assert client.get("/api/auth/me").json()["display_name"] == "Updated Candidate"
    assert client.get("/api/profile").json()["summary"] == "Building useful APIs."


def test_profile_authorization(client):
    for endpoint in ["/api/profile", "/api/dashboard", "/api/skills"]:
        assert client.get(endpoint).status_code == 401


def test_profile_validation(client, account):
    assert (
        client.put(
            "/api/profile", json={"display_name": "Valid", "skill_ids": ["unknown"]}
        ).status_code
        == 422
    )
    assert (
        client.put(
            "/api/profile", json={"display_name": " ", "experience_level": "invalid"}
        ).status_code
        == 422
    )


def test_profiles_are_isolated(client, account):
    client.put(
        "/api/profile", json={"display_name": "Candidate One", "target_role": "Private target"}
    )
    client.post(
        "/api/auth/register",
        json={
            "email": "second@example.com",
            "display_name": "Candidate Two",
            "password": "Another-test-password42",
        },
    )
    assert client.get("/api/profile").json()["target_role"] == ""
