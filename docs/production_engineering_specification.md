# RapidTicket — Production Engineering Specification

## 1. System Overview

RapidTicket is a LAN-only, server-dependent POS system designed for restaurants and bars.

### 1.1 Tech Stack

| Layer | Technology |
|---|---|
| **Database** | PostgreSQL |
| **Backend / API** | NestJS (Node.js + TypeScript) |
| **Event Bus** | Node.js `EventEmitter` (in-process, no external broker) |
| **WebSocket** | NestJS Gateway (Socket.IO or ws) |
| **UI Framework** | React (renders inside Electron's bundled Chromium shell) |
| **Client Stations** | Electron — standalone desktop application (`.exe` / `.app`), installs like any native app on Windows & macOS. UI renders inside a bundled Chromium shell with no browser required. Full OS-level access via Node.js (printer detection, MAC address, file system). |
| **Station Printing** | Each station has one locally attached printer (OS driver); used for bar chits, guest receipts, or any other client-side print job assigned to that station |
| **Kitchen Printing** | ESC/POS over Ethernet TCP, server-managed (no dedicated machine at the kitchen station) |
| **Server Install** | Native `.exe` (Windows) / `.pkg` (macOS) — bundles API, print worker, and embedded PostgreSQL; registers as a system service |
| **Station Install** | Electron `.exe` (Windows) / `.dmg` (macOS) — standard desktop install, no server-side components |

---

### 1.2 Core Characteristics

- No internet access required
- Runs entirely on local network
- Central server + multiple client stations
- **Client stations:** Electron desktop application — installed as a native executable (`.exe` on Windows, `.app` on macOS). Not a browser app. The UI uses web technologies (React) rendered inside a bundled Chromium shell, fully isolated from any browser. Node.js provides OS-level access for printer detection, MAC address binding, and local hardware integration.
- **No offline fallback:** if a station cannot reach the server, all actions are blocked until connectivity is restored. No local caching or degraded mode.
- Real-time sync across devices
- Hybrid printing — three distinct print paths; kitchen and bar routing is configured per menu item in the back office:
  - **Kitchen ticket** → server-routed via Ethernet TCP to the kitchen printer (items where `printDestination = KITCHEN`, newly added per round)
  - **Bar chit** → client-side, printed from the bar station to its locally attached printer (items where `printDestination = BAR`, newly added per round — not cumulative)
  - **Guest receipt** → client-side, printed locally from the station via its attached printer; server always prompts after payment, ad-hoc reprint available on demand

---

## 2. High-Level Architecture

```
            ┌────────────────────────────┐
            │     Client Stations        │
            │ (Bar + Floor Devices)      │
            └──────────┬─────────────────┘
                       │ REST + WebSocket
                       ▼
        ┌───────────────────────────────────────┐
        │        RapidTicket Server             │
        │---------------------------------------│
        │ API Layer (NestJS)                    │
        │ Realtime Gateway (WebSocket)          │
        │ Print Service                         │
        │ Event Bus (in-process EventEmitter)   │
        └──────────┬──────────────────────┬─────┘
                   │                      │
                   ▼                      ▼
          ┌──────────────┐    ┌──────────────────┐
          │ PostgreSQL   │    │ Kitchen Printer  │
          │ (embedded)   │    │ (Ethernet TCP)   │
          └──────────────┘    └──────────────────┘

  Client Station (local)
          ┌──────────────────────────┐
          │  Attached Printer        │
          │  (USB / Bluetooth)       │
          └──────────────────────────┘
```

---

## 3. Core Services

### 3.1 API Service

- REST endpoints
- Auth (PIN-based)
- Order lifecycle
- Menu management
- Back office configuration (tables, printers, menu items, settings)

### 3.2 Realtime Service

- WebSocket server
- Broadcasts events to clients
- Keeps all stations in sync

### 3.3 Print Service

- Subscribes to order events
- Evaluates each newly-added item's `print_destination` (set in the back office per menu item) and routes accordingly:
  - `KITCHEN` → server-routed via Ethernet TCP to the kitchen printer
  - `BAR` → event delivered to bar station via WebSocket; bar station prints to its locally attached printer (client-side)
  - `NONE` → no print action
- All client-side printing (bar chits, guest receipts) is handled by the station using its locally attached printer; the server has no direct involvement

### 3.4 Event Bus

- Node.js `EventEmitter` (in-process)
- Decouples the API, Realtime Gateway, and Print Service without any external broker
- All server components run in the same process; no Redis or inter-process communication required

---

## 4. Data Flow (End-to-End)

### Order Creation Flow

1. Client sends `POST /orders`
2. API writes to DB; newly-added items are flagged for this submission round; table `occupied` is set to `true`
3. Event published → `order.created` / `order.updated`
4. Realtime pushes to all clients
5. Newly-added items are routed by their configured `print_destination`:
   - `KITCHEN` → Print Service sends kitchen ticket via Ethernet TCP to kitchen printer (server-managed)
   - `BAR` → WebSocket event delivered to bar station; bar station prints chit locally to its attached printer (client-managed, this round's items only)
   - `NONE` → no print action
   - Each item's `is_taxable` flag (configured in back office) drives tax computation
6. After payment, client station is prompted to print guest receipt via its attached printer
7. Station always offers ad-hoc receipt reprint from the order screen

---

## 5. Database Schema (Production)

### Users

- `id`: UUID (PK)
- `name`: TEXT
- `role`: ENUM (admin, server, bartender)
- `pin_hash`: TEXT
- `created_at`: TIMESTAMP

### FloorPlans

> Represents a named area of the venue (e.g., "Main Floor", "Bar", "Patio", "Upstairs"). A business can have any number of floor plans.

- `id`: UUID
- `name`: TEXT
- `sort_order`: INT

### Tables

- `id`: UUID
- `floor_plan_id`: UUID — which floor plan this table belongs to
- `name`: TEXT (e.g., "T1", "Bar 3", "Booth 2")
- `shape`: ENUM (ROUND, RECTANGLE) — used for visual rendering on the floor plan canvas
- `position_x`: INT — x coordinate on the floor plan canvas (pixels)
- `position_y`: INT — y coordinate on the floor plan canvas (pixels)
- `status`: ENUM (OPEN, CLOSED) — whether the table is available for service (`OPEN`) or removed from service (`CLOSED`); admin-controlled
- `occupied`: BOOLEAN — server-managed; set to `true` automatically when an order is created on this table, set back to `false` when the order is closed after payment

### Seats

- `id`: UUID
- `table_id`: UUID
- `label`: TEXT — admin-defined label (e.g., "1", "2", "A", "Window")

### Orders

- `id`: UUID
- `table_id`: UUID
- `created_by`: UUID — references `Users.id`; the staff member who opened the order
- `status`: ENUM (OPEN, SENT, READY, CLOSED) — server-managed; transitions are automatic:
  - `OPEN` — order created; items are still being built and submitted by staff
  - `SENT` — auto-set by server on the first `POST /orders` call once items have been dispatched to kitchen/bar; subsequent `PATCH /orders/{id}` rounds leave status as `SENT`
  - `READY` — auto-set by server when all `OrderItems` reach `READY` status
  - `CLOSED` — auto-set by server when `POST /payments` completes successfully; table `occupied` is reset to `false`
- `subtotal`: DECIMAL(10,2) — sum of all items (taxable and non-taxable)
- `taxable_subtotal`: DECIMAL(10,2) — sum of items where `is_taxable = true` (determined by per-item back office config)
- `tax_amount`: DECIMAL(10,2) — tax applied to taxable_subtotal only
- `total`: DECIMAL(10,2) — subtotal + tax_amount
- `created_at`: TIMESTAMP
- `updated_at`: TIMESTAMP

### OrderItems

- `id`: UUID
- `order_id`: UUID
- `menu_item_id`: UUID
- `quantity`: INT
- `unit_price`: DECIMAL(10,2) — snapshot of the item's base price at time of order; modifier price deltas are stored separately in `OrderItemModifiers`
- `is_taxable`: BOOLEAN — snapshot of the item's taxability flag at time of order (set per item in back office)
- `notes`: TEXT
- `status`: ENUM (NEW, SENT, PREPARING, READY)
  - `NEW` — item just added; not yet dispatched
  - `SENT` — auto-set by server when the submission round is processed and the item has been dispatched (kitchen ticket sent or BAR event published)
  - `PREPARING` — manually set by kitchen or bar staff via `PATCH /orders/{id}/items/{itemId}`
  - `READY` — manually set by kitchen or bar staff; triggers `order.item_status_changed` broadcast

### OrderItemModifiers

> Records the modifiers applied to a specific order item. All fields are snapshotted at time of order so historical records are preserved even if modifiers are later changed.

- `id`: UUID
- `order_item_id`: UUID
- `modifier_id`: UUID — references `MenuItemModifiers.id`
- `label`: TEXT — snapshot of modifier label at time of order
- `action`: ENUM (ADD, REMOVE) — snapshot
- `price_delta`: DECIMAL(10,2) — snapshot of additional charge at time of order

### MenuItems

- `id`: UUID
- `name`: TEXT
- `category_id`: UUID
- `price`: DECIMAL(10,2)
- `type`: ENUM (FOOD, DRINK) — used for display grouping only
- `is_taxable`: BOOLEAN — admin-configured; drives whether this item is included in taxable subtotal
- `print_destination`: ENUM (KITCHEN, BAR, NONE) — admin-configured; `KITCHEN` routes to the server-managed kitchen printer via Ethernet TCP; `BAR` routes the event to the bar station, which prints locally to its attached printer; `NONE` skips printing
- `is_available`: BOOLEAN
- `sort_order`: INT

> **No hardcoded business logic.** Taxability and print routing are fully driven by per-item settings configured in the back office. A beer could route to `BAR` and be taxable; a bottled water could be `NONE` and non-taxable; a cocktail that requires kitchen prep could route to `KITCHEN`. The application enforces whatever the admin configures.

### MenuItemModifiers

> Defines the configurable add/remove modifier options for a menu item. Set up per item in the back office. Shown to staff on the order screen when the item is selected.

- `id`: UUID
- `menu_item_id`: UUID
- `label`: TEXT — display name (e.g., "Bacon", "Fried Egg", "Lettuce", "Tomato")
- `action`: ENUM (ADD, REMOVE)
- `price_delta`: DECIMAL(10,2) — additional charge for ADD modifiers; must be `0.00` for REMOVE modifiers
- `sort_order`: INT

### Categories

- `id`: UUID
- `name`: TEXT
- `sort_order`: INT

### Payments

- `id`: UUID
- `order_id`: UUID
- `subtotal`: DECIMAL(10,2)
- `taxable_subtotal`: DECIMAL(10,2) — sum of items where `is_taxable = true`
- `tax_rate`: DECIMAL(5,4) — snapshot of rate at time of payment
- `tax_amount`: DECIMAL(10,2)
- `tip_amount`: DECIMAL(10,2) — optional, defaults to 0
- `total`: DECIMAL(10,2) — subtotal + tax_amount + tip_amount
- `method`: ENUM (CASH, CARD_EXTERNAL)
- `status`: ENUM (PENDING, COMPLETED)
- `created_at`: TIMESTAMP

### Settings

- `key`: TEXT (PK) — e.g. `tax_rate`
- `value`: TEXT
- `updated_at`: TIMESTAMP

> Default entries:
> - `{ key: 'tax_rate', value: '0.0875' }` — tax rate (8.75% default, override per deployment)
> - `{ key: 'pin_lockout_threshold', value: '5' }` — failed PIN attempts before station lockout
> - `{ key: 'pin_lockout_duration', value: '300' }` — lockout duration in seconds (`0` = indefinite until admin reset)
> - `{ key: 'auto_logout', value: 'true' }` — log staff out after sending an order or completing a payment
> - `{ key: 'auto_logout_timeout', value: '120' }` — seconds of inactivity before automatic logout; `0` disables idle timeout while keeping post-action logout

### Stations

- `id`: UUID
- `name`: TEXT
- `mac_address`: TEXT — used for license binding
- `license_token`: TEXT — signed token issued at install time
- `printer_type`: ENUM (USB, BLUETOOTH, NONE) — connection type of the locally attached printer
- `printer_name`: TEXT (nullable) — OS-level printer name as detected on the station at setup time; `null` if no printer is attached
- `created_at`: TIMESTAMP

### Printers

> Only server-managed printers (Ethernet TCP). Station printers are physically attached to client machines and are not registered here.

- `id`: UUID
- `name`: TEXT
- `ip_address`: TEXT
- `port`: INT (default 9100)
- `type`: ENUM (KITCHEN) — only kitchen printers are server-managed; all other printers are attached directly to station machines

---

## 6. API Specification (Detailed)

### Auth

#### `GET /auth/setup-status`

> Returns whether the system has been bootstrapped (i.e., at least one admin user exists). Called by the client on startup to decide whether to show the first-run screen or the login screen.

**Response**

```json
{
  "needsSetup": true
}
```

---

#### `POST /auth/bootstrap`

> Creates the first admin account. Only succeeds when no users exist (`needsSetup: true`). Returns a JWT token and user object so the client is immediately logged in.

**Request**

```json
{
  "name": "Jane Smith",
  "pin": "1234"
}
```

**Response**

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "name": "Jane Smith",
    "role": "admin"
  }
}
```

---

#### `POST /auth/login`

**Request**

```json
{
  "pin": "1234"
}
```

**Response**

```json
{
  "token": "jwt-token",
  "user": {
    "id": "uuid",
    "name": "Alice",
    "role": "server"
  }
}
```

#### `POST /auth/logout`

> Invalidates the current session token.

**Response**

```json
{
  "success": true
}
```

---

### Stations

#### `POST /stations/register`

> Called during station software install. The server generates and returns a signed license bound to the station's MAC address. The station also reports its locally detected printer so the configuration is stored server-side and survives reinstalls.

**Request**

> `printerType` and `printerName` are optional — omitted or set to `NONE` if no printer is attached to this station.

```json
{
  "stationName": "Bar Station 1",
  "macAddress": "aa:bb:cc:dd:ee:ff",
  "printerType": "USB",
  "printerName": "EPSON TM-T88VII"
}
```

**Response**

```json
{
  "stationId": "uuid",
  "license": "signed-license-token"
}
```

---

#### `GET /stations`

> Requires `admin` role. Returns all registered stations.

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Bar Station 1",
    "macAddress": "aa:bb:cc:dd:ee:ff",
    "printerType": "USB",
    "printerName": "EPSON TM-T88VII",
    "createdAt": "ISO8601"
  }
]
```

#### `DELETE /stations/{id}`

> Requires `admin` role. Decommissions a station — its license token is revoked and the MAC binding is removed.

**Response**

```json
{
  "success": true
}
```

---

### Tables

#### `GET /tables`

> Filter by `?floorPlanId=uuid` to get tables for a specific area.

**Response**

```json
[
  {
    "id": "uuid",
    "floorPlanId": "uuid",
    "floorPlanName": "Main Floor",
    "name": "T1",
    "shape": "RECTANGLE",
    "positionX": 120,
    "positionY": 80,
    "status": "OPEN",
    "occupied": false,
    "seatCount": 4
  }
]
```

### FloorPlans

#### `GET /floor-plans`

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Main Floor",
    "sortOrder": 1
  }
]
```

---

### Menu

#### `GET /menu/categories`

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Burgers",
    "sortOrder": 1
  }
]
```

#### `GET /menu/items`

> Filter by `?categoryId=uuid` or `?type=FOOD|DRINK`.

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Burger",
    "categoryId": "uuid",
    "price": 12.00,
    "type": "FOOD",
    "isTaxable": true,
    "printDestination": "KITCHEN",
    "isAvailable": true,
    "sortOrder": 1,
    "modifiers": [
      { "id": "uuid", "label": "Bacon", "action": "ADD", "priceDelta": 1.50, "sortOrder": 1 },
      { "id": "uuid", "label": "Fried Egg", "action": "ADD", "priceDelta": 1.00, "sortOrder": 2 },
      { "id": "uuid", "label": "Lettuce", "action": "REMOVE", "priceDelta": 0.00, "sortOrder": 1 },
      { "id": "uuid", "label": "Tomato", "action": "REMOVE", "priceDelta": 0.00, "sortOrder": 2 }
    ]
  }
]
```

#### `POST /menu/items`

> Requires `admin` role. Creates a new menu item with its back office configuration.

**Request**

```json
{
  "name": "Craft Beer",
  "categoryId": "uuid",
  "price": 7.50,
  "type": "DRINK",
  "isTaxable": true,
  "printDestination": "BAR",
  "isAvailable": true,
  "sortOrder": 2
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Craft Beer",
  "isTaxable": true,
  "printDestination": "BAR"
}
```

#### `PATCH /menu/items/{id}`

> Requires `admin` role. Update any item field including `isTaxable` and `printDestination`.

**Request**

```json
{
  "isTaxable": false,
  "printDestination": "NONE"
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Craft Beer",
  "isTaxable": false,
  "printDestination": "NONE"
}
```

#### `DELETE /menu/items/{id}`

> Requires `admin` role. Only allowed if the item has no order history. To retire an item while preserving history, set `isAvailable: false` instead.

#### `GET /menu/items/{id}/modifiers`

> Returns all configured modifier options for a menu item.

**Response**

```json
[
  { "id": "uuid", "label": "Bacon", "action": "ADD", "priceDelta": 1.50, "sortOrder": 1 },
  { "id": "uuid", "label": "Lettuce", "action": "REMOVE", "priceDelta": 0.00, "sortOrder": 2 }
]
```

#### `POST /menu/items/{id}/modifiers`

> Requires `admin` role.

**Request**

```json
{
  "label": "Fried Egg",
  "action": "ADD",
  "priceDelta": 1.00,
  "sortOrder": 3
}
```

**Response**

```json
{
  "id": "uuid",
  "label": "Fried Egg",
  "action": "ADD",
  "priceDelta": 1.00,
  "sortOrder": 3
}
```

#### `PATCH /menu/items/{id}/modifiers/{modifierId}`

> Requires `admin` role.

**Request**

```json
{
  "priceDelta": 1.25
}
```

**Response**

```json
{
  "id": "uuid",
  "label": "Fried Egg",
  "action": "ADD",
  "priceDelta": 1.25,
  "sortOrder": 3
}
```

#### `DELETE /menu/items/{id}/modifiers/{modifierId}`

> Requires `admin` role.

---

### Orders

#### `GET /orders`

> Returns orders. Filter by `?status=OPEN|SENT|READY|CLOSED` or `?tableId=uuid`.

**Response**

```json
[
  {
    "id": "uuid",
    "tableId": "uuid",
    "status": "OPEN",
    "total": 45.15,
    "createdAt": "ISO8601",
    "createdBy": "uuid"
  }
]
```

#### `POST /orders`

**Request**

```json
{
  "tableId": "uuid",
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 2,
      "modifierIds": ["uuid-add-bacon", "uuid-remove-lettuce"],
      "notes": "extra crispy"
    }
  ]
}
```

> `modifierIds` is optional. Each ID must reference a `MenuItemModifiers` record belonging to the same menu item. `notes` remains available for free-text instructions that don't fit a structured modifier.

**Response**

```json
{
  "id": "uuid",
  "status": "OPEN"
}
```

#### `PATCH /orders/{id}`

> Adds new items to an existing order (any subsequent round after the initial `POST /orders`). Only the newly added items are flagged for printing and status tracking in this round. Existing items are not modified.

**Request**

```json
{
  "items": [
    {
      "menuItemId": "uuid",
      "quantity": 1,
      "modifierIds": ["uuid-add-bacon"],
      "notes": "well done"
    }
  ]
}
```

**Response**

```json
{
  "id": "uuid",
  "status": "SENT",
  "items": [
    {
      "id": "uuid",
      "name": "Burger",
      "quantity": 1,
      "unitPrice": 12.00,
      "appliedModifiers": [
        { "label": "Bacon", "action": "ADD", "priceDelta": 1.50 }
      ],
      "status": "NEW"
    }
  ]
}
```

#### `GET /orders/{id}`

**Response**

```json
{
  "id": "uuid",
  "tableId": "uuid",
  "status": "OPEN",
  "subtotal": 42.00,
  "taxableSubtotal": 36.00,
  "taxAmount": 3.15,
  "total": 45.15,
  "items": [
    {
      "id": "uuid",
      "name": "Burger",
      "quantity": 2,
      "unitPrice": 12.00,
      "isTaxable": true,
      "printDestination": "KITCHEN",
      "appliedModifiers": [
        { "label": "Bacon", "action": "ADD", "priceDelta": 1.50 },
        { "label": "Lettuce", "action": "REMOVE", "priceDelta": 0.00 }
      ],
      "notes": "no onions",
      "status": "NEW"
    }
  ]
}
```

#### `PATCH /orders/{id}/items/{itemId}`

> Used by kitchen and bar screens to update item status (e.g., mark as `PREPARING` or `READY`).

**Request**

```json
{
  "status": "READY"
}
```

**Response**

```json
{
  "id": "uuid",
  "status": "READY"
}
```

### Settings

#### `GET /settings`

> Requires `admin` role. Returns all settings as a flat list.

**Response**

```json
[
  { "key": "tax_rate", "value": "0.0875" },
  { "key": "auto_logout", "value": "true" },
  { "key": "auto_logout_timeout", "value": "120" },
  { "key": "pin_lockout_threshold", "value": "5" },
  { "key": "pin_lockout_duration", "value": "300" }
]
```

#### `PUT /settings/{key}`

> Requires `admin` role. Upserts a single setting by key.

**Request**

```json
{
  "value": "true"
}
```

**Response**

```json
{
  "key": "auto_logout",
  "value": "true"
}
```

---

#### `GET /settings/tax-rate`

**Response**

```json
{
  "taxRate": 0.0875
}
```

#### `PATCH /settings/tax-rate`

> Requires `admin` role.

**Request**

```json
{
  "taxRate": 0.09
}
```

**Response**

```json
{
  "taxRate": 0.09
}
```

#### `GET /settings/lockout`

**Response**

```json
{
  "pinLockoutThreshold": 5,
  "pinLockoutDuration": 300
}
```

#### `PATCH /settings/lockout`

> Requires `admin` role.

**Request**

```json
{
  "pinLockoutThreshold": 3,
  "pinLockoutDuration": 600
}
```

**Response**

```json
{
  "pinLockoutThreshold": 3,
  "pinLockoutDuration": 600
}
```

#### `POST /settings/factory-reset`

> Requires `admin` role. Wipes all users, orders, menu items, floor plans, stations, and printers. Restores all settings to seed defaults. Requires the requesting admin's PIN as confirmation — the operation is rejected if the PIN does not match.

**Request**

```json
{
  "pin": "1234"
}
```

**Response**

```json
{
  "success": true
}
```

### Payments

#### `POST /payments`

**Request**

```json
{
  "orderId": "uuid",
  "method": "CASH",
  "tipAmount": 8.00
}
```

> `tipAmount` is optional (defaults to `0`). The server computes subtotal, taxable subtotal, and tax; `amount` = subtotal + tax_amount + tip. Tax is applied only to items where `is_taxable = true` (configured per item in the back office).

**Response**

```json
{
  "status": "COMPLETED",
  "subtotal": 42.00,
  "taxableSubtotal": 36.00,
  "taxRate": 0.0875,
  "taxAmount": 3.15,
  "tipAmount": 8.00,
  "total": 53.15
}
```

### Back Office (Admin Only)

> All endpoints in this section require `admin` role.

#### Floor Plans & Tables

##### `POST /floor-plans`

**Request**

```json
{
  "name": "Main Floor",
  "sortOrder": 1
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Main Floor",
  "sortOrder": 1
}
```

##### `PATCH /floor-plans/{id}`

**Request**

```json
{
  "name": "Ground Floor",
  "sortOrder": 2
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Ground Floor",
  "sortOrder": 2
}
```

##### `DELETE /floor-plans/{id}`

> Only allowed if the floor plan has no tables assigned to it.

---

##### `POST /tables`

> Adds a table to a floor plan at a specified canvas position.

**Request**

```json
{
  "floorPlanId": "uuid",
  "name": "T5",
  "shape": "ROUND",
  "positionX": 200,
  "positionY": 150
}
```

**Response**

```json
{
  "id": "uuid",
  "floorPlanId": "uuid",
  "name": "T5",
  "shape": "ROUND",
  "positionX": 200,
  "positionY": 150,
  "status": "OPEN",
  "occupied": false
}
```

##### `PATCH /tables/{id}`

> Update name, shape, position, or floor plan assignment.

**Request**

```json
{
  "positionX": 250,
  "positionY": 180
}
```

**Response**

```json
{
  "id": "uuid",
  "floorPlanId": "uuid",
  "name": "T5",
  "shape": "ROUND",
  "positionX": 250,
  "positionY": 180,
  "status": "OPEN",
  "occupied": false
}
```

##### `DELETE /tables/{id}`

> Only allowed if the table has no open orders.

---

##### `GET /tables/{id}/seats`

**Response**

```json
[
  { "id": "uuid", "label": "1" },
  { "id": "uuid", "label": "2" },
  { "id": "uuid", "label": "Window" }
]
```

##### `POST /tables/{id}/seats`

**Request**

```json
{
  "label": "3"
}
```

**Response**

```json
{
  "id": "uuid",
  "tableId": "uuid",
  "label": "3"
}
```

##### `PATCH /tables/{tableId}/seats/{seatId}`

**Request**

```json
{
  "label": "Corner"
}
```

**Response**

```json
{
  "id": "uuid",
  "tableId": "uuid",
  "label": "Corner"
}
```

##### `DELETE /tables/{tableId}/seats/{seatId}`

---

#### Categories

##### `POST /menu/categories`

**Request**

```json
{
  "name": "Appetizers",
  "sortOrder": 3
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Appetizers",
  "sortOrder": 3
}
```

##### `PATCH /menu/categories/{id}`

**Request**

```json
{
  "name": "Starters",
  "sortOrder": 1
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Starters",
  "sortOrder": 1
}
```

##### `DELETE /menu/categories/{id}`

> Only allowed if the category has no menu items assigned to it.

---

#### Printers

##### `GET /printers`

**Response**

```json
[
  {
    "id": "uuid",
    "name": "Kitchen Printer",
    "ipAddress": "192.168.1.50",
    "port": 9100,
    "type": "KITCHEN"
  }
]
```

##### `POST /printers`

**Request**

```json
{
  "name": "Kitchen Printer 2",
  "ipAddress": "192.168.1.51",
  "port": 9100,
  "type": "KITCHEN"
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Kitchen Printer 2",
  "ipAddress": "192.168.1.51",
  "port": 9100,
  "type": "KITCHEN"
}
```

##### `PATCH /printers/{id}`

**Request**

```json
{
  "ipAddress": "192.168.1.52"
}
```

**Response**

```json
{
  "id": "uuid",
  "name": "Kitchen Printer",
  "ipAddress": "192.168.1.52",
  "port": 9100,
  "type": "KITCHEN"
}
```

##### `DELETE /printers/{id}`

##### `POST /printers/{id}/test`

> Sends a test ESC/POS ping to verify printer connectivity.

**Response**

```json
{
  "reachable": true,
  "latencyMs": 12
}
```

---

#### Reporting

##### `GET /reports/daily`

> Returns a summary for the current business day.

**Response**

```json
{
  "date": "2026-03-23",
  "totalOrders": 42,
  "totalRevenue": 1840.50,
  "totalTax": 138.40,
  "totalTips": 220.00,
  "openTables": 3
}
```

##### `GET /reports/tables`

> Current snapshot of all table statuses with running open order totals.

**Response**

```json
[
  {
    "tableId": "uuid",
    "name": "T1",
    "floorPlanId": "uuid",
    "floorPlanName": "Main Floor",
    "status": "OPEN",
    "occupied": true,
    "openOrderTotal": 45.68,
    "openSince": "ISO8601"
  }
]
```

---

## 7. Event System (Production)

### Event Envelope

```json
{
  "event": "order.created",
  "version": "1.0",
  "timestamp": "ISO8601",
  "id": "event-uuid",
  "data": {}
}
```

### Events

#### `order.created`

```json
{
  "event": "order.created",
  "data": {
    "orderId": "uuid",
    "tableId": "uuid",
    "items": [
      {
        "orderItemId": "uuid",
        "name": "Burger",
        "quantity": 2,
        "isTaxable": true,
        "printDestination": "KITCHEN",
        "modifiers": [
          { "action": "ADD", "label": "Bacon" },
          { "action": "REMOVE", "label": "Lettuce" }
        ]
      }
    ]
  }
}
```

#### `order.updated`

> `newItems` contains only the items added in this submission round — the print service uses this list to route tickets without extra DB queries.

```json
{
  "event": "order.updated",
  "data": {
    "orderId": "uuid",
    "tableId": "uuid",
    "status": "OPEN",
    "newItems": [
      {
        "orderItemId": "uuid",
        "name": "Craft Beer",
        "quantity": 1,
        "isTaxable": true,
        "printDestination": "BAR",
        "modifiers": []
      }
    ]
  }
}
```

#### `payment.completed`

> Broadcast to all stations after a payment is finalised. Stations use this to close the table and prompt guest receipt printing.

```json
{
  "event": "payment.completed",
  "data": {
    "paymentId": "uuid",
    "orderId": "uuid",
    "tableId": "uuid",
    "subtotal": 42.00,
    "taxableSubtotal": 36.00,
    "taxRate": 0.0875,
    "taxAmount": 3.15,
    "tipAmount": 8.00,
    "total": 53.15,
    "method": "CASH"
  }
}
```

#### `order.item_status_changed`

> Broadcast when kitchen or bar marks an item as `PREPARING` or `READY`. All stations update their view in real time.

```json
{
  "event": "order.item_status_changed",
  "data": {
    "orderId": "uuid",
    "orderItemId": "uuid",
    "status": "READY"
  }
}
```

---

## 8. Print Service Design

### Print Paths

| Path | Trigger | Items | Destination | Transport |
|---|---|---|---|---|
| Kitchen ticket | `order.created` / `order.updated` | Items where `print_destination = KITCHEN` (newly added in this round) | Kitchen printer | Ethernet TCP |
| Bar chit | `order.created` / `order.updated` | Items where `print_destination = BAR` (newly added in this round — not cumulative) | Bar station's locally attached printer | Client-side (bar station) |
| Guest receipt | Client-initiated after payment | Full order summary | Station's attached printer | USB / Bluetooth |

> **Bar chit behaviour:** the bar station receives the WebSocket event and prints only items added in the current submission round. If a guest orders a beer, it prints one line. If they later order another drink, only that new drink prints — not the full drink history for the table. This tells the bartender exactly what to prepare for that delivery.

> **Receipt:** the server always prompts the station to print after a payment is completed (`payment.completed` event). The station also exposes an ad-hoc reprint button on the order screen. Receipt printing is handled entirely client-side via the station's attached printer and the server has no direct involvement.

### Server-Side Flow

1. Subscribe to `order.created` / `order.updated` via the in-process EventEmitter
2. Parse event; filter to newly-added items in this round
3. Route by each item's configured `print_destination`:
   - `KITCHEN` → format kitchen ticket, send via Ethernet TCP to kitchen printer
   - `BAR` → no server action; bar station handles printing client-side via its attached printer upon receiving the WebSocket event
   - `NONE` → no print action
4. Format ESC/POS for kitchen ticket
5. Send TCP to kitchen printer

### Reliability

- Retry: 3 attempts
- Timeout: 2–5s
- Backoff: exponential
- Dead-letter queue for failures

---

## 9. Installation & Deployment

> No Docker, no CLI, no technical knowledge required from the operator. Two native installers cover the entire system.

### Server Install — `RapidTicket-Server-Setup.exe` / `.pkg`

Installed once on the dedicated LAN server machine.

**Bundled components:**
- NestJS API + Print Worker compiled to a single Node.js executable (via `pkg` / `@vercel/ncc`)
- Embedded PostgreSQL — no separate database install required
- In-process event bus — Node.js `EventEmitter`; no Redis or external broker
`
**Install behaviour:**
- Registers the server as a **Windows Service** / **macOS LaunchDaemon** — starts automatically on boot, no user login required
- System tray icon provides Start / Stop / Status controls for operator visibility
- On first run: prompts to confirm the server's LAN IP and creates the initial admin PIN

### Station Install — `RapidTicket-Station-Setup.exe` / `.dmg`

Installed on every floor and bar device. Standard Electron desktop installer — identical to installing any native app.

**First-launch setup:**
1. Prompts for the server's static LAN IP
2. Detects the locally attached printer from the OS (if present)
3. Calls `POST /stations/register` with MAC address and printer details
4. Stores the returned license token locally

No server-side components are installed on station machines.

### Network Requirements

- Server must have a static LAN IP (e.g., `192.168.1.10`)
- Static IP for the kitchen printer (e.g., `192.168.1.50`) — only server-managed printer requiring a reserved address
- Local-only firewall rules; no internet access required

---

## 10. Backup Strategy

> **TBD — not a blocker.** Backup mechanism, retention policy, and restore procedure to be defined before production deployment. Likely approach: automated nightly `pg_dump` stored to an external drive or local NAS.

---

## 11. UI Wireframes

### 11.1 Table View

```
[ Main Floor ] [ Bar ] [ Patio ]   <- Floor plan tabs

+----------------------------------+
|  [T1]    [T2]    [T3]            |
|  (occupied) (open)  CLOSED       |
|                                  |
|     [T4]      [T5]               |
|     (open)  (occupied)           |
+----------------------------------+
```

> Tables show their name and visual state: **occupied** (has an active order), **open** (available), or **closed** (out of service). Positions reflect the configured canvas layout.

### 11.2 Order Screen

```
Menu:
[ Burger ] [ Fries ] [ Beer ]

Order:
- 2x Burger
- 1x Beer

[Submit Order]
[Print Receipt]
```

### 11.3 Kitchen Screen

```
----------------------
ORDER #102
2x Burger
  + Bacon
  - Lettuce
1x Fries

[READY]
----------------------
```

> Modifiers are printed beneath their item. `+` = ADD, `-` = REMOVE. Notes (free-text) print on the next line if present.

### 11.4 Payment Screen

```
Subtotal: $42.00
Tax (8.75%): $3.15
Tip:      [  $0  ] [15%] [18%] [20%] [Custom]
Total:    $53.15

[Cash]
[External Card]
[Split Bill]
```

> **Split Bill — TBD (not a blocker):** The `[Split Bill]` button is reserved for a future release. There is currently no API or data model for split payments. This will require its own design section covering the supported split modes (by item, by seat, or equal split).

### 11.5 Bar Screen

```
----------------------
TABLE T3 — BAR CHIT
1x Craft Beer
1x House Wine
  + Extra Ice

[PREPARING] [READY]
----------------------
```

> Shows only items with `printDestination = BAR` for the current round. Modifiers are printed beneath their item (`+` = ADD, `-` = REMOVE). Each round appears as a separate chit. Staff mark items as PREPARING or READY from this screen.

---

## 12. UI Kit

### Colors

**Primary**

- Charcoal: `#1E1E1E`
- White: `#FFFFFF`

**Accent**

- Orange: `#FF5A1F`
- Red: `#E53935`
- Green: `#43A047`

### Components

**Buttons**

- Primary: Orange
- Danger: Red
- Success: Green

**Status Indicators**

- New: Orange
- In Progress: Yellow
- Ready: Green

---

## 13. Logo Concepts

**Concept 1: Speed Ticket**

- Receipt icon with motion lines
- Emphasizes speed

**Concept 2: Kitchen Rail**

- Horizontal ticket bar (expo line)
- Industrial minimal look

**Concept 3: RT Monogram**

- Bold "RT"
- Sharp geometric style

---

## 14. Reliability Design

- **No offline mode** — stations require an active server connection at all times; no fallback, no local caching
- Idempotent APIs
- Event replay capability
- Printer retry + queue
- WebSocket auto-reconnect on dropped connection (blocks UI until reconnected)

---

## 15. Security

- LAN-only access
- JWT tokens (local signing)
- Role-based permissions
- Optional IP whitelisting
- **Staff PIN**: All staff authenticate with exactly **4-digit** PINs; stored as bcrypt hashes (12 rounds) — plaintext PIN is never persisted
- **Station Lockout**: Configurable from the back office — a station locks after X consecutive failed PIN attempts; admin sets the threshold and lockout duration via Settings (`pin_lockout_threshold`, `pin_lockout_duration`)
- **Station Licensing**: During station software install, the station calls `POST /stations/register`; the server issues a signed license token bound to the station's MAC address. The station must present a valid license on every startup and reconnection
- **First-run bootstrap**: On first startup, if no admin exists, the client shows a setup screen (`GET /auth/setup-status`). The admin enters their name and a 4-digit PIN (confirmed in a second step) and the account is created via `POST /auth/bootstrap`
- **Destructive action protection**: Factory reset requires the requesting admin's PIN as a second confirmation before execution

---

## 16. Back Office

The back office is the admin-only management interface. All business configuration lives here — nothing is hardcoded in the application.

### What the Back Office Manages

**Floor Plans & Table Layout**
- Create and manage named floor plan areas (e.g., "Main Floor", "Bar", "Patio", "Upstairs") — no limit on the number of areas
- Each floor plan has a visual canvas; tables are placed by dragging to a position
- Per table: set name, shape (round or rectangle), and canvas position
- Per table: add, rename, and remove individual seats with custom labels
- View real-time table state overlaid on the floor plan: **occupied** (active order), **open** (available), **closed** (out of service)

**Menu Items**
- Create and edit items with full configuration:
  - Name, category, price, display sort order
  - `isTaxable` — whether this item is included in the taxable subtotal
  - `printDestination` — where the ticket is routed (`KITCHEN` = server sends to kitchen printer via TCP; `BAR` = station prints locally; `NONE` = no print)
  - `isAvailable` — toggle item visibility on the order screen
- No hardcoded routing or tax rules; every decision is per-item

**Modifiers**
- Per menu item: configure the structured add/remove options available to staff when placing an order
- Each modifier has a label, action (`ADD` or `REMOVE`), optional price delta for paid add-ons, and sort order
- Examples: Item = Burger → ADD: Bacon (+$1.50), Fried Egg (+$1.00) / REMOVE: Lettuce, Tomato
- Selected modifiers are snapshotted on the order item and printed on kitchen/bar tickets so staff see exact build instructions
- Free-text `notes` remain available for instructions that don't fit a structured modifier

**Categories**
- Create and sort menu categories

**Printers**
- Register kitchen printers (IP, port) — station printers are attached directly to station machines and do not require server-side registration
- Test printer connectivity

**Settings**
- Tax rate
- Auto-logout (toggle) and idle timeout duration
- PIN lockout threshold and duration
- Factory Reset — wipes all data and restores defaults; requires admin PIN confirmation

**Users**
- Add, edit, and delete staff accounts
- Set name, role (`admin`, `server`, `bartender`), and 4-digit PIN
- Admins cannot delete their own account

**Reporting (Read-Only)**
- Open / occupied table counts at a glance
- Daily sales total
- Per-table order summaries

---

## 17. Future Enhancements

- Inventory management
- Reporting dashboard (already in back office, advanced analytics TBD)
- Multi-location sync (manual export/import)
- Advanced terminal integrations
