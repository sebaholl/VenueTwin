# Customer seat viewer

The new `/viewer` route is a read-only presentation of one venue. It provides
level/row/seat selection, an interactive map for the chosen level, a 3D overview,
seat perspective, neighbouring-seat buttons, full-screen controls and responsive
layout. It does not sell tickets or claim live availability.

## Try locally

1. Switch to `feature/customer-viewer` and run `npm run dev`.
2. In Studio, open/import your National Theatre project and load its matching
   detailed GLB using the Blender bridge.
3. Above the Blender bridge choose **Customer preview**. A new tab opens.
   If the browser blocks it, use the **Open prepared preview** link.
4. Choose a level, row and numbered seat, then **View from this seat**.
   Drag or use arrow keys to look around; Escape returns to the overview.
   Previous/next buttons switch seats within the selected row.
5. **Seat map** isolates one level; the 3D overview keeps the whole auditorium
   visible so it remains spatially understandable.

The local snapshot (project + GLB) is stored in IndexedDB in this browser.
Reloading `/viewer` restores it. Preparing another preview replaces this one
snapshot. Nothing is uploaded. It is separate from Studio's normal project
storage and Supabase. The preview URL is not a public sharing link.

Changing geometry after attaching a model blocks preview preparation until the
model is rebuilt/reloaded or removed. This detects edits made since attachment;
it cannot prove that an arbitrarily imported GLB originally matched the project.
The paired Theatre project/model from the previous deliverable should be used.

## Prepare a website embed (no automatic deployment)

In the local viewer, expand **Website setup**:

1. Download `venue.json` and, if present, `venue.glb` from the same snapshot.
2. When ready to publish, deploy this version of VenueTwin and put both files
   together at e.g. `/venues/national-theatre/` on the same website. For Vite
   development this corresponds to `public/venues/national-theatre/`; for the
   existing Simply.com static deployment, use `public_html/venues/national-theatre/`.
3. Test `/viewer?venue=/venues/national-theatre/venue.json` on that website.
4. Copy the iframe code from Website setup. Replace the localhost origin with
   the public VenueTwin domain. Place the iframe on the client's website.

The public route loads only its manifest and model. It never falls back to a
private local preview and hides the publisher's local setup controls. The GLB's
SHA-256 hash is checked against the manifest to catch mismatched uploads. This
checks file pairing, not physical accuracy or authenticity of the venue.
Asset URLs must stay on the same origin under `/venues/`; redirects, external
resources and oversized files are rejected. The GLB limit remains 25 MB.

Do not upload private source drawings or keys. Only the deliberately exported
viewer files are needed. Existing `/share/:token` Supabase links are unchanged;
they still do not include local GLBs. No hosting or database migrations are added.

## Rendering and known limits

The detailed model uses warm lights and locally generated environment lighting;
it no longer depends on a remote HDR file. Rendering runs on demand and the
pixel ratio is capped at 1.5. The shell is cut away in overview and restored in
seat perspective. Seats stay at the exact Studio coordinates.

This is not a match to the Blender Cycles render. There is no calibrated
photographic lighting, measured sightline score or observer obstruction model.
National Theatre dimensions, seat numbering and ornament remain a study.

## Verification

Unit tests cover level membership, original seat elevations, geometry-change
detection, validation limits, model hash pairing, same-origin asset restrictions,
failed published manifests and generated embed URLs. Production build and lint
are checked. Automated browser execution was blocked by the execution
environment's socket permissions; desktop/mobile rendering, touch controls,
IndexedDB behaviour and full-screen still need the following browser check:

- Open the detailed model from Studio; prepare Customer preview.
- Select Balcony 1, row K, seat 21; enter the seat view and try next/previous.
- Drag, use arrow keys, change eye height and press Escape.
- Switch Seat map and confirm that only the selected level is visible.
- Reload the local viewer and confirm the GLB remains present.
- At a 390 px mobile width, check scrolling, seat selection and drag gestures.
- Test published files in a fresh browser session and inside an iframe.
- Replace only the GLB and confirm the mismatched-file error is shown.
