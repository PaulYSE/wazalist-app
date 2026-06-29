-- Migration 0003 — CHECK constraints on contributions.type / status
--
-- contributions.type and contributions.status are validated in
-- application code (src/index.ts) but had no database-level constraint,
-- unlike every other status/role/policy column in the schema
-- (groups.join_policy, group_members.role, group_applications.status).
-- This brings contributions up to the same standard.
--
-- Careful rebuild (create new → copy → drop old → rename), NOT a
-- drop-and-recreate: unlike the Groups tables in 0002, contributions
-- has been live to all users since launch and almost certainly holds
-- real submitted edits/new-waza proposals that must survive intact.

PRAGMA defer_foreign_keys = TRUE;

CREATE TABLE contributions_new (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id),
    type        TEXT NOT NULL
                  CHECK(type IN ('edit', 'new_waza')),
    waza_id     INTEGER REFERENCES waza(id),
    payload     TEXT NOT NULL,
    status      TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'approved', 'rejected')),
    admin_note  TEXT,
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    reviewed_at DATETIME
);

INSERT INTO contributions_new
  (id, user_id, type, waza_id, payload, status, admin_note, created_at, reviewed_at)
SELECT id, user_id, type, waza_id, payload, status, admin_note, created_at, reviewed_at
FROM contributions;

DROP TABLE contributions;
ALTER TABLE contributions_new RENAME TO contributions;

-- Indexes were on the OLD table — dropped automatically when it was
-- dropped above. Recreate them (IF NOT EXISTS — harmless if 0002 already
-- created them, required if this is being applied to a fresh database
-- that skipped straight from 0001 without 0002's copies of these).
CREATE INDEX IF NOT EXISTS idx_contributions_user   ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_contributions_status ON contributions(status);