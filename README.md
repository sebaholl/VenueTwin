# VenueTwin

View comparison workspace: [reference sources, camera matching and geometry drafts](docs/VIEW_REVIEW.md).

Customer seat viewer: [local preview, website export and embedding](docs/CUSTOMER_VIEWER.md).

Detailed National Theatre Blender workflow: [photo study and model generation](docs/NATIONAL_THEATRE_DETAIL.md).

VenueTwin is an early-stage spatial planning product that turns venue layouts into interactive 3D models and seat-level previews. The repository currently contains a polished public landing page and a functional local-first VenueTwin Studio.

## Current capabilities

- Responsive product landing page
- Interactive Three.js venue model
- Editable columns, walls and open railings with metric dimensions, base elevation and rotation
- Obstacle footprints in 2D, shared previews and exports; 3D structures occlude the seat-level view
- Seat-level first-person preview with fixed eye position, drag/touch and arrow-key look controls
- Adjustable seated eye height, stage-facing reset and return to overview (also in shared previews)

- Visual 2D floor-plan editor with an optional image overlay
- Drag individual rows freely in X/Y and change seat counts, rotation and curvature
- Add, duplicate, reset and delete individual rows
- 50-step Undo/Redo history with keyboard shortcuts
- Draw a polygonal venue boundary and preview an automatically generated seating layout
- Configure seat spacing, row spacing, edge clearance, aisle width and stage direction
- Reposition and rotate the stage consistently in 2D and 3D
- Two-point real-world scale calibration
- Straight, fan and block geometry presets
- Adjustable rows, seats, sections, rake and stage width
- Clickable seats with an approximate first-person view (not a certified sightline analysis)
- Local floor-plan selection (files are not uploaded)
- Browser persistence through local storage
- Optional email authentication, refreshed sessions and cloud autosave through Supabase
- Visual project dashboard with capacity, venue type and last-updated metadata
- Guided project creation for cinemas, theatres, conference spaces and custom venues
- Optional floor-plan upload during onboarding and editable layout presets
- Revocable public read-only links with dedicated 2D and 3D previews
- Create, rename, duplicate, open and safely delete cloud projects
- Project import and export as `.venuetwin.json`
- High-resolution PNG floor-plan export
- Print-ready A4 project report with browser PDF saving
- Custom seat categories with colors, optional prices and a project currency
- Whole-row assignments and individual seat overrides, with independent accessibility labels
- Category capacity and gross sell-out estimates (unpriced seats excluded); matching colors in 2D, 3D and exports
- About and fallback pages

## Blender prototype

An [estimated National Theatre spatial study](docs/NATIONAL_THEATRE_STUDY.md)
is available from New project. It adds five configurable seating levels and
open-centre arc balconies; dimensions and seat labels are not verified venue data.

Export a scene blueprint, build an architectural scaffold in Blender and load
the GLB locally in Studio while keeping interactive seats. Follow the
[Blender bridge guide](docs/BLENDER_BRIDGE.md). Local GLBs are saved per project in this browser and
are not part of cloud saves, public previews or 2D exports.

## Technology stack

- React 19 + TypeScript
- Vite
- Three.js through React Three Fiber and Drei
- Zustand for local application state
- React Router
- Plain CSS design system

## Run locally

Requirements: Node.js 20 or newer and npm.

```bash
git clone https://github.com/sebaholl/VenueTwin.git
cd VenueTwin
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:5173`.

## Commands

```bash
npm run dev       # local development server
npm run build     # type-check and production build
npm run lint      # ESLint checks
npm run test      # Vitest test suite
npm run preview   # preview the production build
```

## Environment variables

The application works without environment variables. To enable optional cloud persistence, follow [the Supabase setup guide](docs/SUPABASE_SETUP.md), create `.env.local` from `.env.example` and add the public project values. Never commit `.env` or `.env.local`.

## Deploy to Simply.com

VenueTwin includes a production `.htaccess` for React Router fallback, Let's Encrypt validation, security headers and static-asset caching. Follow the [Simply.com deployment guide](docs/SIMPLY_DEPLOY.md) to build the app, configure Supabase authentication URLs, upload `dist` to `public_html`, and enable HTTPS.

## Branch strategy

- `main` — stable releases
- `develop` — integration branch
- `feature/*` — isolated feature work

New work should branch from `develop` and return through a pull request.

## Planned architecture

The frontend is intentionally deployable as a static Vite build, including on Simply.com. Supabase provides optional PostgreSQL persistence and authentication, while local-only mode remains the default. A separate Python/FastAPI service can later handle computer-vision analysis without coupling it to the web client.

## Product status

This is a validation prototype, not an architectural or safety-certification tool. Sightline scores and venue dimensions are currently estimates.
## Sourced seating study

Studio's New project dialog now includes **Open sourced stalls study · rows 1–13**.
It adds the official National Theatre stalls numbering as a separate study, with
source status in Studio and the customer viewer. Upper tiers and all 3D positions
remain estimates. Rebuild the Blender model for the new layout.
See [source, scope and instructions](docs/NATIONAL_THEATRE_SEATING.md).

### Studio workflow

Studio is organised into four freely accessible steps:

1. **Project** — name the venue and organise saved floor plans, reference photos and known measurements. Use the Project menu for new templates, cloud projects and file imports.
2. **Layout** — switch between Seating, Levels, Categories and Obstacles. Only the selected tool group is shown. Select rows in the plan for individual adjustments.
3. **Model** — export Blender JSON, load a local GLB, then open the full-width seat-view review. Close the review with its own controls before changing steps; draft changes require Apply.
4. **Preview & share** — try the local customer experience, export a backup, or manage public cloud sharing.

The 2D/3D switch remains in the canvas. Switching steps preserves a loaded Blender model. Saved source plans restore automatically in the same browser. GLBs restore per project in this browser; cloud sharing does not include them. On narrow screens, step controls appear above the canvas.

### Customer viewer interaction checks

The customer viewer eases into a selected seat and between seats, with shorter smoothing when looking around. Reduced-motion preferences skip camera animation. One finger rotates the overview or looks around from a seat; two fingers zoom the overview. Reset view restores the overview or faces the stage. Back to seats opens the seat map. Mobile visitors can jump straight to the level/row/seat picker. Dragging the 3D model does not select a seat on release.

Loading shows real phases (venue details, model download, integrity check, geometry preparation, then first 3D frames), without invented percentages. A failed 3D view offers a canvas retry and a usable seat map.

Before publishing, verify on a real phone and desktop:
- Enter a seat, switch rapidly with previous/next, reset direction and return to the seat map.
- Drag with one finger; pinch the overview; scroll the page outside the canvas.
- Turn on reduced motion and check that the camera moves immediately.
- Test portrait/landscape, both generated geometry and an imported GLB.
- Simulate a slow connection or invalid model and check the loading/retry messages.

Automated build/lint and geometry tests do not replace these device checks. A local browser preview is stored per browser; opening the same localhost viewer URL on another device does not transfer its model.

### Complete embedded demo

Run the viewer and the independent sample customer website in two terminals:

```bash
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

```bash
npm run demo:host
```

Open **http://127.0.0.1:4174**. The Lantern is an original fictional demonstration theatre, not a reconstruction of the National Theatre. Its small GLB and 140-seat layout are generated automatically before dev/build. The independent HTML website embeds the viewer from port 5173 (a different origin), with sample seat buttons and a full-viewer link. Connection settings can point to a different viewer origin or venue manifest. The standalone `demo-host/index.html` can later be placed on another website; update its default viewer origin for deployment.

Direct demo link:
`http://127.0.0.1:5173/viewer?venue=%2Fvenues%2Fdemo-theatre%2Fv1%2Fvenue.json&seat=r6-s7`

The viewer selects that seat and opens its perspective. Copy link to this seat creates a standalone URL in published-file mode, with a selectable-text fallback if clipboard access is unavailable. Invalid/unavailable seat IDs show a notice and leave the visitor free to choose another seat. Local IndexedDB previews deliberately do not offer share links. Localhost URLs work only on your computer; public sharing requires your deployed domain.

To package a real project and its matching Blender GLB:

```bash
npm run demo:prepare -- --project /path/to/theatre.venuetwin.json --model /path/to/theatre.glb --slug national-theatre/v1
```

This writes `public/venues/national-theatre/v1/venue.json` and a content-hashed GLB beside it. Point the demo connection settings to `/venues/national-theatre/v1/venue.json`. Use a self-contained GLB below 25 MB, exported for precisely that layout. The viewer validates geometry and verifies the model hash before opening. Inspect the result locally before publishing.

Keep existing version folders unchanged once shared: seat IDs encode one-based row/seat indices within that exact manifest. A new layout needs a new folder (`v2`, etc.); the packager refuses to overwrite an existing custom version. Retain previous folders on the host so old seat links keep working. Hashed model filenames avoid mixing cached geometry with a new manifest. Generated demo assets need not be committed; custom packages must be retained with the project or in your asset storage.

When ready to publish, `npm run build` includes the prepared venue folders in `dist`. Upload the complete build and the updated `.htaccess`. Only `/viewer` is exempted from the app's same-origin framing restriction; Studio retains it. If the hosting control panel injects its own framing/CSP restrictions, verify the deployed response headers and permit the intended embedding website there. No deployment happens automatically.

Apache header expression reference: https://httpd.apache.org/docs/2.4/mod/mod_headers.html and https://httpd.apache.org/docs/current/expr.html. The original request line is used so the SPA rewrite does not hide the viewer path.

Release checks: open the independent host, choose all three sample views, copy/open a seat link in a fresh browser, reload, test an unavailable seat, test phone portrait/landscape, and test the deployed iframe from the actual customer domain. Local HTTP checks do not validate Simply.com's Apache configuration or physical phone behaviour.

### Saved Blender models

Studio stores each successfully imported GLB in IndexedDB under its project ID, alongside the geometry signature captured at import. Refreshing or reopening the same cloud project on the same browser origin restores it automatically. New projects have separate model records. Importing a project JSON creates a new project ID and requires attaching its GLB. Models are not uploaded to Supabase or bundled in project JSON exports.

The Model panel reports restoring, saving, saved or preview-only status. A storage failure leaves the imported model usable for the current session and offers Retry saving; the previous saved record remains unchanged. Remove saved model deletes the record before clearing the preview. Stale models remain stored but are hidden from the Studio scene until the original geometry is restored or a matching GLB is imported. Customer preview also rejects a stale model.

Keep the original GLB: clearing browser site data, storage eviction or changing browser/origin loses access to the local copy. Test import → saved status → refresh → Model/3D, project switching, removal → refresh, and layout change → stale warning. Cloud model storage and portable project bundles are future work.

### Project reference panel

Studio → Project → Venue references groups floor plans, reference photos, measured/estimated dimensions and reconstruction notes. Each project stores its references locally in IndexedDB. New-project wizard plans are saved here too. Choose an active image plan to restore its overlay in the editor; PDFs are retained as downloadable sources and are not rendered as overlays. Changing/removing the active plan clears its previous calibration and boundary.

File additions/removals and plan selection save immediately. Captions, measurements and notes use **Save references**; save before switching projects. Unsaved edits remain while switching workflow steps, and closing/reloading the page prompts when edits are unsaved. Measurements are evidence notes only: they do not change venue geometry or calibrate the plan. Photos can record their source and viewpoint in the caption.

Limits: 20 files, 10 MB per file, 40 MB total, 30 measurements. Plans accept JPG/PNG/WebP/PDF; photos accept JPG/PNG/WebP. Files remain on this browser origin and are excluded from cloud data, project JSON and public viewers. Keep originals as backups. Importing project JSON creates a new project ID, so attach the references to that new project separately.

Local verification: attach an image plan and photos, add a sourced measurement, save, refresh and confirm the active overlay and records return. Switch projects to check isolation; change the active plan and confirm old calibration clears. Test a PDF as a downloadable source and rejected oversized/unsupported files. Physical browser persistence and visual checks remain necessary.

### Calibrate a saved plan with reference measurements

1. In Project, choose an image floor plan and save any known measurements (including their source and measured/estimated status).
2. In the 2D plan, choose **Calibrate**, then mark the two ends of that same known distance.
3. Select a saved measurement or enter metres manually, then **Apply scale**. Coincident points and invalid values cannot be applied.
4. For single-level venues, open Auto layout, draw a seating boundary, set seat/row spacing and inspect the preview before applying. Multi-level venues still require manual row/level placement.

Calibration now sets SVG units per metre for seats, stage, obstacles, dragging and automatic layout. It changes how existing geometry is drawn over the plan, not its stored real-world dimensions. The background image and pointer coordinates share the same SVG coordinate system so resizing/letterboxing does not shift the calibration points. Auto-generated row offsets use the actual row-spacing formula rather than the former display-row gap.

Saved measurements remain reference notes until explicitly selected and applied to two points; estimates do not become verified measurements. Stage placement can be dragged on the plan. Existing manually positioned geometry may need alignment after setting a new scale. Check plan calibration, dragging and boundary generation locally at desktop and narrow viewport sizes before relying on a new layout.
