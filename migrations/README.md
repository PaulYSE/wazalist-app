# Database migrations

D1 (the app's SQLite database) is managed with Wrangler migrations. Each `.sql`
file here runs once, in filename order, and Wrangler records which have been
applied so they never run twice.

## Commands

```sh
# Apply to your LOCAL dev database (safe, throwaway):
npx wrangler d1 migrations apply DB --local

# Apply to the REMOTE production database:
npx wrangler d1 migrations apply DB --remote
```

`npm run dev` runs the `--local` apply for you, and `npm run predeploy` runs the
`--remote` apply automatically before `npm run deploy`.

## Adding a migration

Create a new file with the next number, e.g. `0002_add_difficulty_column.sql`.
Never edit a migration that has already been applied — write a new one instead.
Prefer additive, reversible changes (`ADD COLUMN`, `CREATE TABLE IF NOT EXISTS`).

## ⚠️ Note for the existing production deployment

`0001_initial_schema.sql` documents the schema the app already runs on. The
live database was created before these migration files existed, so its tables
already exist. The migration uses `CREATE TABLE IF NOT EXISTS` everywhere, so it
is non-destructive — but **before the first `--remote` apply on the live DB**,
confirm whether Wrangler's migration log already considers `0001` applied
(`npx wrangler d1 migrations list DB --remote`). If you are unsure, take a D1
export first: `npx wrangler d1 export DB --remote --output backup.sql`.
