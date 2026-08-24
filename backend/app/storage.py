"""SQLite persistence for the IDAP prototype.

The database path is derived from the application directory by default so local
runs and the container use a predictable location. Set DATABASE_PATH to point to
managed storage in production.
"""
from __future__ import annotations

import json
import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterator

DEFAULT_DB_PATH = Path(__file__).resolve().parents[1] / "data" / "idap.db"
DB_PATH = Path(os.getenv("DATABASE_PATH", str(DEFAULT_DB_PATH)))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    DB_PATH.parent.mkdir(parents=True, exist_ok=True)
    connection = sqlite3.connect(DB_PATH, timeout=30)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    try:
        yield connection
        connection.commit()
    finally:
        connection.close()


def init_db() -> None:
    with get_connection() as connection:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE,
                full_name TEXT NOT NULL,
                hashed_password TEXT NOT NULL,
                created_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS documents (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                file_type TEXT NOT NULL,
                size INTEGER NOT NULL DEFAULT 0,
                characters INTEGER NOT NULL DEFAULT 0,
                content TEXT NOT NULL,
                pages_json TEXT NOT NULL DEFAULT '[]',
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_documents_user_id ON documents(user_id);

            CREATE TABLE IF NOT EXISTS chat_sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                mode TEXT NOT NULL,
                document_id TEXT,
                document_name TEXT,
                document_type TEXT,
                document_size INTEGER NOT NULL DEFAULT 0,
                document_upload_date TEXT,
                messages_json TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );

            CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_updated
                ON chat_sessions(user_id, updated_at DESC);

            CREATE TABLE IF NOT EXISTS evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                document_id TEXT,
                retrieval_relevance REAL,
                faithfulness REAL,
                latency_ms REAL NOT NULL,
                citations_count INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            );
            """
        )


def create_user(user_id: str, email: str, full_name: str, hashed_password: str) -> dict[str, Any]:
    created_at = _utc_now()
    with get_connection() as connection:
        connection.execute(
            "INSERT INTO users (id, email, full_name, hashed_password, created_at) VALUES (?, ?, ?, ?, ?)",
            (user_id, email.lower(), full_name, hashed_password, created_at),
        )
    return {"id": user_id, "email": email.lower(), "full_name": full_name, "created_at": created_at}


def get_user_by_email(email: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE email = ?", (email.lower(),)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> dict[str, Any] | None:
    with get_connection() as connection:
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return dict(row) if row else None


def save_document(
    document_id: str,
    user_id: str,
    name: str,
    file_type: str,
    size: int,
    characters: int,
    content: str,
    pages: list[dict[str, Any]],
) -> None:
    with get_connection() as connection:
        connection.execute(
            """INSERT INTO documents
            (id, user_id, name, file_type, size, characters, content, pages_json, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (document_id, user_id, name, file_type, size, characters, content, json.dumps(pages), _utc_now()),
        )


def get_document(document_id: str, user_id: str | None = None) -> dict[str, Any] | None:
    query = "SELECT * FROM documents WHERE id = ?"
    params: list[Any] = [document_id]
    if user_id is not None:
        query += " AND user_id = ?"
        params.append(user_id)
    with get_connection() as connection:
        row = connection.execute(query, params).fetchone()
    if not row:
        return None
    result = dict(row)
    result["pages"] = json.loads(result.pop("pages_json") or "[]")
    return result


def list_documents(user_id: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT id, name, file_type, size, characters, created_at FROM documents WHERE user_id = ? ORDER BY created_at DESC",
            (user_id,),
        ).fetchall()
    return [dict(row) for row in rows]


def list_all_documents() -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute("SELECT * FROM documents ORDER BY created_at DESC").fetchall()
    documents: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["pages"] = json.loads(item.pop("pages_json") or "[]")
        documents.append(item)
    return documents


def save_chat_session(session: dict[str, Any], user_id: str) -> None:
    document = session.get("documentRef") or {}
    with get_connection() as connection:
        connection.execute(
            """INSERT INTO chat_sessions
            (id, user_id, title, mode, document_id, document_name, document_type,
             document_size, document_upload_date, messages_json, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              title=excluded.title, mode=excluded.mode, document_id=excluded.document_id,
              document_name=excluded.document_name, document_type=excluded.document_type,
              document_size=excluded.document_size, document_upload_date=excluded.document_upload_date,
              messages_json=excluded.messages_json, updated_at=excluded.updated_at""",
            (
                session["id"], user_id, session["title"], session["mode"], document.get("id"),
                document.get("name"), document.get("type"), document.get("size", 0),
                document.get("uploadDate"), json.dumps(session.get("messages", [])),
                session.get("createdAt", _utc_now()), session.get("updatedAt", _utc_now()),
            ),
        )


def list_chat_sessions(user_id: str) -> list[dict[str, Any]]:
    with get_connection() as connection:
        rows = connection.execute(
            "SELECT * FROM chat_sessions WHERE user_id = ? ORDER BY updated_at DESC",
            (user_id,),
        ).fetchall()
    sessions: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        item["messages"] = json.loads(item.pop("messages_json") or "[]")
        item["documentRef"] = {
            "id": item.pop("document_id") or "unknown",
            "name": item.pop("document_name") or item["title"],
            "type": item.pop("document_type") or "application/pdf",
            "size": item.pop("document_size") or 0,
            "uploadDate": item.pop("document_upload_date") or item["created_at"],
        }
        item["userId"] = item.pop("user_id")
        item["createdAt"] = item.pop("created_at")
        item["updatedAt"] = item.pop("updated_at")
        sessions.append(item)
    return sessions


def delete_chat_session(session_id: str, user_id: str) -> None:
    with get_connection() as connection:
        connection.execute("DELETE FROM chat_sessions WHERE id = ? AND user_id = ?", (session_id, user_id))


def record_evaluation(
    user_id: str,
    document_id: str | None,
    retrieval_relevance: float | None,
    faithfulness: float | None,
    latency_ms: float,
    citations_count: int,
) -> None:
    with get_connection() as connection:
        connection.execute(
            """INSERT INTO evaluations
            (user_id, document_id, retrieval_relevance, faithfulness, latency_ms, citations_count, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (user_id, document_id, retrieval_relevance, faithfulness, latency_ms, citations_count, _utc_now()),
        )


def get_evaluation_summary(user_id: str) -> dict[str, Any]:
    with get_connection() as connection:
        row = connection.execute(
            """SELECT COUNT(*) AS total, AVG(retrieval_relevance) AS retrieval_relevance,
                      AVG(faithfulness) AS faithfulness, AVG(latency_ms) AS latency_ms,
                      SUM(citations_count) AS citations_count
               FROM evaluations WHERE user_id = ?""",
            (user_id,),
        ).fetchone()
    result = dict(row)
    return {
        "total_evaluations": result["total"] or 0,
        "average_retrieval_relevance": round(result["retrieval_relevance"], 3) if result["retrieval_relevance"] is not None else None,
        "average_faithfulness": round(result["faithfulness"], 3) if result["faithfulness"] is not None else None,
        "average_latency_ms": round(result["latency_ms"], 1) if result["latency_ms"] is not None else None,
        "citations": result["citations_count"] or 0,
    }
