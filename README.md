# Wazalist

**Wotagei Skills Database** — Track, learn, and share Wotagei techniques (Waza) with a modern, full-featured web application.

---

## Introduction

Wazalist is a comprehensive database and tracking tool for **Wotagei** (Japanese idol fan-dance) techniques, known as **Waza**. Whether you're a beginner learning your first moves or an advanced practitioner with hundreds of techniques, Wazalist helps you organize, track, and share your progress.

The application is built entirely on Cloudflare's serverless platform, offering:
- Zero infrastructure management — runs on Cloudflare Workers
- Global availability — data stored in Cloudflare D1 and KV
- Device sync — your progress follows you across devices
- Guest mode — start using immediately without an account

## Project Description

Wazalist serves as a living database of Wotagei Waza, allowing users to:

- Browse the complete Waza database with fuzzy search, filtering, and multiple view modes
- Track progress with 6 customizable markings (● ▲ ■ ♥ ★ ◆) + Like/Dislike
- Compare your progress with group members or imported lists
- Contribute to the database by suggesting edits or submitting new Waza
- Share your list via shareable keys (90-day expiry)
- Import/Export Excel files with color-coded progress tracking
- Join Groups to collaborate and compare with other practitioners

The application is designed for both guest users (local storage only) and authenticated users (cloud sync), making it accessible to anyone while offering full features to registered users.

## Features

### Core Features
- Smart Search: Fuzzy, typo-tolerant search with exact-phrase matching ("exact phrase")
- Scoped Search: AUTHOR:"name", PARENT:"name", NAME:"query", TAG:"tag"
- 3 View Modes: List, Cards, Compact — switch anytime
- 6 Custom Markings: Name each marking to match your learning style
- Like/Dislike: Community-driven popularity scoring
- Stats Dashboard: Progress overview, top authors/families, recent activity

### Social & Collaboration
- Groups: Create/join groups with open, approval, or invite-only policies
- Compare: Side-by-side comparison with group members and imported lists
- Share Lists: Export your progress as a shareable key (90-day KV storage)
- Import Lists: Import others' lists via share key

### Data Management
- Export to Excel: Download your list with color-coded markings
- Import from Excel: Upload Excel files with colored cells → automatically map to markings
- Text Import: Paste plain text lists with support for [Labels] and {Categories}
- Contribution System: Suggest edits or new Waza with admin review workflow

### User Experience
- 20+ Themes: Light, dark, and system-follow with 18+ curated themes
- Mobile-First: Fully responsive with mobile menu and filter sheet
- Interactive Onboarding: 10-slide guided tour for new users
- Accessibility: Keyboard navigation, screen reader support

### Technical
- Secure Authentication: PBKDF2 password hashing (100k iterations) with per-user salt
- Dual Storage: Guests = localStorage; Users = Cloudflare D1
- Global CDN: Served via Cloudflare's edge network
- Zero Framework: Vanilla JS with ES modules — no build-step overhead

## Requirements & Dependencies

### Development Requirements
- Node.js >= 22.0.0
- npm >= 10.0.0
- Cloudflare Account (for deployment)
- Wrangler CLI (installed via npm)

### Core Dependencies
{
  "devDependencies": {
    "@eslint/js": "^10.0.1",
    "concurrently": "^10.0.3",
    "eslint": "^10.4.1",
    "prettier": "^3.8.3",
    "typescript": "5.9.3",
    "vite": "^8.0.16",
    "wrangler": "^4.97.0"
  }
}

Note: Frontend uses vanilla JavaScript with ES modules. No frontend frameworks are used — everything is custom-built.

### Runtime Dependencies (CDN)
- SheetJS (XLSX) — Excel import
- ExcelJS — Styled Excel export

## Tech Stack

### Backend
| Technology | Purpose |
|------------|---------|
| Cloudflare Workers | Serverless compute platform |
| Cloudflare D1 | SQLite database (serverless) |
| Cloudflare KV | Shareable list storage (90-day TTL) |
| TypeScript | Backend type safety |
| Wrangler | Development & deployment tool |

### Frontend
| Technology | Purpose |
|------------|---------|
| Vanilla JS (ES Modules) | Application logic |
| Vite | Development server & build tool |
| CSS Variables | Theming (20+ themes) |
| CSS Grid/Flexbox | Responsive layout |
| SheetJS + ExcelJS | Excel import/export |
| Web Crypto API | Password hashing (PBKDF2) |
| Service Worker API | Fetch interception (Cloudflare) |

### Storage
| Service | Usage |
|---------|-------|
| D1 (SQLite) | Users, sessions, waza, progress, contributions, groups |
| KV (Key-Value) | Shareable list keys (90-day expiry) |
| localStorage | Guest progress, themes, preferences |

## Project Structure

wazalist-app/
├── src/                           # Backend — Cloudflare Worker (TypeScript)
│   ├── index.ts                   # Router: all /api/... endpoints + fallbacks
│   ├── auth.ts                    # PBKDF2 hashing, token generation, session lookup
│   ├── renderHtml.ts              # Serves public/index.html via ASSETS
│   └── renderAdmin.ts             # Serves public/admin.html via ASSETS
│
├── public/                        # Frontend — served as static assets
│   ├── index.html                 # Main app markup (SPA shell)
│   ├── admin.html                 # Admin panel (standalone)
│   ├── icons/                     # App icons (SVG, PNG)
│   ├── css/                       # All stylesheets
│   │   ├── base.css               # Reset, body, auth, layout, filter row
│   │   ├── waza.css               # Waza list, cards, marking pips, detail, videos
│   │   ├── panels.css             # Dashboard, stats, nav, contributions
│   │   ├── modals.css             # All modals (contribution, compare, import/share)
│   │   ├── mobile.css             # Mobile menu, filter sheet, responsive overrides
│   │   ├── onboarding.css         # Interactive onboarding overlay
│   │   ├── admin.css              # Admin panel styles
│   │   └── themes.css             # 20+ theme palettes (light/dark)
│   │
│   └── js/                        # Frontend JavaScript (ES modules)
│       ├── main.js                # Entry point — orchestrates all modules
│       │
│       ├── app/                   # Core application orchestration
│       │   ├── init.js            # initApp() — loads data, renders views
│       │   ├── shell.js           # UI shell: nav, search, filters, mobile menu
│       │   ├── router.js          # URL routing (history API integration)
│       │   └── accordion-shell.js # Reusable accordion builder
│       │
│       ├── config/                # Configuration & constants
│       │   ├── constants.js       # SHAPES, platforms, status maps, templates
│       │   ├── theme-registry.js  # Available themes (20+ entries)
│       │   └── groups-config.js   # Group policy labels
│       │
│       ├── state/                 # Application state containers
│       │   ├── state.js           # Global app state (wazaData, prog, selectedId)
│       │   ├── user-state.js      # User identity, auth, groups
│       │   ├── waza-browse-state.js # Search filters, view mode, sort
│       │   ├── compare-state.js   # Comparison entries, imported lists
│       │   ├── groups-state.js    # Groups list, selected group, search
│       │   ├── import-state.js    # Text/Excel import parsing state
│       │   └── localStorage.js    # localStorage helpers & keys
│       │
│       ├── services/              # External services & API
│       │   ├── api.js             # Authenticated API wrapper
│       │   ├── auth.js            # Login, register, guest, logout
│       │   ├── progress.js        # Progress saving with localStorage fallback
│       │   ├── theme.js           # Theme management (system/explicit)
│       │   └── compare-data.js    # Fetches & shapes comparison data
│       │
│       ├── views/                 # Render functions for each tab
│       │   ├── waza-browse-list.js # Browse list: 3 view modes + sorting
│       │   ├── waza-detail.js     # Detail panel: collapsible sections, video embedding
│       │   ├── stats.js           # Stats dashboard: progress, rankings, activity
│       │   ├── compare.js         # Compare tab orchestrator
│       │   ├── compare-controls.js # Compare: add panel, group/imported pickers
│       │   ├── groups-browse-list.js # Groups list + search
│       │   ├── groups-detail.js   # Group detail: members, join/leave, admin
│       │   ├── account.js         # Account: import/export, labels, themes, reset
│       │   └── contribute.js      # Contribution submission & history
│       │
│       ├── features/              # Standalone feature modules
│       │   ├── export-to-excel.js # Excel export with colored cells
│       │   ├── share-list.js      # Share/import via KV keys
│       │   ├── onboarding.js      # Interactive 10-slide tour
│       │   └── import/            # Import subsystem
│       │       ├── import-ui.js   # Import UI rendering & events
│       │       ├── import-excel.js # Excel file parsing
│       │       └── parser.js      # Text import engine (no DOM)
│       │
│       ├── modals/                # Modal controllers
│       │   ├── waza-edit.js       # Suggest edit & video suggest modals
│       │   ├── waza-new.js        # New Waza submission
│       │   ├── group-edit.js      # Edit group modal
│       │   └── group-new.js       # Create group modal
│       │
│       ├── components/            # Reusable UI components
│       │   ├── render-helpers.js  # Marking styles, pips, video buttons, oEmbed
│       │   ├── compare-table.js   # Comparison matrix builder
│       │   ├── show-toast.js      # Toast notification helper
│       │   └── render-groups-socials.js # Social link list builder
│       │
│       ├── lib/                   # Utilities
│       │   ├── search.js          # Fuzzy matching, scoped search, filterWaza()
│       │   ├── parser.js          # Text import: label extraction, waza matching
│       │   └── escape.js          # HTML escaping
│       │
│       └── admin/                 # Admin panel (standalone island)
│           └── admin.js           # Admin contribution review queue
│
├── migrations/                    # D1 SQL schema migrations
│   └── 0001_initial_schema.sql   # Initial database schema
│
├── wrangler.json                  # Cloudflare Workers + D1 + KV config
├── vite.config.js                 # Vite build configuration
├── tsconfig.json                  # TypeScript configuration
├── package.json                   # npm scripts & dependencies
├── package-lock.json              # Locked dependency versions
├── CONTRIBUTING.md                # Contribution guidelines
└── README.md                      # This file

## SQL Schema

### Tables

#### Users
Stores user accounts, authentication data, and custom marking labels.

```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    is_admin INTEGER DEFAULT 0,
    shape_labels TEXT DEFAULT '["","","","","",""]'
);

CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE waza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_jp TEXT,
    name_en TEXT,
    name_en_literal TEXT,
    name_en_gtranslate TEXT,
    name_cn_gtranslate TEXT,
    reference TEXT,
    tag TEXT,
    parent_jp0 TEXT,
    parent_en0 TEXT,
    parent_jp1 TEXT,
    parent_en1 TEXT,
    author_jp0 TEXT,
    author_en0 TEXT,
    author_jp1 TEXT,
    author_en1 TEXT,
    video0 TEXT,
    video1 TEXT,
    video2 TEXT,
    video3 TEXT,
    video4 TEXT,
    video5 TEXT,
    video6 TEXT,
    video7 TEXT,
    video8 TEXT,
    video9 TEXT,
    UNIQUE(name_jp, name_en)
);

CREATE TABLE progress (
    user_id INTEGER NOT NULL,
    waza_id INTEGER NOT NULL,
    markings TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    like INTEGER,
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE contributions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    type TEXT NOT NULL,
    waza_id INTEGER REFERENCES waza(id),
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    admin_note TEXT,
    created_at DATETIME NOT NULL DEFAULT (datetime('now')),
    reviewed_at DATETIME
);

CREATE TABLE groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    join_policy TEXT NOT NULL DEFAULT 'open'
        CHECK(join_policy IN ('open', 'approval', 'invite')),
    invite_key TEXT UNIQUE,
    social TEXT,
    created_by INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_groups_invite_key ON groups(invite_key);

CREATE TABLE group_members (
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'member'
        CHECK(role IN ('admin', 'member')),
    tag TEXT,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (group_id, user_id)
);

CREATE INDEX idx_group_members_user ON group_members(user_id);
CREATE INDEX idx_group_members_group ON group_members(group_id);

CREATE TABLE group_applications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    group_id INTEGER NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK(status IN ('pending', 'approved', 'rejected')),
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_applications_group ON group_applications(group_id);
CREATE INDEX idx_group_applications_user ON group_applications(user_id);
```

## License & Contributing

### License
This project is licensed under the **MIT License** — see the LICENSE file for details.

### Contributing
We welcome contributions! Please read our Contributing Guide (CONTRIBUTING.md) for:

- Code conventions (ES modules, plain JS, no frontend frameworks)
- Project structure (where to find what)
- Development workflow (npm run dev, npm run deploy)
- Pull request process

#### Quick Start for Contributors

# Clone the repository
git clone https://github.com/yourusername/wazalist-app.git
cd wazalist-app

# Install dependencies
npm install

# Start development server
npm run dev

# Make changes to frontend (public/) — refresh browser
# Make changes to backend (src/) — Wrangler reloads automatically

# Run linting
npm run lint

# Format code
npm run format

# Deploy (maintainers only)
npm run deploy

## Deployment

### Prerequisites
- Cloudflare account with Workers, D1, and KV enabled
- Wrangler CLI installed (npm install -g wrangler)

### Steps

1. Configure wrangler.json with your database and KV namespace IDs:
   {
     "d1_databases": [
       { "binding": "DB", "database_name": "wazalist-db", "database_id": "..." }
     ],
     "kv_namespaces": [
       { "binding": "LIST_STORE", "id": "..." }
     ]
   }

2. Apply database migrations:
   npx wrangler d1 migrations apply DB --remote

3. Deploy the Worker:
   npm run deploy

4. Set environment variables (if needed):
   npx wrangler secret put SECRET_KEY

### Local Development
npm run dev          # Local D1 + Worker + Vite UI (hot reload)
npm run dev:remote   # Remote D1 (read/write to production database)


## Credits

**Author**: Paul Yong Shao En  
**Email**: paulyse99@gmail.com  
**Project**: Wazalist App  

Built with passion and AI Tools for the Wotagei community.

## Acknowledgments

- Wotagei Community — for inspiration and feedback
- Cloudflare — for providing the serverless platform
- Open Source Libraries — SheetJS, ExcelJS, and all dependencies

Wazalist — Track your Wotagei journey, one Waza at a time.