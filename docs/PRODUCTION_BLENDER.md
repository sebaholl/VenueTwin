# Validated local production-to-Blender draft pipeline

## Source-linked appearance in contract 1.3.0

The offline builder now accepts an explicit `triangle_uv` value for each custom-mesh triangle and a `base_color_texture_source_id` on a material. The referenced source must be a `photo` record in that material's evidence. Put a local 8-bit RGB/RGBA PNG in an assets directory under its SHA-256 filename (`<sha256>.png`) and pass `--assets /absolute/path/to/assets`. The builder accepts at most 2048 × 2048 pixels, 4 MiB per PNG and 16 MiB in total. It checks PNG structure and the source hash before Blender starts; the exported GLB must embed the same bytes. Neither the builder nor the verifier fetches an image URL. Textured structures must have explicit mesh UVs; no automatic photo projection or texture generation is implied.

The fictional fixture `contracts/fixtures/fictional-texture-venue.json` and `contracts/fixtures/textures/` exercise the complete local path. Its two-pixel pattern is synthetic test data, not a venue photo. Build it with the ordinary command plus `--assets contracts/fixtures/textures`. The Three.js round-trip verifier checks embedded PNG identity and every exported triangle UV against the contract while checking geometry and cameras; the managed release build accepts self-contained GLBs and publishes the original bytes. Before using real venue photos, the operator must obtain usage rights, map them onto measured geometry, and visually compare the rendered seat views with calibrated reference images and the venue owner. None of those checks has happened for the Prague study.

This extends the Phase 1 branch in PR #52. It does not replace the existing Studio exporter, alter saved projects, expose an HTTP build route, change Supabase, or enable paid providers. The separate draft PR should be reviewed after Phase 1; retarget it to main once that dependency lands.

## What works

The explicit Python CLI validates a production v1 document and checks missing inputs before starting Blender. The default refuses incomplete evidence. `--allow-unverified` permits an intentionally unverified **draft**, but never supplies absent seat eyes, a stage target, seats or structures. Invalid numeric data still fails. Coincident or vertical camera targets are rejected; the current lens policy does not define a vertical-view roll convention. The box builder supports dimensions of at least 1 mm; smaller valid contract dimensions are rejected rather than silently resized.

The dedicated Blender worker exports:

- Every box structure with its declared centre, dimensions and yaw. Production contract 1.1.0 also accepts a source-linked, locally bounded triangle mesh for a structure; this allows a measured auditorium shell, balcony or obstruction to keep its actual shape instead of becoming a box. The mesh must supply explicit vertices and non-degenerate triangle indices. Contract 1.0.0 remains box-only.
- A non-rendering anchor for each stable seat ID, preserving position and yaw.
- A perspective camera at each explicit eye position, aimed at the explicit stage target. The illustrative lens is 65 degrees vertical; it is not camera calibration.
- Stable IDs in glTF `extras` (not truncated object names), and `venueTwinStatus=draft-unverified` on every exported object.

Y-up contract coordinates convert to Blender Z-up as `(x, -z, y)` and back to Y-up during GLB export. No legacy viewer model offset is applied. Unassigned structures keep a neutral draft material. Production contract 1.2.0 also accepts a bounded, source-linked PBR palette (linear base colour, roughness and metallic factor) with explicit structure assignments. Blender exports those values and the Three.js verifier checks the imported material and assignment. This is a reviewed appearance estimate, not a photo texture or photorealistic reconstruction. There are no guessed seat meshes or lighting assets.

Before accepting an output, the CLI loads the **actual GLB through Three.js** and compares box vertices or custom mesh triangle topology, seat positions/yaw, camera positions/aim/roll and lens against the validated input. The positional tolerance is 0.0001 m (a numerical export tolerance, not a claim about survey accuracy). Direction vectors use a 0.0001 tolerance. Unexpected meshes/cameras, duplicate IDs, external buffers/images and mismatched transforms fail verification. Network requests are blocked in the verifier. This proves digital geometry round-trip only; it does not prove that input mesh vertices came from a real survey.

## Files and guarantees

`services/planner/venuetwin_planner/build.py` is the trusted local orchestrator; `scripts/blender/build_production.py` is its internal worker. Do not expose the worker as an upload endpoint: canonical Pydantic validation belongs to the orchestrator, while the worker independently checks the numeric packet it consumes.

The output directory must not already exist, and its parent must exist. A private temporary directory holds partial work. On failure, the newly reserved output is removed; existing directories are never overwritten. A successful package contains:

| File | Purpose |
| --- | --- |
| `input.json` | Validated production document; contains private source metadata, so keep the package local |
| `packet.json` | Deterministic geometry/camera packet, sorted by stable ID |
| `venue.glb` | Architecture, seat anchors and cameras |
| `builder.json` | Blender version and illustrative lens policy |
| `verification.json` | Three.js revision, counts, numeric errors and GLB hash |
| `manifest.json` | Written last; input/source hash, compiler/contract/worker/verifier hashes and every output hash/size |

Every manifest has `requires_human_review=true` and `verified_venue=false`, even if source declarations pass readiness checks. Missing evidence remains listed in the manifest. Hashes support reproducibility and integrity checks; they are not signatures or proof of measurement truth. Byte-identical GLBs across different Blender versions are not promised.

Remote Docker endpoints are rejected before daemon contact. Container builds require an **already installed local image**, never pull an image, have no network, and use a read-only root with bounded temporary storage, 2 GiB memory, 2 CPUs, 128 PIDs and dropped capabilities. The build deadline is 180 seconds, verification 60 seconds; named containers are explicitly removed on exit/timeout. Native Blender execution uses an allowlisted environment without API keys. Docker runs on the developer's local daemon; this is not a hosted job service.

## Reproduce

From the repository root, using the Phase 1 Python environment and npm dependencies:

```sh
# If needed: install dependencies using the Phase 1 setup instructions.
PYTHONPATH=services/planner .venv/bin/python -m pytest services/planner/tests -q
npm run test:python
npm run lint
npm test
npm run build
npm run build:server

# Reuse the existing local image from Phase 1, or build it locally first:
BUILDX_CONFIG=/tmp/venuetwin-buildx docker build -t venuetwin-phase1:local .

# Select a NEW output directory; this fictional venue needs explicit draft consent.
PYTHONPATH=services/planner .venv/bin/python -m venuetwin_planner.build \
  contracts/fixtures/fictional-venue.json /tmp/venuetwin-production-demo \
  --container-image venuetwin-phase1:local --allow-unverified

# Corruption checks against the real exported GLB:
node scripts/test-production-verifier.mjs /tmp/venuetwin-production-demo
```

Alternatively replace `--container-image ...` with `--blender /absolute/path/to/blender`. The native Blender 5.2.2 Metal crash documented in Phase 1 remains unresolved on this Mac; the working route tested here is local Docker/Blender 3.4.1. The new worker is mounted read-only into the existing image, so it need not be added to the deployed image.

Without `--allow-unverified`, the fictional fixture is blocked by 17 evidence requirements. Its accompanying `fictional-venue-source.txt` is the actual hashed authored source; it explicitly describes fictional values. No pretend survey or “measured” evidence is used.

## Verification on 2026-10-22

- 207 TypeScript tests, 20 Blender Python tests and 57 planner/build Python tests pass.
- Lint, client build and Node server build pass.
- Local network-disabled Blender exports a 10,580-byte GLB: 5 structures, 4 seat anchors, 4 cameras.
- Three.js round-trip checks pass, including an elevated row and a rotated obstruction. Maximum numerical vector error was below 0.000001 in the fixture.
- Four real-GLB corruption cases (eye position, structure geometry, seat ID, GLB header) are rejected.
- Unit tests cover missing-input no-launch behavior, explicit draft gating, deterministic mapping, immutable input, output collision protection, failure/timeout cleanup, environment key filtering, and manifest creation only after successful verification.
- Existing scene chunk-size and Starlette/AnyIO deprecation warnings remain. The unchanged dependency audit findings from Phase 1 were not addressed by this patch.

CI adds the real production round-trip and corruption tests to the existing Blender-container job. While the PR is stacked on the Phase 1 branch, the existing main/develop PR filter does not run hosted CI; local checks above are the current evidence. Retargeting to main enables the existing CI triggers.

## Still needed

The customer viewer does not yet consume these production packages or cameras. Seats are anchors, not finished chair meshes. Survey capture, genuine evidence review, calibrated lens conventions, source integrity verification, realistic PBR assets, lighting, obstruction/sightline assessment, storage/authentication and publication remain separate work. This change proves that explicit geometry and cameras survive the production contract → Blender → Three.js boundary; it does not prove a venue is complete or photorealistic.

API references checked through Context7: [Blender glTF export](https://docs.blender.org/api/current/bpy.ops.export_scene.html), [Three.js GLTFLoader](https://threejs.org/docs/#examples/en/loaders/GLTFLoader).
