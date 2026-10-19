# Hosted Pilot first release — controlled beta

This release adds a production API for invited customers. It is a release candidate until the live acceptance gates below pass. It does not provide an unattackable system, automated billing, automatic account onboarding, or autonomous near-identical venue reconstruction.

## Deployment topology

- Simply.com serves `dist/`, including the generated `.htaccess`.
- Supabase provides user authentication, owner-isolated projects, operator-managed Pilot access and durable quota reservations.
- A separate Linux host runs **one** Node API/Blender container behind HTTPS. Simply.com's shared webhosting does not support a listening Node server: https://www.simply.com/en/support/faq/general/837-can-i-run-nodejs-applications-on-my-webhosting/
- Customers never install Blender. The hosted API runs the fixed general Blender builder with a validated geometry blueprint. The specialised National Theatre script remains a separate local workflow.

Do not deploy Vite's development server publicly. Do not expose port 3001 externally. Do not scale the API to multiple instances: job ownership and job execution state are process-local, although usage reservations are durable in PostgreSQL.

## 1. Database and accounts

Back up the existing database. Apply unapplied files in `supabase/migrations` in filename order, including `202610190001_pilot_release.sql`, using Supabase SQL Editor. Never run `supabase/tests/security.sql` against a live database; it creates mock auth objects for an empty disposable test database.

Existing project RLS remains owner-only. New access/usage tables have RLS and no browser grants. Only the server service role can reserve usage. The reservation function locks the global quota row and checks both account and global limits atomically. Two AI units are reserved for an auto-review request; one for analysis or a single-pass plan. Failed/cancelled requests are not refunded automatically because provider work may already have been billed. A unit is a request allowance, **not a currency budget**.

Enable one confirmed test account using its UUID from Supabase Authentication:

```sql
insert into public.pilot_access(user_id, enabled, daily_ai_units, daily_builds)
values ('REPLACE_WITH_CONFIRMED_USER_UUID', true, 4, 3)
on conflict (user_id) do update set enabled = true;
update public.pilot_limits set enabled = true, daily_ai_units = 20, daily_builds = 10 where id = true;
```

These are example operational allowances, not pricing. Start conservatively, monitor provider usage and adjust deliberately. No new signup gets Pilot access automatically. Configure email confirmation, production SMTP, allowed auth redirects, auth rate limits and signup abuse controls in Supabase before inviting customers. Server authorization calls Supabase `/auth/v1/user` and checks confirmed email, then the operator-owned access record. It never trusts a browser-provided user ID or editable user metadata.

Emergency pause:

```sql
update public.pilot_limits set enabled = false where id = true;
-- Revoke an individual account, including further job reads/downloads:
update public.pilot_access set enabled = false where user_id = 'USER_UUID';
```

Pausing prevents new reservations; already-running work may finish. Stop the container to terminate running builds. Do not rotate/delete credentials without recording an incident and planning recovery. The project cap is 100 per account and 256 KB per project JSON. Existing oversized records must be corrected before validating the new `NOT VALID` constraints:

```sql
select id, owner_id, octet_length(venue_data::text) from public.projects
where octet_length(venue_data::text) > 256000 or jsonb_typeof(venue_data) <> 'object';
```

## 2. API host

Use a maintained Linux server with Docker/Compose, enough memory for Blender, a domain pointing to it, and inbound firewall ports 80/443 only (plus restricted administrative access). The sample limits are 2 CPUs/2 GB RAM; validate them against representative venues. Configure host updates, monitoring and backups. The supplied container runs without root, with a read-only filesystem, dropped capabilities, bounded processes, and a 512 MB temporary filesystem. Server credentials are excluded from Blender's environment. No uploaded scripts or blend files are executed.

```bash
cp deploy/api.env.example deploy/api.env
# Edit real server credentials and exact allowed frontend origins in this ignored file.
docker compose -f deploy/compose.yml build
docker compose -f deploy/compose.yml up -d
```

The image build runs `scripts/smoke-blender.mjs`: the actual installed Blender must generate a GLB containing geometry and its material. The API also refuses startup when Blender cannot launch. The Dockerfile uses distribution Blender; the smoke gate must pass on the actual host/image. Pin the successfully tested image digest for a release and record its Blender/Node versions. Do not assume the host package matches your Mac version.

Install/configure Caddy using `deploy/Caddyfile` with your API domain, or an equivalent TLS proxy with a 19 MB body limit and response timeouts longer than 125 seconds. The sample container port binds to `127.0.0.1`; Caddy runs on that host. `/healthz` reports process liveness only, not provider or database availability.

The server allows exact frontend origins, verifies bearer sessions, bounds requests/concurrency and rate limits, serialises paid AI work and Blender jobs, and maps each job to its creator. Unknown/non-owned IDs return the same unavailable response. Reverse-proxy/network abuse protection is still needed; application throttles are not DDoS protection.

## 3. Frontend

Set the following build-time public values in `.env.local`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_KEY
VITE_PILOT_API_URL=https://api.YOUR_DOMAIN
VITE_OPERATOR_NAME=YOUR_REAL_BUSINESS_OR_OPERATOR_NAME
VITE_SUPPORT_EMAIL=YOUR_REAL_SUPPORT_EMAIL
VITE_PRIVACY_URL=https://YOUR_DOMAIN/privacy-notice
VITE_TERMS_URL=https://YOUR_DOMAIN/service-terms
```

The privacy/terms documents must actually exist and reflect your business and providers. These are links to documents you publish, not generated legal guarantees. Hosted builds fail without the operator/contact/link configuration; URL presence does not verify their content. `/service` explains access, processing, storage limits and support, and links to those documents.

```bash
npm ci
npm test
npm run lint
npm run build
npm run build:server
```

Upload only the contents of `dist/` to `public_html`, including `.htaccess`. Never upload source, `deploy/api.env`, `.env.local`, server keys or `dist-server` there. `postbuild` generates a CSP using the configured API and Supabase origins, Google Fonts and the existing 3D font CDN; verify fonts, text workers, model uploads, exports and embeds in a real browser. Do not copy the older source `.htaccess` over the generated file.

Enable HTTPS redirects on the frontend. Configure `ALLOWED_ORIGINS` to match the actual scheme/host exactly, including `www` only if you serve it. Browser requests omit cookies and refuse redirects. On the live Studio, sign in through VenueTwin Cloud and click **Check connection after signing in** if Pilot initially showed an authentication message.

## 4. Live release gates (required)

1. CI passes: full JS tests, type/build/lint, Python tests, disposable PostgreSQL RLS/quota tests, Docker image build and real Blender smoke. A test fixture does not prove live provider compatibility.
2. Apply migrations to staging, enable two test accounts, and confirm one account cannot see the other's projects, jobs, models or cancellations.
3. Test confirmed/unconfirmed email, expired session refresh, non-invited users, revocation and global pause. Check exact HTTPS CORS and generated CSP in the deployed browser.
4. Use a small real brief with the configured OpenAI model. Analyse a permitted photo/PDF, review findings, generate a proposal, apply and build on the remote Blender worker. Confirm the GLB returns to Studio and retains materials, openings and architectural detail.
5. Test cancel during planning and building, a provider failure, full quota, an invalid upload and a worker restart. Confirm prior editable layouts/models remain usable and failed work is clearly reported.
6. Test a representative large venue under container limits. Inspect performance and queue-busy behaviour. This version rejects concurrent work with a retry message; it is not a durable multi-worker queue.
7. Open Customer preview on desktop and a phone. Inspect front/back/side/balcony views, download the viewer pair, publish them together under a versioned `/venues/` folder, and test the public URL/embed/seat links without signing in.
8. Review operator identity, privacy/terms, support handling, backups, service expectations, data rights and allowed source assets. No payments or subscriptions are collected by this release.

Do not advertise automatic near-identical reconstruction or guaranteed sightlines/accessibility. Geometry/source fidelity requires review.

## Operations, retention and recovery

API logs contain request ID, route family, status and duration, not bearer tokens, uploaded files or briefs. Blender error output may contain component names; treat host logs as private. Do not expose logs publicly. Use request IDs for support, monitor non-2xx rates, job failures, memory/disk and provider costs. Docker logs rotate with the supplied configuration.

Builds have a 10-minute timeout, a 25 MB output limit and four retained slots. Completed/failed job directories are pruned after about an hour and may be evicted earlier for newer jobs. A restart loses jobs and files; users must retry. This is intentional ephemeral processing, not durable model storage. Successful returned GLBs and reference uploads remain in the browser's local store; cloud project JSON does not back them up. Export backups before clearing browser data. The frontend already offers project, blueprint, handover and viewer/model downloads.

Usage counters persist across restarts. Retain them only as long as needed for operations and your published policy. For account deletion, revoke access, disable public shares, stop any active work if necessary, delete the Supabase auth user (owned projects/access cascade), and remove that user's usage scopes through an operator-authorized procedure. Usage has no auth FK because the global counter also lives there. Browser-local data must be cleared separately. Provider retention and contractual arrangements must be described accurately; `store:false` is not a zero-retention guarantee.

Keep the previous frontend build and container digest for rollback. Schema changes are additive; do not drop live data to roll back a release. Pause Pilot first, restore the last working application versions, investigate with private logs, and re-run the live acceptance path before reopening access.

## Remaining scope

Payment processing, invoicing, subscriptions, automated onboarding, durable shared file storage, multi-worker queues and automated legal/account lifecycle are not implemented. They are not prerequisites for a manually operated, invited beta, but must be implemented or explicitly handled operationally before selling the corresponding service. The operator must choose hosting, configure secrets/DNS, apply migrations and supply real business policies; this repository cannot perform those account-level steps automatically.
