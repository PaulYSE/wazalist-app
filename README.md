# Wazalist - Wotagei Skills Database

A comprehensive web application for tracking and managing wotagei (Japanese idol fan dance) techniques. Browse waza (skills), mark your progress, and sync your learning journey across devices.

## Features

### 📚 Browse & Search
- **Full-text search** with fuzzy matching (typo-tolerant)
- Search by Japanese or English names
- Exact phrase search using quotes (e.g., `"technique name"`)
- Multiple view modes: Card view, List view, Compact view

### 🎯 Filtering System
- **Skill level** filtering
- **Family/technique group** filtering
- **Markings** filter (6 customizable symbols: ● ▲ ■ ♥ ★ ◆)
- **Any ★** quick-filter - show only Waza you have marked or liked
- Sort by name or popularity (like count)

### 📊 Progress Tracking
- **Markings** - Assign any meaning to 6 different symbols per technique
- **Custom labels** - Define what each marking symbol means to you
- **Like/Dislike** system for personal preference (stored as integers for efficiency)
- Progress syncs across devices when logged in
- Guest mode with local browser storage

### 📱 Tabs & Views
- **Browse** - Main view with search, filters, and sorting
- **Stats** - Overview of marked Waza, recently updated, and coverage analytics
- **Compare** - Import and compare other users' lists side-by-side
- **Import** - Text-based import for bulk list management
- **Contribute** - Submit edits and new Waza (authenticated users only)

### 🔐 Authentication
- Create account with email (optional)
- Guest mode for quick access without registration
- Secure password hashing (PBKDF2 with salt)
- Session-based authentication (30-day sessions)
- Admin panel for reviewing contributions

### 🎥 Video References
- Multiple video links per technique (up to 6)
- Support for YouTube, Bilibili, Twitter/X, NicoNico, Facebook
- Automatic platform detection and icons
- In-app video player with oEmbed support
- Lazy-loading of video metadata

### ✏️ User Contributions
- Suggest edits to existing Waza
- Submit new Waza entries
- Admin review workflow with approve/reject
- Track your contribution history
- Edit payload preview with diff view

### 🌐 List Sharing
- Generate shareable links to your marked Waza
- Import lists from other users
- Compare your progress side-by-side
- SHA-256 hashed URLs for privacy
- 90-day expiration on shared lists (Cloudflare KV)

### 🎨 User Experience
- Interactive onboarding for new users
- Rotating username placeholders
- Collapsible sections in detail view
- Mobile-responsive design
- Dark theme with custom color scheme
- Smooth animations and transitions

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Storage**: Cloudflare KV (for list sharing)
- **Authentication**: PBKDF2 password hashing (100,000 iterations), session tokens
- **Language**: TypeScript

### Frontend
- **HTML/CSS**: Custom dark theme with CSS Grid/Flexbox
- **JavaScript**: Vanilla JS (no frameworks)
- **Features**: 
  - Fuzzy search with normalization (Japanese + Latin)
  - Client-side filtering and sorting
  - Responsive design (mobile + desktop)
  - oEmbed integration for video metadata
  - localStorage for guest mode

### Optimization
- **Like/Dislike storage**: Integer format (`null`/`1`/`-1`) for 83% space savings
- **Markings storage**: JSON array of booleans
- **Video metadata caching**: In-memory cache for oEmbed responses
- **Lazy loading**: Video metadata fetched on-demand

## Database Schema

```sql
-- Waza (techniques) table
CREATE TABLE waza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_jp TEXT,
    name_en TEXT,
    name_en_literal TEXT,
    name_en_gtranslate TEXT,
    reference TEXT,
    tag TEXT,
    parent_jp0 TEXT,
    parent_en0 TEXT,
    parent_jp1 TEXT,
    parent_en1 TEXT,
    author_jp TEXT,
    author_en TEXT,
    video0 TEXT,
    video1 TEXT,
    video2 TEXT,
    video3 TEXT,
    video4 TEXT,
    video5 TEXT
);

-- Users table
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

-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- User progress table
CREATE TABLE progress (
    user_id INTEGER NOT NULL,
    waza_id INTEGER NOT NULL,
    markings TEXT NOT NULL DEFAULT '[]',
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    like INTEGER,
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Contributions table
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

-- Indexes
CREATE INDEX idx_contributions_status ON contributions(status);
CREATE INDEX idx_contributions_user ON contributions(user_id);
```

### Schema Notes

**Waza Table:**
- `tag` - Skill level (e.g., "beginner", "intermediate", "advanced")
- `reference` - Lore/description of the technique
- `parent_jp0/parent_en0` - Primary prerequisite technique
- `parent_jp1/parent_en1` - Secondary prerequisite technique
- `video0-video5` - Up to 6 video reference URLs

**Users Table:**
- `email` - Optional, can be NULL
- `is_admin` - 0 (regular user) or 1 (admin)
- `shape_labels` - JSON array of 6 custom labels for marking symbols
- `created_at/updated_at` - TEXT format (SQLite datetime strings)

**Progress Table:**
- `markings` - JSON array: `"[true,false,false,false,false,false]"` (6 booleans)
- `like` - INTEGER: `null` (none), `1` (like), `-1` (dislike)
- No foreign key to `waza(id)` for flexibility (allows orphaned progress if waza deleted)

**Contributions Table:**
- `type` - Either `"edit"` (modify existing) or `"new_waza"` (create new)
- `waza_id` - NULL for new_waza type
- `payload` - JSON with field changes
- `status` - `"pending"`, `"approved"`, or `"rejected"`

**Sessions Table:**
- `id` - Random 64-character hex string
- `expires_at` - 30 days from creation
- `ON DELETE CASCADE` - Sessions deleted when user deleted

## API Endpoints

### Public Endpoints
- `GET /` - Serve main application
- `GET /api/waza` - Get all Waza with aggregated like counts
- `POST /api/login` - Authenticate user
- `POST /api/register` - Create new account

### Authenticated Endpoints
- `GET /api/progress` - Get user's progress data
- `POST /api/progress` - Save progress (markings and like/dislike)
- `GET /api/labels` - Get user's custom marking labels
- `POST /api/labels` - Update custom marking labels
- `GET /api/contributions/mine` - Get user's contribution history
- `POST /api/contributions` - Submit edit or new Waza

### List Sharing (KV)
- `POST /api/list` - Store shareable list (returns SHA-256 key)
- `GET /api/list?key=<hash>` - Retrieve shared list

### Admin Endpoints
- `GET /admin` - Admin panel UI
- `GET /api/admin/contributions` - Get contributions by status
- `GET /api/admin/waza/:id` - Get Waza details for editing
- `POST /api/admin/contributions/:id/approve` - Approve contribution
- `POST /api/admin/contributions/:id/reject` - Reject contribution

## Data Models

### Progress Object
```javascript
{
  markings: [boolean, boolean, boolean, boolean, boolean, boolean],
  like: null | 1 | -1  // null = none, 1 = like, -1 = dislike
}
```

### Marking Labels (per user)
```javascript
["Learning", "Mastered", "Practicing", "Favorite", "Hard", "Easy"]
```

### Shared List Format
```javascript
{
  name: "My Wotagei List",
  created: "2025-05-24T12:00:00Z",
  prog: {
    "123": { markings: [true, false, ...], like: 1 },
    "456": { markings: [false, true, ...], like: null }
  }
}
```

## Storage Optimization

### Like/Dislike Format
- **Type**: INTEGER (not TEXT)
- **Values**: `null` (0 bytes), `1` (1 byte), `-1` (1 byte)
- **Savings**: 83% reduction vs string format
- **Benefits**: Faster queries, math operations (sentiment scores)

### Markings Format
- **Type**: TEXT (JSON array)
- **Format**: `"[true,false,false,false,false,false]"`
- **Size**: ~33 bytes for 6 boolean values

### Custom Labels
- **Type**: TEXT (JSON array)
- **Format**: `'["label1","label2","label3","label4","label5","label6"]'`
- **Default**: `'["","","","","",""]'` (empty labels)

## Frontend Features

### View Modes
1. **Card View** (`.waza-card`) - Full details with video links
2. **List View** (`.waza-list`) - Condensed info, no videos
3. **Compact View** (`.waza-compact`) - Single-line entries

### Search & Filter
- **Search**: Fuzzy matching with normalization
  - Japanese text normalization (half/full width)
  - Latin text normalization (accents, case)
  - Exact phrase matching with quotes
- **Filters**: Skill level, family, markings, "Any ★" (has progress)
- **Sort**: Default order, Name (A-Z/Z-A), Likes (ascending/descending)

### Onboarding
- Multi-slide carousel with interactive demos
- Progress indicator
- Skip option for returning users
- Demonstrates: browse, markings, labels, stats, import

### Constants
```javascript
const SHAPES = ['●', '▲', '■', '♥', '★', '◆'];
const LIKE_NONE = null;
const LIKE_UP = 1;
const LIKE_DOWN = -1;
```

## Deployment

### Prerequisites
- Cloudflare account with Workers and D1 enabled
- Wrangler CLI installed (`npm install -g wrangler`)

### Setup
1. Clone the repository
2. Run database migrations (see schema above)
3. Configure `wrangler.json` with your D1 database ID and KV namespace ID
4. Deploy: `wrangler deploy`

### Environment Variables
Set in `wrangler.json`:
```json
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_id": "your-d1-database-id",
      "database_name": "wazalist-db"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "LIST_STORE",
      "id": "your-kv-namespace-id"
    }
  ]
}
```

## File Structure

```
wazalist-app/
├── src/
│   ├── index.ts          # Main worker entry point
│   ├── auth.ts           # Authentication helpers
│   ├── renderHtml.ts     # Serve main HTML
│   └── renderAdmin.ts    # Serve admin panel
├── assets/
│   ├── index.html        # Main application UI
│   └── admin.html        # Admin panel UI
├── wrangler.json         # Cloudflare Workers config
├── package.json          # Node.js dependencies
└── README.md             # This file
```

## Security

### Authentication
- **Password hashing**: PBKDF2 with 100,000 iterations + random salt
- **Session tokens**: 64-character random hex strings
- **Session duration**: 30 days
- **Token storage**: Stored in localStorage, sent via Authorization header

### Contribution Review
- All user edits require admin approval
- Payload preview with diff view
- Admin notes for transparency
- Audit trail (created_at, reviewed_at)

### Data Privacy
- Guest mode: All data stored locally in browser
- Account mode: Data synced to private user tables
- Shared lists: SHA-256 hashed URLs, 90-day expiration

## Performance

### Caching
- **Video metadata**: In-memory cache per request
- **oEmbed responses**: Cached to avoid repeated API calls
- **Search normalization**: Pre-computed for faster matching

### Database Optimization
- Indexed foreign keys
- Aggregated like counts (computed in query, not stored)
- Efficient integer storage for like/dislike

### Frontend Optimization
- Minimal dependencies (vanilla JS)
- CSS Grid/Flexbox for layout
- Lazy-loading of video metadata
- Client-side filtering (no server round-trips)

## Browser Support

- **Desktop**: Chrome, Firefox, Safari, Edge (latest 2 versions)
- **Mobile**: iOS Safari, Android Chrome (latest versions)
- **Features**: ES6+, Fetch API, localStorage, CSS Grid/Flexbox

## License

[Add your license here]

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

For Waza contributions (edits/additions), use the in-app contribution system.

## Credits

- Built with [Cloudflare Workers](https://workers.cloudflare.com/)
- Database: [Cloudflare D1](https://developers.cloudflare.com/d1/)
- Storage: [Cloudflare KV](https://developers.cloudflare.com/kv/)

## Changelog

### Recent Updates
- ✅ Migrated like/dislike from strings to integers (83% storage savings)
- ✅ Renamed "shapes" → "markings" for clarity
- ✅ Renamed "legend" → "labels" for custom marking names
- ✅ Added user onboarding with interactive demos
- ✅ Added contribution system with admin review
- ✅ Added list sharing with KV storage
- ✅ Improved search with fuzzy matching
- ✅ Added multiple view modes (card/list/compact)
- ✅ Added Stats tab with analytics
- ✅ Added Compare tab for list comparison
- ✅ Optimized frontend performance

---

**Wazalist** - Track your wotagei journey, one Waza at a time! 🎉