"""SQLite persistence for local/demo use. The schema mirrors
supabase/migrations/0001_init.sql (Postgres + RLS) for production."""

from __future__ import annotations

import sqlite3
from contextlib import contextmanager

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS learners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 40),
  age_band TEXT NOT NULL,
  reading_language TEXT NOT NULL,
  tutor_language TEXT NOT NULL,
  level INTEGER NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  daily_goal_minutes INTEGER NOT NULL DEFAULT 10,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS practice_sessions (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  passage_id TEXT NOT NULL,
  status TEXT NOT NULL,
  transcript TEXT,
  stt_source TEXT,
  duration_seconds REAL,
  result_json TEXT,
  feedback_json TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sessions_learner ON practice_sessions(learner_id, created_at);
CREATE TABLE IF NOT EXISTS word_assessments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL REFERENCES practice_sessions(id) ON DELETE CASCADE,
  word_index INTEGER NOT NULL,
  expected TEXT NOT NULL,
  recognized TEXT,
  status TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS learner_skill_mastery (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  skill_id TEXT NOT NULL,
  language TEXT NOT NULL,
  mastery REAL NOT NULL DEFAULT 0.3 CHECK (mastery BETWEEN 0 AND 1),
  attempts INTEGER NOT NULL DEFAULT 0,
  successes INTEGER NOT NULL DEFAULT 0,
  last_practiced_at TEXT,
  next_review_at TEXT,
  PRIMARY KEY (learner_id, skill_id)
);
CREATE TABLE IF NOT EXISTS practice_items (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  target_word TEXT NOT NULL,
  language TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  answer TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS practice_attempts (
  id TEXT PRIMARY KEY,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES practice_items(id) ON DELETE CASCADE,
  correct INTEGER NOT NULL,
  response TEXT,
  source TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS xp_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  reason TEXT NOT NULL,
  idempotency_key TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS learner_achievements (
  learner_id TEXT NOT NULL REFERENCES learners(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  earned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (learner_id, achievement_id)
);
"""


def init_db() -> None:
    with connect() as c:
        c.executescript(SCHEMA)


@contextmanager
def connect():
    conn = sqlite3.connect(settings.db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def award_xp(conn: sqlite3.Connection, learner_id: str, amount: int, reason: str, key: str) -> bool:
    """Idempotent: returns False if this key was already claimed."""
    cur = conn.execute(
        "INSERT OR IGNORE INTO xp_transactions (learner_id, amount, reason, idempotency_key) VALUES (?,?,?,?)",
        (learner_id, amount, reason, key),
    )
    return cur.rowcount == 1
