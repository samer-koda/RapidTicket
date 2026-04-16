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

---

<!-- Versions below this line are released -->

<!-- Example format:
## [1.0.0] - 2026-XX-XX
### Added
### Changed
### Fixed
### Removed
-->
