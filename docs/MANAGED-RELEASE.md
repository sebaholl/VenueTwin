# Managed customer viewer v1

This release provides a public, read-only venue viewer. The operator prepares the venue locally, reviews the exact model and seat views, and publishes a static package. Customers do not need an account. There is no booking, live inventory, payment, customer upload, analytics or AI request in the managed bundle. Existing Studio, server and legacy viewer remain separate.

**Status: release candidate, not deployed or approved for customers.** The committed four-seat venue is fictional. Current geometry is procedural and chairs/lighting are illustrative, not photorealistic. Real-world accuracy requires measured source material and human review. Passing automated checks does not certify sightlines, accessibility or venue conditions.

## Local checks (Node >=22.18, Python 3.12)

```sh
npm ci
npm run lint
npm test
npm run test:python
python3 -m venv .venv
.venv/bin/python -m pip install -r services/planner/requirements.lock
PYTHONPATH=services/planner .venv/bin/python -m pytest services/planner/tests -q
npm run build
npm run build:server
npm audit --audit-level=high
node --test scripts/test-managed-release.mjs
npm run build:managed:demo
npx playwright install chromium webkit
npm run test:e2e
node scripts/serve-managed.mjs
```

Preview http://127.0.0.1:4174. The demo build is explicitly labelled and is not an approved customer release. Browser tests use the built bundle with its generated security headers; external page requests are blocked. They cover seat selection, deep links, levels, small screens, integrity failures, missing packages, unavailable routes and WebGL loss. The mobile profile is emulation; a physical phone check remains necessary.

## Prepare and approve a real venue

Follow `PRODUCTION_BLENDER.md` to create the verified build directory from contract v1. Keep input/source evidence, review records and build manifests in private operator storage. Never put that directory under a public web root. Resolve every missing-input requirement. Do not turn inferred values into measured evidence without actual measurement.

Review every seat camera against measured eye positions and reference photos, review obstructions and geometry, and confirm publication rights. Save this private review JSON, replacing hashes with the exact values from `manifest.json` and using the actual reviewer/date:

```json
{
  "version": 1,
  "input_sha256": "<input.json sha256>",
  "model_sha256": "<venue.glb sha256>",
  "reviewer": "<reviewer's name>",
  "reviewed_on": "<YYYY-MM-DD>",
  "source_rights_confirmed": true,
  "geometry_checked": true,
  "seat_views_checked": true,
  "public_release_approved": true
}
```

These are operator attestations, not independent certifications or cryptographic signatures. Publishing permissions must remain restricted to trusted operators. Editing public manifests manually bypasses the review workflow and is unsupported.

```sh
mkdir -p /private/operator/public-packages/theatre
PYTHONPATH=services/planner .venv/bin/python -m venuetwin_planner.package \
  /private/operator/build /private/operator/public-packages/theatre/v1 \
  --review /private/operator/review.json
```

Use actual writable private paths. The command refuses existing destinations, tampered builds, missing evidence and reviews for different model/input hashes. It reruns the Three.js geometry verifier, then exports only `venue.json` and `venue.glb`. The public JSON omits source descriptions, evidence and reviewer identity. Inspect the model itself for information that must not be published; downloadable geometry cannot be kept confidential.

## Build the customer release

Set these public-facing configuration values in the shell or `.env.production`:

```sh
export VITE_OPERATOR_NAME='VenueTwin, operated by Sebastian Höll'
export VITE_SUPPORT_EMAIL='venuetwin@gmail.com'
export VITE_PRIVACY_URL='https://your-domain/privacy'
export VITE_TERMS_URL='https://your-domain/terms'
npm run build:managed -- --venues /private/operator/public-packages
```

Intended host: https://venuetwin.online/ on Simply.com (provided by the operator; not changed or deployed by this implementation). Operator name and support email above are confirmed. Privacy and terms URLs are still unconfirmed: provide real published policy URLs appropriate for the business. Placeholder contact information, demonstration packages, unexpected public files, malformed manifests and mismatched model hashes are rejected. Only the two approved package files from each `slug/vN` directory are copied. The independent build does not include Studio, the API server, Supabase configuration or source uploads. Inspect `dist-managed/release.json` and its status before publishing; a failed build may leave a previous build on disk, so never publish after a failed command.

Seat link: `/venue?venue=/venues/theatre/v1/venue.json&seat=stable-seat-id`. Keep published version paths immutable. Publish revisions under a new version path and retain old versions for existing links. The app displays the manifest's revision; ensure directory version and document revision agree.

## Hosting handoff (not performed by these commands)

Publish only `dist-managed` at an HTTPS origin's root. Configure SPA fallback to `index.html` for `/venue` and `/service`; missing `/assets/` and `/venues/` files should return 404. Generated `.htaccess` targets Apache with rewrite/headers enabled; `_headers` contains the same header policy for compatible static hosts. Other hosts require equivalent configuration. Verify headers on actual responses, not merely file presence. Host access logs and retention must match your privacy notice. Venue files are public to anyone with their URL; use a separately designed access control system for confidential venues.

Before first customer access:

- Obtain and review a real venue package, including rights, dimensions, seat IDs, eye heights, obstruction coverage, stage target and photos from representative seats.
- Confirm operator/support details and published terms/privacy notice.
- Review the final build's release manifest and exact model hashes; retain the private review record.
- Test HTTPS, content types, headers, deep links, missing assets and the seat map on the chosen host.
- Check real desktop Safari/Chrome and physical iOS/Android devices, including slow network and WebGL unavailable; evaluate a representative large venue, not only the tiny fixture.
- Have the venue owner accept geometry and seat views, document known limitations and a correction/support process.
- Keep the prior release for rollback; upload to a new release directory then switch atomically. Do not replace an approved version's files in place.

No deployment, database migration, paid API call or cloud provisioning is part of this implementation. Photorealistic capture/texturing, survey registration and venue-wide quality acceptance remain production work beyond this procedural first viewer.
