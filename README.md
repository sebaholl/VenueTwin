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
[Blender bridge guide](docs/BLENDER_BRIDGE.md). Local GLBs are session-only and
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

1. **Project** — name the venue and optionally attach a floor-plan image. Use the Project menu for new templates, cloud projects and file imports.
2. **Layout** — switch between Seating, Levels, Categories and Obstacles. Only the selected tool group is shown. Select rows in the plan for individual adjustments.
3. **Model** — export Blender JSON, load a local GLB, then open the full-width seat-view review. Close the review with its own controls before changing steps; draft changes require Apply.
4. **Preview & share** — try the local customer experience, export a backup, or manage public cloud sharing.

The 2D/3D switch remains in the canvas. Switching steps preserves a loaded Blender model. Source images and GLB files are session-only and must be reattached after refreshing; cloud sharing does not include the GLB. On narrow screens, step controls appear above the canvas.

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
