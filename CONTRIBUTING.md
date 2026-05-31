# Contributing to Wazalist

Welcome! This guide assumes you can program (C, C++, Python, whatever) but may be
new to HTML/CSS/JavaScript. The project is deliberately built **without a frontend
build step** so you can edit a file, refresh the browser, and see the change. No
bundler, no framework, no transpiler for the frontend.

## The 30-second mental model

There are two halves:

1. **The frontend** — plain files in `assets/` that the browser downloads as-is.
   `index.html` lists which CSS and JS files to load. There is no compile step.
   If you know C: think of each `.js` file as a `.c` file, and `index.html` as the
   thing that decides the link order.

2. **The backend** — a small TypeScript program in `src/` that runs on Cloudflare
   Workers. It answers `/api/...` requests (login, save progress, contributions)
   and otherwise just hands the browser `index.html`. Wrangler compiles this for
   you; you don't run a compiler by hand.

Data lives in Cloudflare D1 (an SQL database) and Cloudflare KV (for shared lists).

## Project layout

```
wazalist/
├── wrangler.json            Cloudflare config (database, KV, assets dir)
├── package.json             npm scripts (dev / deploy / migrations)
├── tsconfig.json            TypeScript settings for the worker
├── worker-configuration.d.ts  Generated env types (run `npm run cf-typegen` to refresh)
│
├── migrations/              SQL schema, applied by Wrangler (see its README)
│   └── 0001_initial_schema.sql
│
├── src/                     BACKEND — Cloudflare Worker (TypeScript)
│   ├── index.ts             Router: every /api/... endpoint lives here
│   ├── auth.ts              Password hashing + session lookup
│   ├── renderHtml.ts        Serves assets/index.html
│   └── renderAdmin.ts       Serves assets/admin.html (admin only)
│
└── assets/                  FRONTEND — served to the browser unchanged
    ├── index.html           Page markup + the <link>/<script> list
    ├── admin.html           Admin review panel
    ├── css/                 Styles, split by area
    └── js/                  App logic, split by area
```

## ⚠️ The one rule that matters most (read this)

The files in `assets/js/` are **plain ("classic") `<script>` tags, not ES modules.**
They all share a single global scope, exactly like pasting them one after another.
That is intentional and the app depends on it:

- Inline handlers in the HTML (e.g. `onclick="selectWaza(5)"`) call functions by
  their global name.
- `onboarding.js` reaches into globals defined by the other files
  (`initApp`, `wazaData`, `markingPips`, …) and even replaces `window.initApp`.

Because of this, **the load order in `index.html` is load-bearing.** When you add
or move a file:

- Keep the `<script>` tags in dependency order. `config.js` and `state.js` come
  first; `main.js` (the boot/wiring) and `onboarding.js` come last.
- **Do not** add `type="module"`, and **do not** introduce `import` / `export` in
  these files. That would break the shared global scope and silently stop the app
  from working. (If the project ever wants modules, that's a deliberate, whole-app
  change — not something to slip into one file.)

The backend `src/*.ts` files are the opposite: those *are* modules and use normal
`import`/`export`. That's fine — they're compiled separately by Wrangler.

## "I want to change X — which file?"

CSS (`assets/css/`, loaded in this order; later files override earlier ones):

| Area | File |
|------|------|
| Reset, body, colors, auth screen, page layout, filter row | `base.css` |
| Waza list, cards, marking pips, detail panel, videos, like pill | `waza.css` |
| Dashboard, top nav, Stats, contributions list | `panels.css` |
| Contribution / compare / import / share modals | `modals.css` |
| Mobile menu, mobile filter sheet, small-screen overrides | `mobile.css` |
| The onboarding overlay | `onboarding.css` |

JavaScript (`assets/js/`):

| Area | File |
|------|------|
| Constants (markings, video platforms, like values) | `config.js` |
| App state + localStorage helpers | `state.js` |
| Fetch wrapper, login/guest, `initApp`, saving progress | `app-core.js` |
| Search + fuzzy matching + `filterWaza()` | `search.js` |
| Marking styles/pips, video/oEmbed helpers | `render-helpers.js` |
| Browse list + single-waza detail view | `render.js` |
| Contribute & Account tabs | `forms.js` |
| Excel export | `export.js` |
| Stats dashboard | `stats.js` |
| Placeholders, filter UI, mobile menu/sheet, `escHtml` | `ui.js` |
| Suggest-edit / new-waza dialogs | `contribute-modals.js` |
| Share + Compare (list hashing, modals) | `share.js` |
| Text-import parsing engine (no DOM) | `import-parser.js` |
| Import tab UI + Excel file reading | `import-ui.js` |
| Boot wiring: events, popstate, auto-import | `main.js` |
| First-run onboarding overlay | `onboarding.js` |

API endpoints (login, progress, contributions, admin): all in `src/index.ts`.
Database shape: `migrations/0001_initial_schema.sql`.

## Running it locally

You need Node.js and a free Cloudflare account.

```sh
npm install
npm run dev        # applies local DB migrations, then starts a local server
```

Wrangler prints a `http://localhost:...` URL. Edit a file in `assets/`, save, and
refresh the browser — no rebuild needed. Changes to `src/*.ts` reload automatically.

Deploying (maintainers):

```sh
npm run deploy     # runs remote migrations first, then deploys
```

## Adding or editing waza (technique data)

You do **not** need to touch the database directly. Log in and use the in-app
**Contribute** tab to suggest an edit or a new waza. An admin reviews it in the
`/admin` panel and approves or rejects it. That review workflow is the intended
way to grow the dataset.

## Code conventions

- Match the surrounding style (indentation, quoting). Small, focused changes.
- Frontend JS: plain functions on the global scope, no new libraries unless
  discussed first. The project intentionally stays HTML/CSS/JS only and must keep
  working on Cloudflare's free tier.
- Test by clicking through the affected screen on desktop **and** narrow/mobile
  width before opening a PR.

## Two existing quirks worth knowing

- `markingLabels` in `state.js` is declared with `let`, so it is **not** attached
  to `window`. The onboarding overlay's attempt to sync labels back into the app
  (`window.markingLabels`) is therefore currently a no-op and falls back to a
  template. This is preserved behavior — don't "fix" it casually, since other code
  reads the bare `markingLabels` global directly.
- `admin.html` is a static asset, so it can be fetched directly at `/admin.html`.
  That's only the empty shell — every admin action goes through `/api/admin/*`,
  which checks `is_admin` server-side, so no data is exposed by the page itself.

## Pull requests

1. Fork and create a branch.
2. Make your change; keep it scoped.
3. Note what you tested (which screens, desktop + mobile).
4. Open the PR with a short description of the *why*.

Thanks for helping build Wazalist!
