# Wazalist - Wotagei Skills Database

A comprehensive web application for tracking and managing wotagei (Japanese idol fan dance) techniques. Browse waza (skills), mark your progress, and sync your learning journey across devices.

## Features

### 📚 Browse & Search
- **Full-text search** with fuzzy matching (typo-tolerant)
- Search by Japanese or English names
- Exact phrase search using quotes (e.g., `"technique name"`)

### 🎯 Filtering System
- **Skill level** filtering
- **Family/technique group** filtering
- **Shape markers** (6 customizable shapes: ● ▲ ■ ♥ ★ ◆)
- **👍 Liked** quick-filter

### 📊 Progress Tracking
- **Shape markers** - Assign any meaning to 6 different shapes per technique
- **Like/Dislike** system for personal preference
- Progress syncs across devices when logged in
- Guest mode with local browser storage

### 📱 Dashboard
- **Home** - Overview of marked and liked techniques
- **My List** - Expanded cards with video links for tracked techniques
- **Stats** - Detailed analytics on your learning progress

### 🔐 Authentication
- Create account with email (optional)
- Guest mode for quick access without registration
- Secure password hashing (PBKDF2)
- Session-based authentication (30-day sessions)

### 🎥 Video References
- Multiple video links per technique
- Support for YouTube, Bilibili, Twitter/X, NicoNico, Facebook
- Automatic platform detection and icons

## Tech Stack

### Backend
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Authentication**: PBKDF2 password hashing, session tokens
- **Language**: TypeScript

### Frontend
- **HTML/CSS**: Custom dark theme with CSS Grid/Flexbox
- **JavaScript**: Vanilla JS (no frameworks)
- **Features**: Collapsible sections, responsive design, fuzzy search

## Database Schema

```sql
-- Users table
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Sessions table
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Waza (techniques) table
CREATE TABLE waza (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name_jp TEXT,
    name_en TEXT,
    name_en_literal TEXT,
    name_en_gtranslate TEXT,
    tag TEXT,                    -- Skill level
    reference TEXT,              -- Lore/description
    parent_jp0 TEXT,             -- Prerequisite technique (JP)
    parent_en0 TEXT,             -- Prerequisite technique (EN)
    parent_jp1 TEXT,
    parent_en1 TEXT,
    author_jp TEXT,
    author_en TEXT,
    video0 TEXT, video1 TEXT, video2 TEXT,
    video3 TEXT, video4 TEXT, video5 TEXT
);

-- User progress table
CREATE TABLE progress (
    user_id INTEGER NOT NULL,
    waza_id INTEGER NOT NULL,
    shapes TEXT,                 -- JSON array of 6 booleans
    like TEXT,                   -- 'like', 'dislike', or NULL
    updated_at DATETIME,
    PRIMARY KEY (user_id, waza_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (waza_id) REFERENCES waza(id)
);