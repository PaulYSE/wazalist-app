-- Migration 0002 — FK hardening, application history, missing indexes
--
-- Three changes bundled together:
--   1. progress.waza_id gets a real FK with ON DELETE CASCADE (rebuilt
--      carefully — this table holds real user data that must survive).
--   2. groups / group_members / group_applications are fully dropped and
--      recreated with their final shape. Confirmed safe: the Groups
--      feature has only ever been used by the developer and one test
--      account while gated behind admin-only access — there is no
--      production data in any of these three tables to preserve.
--   3. Five indexes added to match query patterns already in src/index.ts
--      that had no supporting index.
--
-- Requires PRAGMA foreign_keys = ON to actually be enforced at runtime
-- (see src/index.ts — enabled per-request at the top of the fetch handler).
-- This migration itself defers FK checks during the rebuild, per SQLite's
-- standard "create new table, copy, drop old, rename" procedure — there
-- is no ALTER TABLE ... ADD CONSTRAINT in SQLite.

PRAGMA defer_foreign_keys = TRUE;

-- ── 1. progress: rebuild with a real waza_id foreign key ───────

CREATE TABLE progress_new (
    user_id    INTEGER NOT NULL,
    waza_id    INTEGER NOT NULL,
    markings   TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    "like"     INTEGER CHECK ("like" IN (-1, 1) OR "like" IS NULL),
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (waza_id) REFERENCES waza(id) ON DELETE CASCADE
);

INSERT INTO progress_new (user_id, waza_id, markings, updated_at, "like")
SELECT user_id, waza_id, markings, updated_at, "like" FROM progress;

DROP TABLE progress;
ALTER TABLE progress_new RENAME TO progress;

-- ── 2. groups / group_members / group_applications: drop + recreate ──

DROP TABLE IF EXISTS group_applications;
DROP TABLE IF EXISTS group_members;
DROP TABLE IF EXISTS groups;

CREATE TABLE groups (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  join_policy TEXT    NOT NULL DEFAULT 'open'
                CHECK(join_policy IN ('open','approval','invite')),
  invite_key  TEXT    UNIQUE,
  social      TEXT,
  -- Nullable + ON DELETE SET NULL: created_by is record-keeping only
  -- (who originally created the group), not an active relationship.
  -- A user must be able to delete their account without that record
  -- blocking the deletion or leaving a dangling reference behind.
  created_by  INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE group_members (
  group_id  INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  role      TEXT    NOT NULL DEFAULT 'member'
              CHECK(role IN ('admin','member')),
  tag       TEXT,
  joined_at TEXT    NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (group_id, user_id)
);

-- No table-wide UNIQUE(group_id, user_id) here — that's what forced the
-- app to delete old rejected rows before letting someone reapply,
-- destroying history. The partial unique index below replaces it: it
-- only blocks a SECOND simultaneously-pending row for the same pair,
-- while letting historical approved/rejected rows accumulate freely.
CREATE TABLE group_applications (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id   INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    INTEGER NOT NULL REFERENCES users(id)  ON DELETE CASCADE,
  status     TEXT    NOT NULL DEFAULT 'pending'
               CHECK(status IN ('pending','approved','rejected')),
  applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX idx_group_applications_one_pending
  ON group_applications(group_id, user_id)
  WHERE status = 'pending';

-- ── 3. Indexes — match existing query patterns in src/index.ts ────

-- Hot path: fired on every progress save (like/dislike count recompute)
-- and on every GET /api/waza (LEFT JOIN progress ... GROUP BY w.id).
CREATE INDEX idx_progress_waza ON progress(waza_id);

-- Hit by account deletion and password-change session invalidation.
CREATE INDEX idx_sessions_user ON sessions(user_id);

-- Not yet used by any route — added ahead of the planned session-expiry
-- cleanup cron, so that future DELETE ... WHERE expires_at < ? has a
-- supporting index from day one instead of a full table scan.
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- Hit by GET /api/contributions/mine and the admin queue respectively.
-- (These existed in the hand-maintained 0001 file already, but were
-- never actually deployed via a migration — confirmed absent from the
-- live remote schema export.)
CREATE INDEX idx_contributions_user   ON contributions(user_id);
CREATE INDEX idx_contributions_status ON contributions(status);

CREATE INDEX idx_group_members_user   ON group_members(user_id);
CREATE INDEX idx_group_members_group  ON group_members(group_id);
CREATE INDEX idx_group_applications_user  ON group_applications(user_id);
CREATE INDEX idx_group_applications_group ON group_applications(group_id);
CREATE INDEX idx_groups_invite_key ON groups(invite_key);

-- Supports the planned rate-limiting feature: "max N groups created per
-- user per 24h" is a windowed COUNT(*) against exactly these two columns.
CREATE INDEX idx_groups_created_by_at ON groups(created_by, created_at);