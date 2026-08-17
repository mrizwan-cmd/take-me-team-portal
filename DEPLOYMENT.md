# Vercel testing and Forge production

The portal now uses one standard Next.js/Node application for both environments. Use separate databases, storage buckets and Google OAuth callback settings so testing can never modify production records.

## Shared requirements

- Node.js 22 or newer
- PostgreSQL 15 or newer
- A private S3-compatible bucket, such as Cloudflare R2, AWS S3 or Backblaze B2
- A Google Cloud OAuth web client with the Take Me Workspace domain configured

Copy the keys from `.env.example` into each platform's protected environment settings. Generate independent values for `PORTAL_SESSION_SECRET`, `GOOGLE_TOKEN_ENCRYPTION_KEY` and `REALTIME_TOKEN_SECRET` in testing and production.

The portal always refreshes shared changes in the background, so Vercel testing does not require a separate socket server. Forge can additionally run the included realtime gateway for instant chat typing, employee presence and immediate project/chat refreshes. If the gateway is unavailable, clients automatically continue with the background-sync fallback.

Configure bucket CORS to allow the stable Vercel testing origin and the Forge production origin. Allow `PUT`, `GET` and `HEAD` with the `Content-Type` header. The portal uses short-lived signed storage addresses so files up to 20 MB bypass Vercel's function payload limit while remaining private.

## Vercel testing project

1. Create a dedicated Vercel project used only for testing and connect the repository.
2. Add a managed PostgreSQL database and a private S3-compatible test bucket.
3. Add all required environment values from `.env.example`. Use `DATABASE_POOL_SIZE=1` and `DATABASE_SSL=true`.
4. Use the stable project address, for example `https://take-me-portal-test.vercel.app`, for Google OAuth. Do not use a changing per-commit preview address.
5. Register these Google redirect URIs:
   - `https://take-me-portal-test.vercel.app/api/auth/google/login/callback`
   - `https://take-me-portal-test.vercel.app/api/auth/google/callback`
6. Set `GOOGLE_LOGIN_REDIRECT_URI` and `GOOGLE_REDIRECT_URI` to those exact values.
7. Run `npm run db:migrate` once against the test `DATABASE_URL`, then deploy. Vercel will detect the included `vercel.json` and build it as Next.js.

Leave `REALTIME_URL` empty on Vercel unless you host the included gateway separately. The portal will display **Auto-sync** and refresh active browser tabs at the administrator-configured interval, which defaults to three seconds.

The portal's own Google Workspace login protects application data. Keep Vercel deployment protection enabled as an additional test-environment safeguard when your plan supports it.

## Forge production server

1. Provision a Forge server with Nginx, Node.js 22 and PostgreSQL, or use an external managed PostgreSQL database.
2. Create a Node.js site for the production domain and add the repository.
3. Configure the production environment values from `.env.example`. For PostgreSQL on the same private server use `DATABASE_SSL=false`; otherwise keep TLS enabled.
4. Register the two production Google callbacks:
   - `https://portal.takeme.taxi/api/auth/google/login/callback`
   - `https://portal.takeme.taxi/api/auth/google/callback`
5. Use this Forge deployment sequence:

   ```sh
   npm ci
   npm run db:migrate
   npm run build
   ```

6. Create a Forge daemon in the site directory with `npm start`. Set `PORT=3000` in the production environment and proxy Nginx to `http://127.0.0.1:3000`.
7. Generate a separate 32+ character `REALTIME_TOKEN_SECRET`, set `REALTIME_PORT=3001`, set `REALTIME_URL=wss://portal.takeme.taxi/realtime`, and set `REALTIME_ALLOWED_ORIGINS=https://portal.takeme.taxi`. These values must be present in both the Next.js daemon and the realtime daemon environment.
8. Create a second Forge daemon in the same site directory with `npm run realtime:start`.
9. Add this location to the site's Nginx configuration so the public secure address reaches the private daemon:

   ```nginx
   location /realtime {
       proxy_pass http://127.0.0.1:3001;
       proxy_http_version 1.1;
       proxy_set_header Upgrade $http_upgrade;
       proxy_set_header Connection "upgrade";
       proxy_set_header Host $host;
       proxy_set_header Origin $http_origin;
       proxy_read_timeout 65s;
   }
   ```

10. Enable the Forge SSL certificate before testing Google login or WebSockets. Check `https://portal.takeme.taxi/realtime/health`, then confirm the portal status changes from **Auto-sync** to **Live**.

## Release checks

After each deployment, check `/api/health` as an administrator, test login with an allowed company account and a rejected personal account, upload/download/delete a test file, create/edit/cancel one Google Calendar event, and keep two signed-in tabs open while changing a project card and sending a chat message. The second tab must update without a manual reload.
