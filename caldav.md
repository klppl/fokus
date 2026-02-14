# CalDAV Sync Implementation Plan

## Context

Tatsu currently has no external calendar sync or import/export functionality. Users who use CalDAV-compatible services (Nextcloud, Radicale, iCloud, Google Calendar) cannot sync their todos. The existing data model already uses RFC 5545 RRULE for recurrence and per-instance overrides via `TodoInstance`, which maps well to the iCalendar/CalDAV protocol. This plan adds bidirectional CalDAV sync so users can keep Tatsu in sync with their calendar servers.

---

## Phase 1 — Foundation

### 1.1 Install dependencies

```
npm install tsdav ical.js @noble/ciphers
```

- **tsdav**: TypeScript CalDAV client (PROPFIND, REPORT, sync-collection, calendar-multiget)
- **ical.js**: Mozilla's iCalendar parser/generator (VTODO, RRULE, RECURRENCE-ID support)
- **@noble/ciphers**: AES-GCM encryption for stored credentials (same `@noble` family already used)

### 1.2 Prisma schema — new models

**File: `prisma/schema.prisma`**

Add three new models + one enum:

**`CalDavAccount`** — stores server connection info per user
- `id`, `userID` (→ User), `displayName`, `serverUrl`, `username`
- `encryptedPassword`, `passwordIV` (AES-GCM encrypted at rest)
- `principalUrl?`, `calendarHomeUrl?` (discovery results)
- `lastSyncAt?`, `syncEnabled`, `syncIntervalMin`
- Relation: `calendars CalDavCalendar[]`

**`CalDavCalendar`** — one calendar collection on the server
- `id`, `accountId` (→ CalDavAccount), `calendarUrl`, `displayName?`, `color?`
- `ctag?`, `syncToken?` (change detection)
- `syncDirection` enum: `BIDIRECTIONAL | PULL_ONLY | PUSH_ONLY`
- `componentType` enum: `VTODO | VEVENT` (default VTODO) — user chooses per-calendar
- `projectId?` (→ Project, optional mapping)
- Relation: `items CalDavSyncItem[]`

**`CalDavSyncItem`** — maps one CalDAV resource ↔ one Tatsu todo
- `id`, `calendarId` (→ CalDavCalendar)
- `caldavUid`, `caldavEtag?`, `caldavHref` (server-side identifiers)
- `todoId?` (→ Todo), `todoInstanceId?` (→ TodoInstance)
- `lastSyncedIcal?` (cached iCal text), `lastSyncedHash?`
- `locallyModifiedAt?`, `lastSyncedAt?`
- `conflictState` enum: `NONE | PENDING_RESOLUTION | LOCAL_WINS | SERVER_WINS`
- `serverIcalOnConflict?` (stored for conflict resolution UI)
- Unique constraint: `[calendarId, caldavUid]`

Add relation fields to existing models: `User.calDavAccounts`, `Todo.syncItems`, `TodoInstance.syncItems`, `Project.calDavCalendars`.

### 1.3 Credential encryption

**New file: `lib/caldav/crypto.ts`**

- `encryptPassword(plaintext, key)` → `{ encrypted, iv }` (AES-256-GCM)
- `decryptPassword(encrypted, iv, key)` → plaintext
- Key from env var `CALDAV_ENCRYPTION_KEY` (32-byte hex)
- Uses `@noble/ciphers` for AES-GCM

### 1.4 iCalendar ↔ Tatsu converter

**New file: `lib/caldav/ical-converter.ts`**

**iCal component type is configurable per-calendar** — users choose VTODO or VEVENT when setting up each calendar sync. This is stored as `componentType` on `CalDavCalendar`.

**Tatsu Todo → VTODO mapping:**

| Tatsu | VTODO | Notes |
|-------|-------|-------|
| `title` | `SUMMARY` | |
| `description` | `DESCRIPTION` | |
| `dtstart` | `DTSTART` | With TZID from `timeZone` |
| `due` | `DUE` | |
| `rrule` | `RRULE` | Already RFC 5545 |
| `exdates` | `EXDATE` | |
| `priority` | `PRIORITY` | High→1, Medium→5, Low→9 |
| `completed` | `STATUS:COMPLETED` + `COMPLETED` | |
| `pinned` | `X-TATSU-PINNED` | Custom, round-trip safe |
| `order` | `X-TATSU-ORDER` | Custom, round-trip safe |
| Project name | `CATEGORIES` | |

**Tatsu Todo → VEVENT mapping** (when calendar is configured as VEVENT):

| Tatsu | VEVENT | Notes |
|-------|--------|-------|
| `title` | `SUMMARY` | |
| `description` | `DESCRIPTION` | |
| `dtstart` | `DTSTART` | |
| `due` | `DTEND` | VEVENT uses DTEND, not DUE |
| `rrule` | `RRULE` | |
| `exdates` | `EXDATE` | |
| `priority` | `PRIORITY` | Same mapping |
| `completed` | `STATUS:CANCELLED` + `X-TATSU-COMPLETED` | VEVENT has no COMPLETED; use custom property |
| `pinned` | `X-TATSU-PINNED` | |
| `order` | `X-TATSU-ORDER` | |

**TodoInstance → RECURRENCE-ID:** Each overridden instance becomes a separate VTODO/VEVENT component (matching the calendar's `componentType`) with `RECURRENCE-ID` set to `instanceDate`. Override fields map to their corresponding properties.

**Reverse mapping**: Priority 1-3→High, 4-6→Medium, 7-9→Low. RECURRENCE-ID components → TodoInstance upserts. Unknown X-properties preserved.

### 1.5 CalDAV client wrapper

**New file: `lib/caldav/client.ts`**

Wraps `tsdav`:
- `createCalDavClient(account)` — authenticated DAVClient
- `discoverCalendars(client)` — service discovery
- `fetchChangedResources(client, calendar, syncToken?)` — incremental fetch via sync-collection or ctag/etag fallback
- `fetchResource(client, href)` → `{ icalData, etag }`
- `putResource(client, href, icalData, etag?)` → `{ newEtag }`
- `deleteResource(client, href, etag?)`

### 1.6 Tests for converter

**New file: `tests/caldav/ical-converter.test.ts`**

- Priority mapping round-trip
- RRULE round-trip (ensure Tatsu's RRULEs survive iCal serialization/parsing)
- RECURRENCE-ID ↔ TodoInstance mapping
- Exdates handling
- Custom X-property preservation

---

## Phase 2 — Account Management API + UI

### 2.1 Zod schemas

**File: `schema.ts`** — add:
- `calDavAccountSchema`: displayName, serverUrl (URL), username, password
- `calDavSyncConflictResolutionSchema`: syncItemId, resolution enum

### 2.2 API routes

All follow existing pattern (auth via `auth()`, Zod validation, `errorHandler`).

| Route | Methods | Purpose |
|-------|---------|---------|
| `app/api/caldav/account/route.ts` | POST, GET | Create account (with discovery), list accounts |
| `app/api/caldav/account/[id]/route.ts` | PATCH, DELETE | Update/remove account |
| `app/api/caldav/account/[id]/test/route.ts` | POST | Test connection |
| `app/api/caldav/account/[id]/discover/route.ts` | POST | Re-discover calendars |
| `app/api/caldav/calendar/[id]/route.ts` | PATCH, DELETE | Update calendar settings, stop syncing |

### 2.3 Error classes

**New file: `lib/caldav/errors.ts`**

- `CalDavConnectionError` (502)
- `CalDavAuthError` (401)
- `CalDavSyncError` (500)

### 2.4 UI — Settings

**New files:**
- `components/Settings/CalDavSettings.tsx` — list accounts, add/remove/toggle
- `components/Settings/CalDavAccountForm.tsx` — form with server URL, username, password, test button
- Integrate into existing settings area or new settings page at `app/[locale]/app/settings/`

**New React Query hooks in `features/caldav/query/`:**
- `get-caldav-accounts.ts`, `create-caldav-account.ts`, `delete-caldav-account.ts`

---

## Phase 3 — Sync Engine

### 3.1 Core sync logic

**New file: `lib/caldav/sync-engine.ts`**

**Initial sync** is pull-only — only items from the CalDAV server are imported into Tatsu. Existing Tatsu todos are not pushed until they are newly created or explicitly modified after the initial sync completes. This avoids duplicates.

**Incremental sync flow (per calendar):**

1. **Pull phase:**
   - Use sync-token (or ctag/etag fallback) to detect server changes
   - For each changed resource: parse iCal → compare with local state
   - If `locallyModifiedAt > lastSyncedAt` → conflict (see 3.3)
   - Otherwise apply server version to local Todo via Prisma upsert
   - Update etag, syncToken, lastSyncedIcal

2. **Push phase:**
   - Query CalDavSyncItem where `locallyModifiedAt > lastSyncedAt AND conflictState = NONE`
   - Convert Todo → VTODO iCal string
   - PUT to server with `If-Match: <etag>`
   - On `412 Precondition Failed` → refetch, apply conflict resolution
   - On success → update etag, clear locallyModifiedAt

3. **Deletion handling:**
   - Server deletion (from sync-collection report) → delete local Todo + sync item
   - Local deletion → send DELETE to CalDAV server → remove sync item

### 3.2 Change tracking hook

**New file: `lib/caldav/change-tracker.ts`**

- `markTodoModified(todoId)` — sets `locallyModifiedAt = now()` on associated CalDavSyncItem
- `markTodoDeleted(todoId)` — queues CalDAV DELETE

**Files to modify** (add non-blocking `markTodoModified`/`markTodoDeleted` calls after Prisma operations):
- `app/api/todo/route.ts` (POST — new todo, if linked to synced project)
- `app/api/todo/[id]/route.ts` (PATCH, DELETE)
- `app/api/todo/[id]/complete/route.ts` (PATCH)
- `app/api/todo/instance/[id]/route.ts` (PATCH, DELETE)
- `app/api/todo/instance/[id]/complete/route.ts` (PATCH)
- `app/api/todo/instance/[id]/uncomplete/route.ts` (PATCH)
- `app/api/todo/instance/[id]/prioritize/route.ts` (PATCH)

All wrapped in try/catch — sync tracking failures must never break primary todo operations.

### 3.3 Conflict resolution

**Strategy: last-write-wins by default, user choice for flagged conflicts**

- Compare `locallyModifiedAt` vs server `LAST-MODIFIED`
- When both sides changed: set `conflictState = PENDING_RESOLUTION`, store both versions
- Expose via API + UI for manual resolution

### 3.4 Sync trigger API

| Route | Method | Purpose |
|-------|--------|---------|
| `app/api/caldav/sync/route.ts` | POST | Manual sync (optional `accountId` filter) |
| `app/api/caldav/sync/route.ts` | GET | Sync status (last sync, conflict count) |
| `app/api/caldav/sync/conflicts/route.ts` | GET, POST | List/resolve conflicts |
| `app/api/caldav/sync/cron/route.ts` | POST | Cron-triggered sync (protected by `CALDAV_CRON_SECRET`) |

### 3.5 Sync triggers

- **Manual**: "Sync Now" button → POST `/api/caldav/sync`
- **Periodic**: Cron job (extend existing `.github/workflows/cronjob.yml`) calls cron endpoint
- **On mutation**: After todo CRUD, debounced push for the affected item (5s debounce)

---

## Phase 4 — Conflict Resolution UI + Polish

### 4.1 UI components

- `components/Settings/ConflictResolutionDialog.tsx` — side-by-side local vs server comparison, "Keep Local" / "Keep Server" buttons
- `components/Sidebar/Settings/SyncStatusIndicator.tsx` — sync icon in sidebar, badge for conflicts, click to sync or open settings
- `features/caldav/query/get-sync-status.ts`, `get-conflicts.ts`, `resolve-conflict.ts`

### 4.2 Error handling & resilience

- Network failures: retry with exponential backoff (3 attempts)
- Partial sync: continue on per-item failures, report succeeded/failed/skipped
- Invalid iCal: skip with warning log, store raw data for debugging
- Auth expiry (401): mark account as needing re-auth, prompt user

---

## Environment Variables

Add to `.env.example`:
```
CALDAV_ENCRYPTION_KEY=    # 64-char hex string for AES-256 credential encryption
CALDAV_CRON_SECRET=       # Secret for cron sync endpoint auth
```

---

## New Files Summary

```
lib/caldav/
  client.ts              CalDAV client wrapper (tsdav)
  ical-converter.ts      VTODO ↔ Todo mapping
  sync-engine.ts         Pull/push/conflict orchestration
  change-tracker.ts      Hook into todo mutations
  crypto.ts              AES-GCM credential encryption
  errors.ts              CalDAV-specific error classes

app/api/caldav/
  account/route.ts               POST, GET
  account/[id]/route.ts          PATCH, DELETE
  account/[id]/test/route.ts     POST
  account/[id]/discover/route.ts POST
  calendar/[id]/route.ts         PATCH, DELETE
  sync/route.ts                  POST, GET
  sync/conflicts/route.ts        GET, POST
  sync/cron/route.ts             POST

features/caldav/query/
  get-caldav-accounts.ts
  create-caldav-account.ts
  delete-caldav-account.ts
  trigger-sync.ts
  get-sync-status.ts
  get-conflicts.ts
  resolve-conflict.ts

components/Settings/
  CalDavSettings.tsx
  CalDavAccountForm.tsx
  ConflictResolutionDialog.tsx

components/Sidebar/Settings/
  SyncStatusIndicator.tsx

tests/caldav/
  ical-converter.test.ts
```

## Modified Files

- `prisma/schema.prisma` — new models + relations on User, Todo, TodoInstance, Project
- `schema.ts` — new Zod schemas
- `app/api/todo/route.ts` — add change tracking call (POST)
- `app/api/todo/[id]/route.ts` — add change tracking calls (PATCH, DELETE)
- `app/api/todo/[id]/complete/route.ts` — add change tracking call
- `app/api/todo/instance/[id]/route.ts` — add change tracking calls
- `app/api/todo/instance/[id]/complete/route.ts` — add change tracking call
- `app/api/todo/instance/[id]/uncomplete/route.ts` — add change tracking call
- `app/api/todo/instance/[id]/prioritize/route.ts` — add change tracking call
- `.env.example` — add CALDAV_ENCRYPTION_KEY, CALDAV_CRON_SECRET
- `.github/workflows/cronjob.yml` — add CalDAV sync cron schedule

## Verification

1. **Unit tests**: Run `npm test` — iCal converter tests pass (priority mapping, RRULE round-trip, RECURRENCE-ID)
2. **Manual test with Radicale** (lightweight CalDAV server, easy to run locally via Docker):
   - Add a CalDAV account in Settings → verify discovery finds calendars
   - Create a todo in Tatsu → verify it appears on the CalDAV server as VTODO
   - Modify the todo on the server → trigger sync → verify Tatsu reflects changes
   - Create a recurring todo → verify RRULE + instance overrides sync correctly
   - Delete a todo on each side → verify deletion propagates
   - Modify on both sides simultaneously → verify conflict resolution UI appears
3. **Build**: Run `npm run build` — no type errors
4. **Lint**: Run `npm run lint` — clean
