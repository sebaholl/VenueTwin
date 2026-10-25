# Production architecture: Phase 1

Implemented against main commit `8391d6f69387f85c524b75221661ddf097c05871`.
This is an offline foundation for production planning, not a photorealistic reconstruction engine or a certified seat-view system.

## Audit and integration decisions

| Area | Existing implementation | Decision / remaining gap |
| --- | --- | --- |
| Geometry | `VenueConfig`, generated rows, optional dimensions, `parseViewerConfig` | Preserve all legacy formats and defaults. New production data has a separate strict versioned boundary. |
| Three.js | `VenueScene`, `getSeatView`, procedural seats and imported GLB architecture | Existing Y-up coordinates and interactive seats remain. Default eye height is 1.15 m; visual scene offset is `[0,-1.4,-2.8]`. Neither is survey evidence. No measured-camera consumer added yet. |
| Blender | `blenderBlueprint`, bounded Node jobs, `build_venue.py`, optional theatre study | General export builds boxes/materials and excludes seat-reference empties from exported GLB; seats remain interactive in Three.js. Conversion is `(x,y,z) -> (x,-z,y)` with Y-up GLB export. No production-document-to-Blender adapter yet: approximated boxes must not silently become a measured venue. |
| AI | Existing TypeScript Pilot and reference-analysis Responses calls | Preserve existing opt-ins. Separate Python scaffold never creates a live SDK client or reads a key. No changes to existing AI calls or quotas. |
| Supabase | Owner-scoped projects, public-share filtering, service-role quota RPC, SQL isolation tests | No migrations or cloud operations. Production revisions, source evidence, review records and asset manifests need separate owner-scoped storage design. Do not put private source metadata into public project JSON. |
| Tests | 204 TypeScript and 17 Python tests at baseline; CI includes PostgreSQL isolation and real Blender | Added 3 adapter tests and 37 network-blocked Python tests; added Python checks to existing CI. |

The referenced ChatGPT discussion exposed only placeholder assistant messages; this implementation follows the explicit Phase 1 request rather than claiming to reproduce an unreadable architecture.

## New files and behavior

- `services/planner/venuetwin_planner/contract.py`: canonical Pydantic models and deterministic missing-input requirements.
- `contracts/venue-production-v1.schema.json`: generated JSON Schema for structural interoperability. Python additionally enforces unique IDs, foreign keys and evidence semantics; JSON Schema alone is not full validation.
- `contracts/fixtures/legacy-draft.json`: shared TypeScript/Python compatibility fixture (a fictional two-seat concept).
- `src/utils/productionContract.ts`: explicitly invoked, one-way `productionDraft(config, venueId, revision)` adapter. Uses existing layout/blueprint code without mutating or saving the project. All geometry is inferred; eye/target measurements remain absent. It is not wired to the UI or cloud. Call the Python validator before accepting a draft for production.
- `services/planner/venuetwin_planner/planning.py`: deterministic offline planner and an injected OpenAI SDK adapter, advisory output only. Missing inputs stop provider execution. SDK adapter has one attempt, 20-second timeout, 1,200 output-token limit, no tools and `store=False`; it sends only schema version and geometry counts. It has no live service route.
- `services/planner/venuetwin_planner/app.py` and `body_limit.py`: optional local HTTP routes, strict validation errors without echoing raw evidence, a 2 MiB request limit, local Host allowlist and browser-Origin rejection. These are local-development safeguards, not deployment authentication.
- `services/planner/tests/`: schema drift, cross-language fixture, strict/semantic failures, missing inputs, no mutation, feature flag, request limits, deterministic planning and real SDK mock-transport success/refusal/incomplete/invalid/error tests. Socket connections are blocked in every test.
- `requirements.txt` records direct tested pins; `requirements.lock` pins the tested transitive environment. Python 3.12 is the tested runtime.
- README, `.gitignore`, `.dockerignore`, and existing CI updated; existing product implementation, Node production entry point, deployment configuration, npm dependencies and database migrations unchanged.

## Contract semantics

`format=venuetwin-production`, `version=1.0.0`; unsupported versions fail, with no automatic migration. Unknown keys fail at every model boundary. Core geometry fields are required even when their value may explicitly be null. Optional per-seat `vertical_fov_deg` and `camera_source_id` must appear together when a reference photo calibrates the lens; older drafts omit them and retain an illustrative 65° lens. Numeric strings, booleans as numbers, NaN/Infinity, invalid vector lengths, oversized collections, duplicate IDs and dangling references fail.

- Metres, right-handed Y-up; positions precede the viewer-only model offset. `origin` must describe the frame. Positive yaw rotates about +Y in radians. A box position is its centre, and dimensions are local X/Y/Z extents.
- A seat's `position_m` is its geometry anchor, not its eye or floor. `eye_position_m` is an explicit absolute position in the same frame. The stage viewing target also requires its own evidence.
- IDs are stable identifiers within production revisions. Legacy row/seat-derived IDs are snapshot identifiers only: reconcile them before editing/publishing or selling tickets. The adapter includes sale seats only; service places are not asserted to be a complete inventory.
- Evidence references source IDs and SHA-256 metadata. Measured evidence requires a survey/dimensioned drawing source and positive uncertainty. Legacy concepts and photos alone cannot be promoted to measured evidence. A supplied hash is not independently verified; Phase 1 fetches no sources and proves no measurement accuracy.
- Readiness requires measured scale, inventory, occluder coverage, geometry, target and eye positions, plus documented/measured materials and lighting references. An empty obstruction collection is acceptable only with explicit measured occluder coverage. Requirements are sorted by stable path/code, independent of collection order, and never filled with guesses.
- `ready_for_review` only permits human review of a plan. It does not certify sightlines, guarantee completeness, create assets, execute Blender or authorize publication. Missing/uncertain evidence returns `blocked` and no steps.

## Local commands

From the repository root (Python 3.12 and Node 22+):

```sh
npm ci --ignore-scripts --no-audit --no-fund
python3.12 -m venv .venv
.venv/bin/python -m pip install -r services/planner/requirements.lock
PYTHONPATH=services/planner .venv/bin/python -m pytest services/planner/tests -q
npm run lint
npm test
npm run test:python
npm run build
npm run build:server
PYTHONPATH=services/planner .venv/bin/python services/planner/export_schema.py
git diff --exit-code -- contracts/venue-production-v1.schema.json
```

Dependency installation downloads public packages; test/model execution is offline. On this Mac, the supplied Python runtime was used to create the venv because `/usr/bin/python3` is 3.9.6:

```sh
/Users/sebastianholl/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3 -m venv .venv
```

Start the optional **offline** service on loopback only:

```sh
VENUETWIN_PLANNER_ENABLED=1 PYTHONPATH=services/planner \
  .venv/bin/python -m uvicorn venuetwin_planner.app:app --host 127.0.0.1 --port 8011
curl -s http://127.0.0.1:8011/health
curl -s http://127.0.0.1:8011/v1/plan \
  -H 'Content-Type: application/json' \
  --data-binary @contracts/fixtures/legacy-draft.json
```

The fixture returns `blocked`. Without the exact flag value `1`, both `/v1/plan` and `/v1/validate` are absent (404). Setting an OpenAI API key does not enable live requests. Do not put this service behind the public proxy: authentication, tenant isolation, quotas and review persistence are intentionally future work.

Local PostgreSQL verification (disposable container, no exposed ports or network):

```sh
docker run --detach --rm --name venuetwin-phase1-postgres --network none \
  -e POSTGRES_PASSWORD=disposable-local-test -e POSTGRES_DB=venuetwin_test postgres:16
# Once the database is ready:
docker cp supabase venuetwin-phase1-postgres:/tmp/supabase
docker exec venuetwin-phase1-postgres psql -U postgres -d venuetwin_test \
  -v ON_ERROR_STOP=1 -f /tmp/supabase/tests/security.sql
docker stop venuetwin-phase1-postgres
```

Blender checks:

```sh
BLENDER_PATH=/Applications/Blender.app/Contents/MacOS/Blender npm run test:blender
BUILDX_CONFIG=/tmp/venuetwin-phase1-buildx docker build --tag venuetwin-phase1:local .
docker run --rm --network none --read-only --tmpfs /tmp:size=512m,mode=1777 \
  --cap-drop ALL --security-opt no-new-privileges --memory 2g --cpus 2 --pids-limit 128 \
  venuetwin-phase1:local node scripts/smoke-blender.mjs
```

## Verification results (2026-10-22)

- Baseline: 204 TypeScript tests and 17 Blender Python tests passed.
- Phase 1: 207 TypeScript tests and 37 planner Python tests passed; existing Python tests remain passing.
- Lint, TypeScript/client build and Node server build passed. Existing ~1.1 MB scene chunk warning remains.
- Supabase migration/security SQL passed in local PostgreSQL 16, including owner isolation, public source filtering and quotas. Test transaction rolled back; no hosted Supabase contact.
- Docker image build and Blender smoke passed, including a network-disabled, read-only, capability-dropped container with 2 GiB / 2 CPU / 128 PID limits (2,112-byte GLB, one mesh with materials).
- macOS Blender 5.2.2 smoke failed with SIGSEGV during Metal GPU initialization, before Python execution. Native export is not verified on this host.
- `npm audit --audit-level=high` failed on the unchanged lockfile: 1 high Vite advisory group and 3 low transitive findings; npm reported no available fix for the Vite group. This existing CI gate may remain red and needs a separate dependency decision. No broad dependency upgrade made here.
- Planner tests emit one upstream Starlette/AnyIO deprecation warning; no test failures.
- No live OpenAI/Supabase calls, paid cloud resources or deployments were used. GitHub and public dependency downloads are the only external development services used.

## Next phases and acceptance gates

1. **Measured pilot venue:** collect licensed drawings/survey, explicit coordinate anchors, complete stable seat inventory, per-seat camera convention and obstruction evidence. Reconcile disagreement and document tolerances with the venue operator. No automated promotion from photo interpretation to measurements.
2. **Deterministic asset build:** add a versioned contract-to-Blender adapter, trusted material library, reproducible build manifest (input hash, builder version, GLB hash), local build queue and cleanup. Test coordinate round-trips and camera positions against measured references before replacing the existing path.
3. **Photorealism and interactive delivery:** authored PBR materials/textures, calibrated lighting, occlusion review, mesh/texture budgets, instancing and LOD. Add screenshot comparisons from known seats and mobile performance budgets. Box primitives and planning output alone do not deliver photorealism.
4. **Production integration:** owner-scoped immutable revisions/evidence/assets in Supabase with SQL tests; review/signoff workflow; authenticated Node-to-planner boundary; rate limits, explicit cost caps and cancellation before any live provider option. Publish reviewed versioned GLBs/manifests only. Operator-controlled release, no autonomous publishing.

Relevant implementation references: [FastAPI testing](https://fastapi.tiangolo.com/advanced/testing-dependencies/), [Pydantic 2.12 configuration](https://docs.pydantic.dev/2.12/api/config/), [OpenAI structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs).
