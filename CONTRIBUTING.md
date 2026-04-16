# Contributing to RapidTicket

Thanks for your interest in contributing. RapidTicket is a LAN-only point-of-sale system built for speed and reliability — please keep that philosophy in mind when proposing changes.

---

## Getting Started

1. Fork the repository and clone your fork.
2. Install dependencies from the repo root:
   ```bash
   npm install
   ```
3. Set up PostgreSQL (see [README.md](README.md#database-setup)).
4. Run the server and client in development mode:
   ```bash
   cd server && npm run start:dev
   cd client && npm run electron:dev
   ```

---

## Branching

| Branch | Purpose |
|---|---|
| `main` | Stable, always deployable |
| `dev` | Active development |
| `feature/<name>` | New features |
| `fix/<name>` | Bug fixes |

Branch off `dev` for all new work. Open PRs targeting `dev`.

---

## Commit Style

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add split payment support
fix: resolve KDS not updating on item void
chore: upgrade NestJS to v11
docs: update database setup instructions
```

---

## Code Style

- **TypeScript** everywhere — no untyped `any` unless unavoidable.
- Backend follows NestJS module conventions (controller → service → entity).
- Client components live in `client/src/screens/` with co-located `.module.css`.
- Shared types live in `shared/src/` and are imported by both sides.
- Run the linter before pushing: `npm run lint` (in `server/` or `client/`).

---

## Pull Requests

- Keep PRs focused — one feature or fix per PR.
- Fill out the PR template completely.
- PRs require at least one review before merging to `dev`.
- Ensure `npm run lint` and any tests pass before requesting review.

---

## Reporting Bugs

Open a GitHub Issue using the **Bug Report** template. Include steps to reproduce, expected vs actual behaviour, and your OS/Node version.

---

## License

By contributing, you agree that your contributions will be licensed under the [Apache 2.0 License](LICENSE).
