# Deploy VenueTwin to Simply.com

VenueTwin is a static React/Vite application. Simply.com serves the built files while Supabase continues to provide authentication and PostgreSQL persistence.

## 1. Prepare Supabase

Run all files in `supabase/migrations` in filename order using the Supabase SQL Editor. For an existing VenueTwin database, make sure the public-sharing migration has been run:

```text
supabase/migrations/202610040001_public_project_sharing.sql
```

In **Supabase → Authentication → URL Configuration**, set:

```text
Site URL: https://venuetwin.online
Redirect URLs: https://venuetwin.online/**
```

Only use the public publishable/anon key in the frontend. Never put the `service_role` key in a Vite environment file.

## 2. Build locally

Confirm `.env.local` contains the production Supabase project values:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-publishable-key
```

Then run:

```bash
git switch main
git pull origin main
npm ci
npm run build
```

The deployable website is generated in `dist`. It must contain:

```text
dist/
  .htaccess
  index.html
  robots.txt
  assets/
```

The `.htaccess` file makes direct visits to `/studio` and `/share/:token` work, prevents directory listings, preserves Let's Encrypt validation, and adds conservative browser security headers.

## 3. Upload to Simply.com

1. Open **Website → File Manager** in the Simply.com control panel.
2. Open `public_html`.
3. Remove only the placeholder files supplied by the host. Do not delete the `public_html` directory.
4. Upload the **contents of `dist`**, not the `dist` directory itself.
5. Confirm that `index.html`, `.htaccess`, `robots.txt`, and `assets` are directly inside `public_html`.

Simply.com's temporary URL may be used for a basic visual check, but authentication and share links should be tested on the final HTTPS domain.

## 4. Enable HTTPS

After the domain is active and points to the Simply.com webserver:

1. Open **Website → HTTPS protection**.
2. Select a Let's Encrypt DV certificate for `venuetwin.online`.
3. Add `www.venuetwin.online` only if that hostname is configured and intended for use.
4. Enable forced HTTPS.

Do not redirect or block `/.well-known/`; Simply.com uses that path to issue and renew Let's Encrypt certificates. VenueTwin's `.htaccess` already excludes it from the React Router fallback.

## 5. Production check

Test these URLs in a private browser window:

- `https://venuetwin.online/`
- `https://venuetwin.online/studio`
- refresh while on `/studio`
- create an account or sign in
- open and save a cloud project
- enable a public preview
- open and refresh the generated `/share/:token` URL
- disable the link and confirm the preview becomes unavailable

If the homepage works but `/studio` returns 404, verify that `.htaccess` was uploaded. File managers may hide dotfiles by default.

## Updating the site

For each release, pull `main`, run `npm ci && npm run build`, then replace the existing files in `public_html` with the new contents of `dist`. Supabase data is not affected by replacing frontend files.
