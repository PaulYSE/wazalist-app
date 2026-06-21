-- Migration 0001 — initial schema
--
-- This is the full schema the app actually uses. Every statement uses
-- "IF NOT EXISTS" so it is safe to run against a fresh database without
-- touching tables that already exist. See migrations/README.md before
-- applying this to an EXISTING production database.

-- Techniques ("waza").
CREATE TABLE IF NOT EXISTS waza (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name_jp           TEXT,
    name_en           TEXT,
    name_en_literal   TEXT,
    name_en_gtranslate TEXT,
    name_cn_gtranslate TEXT,
    reference         TEXT,
    tag               TEXT,
    parent_jp0        TEXT,
    parent_en0        TEXT,
    parent_jp1        TEXT,
    parent_en1        TEXT,
    author_jp0        TEXT,
    author_en0        TEXT,
    author_jp1        TEXT,
    author_en1        TEXT,
    video0            TEXT,
    video1            TEXT,
    video2            TEXT,
    video3            TEXT,
    video4            TEXT,
    video5            TEXT,
    video6            TEXT,
    video7            TEXT,
    video8            TEXT,
    video9            TEXT,
    UNIQUE(name_jp, name_en)
);

-- User accounts.
CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    username      TEXT UNIQUE NOT NULL,
    email         TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
    is_admin      INTEGER DEFAULT 0,
    shape_labels  TEXT DEFAULT '["","","","","",""]'
);

-- Login sessions (30-day tokens).
CREATE TABLE IF NOT EXISTS sessions (
    id         TEXT PRIMARY KEY,
    user_id    INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Per-user progress: markings (6 booleans as JSON) + like (-1 / null / 1).
CREATE TABLE IF NOT EXISTS progress (
    user_id    INTEGER NOT NULL,
    waza_id    INTEGER NOT NULL,
    markings   TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    "like"     INTEGER,
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- User-submitted edits / new waza, pending admin review.
CREATE TABLE IF NOT EXISTS contributions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL,            -- 'edit' | 'new_waza'
    waza_id     INTEGER REFERENCES waza(id),
    payload     TEXT NOT NULL,            -- JSON of field changes
    status      TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
    admin_note  TEXT,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    reviewed_at DATETIME
);

-- ── Groups ────────────────────────────────────────────────────

-- Groups
CREATE TABLE IF NOT EXISTS groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  join_policy TEXT    NOT NULL DEFAULT 'open'
                CHECK(join_policy IN ('open','approval','invite')),
  invite_key  TEXT    UNIQUE,
  social      TEXT,
  created_by  INTEGER NOT NULL REFERENCES users(id),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Group membership
CREATE TABLE IF NOT EXISTS group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role      TEXT    NOT NULL DEFAULT 'member'
              CHECK(role IN ('admin','member')),
  tag       TEXT,
  joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

-- Join applications (all three join policies route through here)
CREATE TABLE IF NOT EXISTS group_applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK(status IN ('pending','approved','rejected')),
  applied_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);
CREATE INDEX IF NOT EXISTS idx_contributions_user   ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user   ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group  ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_groups_invite_key ON groups(invite_key);
CREATE INDEX IF NOT EXISTS idx_group_applications_user  ON group_applications(user_id);
CREATE INDEX IF NOT EXISTS idx_group_applications_group ON group_applications(group_id);