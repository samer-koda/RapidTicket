# RapidTicket — Execution Todo

> Reference spec: [`docs/production_engineering_specification.md`](docs/production_engineering_specification.md)

---

## Phase 1 — Foundation

- [x] Scaffold monorepo structure (`/server`, `/client`, `/shared`)
- [x] Initialize NestJS backend project (`/server`)
- [x] Set up TypeORM with PostgreSQL — configure connection and migration runner
- [x] Write migrations for full DB schema (per spec §5):
  - [x] `users`
  - [x] `floor_plans`
  - [x] `tables`
  - [x] `seats`
  - [x] `orders`
  - [x] `order_items`
  - [x] `order_item_modifiers`
  - [x] `menu_items`
  - [x] `menu_item_modifiers`
  - [x] `categories`
  - [x] `payments`
  - [x] `settings`
  - [x] `stations`
  - [x] `printers`
- [x] Seed initial data: default `tax_rate`, `pin_lockout_threshold`, `pin_lockout_duration`, `auto_logout`, `auto_logout_timeout` (per spec §5 Settings)

---

## Phase 2 — Core API

> All endpoints and request/response shapes defined in spec §6.

- [x] **Auth module** — `POST /auth/login`, `POST /auth/logout`; PIN hashing, JWT signing, lockout logic (per spec §15)
  - [x] `GET /auth/setup-status` — detect whether any admin exists (drives first-run screen)
  - [x] `POST /auth/bootstrap` — create the first admin account when no users exist
- [x] **Menu module**
  - [x] Categories CRUD (`POST`, `PATCH`, `DELETE /menu/categories`)
  - [x] Menu items CRUD (`GET`, `POST`, `PATCH`, `DELETE /menu/items`) — including `isTaxable`, `printDestination`, `isAvailable`
  - [x] Modifiers CRUD (`GET`, `POST`, `PATCH`, `DELETE /menu/items/{id}/modifiers`)
- [x] **Floor plans & tables module**
  - [x] Floor plans (`POST`, `PATCH`, `DELETE /floor-plans`)
  - [x] Tables (`GET`, `POST`, `PATCH`, `DELETE /tables`)
  - [x] Seats (`GET`, `POST`, `PATCH`, `DELETE /tables/{id}/seats`)
- [x] **Orders module**
  - [x] `GET /orders` (filters: status, tableId)
  - [x] `POST /orders` — create order, set table `occupied = true`, flag items for this round, auto-set status `SENT`
  - [x] `PATCH /orders/{id}` — add items in a new round (only new items flagged for print/status)
  - [x] `GET /orders/{id}` — full order detail with items, modifiers, totals
  - [x] `PATCH /orders/{id}/items/{itemId}` — update item status (`PREPARING`, `READY`)
- [x] **Payments module** — `POST /payments`; compute taxable subtotal, tax, tip, total; auto-close order; reset table `occupied = false`
- [x] **Settings module** — `GET`/`PATCH /settings/tax-rate`, `GET`/`PATCH /settings/lockout`, `GET`/`PUT /settings/:key`
  - [x] `POST /settings/factory-reset` — PIN-confirmed wipe of all data; restores seed defaults
- [x] **Users module** — `GET`, `POST`, `PATCH`, `DELETE /users`; admin cannot delete their own account
- [x] **Stations module** — `POST /stations/register`, `GET /stations`, `DELETE /stations/{id}`; MAC-bound license token issuance and revocation (per spec §15)
- [x] **Printers module** — `GET`, `POST`, `PATCH`, `DELETE /printers`; `POST /printers/{id}/test` (ESC/POS TCP ping)
- [x] **Reports module** — `GET /reports/daily`, `GET /reports/tables` (per spec §6 Reporting)

---

## Phase 3 — Real-time & Print

> Event shapes defined in spec §7. Print paths defined in spec §8.

- [x] **Event bus** — wire in-process `EventEmitter`; define event envelope (`event`, `version`, `timestamp`, `id`, `data`)
- [x] **WebSocket gateway** — NestJS Gateway (Socket.IO or ws); broadcast `order.created`, `order.updated`, `order.item_status_changed`, `payment.completed` to all connected stations
- [x] **Print service**
  - [x] Subscribe to `order.created` / `order.updated` via EventEmitter
  - [x] Filter newly-added items per round
  - [x] `KITCHEN` path — format ESC/POS kitchen ticket, send via Ethernet TCP (retry ×3, exponential backoff, dead-letter queue — per spec §8)
  - [x] `BAR` path — emit WebSocket event to bar station; station handles client-side printing
  - [x] `NONE` — no action

---

## Phase 4 — Client (Electron + React)

> UI wireframes and kit in spec §11–§12.

- [x] Electron app shell — main process setup, IPC bridge, auto-reconnect WebSocket (blocks UI on disconnect — per spec §14)
- [x] First-launch setup flow: server IP prompt → printer detection → `POST /stations/register` → store license token
- [x] First-run admin creation: `GET /auth/setup-status` check → in-app two-step screen (name + 4-digit PIN with confirmation) → `POST /auth/bootstrap`
- [x] PIN policy: exactly 4 digits, enforced client and server; bcrypt-hashed at rest
- [x] License validation on every startup and reconnect (per spec §15)
- [x] Implement React screens:
  - [x] **Table view** — floor plan tabs, canvas layout, occupied/open/closed states (per spec §11.1)
  - [x] **Order screen** — menu browse, item selection, modifier picker, notes, submit (per spec §11.2)
  - [x] **Kitchen screen** — ticket display with modifiers, `PREPARING` / `READY` actions (per spec §11.3)
  - [x] **Payment screen** — subtotal, tax, tip selector, Cash / External Card (per spec §11.4)
  - [x] **Bar screen** — current-round BAR items only, modifier display, status actions (per spec §11.5)
  - [x] **Back office** — floor plan editor, menu management, modifiers, users, printers, settings, reporting (per spec §16)
    - [x] Factory reset — two-step confirmation (warning + admin PIN entry)
- [x] Client-side printing: bar chit (on BAR WebSocket event), guest receipt (on `payment.completed` + ad-hoc reprint)

---

## Phase 5 — Packaging & Install

> Install behaviour defined in spec §9.

- [ ] **Server installer**
  - [ ] Bundle NestJS API + print worker to single executable (`pkg` / `@vercel/ncc`)
  - [ ] Embed PostgreSQL — no separate DB install
  - [ ] Register as Windows Service / macOS LaunchDaemon (auto-start on boot)
  - [ ] System tray icon with Start / Stop / Status controls
  - [ ] First-run wizard: confirm LAN IP, create initial admin PIN
  - [ ] Build `.exe` (Windows) and `.pkg` (macOS)
- [ ] **Station installer**
  - [ ] Standard Electron packager output
  - [ ] Build `.exe` (Windows) and `.dmg` (macOS)

---

## Deferred / TBD

- [ ] Backup strategy — nightly `pg_dump` to external drive / NAS (per spec §10)
- [ ] Split bill — reserved, no API or data model yet (per spec §11.4)
- [ ] Advanced reporting / analytics dashboard (per spec §17)
- [ ] Inventory management (per spec §17)
- [ ] Multi-location sync (per spec §17)
