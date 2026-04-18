# Changelog

All notable changes to RapidTicket will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- Initial project setup with NestJS backend and Electron/React/Vite client
- LAN-only architecture — no internet dependency
- PostgreSQL database with auto-migrating TypeORM setup
- WebSocket (Socket.IO) realtime sync between server and all stations
- Station setup wizard on first launch
- Role-based login (admin, staff)
- Table view with floor plan support
- Order screen with item selection, modifiers, and quantity controls
- Kitchen display screen (KDS)
- Bar screen
- Back office panel
- ESC/POS printing over Ethernet TCP (server-managed)
- Local printing via OS driver (client-managed)
- Payment screen
- Menu item and category image support — upload, display, and delete images (JPEG, PNG, WebP; max 2 MB) via Back Office
- Images shown on Order Screen: category thumbnails, menu item cards, and modifier picker modal
- `@Public()` decorator for unauthenticated route access (used for image endpoints)
- Server startup now logs LAN IP address for easier station setup
- Contributing, Security, and Code of Conduct sections added to README

### Changed
- Setup wizard defaults to `http://localhost:3000` in browser and `http://192.168.1.10:3000` in Electron
- Setup connectivity check now targets `/auth/setup-status` (a public endpoint) with a 5-second timeout
- Factory reset clears local station config and triggers a full app reload to restart the setup wizard
- Back Office disables "Add Table" when no floor plan exists and "Add Menu Item" when no categories exist

---

<!-- Versions below this line are released -->

<!-- Example format:
## [1.0.0] - 2026-XX-XX
### Added
### Changed
### Fixed
### Removed
-->
