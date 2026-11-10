"""SQLite: foydalanuvchi sozlamalari, statistika va /soz tarixi.

Suhbat xotirasi esa RAMda (tez va maxfiy, bot qayta ishga tushsa tozalanadi).
"""

from __future__ import annotations

import sqlite3
import time
from collections import defaultdict, deque

from . import config

_conn: sqlite3.Connection | None = None


def init(path: str | None = None) -> None:
    global _conn
    _conn = sqlite3.connect(path or config.DB_PATH, check_same_thread=False)
    _conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS users (
            user_id     INTEGER PRIMARY KEY,
            mode        TEXT    NOT NULL DEFAULT 'chat',
            target_lang TEXT,
            created_at  INTEGER NOT NULL,
            last_seen   INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS words (
            user_id    INTEGER NOT NULL,
            word       TEXT    NOT NULL,
            created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_words_user ON words(user_id, created_at);
        """
    )
    _conn.commit()


def _db() -> sqlite3.Connection:
    if _conn is None:
        raise RuntimeError("storage.init() chaqirilmagan")
    return _conn


def touch(user_id: int) -> None:
    now = int(time.time())
    db = _db()
    db.execute(
        "INSERT INTO users(user_id, created_at, last_seen) VALUES(?, ?, ?) "
        "ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen",
        (user_id, now, now),
    )
    db.commit()


def get_mode(user_id: int) -> tuple[str, str | None]:
    row = _db().execute("SELECT mode, target_lang FROM users WHERE user_id = ?", (user_id,)).fetchone()
    return (row[0], row[1]) if row else ("chat", None)


def set_mode(user_id: int, mode: str, target_lang: str | None = None) -> None:
    touch(user_id)
    db = _db()
    if target_lang is None:
        db.execute("UPDATE users SET mode = ? WHERE user_id = ?", (mode, user_id))
    else:
        db.execute("UPDATE users SET mode = ?, target_lang = ? WHERE user_id = ?", (mode, target_lang, user_id))
    db.commit()


def recent_words(user_id: int, limit: int = 40) -> list[str]:
    rows = _db().execute(
        "SELECT word FROM words WHERE user_id = ? ORDER BY created_at DESC LIMIT ?", (user_id, limit)
    ).fetchall()
    return [r[0] for r in rows]


def add_word(user_id: int, word: str) -> None:
    db = _db()
    db.execute("INSERT INTO words(user_id, word, created_at) VALUES(?, ?, ?)", (user_id, word.lower(), int(time.time())))
    db.commit()


def stats() -> dict[str, int]:
    db = _db()
    now = int(time.time())
    total = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    day = db.execute("SELECT COUNT(*) FROM users WHERE last_seen >= ?", (now - 86400,)).fetchone()[0]
    month = db.execute("SELECT COUNT(*) FROM users WHERE last_seen >= ?", (now - 30 * 86400,)).fetchone()[0]
    return {"total": total, "day": day, "month": month}


# ---------- Suhbat xotirasi (RAM) ----------
_history: dict[int, deque] = defaultdict(lambda: deque(maxlen=config.HISTORY_LIMIT))


def history(user_id: int) -> list[dict]:
    return list(_history[user_id])


def remember(user_id: int, user_text: str, answer: str) -> None:
    h = _history[user_id]
    h.append({"role": "user", "content": user_text})
    h.append({"role": "assistant", "content": answer})


def forget(user_id: int) -> None:
    _history.pop(user_id, None)
