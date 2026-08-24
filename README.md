# Take Me Team Portal

> A secure, mobile-ready internal workspace for Take Me Group employees, managers, and administrators.

[![Portal quality gate](https://github.com/mrizwan-cmd/take-me-team-portal/actions/workflows/ci.yml/badge.svg)](https://github.com/mrizwan-cmd/take-me-team-portal/actions/workflows/ci.yml)

The Take Me Team Portal brings day-to-day company work into one branded application. It combines employee self-service, requests and approvals, direct messaging, project collaboration, documents, company knowledge, operations, Google Workspace tools, and administration in a responsive web app that can also be installed on Android and iPhone.

This repository is private and intended for Take Me Group development and deployment.

## Project status

The portal is in **pre-production validation**. The application builds successfully, passes its automated test suite, and has deployment guidance for Vercel testing and Forge production. It must not be approved for production until the checks in [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) are complete.

The latest hardening pass added participant-scoped direct-message realtime delivery, server and client membership checks, and atomic multi-feature database updates that roll back completely when any revision conflicts.

## What the portal includes

| Area | Capabilities |
| --- | --- |
| Home | Personal dashboard, upcoming work, company updates, shortcuts, and notifications |
| Requests & approvals | Employee requests, purchase requests, manager decisions, status tracking, and audit history |
| Projects | Boards, lists, cards, templates, automations, assignments, comments, and collaboration controls |
| Direct messages | One-to-one employee conversations, attachments, typing indicators, message receipts, search, and notifications |
| People | Google-authenticated employee directory, profile details, roles, departments, and availability |
| Work tools | Tasks, calendar, leave, shifts, handovers, documents, articles, and knowledge resources |
| Operations | Drivers, vehicles, incidents, services, and operational records |
| Administration | Feature controls, role configuration, integrations, branding, communication settings, and system health |
| Google Workspace | Company login plus separately authorized Calendar and Drive access |

## Experience and design

- Official Take Me branding and primary colour
- Responsive desktop, tablet, and mobile layouts
- Installable progressive web app for Android and iOS
- One-handed mobile navigation, safe-area support, and touch-sized controls
- Dark mode, reduced-motion preference, keyboard navigation, and accessibility linting
- Offline application shell without caching private company API responses
- Background synchronization with optional authenticated WebSocket updates

## Technology

- Next.js 16 and React 19
- TypeScript with strict validation
- PostgreSQL persistence with project migrations
- Private Vercel Blob or S3-compatible object storage
- Google OpenID Connect, Calendar, and Drive integrations
- Authenticated `ws` realtime gateway with polling fallback
- Node.js test runner, ESLint, and GitHub Actions

## Security model

Production access is restricted to the configured Google Workspace domain. The server verifies Google identity claims and creates a signed, HTTP-only portal session. Administrator and approval permissions are enforced by API routes, not only hidden in the interface.

The portal also provides:

- Same-origin checks on mutation routes
- Per-user storage for personal data and integration credentials
- AES-GCM encryption for stored Google OAuth credentials
- Private file records and authenticated download routes
- File type and 20 MB size limits
- Semantic payload validation and revision-based conflict detection
- Separate secrets and data stores for testing and production

Never commit `.env.local`, OAuth secrets, session secrets, database credentials, or storage tokens. The included [.env.example](./.env.example) contains placeholders only.

## Local development

### Requirements

- Node.js 22.13 or newer
- npm
- Optional PostgreSQL and object storage for integration testing

### Start the portal

```powershell
Copy-Item .env.example .env.local
npm.cmd install
npm.cmd run dev
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000).

Localhost uses a development-only administrator identity unless `PORTAL_FORCE_GOOGLE_LOGIN=true`. When database and storage settings are empty, local records and uploads use the ignored `.portal-data` directory. Non-local environments fail closed until their required services and secure settings are configured.

## Environment configuration

The full configuration template is in [.env.example](./.env.example). Important groups include:

- `DATABASE_*` for PostgreSQL
- `BLOB_*` or `S3_*` for private file storage
- `PORTAL_*` for sessions, company-domain access, administrators, and managers
- `GOOGLE_*` for company login, Calendar, Drive, and encrypted token storage
- `REALTIME_*` for the optional Forge WebSocket gateway
- `TEMP_ADMIN_*` for short-lived initial setup outside production

Temporary administrator login is disabled in production and should be removed from every deployed environment as soon as Google company login is verified.

## Database setup

Apply the included migrations before starting a connected environment:

```powershell
npm.cmd run db:migrate
```

Use separate PostgreSQL databases for local development, Vercel testing, and Forge production.

## Quality checks

```powershell
npm.cmd run lint
npx.cmd tsc --noEmit
npm.cmd test
npm.cmd audit --audit-level=high
```

`npm.cmd test` creates a production build before running the contract and regression tests. GitHub Actions repeats linting, strict TypeScript validation, the production build, and the full test suite on pushes and pull requests.

## Deployment

The same Next.js application can run in both supported environments:

- **Vercel testing:** stable test URL, isolated database and storage, polling-based synchronization, and optional external realtime gateway.
- **Forge production:** Node.js application daemon, PostgreSQL, private object storage, Nginx, SSL, and the included realtime WebSocket daemon.

Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for platform configuration, OAuth callback addresses, migration commands, Forge daemons, Nginx routing, and release checks.

## Mobile installation

- **Android:** open the production HTTPS address in Chrome and choose **Install app**.
- **iPhone or iPad:** open it in Safari, select **Share**, then **Add to Home Screen**.

The offline shell can open without a connection, but company records remain server-protected and require a network connection to load or save.

## Repository guide

```text
app/          Portal screens, client state, authentication, and API routes
db/           Database access and migrations
lib/          Shared infrastructure, including object storage
public/       Take Me branding and progressive-web-app assets
realtime/     Optional authenticated WebSocket gateway
scripts/      Operational scripts, including database migration
tests/        Security, persistence, realtime, UI, and regression contracts
```

## Production approval

A successful build is not production approval. Before launch, complete every item in [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md), including live role testing, external-account rejection, Google integration checks, file-security decisions, backups, retention, accessibility review, and multi-user staging acceptance.

---

Built for [Take Me Group](https://www.takeme.taxi/).
