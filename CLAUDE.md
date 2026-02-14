# CLAUDE.md

## Project Overview

Single-user self-hosted todo/productivity web app built with **Next.js 15** (App Router), **TypeScript**, **React 18**, **Prisma** (SQLite), and **Tailwind CSS**. Features: recurring tasks (RFC 5545 RRULE), calendar, notes (Tiptap editor), projects, CalDAV sync, admin panel, and i18n (next-intl).

Originally forked from [ZhengJiawen44/tatsu](https://github.com/ZhengJiawen44/tatsu) — now significantly diverged (removed vault/S3/encryption, removed public registration, added CalDAV sync, admin panel, single-user model).

## Commands

- `npm run dev` — Start dev server (Turbopack, TZ=UTC)
- `npm run build` — Production build
- `npm run lint` — ESLint
- `npm test` — Run Jest tests (TZ=UTC)
- `npm run db:push` — Push schema to database
- `npx prisma studio` — Database GUI
- `docker compose up --build` — Run with Docker

## Project Structure

```
app/                    Next.js App Router
  [locale]/             i18n dynamic locale routing
    (auth)/             Auth pages (login only, no public registration)
    admin/              Admin panel (outside auth gate, password-protected)
    app/                Protected app pages (auth-gated by layout)
  api/                  REST API routes
    admin/              Admin endpoints (purge, reset-password, register, setup)
    todo/               Todo CRUD + reorder
    note/               Note CRUD
    project/            Project CRUD
    caldav/             CalDAV account/calendar/sync endpoints
components/             React components
  ui/                   shadcn/ui primitives
  Admin/                Admin panel (AdminPanel.tsx)
  Sidebar/              Feature-organized sidebar (Todo, Calendar, Note, Project, Settings)
  Settings/             Settings components
features/               Feature-specific logic (todayTodos, calendar, completed, caldav)
hooks/                  Custom React hooks
providers/              React Context providers (Query, TodoForm, TodoMutation, UserPreferences, Menu)
lib/                    Utilities
  admin.ts              Shared admin helpers (verifyAdminPassword, getSingleUser)
  prisma/               Prisma client + db-adapter (SQLite helpers)
  caldav/               CalDAV sync (client, digest auth, ical converter, sync engine)
  customError.ts        Custom error classes (BaseServerError, UnauthorizedError, etc.)
  errorHandler.ts       Catch-all error → NextResponse handler
i18n/                   Internationalization config
messages/               i18n JSON translation files (ar, de, en, es, fr, it, ja, ms, pt, ru, zh)
prisma/                 Schema
  schema.sqlite.prisma  SQLite schema (source of truth)
  schema.prisma         Generated — copied by scripts/select-schema.js (gitignored)
scripts/                Build/setup scripts
  select-schema.js      Copies SQLite schema to active location
types/                  TypeScript type definitions
tests/                  Jest tests (recurrence)
```

## Key Conventions

- **API routes**: RESTful handlers (POST/GET/PUT/DELETE) with Zod validation and custom error classes via `errorHandler`
- **Components**: Server Components by default; client components use Context providers for state
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **Data fetching**: React Query (TanStack Query v5) client-side, Prisma server-side
- **Auth**: NextAuth.js v5 (Credentials provider only, single user)
- **i18n**: next-intl with `[locale]` routing and JSON message files
- **Imports**: Path alias `@/` maps to project root
- **Naming**: PascalCase for components, features organized by domain
- **Timezone**: All date operations are timezone-aware; dev/test runs with `TZ=UTC`

## Database

Uses **SQLite** via Prisma. `scripts/select-schema.js` copies `schema.sqlite.prisma` to `schema.prisma` before every `dev`, `build`, and `postinstall` run.

### SQLite adapter (`lib/prisma/db-adapter.ts`)

- `exdates` field stored as JSON-serialized `String`
- `Todo.order` set via `getNextTodoOrder()` (computes max + 1)
- Reorder uses `$transaction` with individual updates
- Exdates use read-append-write via `pushExdates()`

**Important**: When modifying code that reads/writes `exdates`, always use the adapter functions (`deserializeExdates`, `serializeExdates`, `pushExdates`, `emptyExdates`) instead of accessing the field directly.

Key models: `User`, `Todo` (with `rrule`, `exdates`, `dtstart`, `due`), `TodoInstance`, `CompletedTodo`, `Note`, `Project`, `UserPreferences`, `CalDavAccount`, `CalDavCalendar`, `CalDavSyncItem`.

## Admin Panel

Located at `/admin` (outside the auth-gated `/app` routes). Protected by `ADMIN_PASSWORD` env var, not by user session.

**Flow:**
1. Enter admin password → unlock
2. If no user exists → "Register your user" form (name, email, password)
3. If user exists → full admin panel (password reset, data purge)

**API endpoints** (`app/api/admin/`):
- `GET /api/admin/setup` — returns `{ hasUser }` (no auth required)
- `POST /api/admin/register` — create first user (admin password + no existing user)
- `POST /api/admin/reset-password` — reset user login password (admin password required)
- `POST /api/admin/purge` — delete data by category (admin password required)

**Shared helpers** (`lib/admin.ts`):
- `verifyAdminPassword(req)` — checks `x-admin-password` header against `ADMIN_PASSWORD` env var
- `getSingleUser()` — returns the first user from DB (single-user app)

**Password hashing**: `pbkdf2(sha256, password, salt, { c: 10000, dkLen: 32 })` stored as `saltHex:hashHex`. Uses `@noble/hashes`.

## CalDAV Sync

CalDAV integration lives in `lib/caldav/`. Supports both **Basic** and **Digest** HTTP authentication (auto-detected per server). Key files:

- `client.ts` — DAVClient wrapper; probes server auth method, creates digest-aware fetch if needed
- `digest-auth.ts` — HTTP Digest auth implementation (challenge-response with MD5, qop=auth)
- `crypto.ts` — AES-256-GCM encryption for stored CalDAV passwords
- `ical-converter.ts` — Bidirectional VTODO/VEVENT <-> Todo conversion
- `sync-engine.ts` — Pull/push sync with conflict detection
- `change-tracker.ts` — Marks todos as locally modified for next sync push

## Removed Features (vs upstream)

These features from the original upstream repo have been removed:
- **Vault / File storage** — S3, encryption, File model, `@aws-sdk/client-s3`, PassKeyProvider
- **Public registration** — user creation now only via admin panel
- **Feedback system** — FeedbackForm component and API
- **Popups** — CalendarMobilePopup, NewFeaturesPopup
- **Prisma migrations** — replaced with `db:push` workflow

## Environment

Requires `.env` — see `.env.example`:

| Variable | Required | Description |
|---|---|---|
| `AUTH_SECRET` | Yes | NextAuth secret (`openssl rand -base64 32`) |
| `DATABASE_URL` | Yes | SQLite path (e.g. `file:./dev.db`) |
| `ADMIN_PASSWORD` | Yes | Password for admin panel at `/admin` |
| `NEXTAUTH_URL` | Yes | App URL (e.g. `http://localhost:3000`) |
| `API_URL` | Yes | API base URL |
| `CRONJOB_SECRET` | Yes | Secret for cron endpoints |
| `CALDAV_ENCRYPTION_KEY` | Optional | 64-char hex for CalDAV password encryption |
| `CALDAV_CRON_SECRET` | Optional | Secret for CalDAV sync cron endpoint |
