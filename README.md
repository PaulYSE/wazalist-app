# Wazalist — Wotagei Skills Database

A web application for tracking and managing wotagei (Japanese idol fan-dance) techniques. Browse waza (techniques), mark your progress, and sync your learning across devices.

## Features

### Browse & Search
- Fuzzy, typo-tolerant full-text search across Japanese, English, romaji, and translation fields
- Exact-phrase search with quotes (e.g. `"technique name"`)
- **Scoped search**: `AUTHOR:"name"` and `PARENT:"name"` restrict matching to that field with exact whole-field matching (so `AUTHOR:SHUN` matches only SHUN, not SHUNMINA)
- Three view modes: Card, List, Compact

### Filtering & Sorting
- Filter by the 6 markings (● ▲ ■ ♥ ★ ◆), in any combination
- "Any" quick-filter to show only waza you've marked
- Sort by name or by community like count (ascending/descending)
- Mobile filter bottom-sheet mirrors the desktop controls

### Progress Tracking
- 6 markings per waza, meaning defined by you
- Custom labels for what each marking means
- Like/Dislike (stored as integers: `null`/`1`/`-1`)
- Syncs across devices when signed in; guest mode persists to `localStorage`

### Tabs
- **Browse** — search, filter, sort, and the waza detail panel
- **Stats** — your progress counts, a combined toggleable Top Authors / Top Family ranking (you vs. community), family completion, and recent activity
- **Compare** — import other users' lists and compare side-by-side
- **Contribute** — suggest edits or submit new waza (signed-in users)
- **Account** — collapsible sections for Import, Export, and Manage Account (account info, change username, change password, reset progress, delete account)

### Authentication & Account Management
- Register (email optional), or continue as guest
- PBKDF2 password hashing (100,000 iterations) with per-user salt
- Session tokens (30-day expiry), sent via the `Authorization` header
- Change username (case-sensitive, 3–32 characters, requires current password)
- Change password (requires current password; invalidates all sessions, forcing re-login)
- Self-service account deletion (requires password; the last admin can't delete themselves)
- Expired sessions are detected globally and return the user to the sign-in screen

### Video References
- Up to 10 video links per waza
- YouTube, Bilibili, NicoNico, Twitter/X, Facebook detection
- In-app embedded player (YouTube, Bilibili, NicoNico) with lazy iframe loading
- oEmbed title/author metadata, fetched progressively and cached per session

### Contributions
- Suggest edits to existing waza or submit new ones
- Admin review queue with diff view, inline editing, approve/reject, and notes
- Per-user contribution history

### List Sharing
- Export your marked list to a SHA-256-keyed shareable link (Cloudflare KV, 90-day expiry)
- Import others' lists for comparison
- Export to a styled Excel (.xlsx) with cell colours per marking
- Import from Excel (cell colours → markings) or pasted text

### UX
- Multi-slide interactive onboarding for new users
- Rotating search placeholder cycling through real waza names
- Collapsible detail sections; animated single-open accordions in Account
- `content-visibility`-based list virtualization for smooth scrolling of long lists
- Mobile-responsive; dark theme

## Tech Stack

**Backend** — Cloudflare Workers (TypeScript), Cloudflare D1 (SQLite), Cloudflare KV (list sharing). PBKDF2 auth with session tokens.

**Frontend** — Vanilla JS as **ES modules**, bundled by **Vite**. No framework. Custom dark-theme CSS (Grid/Flexbox). Client-side fuzzy search and filtering; oEmbed for video metadata; `localStorage` for guest mode.

**Tooling** — ESLint 9 (flat config) + `eslint-plugin-import-x`, Prettier. Lint: `npm run lint`; format: `npm run format`.

## Project Structure

```
wazalist-app/
├── src/                        # Backend — Cloudflare Worker (TypeScript)
│   ├── index.ts                # Router: all /api/... endpoints + fallbacks
│   ├── auth.ts                 # PBKDF2 hashing, token generation, session lookup
│   ├── renderHtml.ts           # Serves public/index.html via ASSETS
│   └── renderAdmin.ts          # Serves public/admin.html via ASSETS
├── public/                     # Frontend (built by Vite)
│   ├── index.html              # Main app markup
│   ├── admin.html              # Admin panel (standalone; loads js/admin.js)
│   ├── css/                    # base, waza, panels, modals, mobile, onboarding, admin
│   └── js/                     # ES-module frontend (see below)
│       ├── main.js             # Boot orchestrator — imports + calls each initX()
│       ├── app/                # init.js (initApp), shell.js (nav/filters/menu)
│       ├── services/           # api.js, auth.js, progress.js
│       ├── views/              # browse-list, waza-detail, stats, compare,
│       │                       #   contribute, account
│       ├── features/           # export-to-excel, onboarding, share-list,
│       │                       #   import/ (import-ui, import-excel)
│       ├── modals/             # suggest-edit, new-waza
│       ├── lib/                # search.js, parser.js, escape.js
│       ├── components/         # render-helpers.js, Toast.js
│       ├── config/             # constants.js
│       ├── state/              # state.js, localStorage.js
│       └── admin/admin.js      # Admin panel logic (standalone island)
├── migrations/                 # D1 SQL schema
├── wrangler.json               # Cloudflare Workers + D1 + KV config
├── vite.config.*               # Vite build config
├── eslint.config.mjs           # ESLint 9 flat config
├── package.json
└── README.md
```

> **Module architecture.** The frontend is ES modules with one-directional
> dependencies (config/state → services → views/features). Every module is
> side-effect-free on import; `main.js` is the only entry point and calls each
> module's `initX()` in order. `admin/admin.js` is a deliberate standalone
> island (its own `api`/`escapeHtml`/`timeAgo`) loaded directly by `admin.html`,
> outside the `main.js` graph.

## Database Schema

```sql
CREATE TABLE waza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_jp TEXT,
    name_en TEXT,
    name_en_literal TEXT,        -- romaji
    name_en_gtranslate TEXT,     -- Google Translate (EN)
    name_cn_gtranslate TEXT,     -- Google Translate (CN)
    reference TEXT,              -- lore / notes
    tag TEXT,                    -- classification category
    parent_jp0 TEXT, parent_en0 TEXT,   -- primary parent waza
    parent_jp1 TEXT, parent_en1 TEXT,   -- secondary parent waza
    author_jp0 TEXT, author_en0 TEXT,   -- primary author
    author_jp1 TEXT, author_en1 TEXT,   -- secondary author
    video0 TEXT, video1 TEXT, video2 TEXT, video3 TEXT, video4 TEXT,
    video5 TEXT, video6 TEXT, video7 TEXT, video8 TEXT, video9 TEXT
);

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,          -- "salt:hash"
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_admin INTEGER DEFAULT 0,
    shape_labels TEXT DEFAULT '["","","","","",""]'
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,                  -- 64-char random hex
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,             -- 30 days from creation
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE progress (
    user_id INTEGER NOT NULL,
    waza_id INTEGER NOT NULL,
    markings TEXT NOT NULL DEFAULT '[]',  -- JSON array of 6 booleans
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    like INTEGER,                         -- null / 1 / -1
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,                   -- "edit" | "new_waza"
    waza_id INTEGER REFERENCES waza(id),  -- null for new_waza
    payload TEXT NOT NULL,                -- JSON of field changes
    status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    admin_note TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    reviewed_at DATETIME
);

CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_user ON contributions(user_id);
```

> **Foreign-key note.** D1 has FK enforcement off by default, and `progress`/
> `contributions` have no `ON DELETE` cascade to `waza`. Account deletion and
> any bulk waza reload delete child rows explicitly (or run with
> `PRAGMA foreign_keys=OFF` in a single batch) rather than relying on cascade.

## API Endpoints

**Public**
- `GET /` — main app
- `GET /api/waza` — all waza with aggregated like/dislike counts
- `POST /api/login` — authenticate (returns token + user)
- `POST /api/register` — create account

**Authenticated** (session token via `Authorization: Bearer`)
- `GET /api/me` — current user (rehydrates session/admin status on refresh)
- `GET /api/progress` · `POST /api/progress` · `DELETE /api/progress`
- `GET /api/labels` · `POST /api/labels`
- `GET /api/contributions/mine` · `POST /api/contributions`
- `POST /api/account/username` — change username (requires current password)
- `POST /api/account/password` — change password (requires current; clears all sessions)
- `DELETE /api/account` — delete account (requires password)

**List sharing (KV)**
- `POST /api/list` — store a list (SHA-256 key)
- `GET /api/list?key=<hash>` — retrieve

**Admin**
- `GET /admin` — admin panel
- `GET /api/admin/contributions?status=` — queue by status
- `GET /api/admin/waza/:id` — waza detail for diffing
- `POST /api/admin/contributions/:id/approve` · `.../reject`

## Data Models

```javascript
// Progress (per waza, in state.prog keyed by waza_id)
{ markings: [bool×6], like: null | 1 | -1, updated_at: "ISO string" }

// Marking labels (per user)
["Want to Learn", "Learning", "Complete", "Favourite", "Oriwaza", "Forgotten"]

// Shared list payload (KV)
{ name: "...", labels: [...], marks: { "123": { markings: [...], like: 1 } } }
```

## Storage Notes

- **like**: INTEGER (`null`/`1`/`-1`) — compact, and enables aggregate counts in SQL
- **markings**: TEXT, JSON array of 6 booleans
- **shape_labels**: TEXT, JSON array of 6 strings (default all-empty)
- like/dislike counts are computed in the `/api/waza` query, not stored

## Constants

```javascript
const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];
const LIKE_NONE = null, LIKE_UP = 1, LIKE_DOWN = -1;
```

## Development

```bash
npm install
npm run dev      # Vite dev + Wrangler (local)
npm run lint     # ESLint
npm run format   # Prettier
npm run build    # Vite build
```

## Deployment

**Prerequisites:** Cloudflare account with Workers, D1, and KV; Wrangler CLI.

1. Apply migrations: `npx wrangler d1 migrations apply DB --remote`
2. Set your D1 `database_id` and KV namespace `id` in `wrangler.json`
3. `npx wrangler deploy`

`wrangler.json` bindings:
```json
{
  "d1_databases": [
    { "binding": "DB", "database_name": "wazalist-db", "database_id": "..." }
  ],
  "kv_namespaces": [
    { "binding": "LIST_STORE", "id": "..." }
  ]
}
```

Static assets in `public/` are served by the Workers ASSETS binding; the Worker
falls back to assets before serving `index.html`, so real files (JS, CSS, icons,
`admin.js`) are served correctly and only genuine misses get the SPA shell.

## Security

- PBKDF2 (100k iterations) + per-user salt; hashes stored as `salt:hash`
- 64-char random session tokens, 30-day expiry; password change clears all sessions
- All user-supplied content (waza fields, names, labels, notes) is HTML-escaped on render
- Contributions require admin approval; full audit trail (`created_at`/`reviewed_at`/`admin_note`)
- Guest data stays local; shared lists use SHA-256 keys with 90-day expiry

## Browser Support

Latest two versions of Chrome, Firefox, Safari, Edge; iOS Safari and Android
Chrome. Requires ES modules, Fetch, `localStorage`, CSS Grid/Flexbox, and
`content-visibility`.

## License

[Add your license here]

---

**Wazalist** — track your wotagei journey, one waza at a time.
