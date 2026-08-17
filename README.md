# Take Me Team Portal

Internal company portal for Take Me Group, branded for [takeme.taxi](https://www.takeme.taxi/). It includes employee self-service, approvals, purchase requests, calendar and Drive access, chat, people, knowledge, documents, leave, operations, and a complete Admin area.

## Local use

1. Copy `.env.example` to `.env.local` and fill only the values needed for local integration testing.
2. Run `npm.cmd run dev`.
3. Open `http://127.0.0.1:3000/`.

Localhost uses a development-only Muneeb Rizwan administrator identity unless `PORTAL_FORCE_GOOGLE_LOGIN=true`. Local data and uploads are stored under the ignored `.portal-data` folder when PostgreSQL and S3 values are empty. Non-local and production requests fail closed until the database, storage and Google Workspace settings are configured.

## Android and iPhone app

The portal is an installable progressive web app (PWA) with branded Android and iPhone icons, a standalone full-screen layout, mobile deep links, safe-area support, an offline connection screen, one-handed bottom navigation, touch-sized controls, mobile cards, and bottom-sheet forms.

- **Android:** open the production HTTPS address in Chrome and choose **Install app**.
- **iPhone/iPad:** open it in Safari, tap **Share**, then **Add to Home Screen**.

The app shell can open offline, but company data remains server-protected and is not stored in the offline cache. A network connection is required to load or save portal records.

## Validation

- `npm.cmd run lint` — source quality and accessibility rules
- `npx.cmd tsc --noEmit` — strict TypeScript validation
- `npm.cmd test` — production build, rendered-shell test, and security contract tests
- `npm.cmd audit --omit=dev --audit-level=moderate` — live production-dependency advisory check

## Authentication and roles

Production access uses the Take Me Google Workspace login and an eight-hour signed, HTTP-only portal session. The same standard Next.js server runs on Vercel and Forge. Configure:

- `PORTAL_ALLOWED_DOMAIN=takeme.taxi`
- `PORTAL_SESSION_SECRET` with at least 32 random characters

For initial deployment setup only, the login screen can expose a temporary one-hour administrator session when `TEMP_ADMIN_USERNAME`, `TEMP_ADMIN_PASSWORD_HASH`, `TEMP_ADMIN_EMAIL`, and a future `TEMP_ADMIN_EXPIRES_AT` are configured. The password is stored only as a `scrypt-v1` hash. Remove all four values as soon as Google login is working.
- `PORTAL_ADMIN_EMAILS` as a comma-separated list
- `PORTAL_MANAGER_EMAILS` as a comma-separated list of approval managers

The API accepts identity only from a valid signed portal-session cookie. Admin controls are enforced by the API, not only hidden in the interface. Personal tasks, calendar events, notifications, leave, shifts, preferences, and onboarding progress are stored per user. Employee requests are owner-bound and create manager approval items. Shared writes use conflict detection to avoid silently overwriting another session.

## Google Workspace

The Google domain, project ID, OAuth Client ID and Client Secret can be entered in **Admin → Integrations**. The Client Secret is encrypted before it is stored in PostgreSQL. Environment variables remain supported and take precedence when an operator wants platform-managed secrets:

- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_TOKEN_ENCRYPTION_KEY` (a long random secret)
- `PORTAL_SESSION_SECRET` (at least 32 random characters)
- optionally `GOOGLE_CLIENT_ID`, `GOOGLE_REDIRECT_URI`, `GOOGLE_LOGIN_REDIRECT_URI`, and `GOOGLE_WORKSPACE_DOMAIN`

Register both OAuth callbacks in the same Google Cloud web client:

- `https://<production-domain>/api/auth/google/login/callback` for company login
- `https://<production-domain>/api/auth/google/callback` for Calendar and Drive

The login requests only OpenID email/profile identity. Calendar and Drive permissions are requested separately when an employee connects those services. Their OAuth tokens are AES-GCM encrypted and isolated per portal user.

## Storage and uploads

The portable backend uses PostgreSQL through `DATABASE_URL` and private S3-compatible storage through the `S3_*` settings. Cloudflare R2 can still be used through its standard S3 API. Uploads are restricted to common business documents and safe image formats, limited to 20 MB, recorded in PostgreSQL, and downloaded through an authenticated route.

See [DEPLOYMENT.md](./DEPLOYMENT.md) for the Vercel testing and Forge production setup.

## Before production

Do not approve production until [PRODUCTION_READINESS.md](./PRODUCTION_READINESS.md) is complete, including isolated testing and production data, real role lists, Google OAuth consent and both callback addresses, external-account rejection, staging workflow tests, backup/retention decisions, and an uploaded-file security policy.
