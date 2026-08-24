from __future__ import annotations

from fastapi.testclient import TestClient
import pytest

from app import main
from app import storage


@pytest.fixture()
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "DB_PATH", tmp_path / "idap-test.db")
    storage.init_db()
    main.RAG.doc_id_to_chunks.clear()
    monkeypatch.setattr(main, "generate_chat_response", lambda messages, max_new_tokens=512: "The deadline is 17 September 2026.")
    with TestClient(main.app) as test_client:
        yield test_client


def register(client: TestClient, email: str = "student@example.com") -> tuple[str, dict]:
    response = client.post(
        "/auth/register",
        json={"full_name": "Student User", "email": email, "password": "TestPass123"},
    )
    assert response.status_code == 201
    data = response.json()
    return data["access_token"], data["user"]


def test_registration_is_persistent_and_duplicate_is_explained(client: TestClient):
    token, user = register(client)
    assert user["email"] == "student@example.com"

    duplicate = client.post(
        "/auth/register",
        json={"full_name": "Student User", "email": "student@example.com", "password": "TestPass123"},
    )
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "An account with this email already exists"

    login = client.post("/auth/login", json={"email": "student@example.com", "password": "TestPass123"})
    assert login.status_code == 200
    assert login.json()["user"]["id"] == user["id"]
    assert client.get("/documents", headers={"Authorization": f"Bearer {token}"}).json()["documents"] == []


def test_upload_and_chat_return_citations_after_index_rebuild(client: TestClient):
    token, _ = register(client, "reader@example.com")
    headers = {"Authorization": f"Bearer {token}"}
    upload = client.post(
        "/upload",
        headers=headers,
        files={"file": ("project.txt", b"The Aurora project deadline is 17 September 2026.", "text/plain")},
    )
    assert upload.status_code == 200
    document_id = upload.json()["document_id"]
    assert upload.json()["pages"] == 1

    main.RAG.doc_id_to_chunks.clear()
    response = client.post(
        "/chat",
        headers=headers,
        json={"message": "What is the project deadline?", "document_id": document_id, "history": []},
    )
    assert response.status_code == 200
    data = response.json()
    assert data["citations"][0]["page"] == 1
    assert "17 September 2026" in data["citations"][0]["quote"]
    assert data["metrics"]["latency_ms"] >= 0
    assert data["metrics"]["retrieval_relevance"] is not None
    assert data["metrics"]["faithfulness"] is not None

    session = {
        "id": "session-1",
        "title": "Aurora research",
        "mode": "Q&A Chat",
        "documentRef": {"id": document_id, "name": "project.txt", "type": "text/plain", "size": 52, "uploadDate": "2026-08-25T00:00:00Z"},
        "messages": [{"id": "message-1", "role": "user", "content": "What is the deadline?", "timestamp": "2026-08-25T00:00:00Z"}],
        "createdAt": "2026-08-25T00:00:00Z",
        "updatedAt": "2026-08-25T00:00:00Z",
    }
    saved_session = client.post("/sessions", headers=headers, json=session)
    assert saved_session.status_code == 200
    loaded_sessions = client.get("/sessions", headers=headers)
    assert loaded_sessions.status_code == 200
    assert loaded_sessions.json()["sessions"][0]["id"] == "session-1"

    summary = client.get("/evaluation/summary", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["total_evaluations"] == 1
    assert summary.json()["citations"] == 1


def test_chat_requires_a_selected_document(client: TestClient):
    token, _ = register(client, "nodoc@example.com")
    response = client.post(
        "/chat",
        headers={"Authorization": f"Bearer {token}"},
        json={"message": "Hello", "history": []},
    )
    assert response.status_code == 400
    assert "Upload and select a document" in response.json()["detail"]
