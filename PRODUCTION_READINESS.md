# Production readiness

## Automated checks completed

- Production build succeeds.
- ESLint and strict TypeScript checks succeed.
- Rendered portal and security contract tests succeed.
- Live npm production-dependency audit reports zero known vulnerabilities.
- Employee and Admin navigation, profile settings, quick-create forms, new conversations, responsive layouts, calendar controls, notification shortcuts, request-to-approval workflow, conflict-safe persistence, and API failure paths were exercised locally.

## Required before approval

- [ ] Create separate Vercel testing and Forge production environments with different databases, storage buckets and encryption/session secrets.
- [ ] Set `PORTAL_ALLOWED_DOMAIN`, a 32+ character `PORTAL_SESSION_SECRET`, `PORTAL_ADMIN_EMAILS`, and `PORTAL_MANAGER_EMAILS` in secure runtime settings.
- [ ] Remove all `TEMP_ADMIN_*` environment variables immediately after Google login has been configured and verified.
- [ ] Configure production PostgreSQL and private S3-compatible storage, then apply `npm run db:migrate`.
- [ ] Configure the Google Cloud OAuth consent screen, Client ID, Client Secret, Workspace domain, token encryption key, and both production redirects: `/api/auth/google/login/callback` and `/api/auth/google/callback`.
- [ ] Live-test login with an employee account, a logged-out session, cancelled consent, an expired login attempt, and a personal/external Google account; verify the external account is rejected.
- [ ] Verify sign-out clears the portal session and protected APIs return 401 afterwards.
- [ ] Live-test Google Calendar create, edit, cancel, attendee updates, Meet links, token refresh, and reconnect with at least two different employee accounts.
- [ ] Live-test Google Drive browsing with least-privilege scopes and Shared Drive permissions.
- [ ] Decide whether employee uploads require malware scanning, data-loss prevention, and/or administrator review before broad use.
- [ ] Define PostgreSQL and object-storage backup, restore, retention, legal hold, and employee offboarding procedures.
- [ ] Confirm accessibility with keyboard-only navigation and assistive technology in the production browser matrix.
- [ ] Run staging acceptance tests with an administrator, manager, ordinary employee, suspended/leaver account, and an external-domain account.
- [ ] Replace or disable any organisation-specific connector whose real API credentials and contract are not yet configured.

## Approval rule

Production approval is granted only after every required item above is completed and the deployed staging URL passes the same automated and live checks. A successful local build alone is not production approval.
