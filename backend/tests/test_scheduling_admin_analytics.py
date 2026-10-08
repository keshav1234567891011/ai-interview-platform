from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy.orm import Session

from app.core.permissions import PERMISSIONS
from app.models.schedule import ScheduledInterview
from app.models.user import User
from app.services.administration import assign_permissions


def schedule(client, **overrides):
    return client.post(
        "/api/scheduled",
        json={
            "role": "Backend Developer",
            "question_count": 1,
            "scheduled_at": (datetime.now(UTC) + timedelta(days=1)).isoformat(),
            **overrides,
        },
    )


def test_timezone_scheduling_reschedule_cancel_and_validation(client, account):
    timestamp = (datetime.now(UTC) + timedelta(days=1)).astimezone().isoformat()
    response = schedule(client, scheduled_at=timestamp)
    assert response.status_code == 201
    data = response.json()
    id = data["id"]
    assert datetime.fromisoformat(data["scheduled_at"]) == datetime.fromisoformat(timestamp)
    assert data["scheduled_at"].endswith("Z") or data["scheduled_at"].endswith("+00:00")
    assert client.post(f"/api/scheduled/{id}/start").status_code == 409
    updated = client.put(
        f"/api/scheduled/{id}",
        json={"scheduled_at": (datetime.now(UTC) + timedelta(days=2)).isoformat()},
    )
    assert updated.status_code == 200
    assert client.get("/api/dashboard").json()["next_scheduled"]["id"] == id
    assert client.post(f"/api/scheduled/{id}/cancel").json()["status"] == "cancelled"
    assert client.post(f"/api/scheduled/{id}/cancel").status_code == 409
    assert client.post(f"/api/scheduled/{id}/start").status_code == 409
    assert client.get("/api/dashboard").json()["next_scheduled"] is None
    assert schedule(client, scheduled_at="2030-01-01T12:00:00").status_code == 422
    assert schedule(client, scheduled_at="2020-01-01T12:00:00Z").status_code == 422


def test_start_due_schedule_once_and_ownership(client, account):
    data = schedule(client).json()
    id = data["id"]
    with Session(client.engine) as db:
        db.get(ScheduledInterview, UUID(id)).scheduled_at = datetime.now(UTC) - timedelta(minutes=1)
        db.commit()
    started = client.post(f"/api/scheduled/{id}/start")
    assert started.status_code == 200 and started.json()["status"] == "in_progress"
    assert client.post(f"/api/scheduled/{id}/start").status_code == 409
    assert client.get("/api/scheduled").json()[0]["interview_id"] == started.json()["id"]
    client.post(
        "/api/auth/register",
        json={
            "email": "other@example.com",
            "display_name": "Other User",
            "password": "Other-test-password42",
        },
    )
    assert client.post(f"/api/scheduled/{id}/start").status_code == 404
    assert client.post(f"/api/scheduled/{id}/cancel").status_code == 404
    assert client.get("/api/scheduled").json() == []
    client.post("/api/auth/logout")
    assert client.get("/api/scheduled").status_code == 401


def evaluated_session(client, answer):
    interview = client.post(
        "/api/interviews",
        json={"role": "Backend Developer", "focus_areas": ["dbms"], "question_count": 1},
    ).json()
    base = f"/api/interviews/{interview['id']}"
    active = client.post(base + "/start").json()
    client.put(
        f"{base}/questions/{active['questions'][0]['id']}/answer", json={"answer_text": answer}
    )
    return client.get(base + "/results").json()["summary"]


def test_analytics_empty_one_many_and_real_history(client, account):
    empty = client.get("/api/analytics").json()
    assert empty["completed_interviews"] == 0 and empty["averages"]["score"] is None
    assert empty["insights"] == []
    results = [
        evaluated_session(
            client,
            "An index improves query lookup. For example, "
            "use an indexed key because it reduces scanning.",
        )
    ]
    single = client.get("/api/analytics").json()
    assert single["completed_interviews"] == 1 and single["latest_score"] == results[0]["score"]
    assert single["insights"] == []
    results.extend(
        evaluated_session(client, answer)
        for answer in [
            "I am not sure.",
            "An index and transaction require isolation because concurrent queries change data. "
            "However, consider a practical example.",
        ]
    )
    data = client.get("/api/analytics").json()
    assert data["completed_interviews"] == data["evaluated_interviews"] == 3
    assert data["averages"]["score"] == round(sum(row["score"] for row in results) / 3)
    assert data["best_score"] == max(row["score"] for row in results)
    assert len(data["trend"]) == 3 and data["topics"][0]["observations"] == 3
    assert len(data["insights"]) == 2
    history = client.get("/api/history").json()
    assert len(history) == 3 and all(row["score"] is not None for row in history)
    assert all("answer_text" not in row for row in history)
    assert client.get("/api/history?offset=50").json() == []
    client.post("/api/auth/logout")
    assert client.get("/api/analytics").status_code == 401


def test_admin_denial_and_public_role_escalation_prevention(client, account):
    assert account["role"] == "user"
    for path in ["/api/admin", "/api/admin/users", f"/api/admin/users/{account['id']}"]:
        assert client.get(path).status_code == 403
    assert (
        client.post(
            "/api/auth/register",
            json={
                "email": "escalate@example.com",
                "display_name": "Attempted Admin",
                "password": "Other-test-password42",
                "role": "admin",
            },
        ).status_code
        == 422
    )
    assert client.get("/api/auth/me").json()["role"] == "user"


def test_admin_safe_views_updates_and_no_role_editor(client, account):
    with Session(client.engine) as db:
        user = db.get(User, UUID(account["id"]))
        user.role = "admin"
        assign_permissions(user, list(PERMISSIONS))
        db.commit()
    other = client.post(
        "/api/auth/register",
        json={
            "email": "other@example.com",
            "display_name": "Other Candidate",
            "password": "Other-test-password42",
        },
    ).json()
    client.post(
        "/api/auth/login",
        json={"email": "candidate@example.com", "password": "Test-account-password42"},
    )
    assert client.get("/api/admin").json()["total_users"] == 2
    assert len(client.get("/api/admin/users?search=Other").json()) == 1
    user = client.get(f"/api/admin/users/{other['id']}").json()
    assert set(user["user"]) == {
        "id",
        "email",
        "display_name",
        "role",
        "is_active",
        "created_at",
        "permissions",
        "password_change_required",
        "last_login_at",
    }
    assert not any(
        term in str(user) for term in ["hashed_password", "storage_key", "token_version"]
    )
    path = f"/api/admin/users/{other['id']}"
    assert client.put(path, json={"role": "admin"}).status_code == 422
    assert (
        client.put(path, json={"display_name": "Updated Candidate", "is_active": False}).json()[
            "is_active"
        ]
        is False
    )
    assert (
        client.put(f"/api/admin/users/{account['id']}", json={"is_active": False}).status_code
        == 409
    )
    with Session(client.engine) as db:
        target = db.get(User, UUID(other["id"]))
        assert target.role == "user" and target.token_version == 1
    assert client.get("/api/admin/users?search=%").json() == []
    assert client.put(path, json={"is_active": True}).status_code == 200
