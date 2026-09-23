# VenueTwin

VenueTwin is an early-stage spatial planning product that turns venue layouts into interactive 3D models and seat-level previews. The repository currently contains a polished public landing page and a functional local-first VenueTwin Studio.

## Current capabilities

- Responsive product landing page
- Interactive Three.js venue model
- Straight, fan and block geometry presets
- Adjustable rows, seats, sections, rake and stage width
- Clickable seats with a simple view-quality estimate
- Local floor-plan selection (files are not uploaded)
- Browser persistence through local storage
- Project export as `.venuetwin.json`
- About and fallback pages
- Prepared environment variables for a later Supabase integration

## Technology

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

The current application works without environment variables. When cloud persistence is implemented, create `.env.local` from `.env.example` and add the public Supabase project values. Never commit `.env` or `.env.local`.

## Branch strategy

- `main` — stable releases
- `develop` — integration branch
- `feature/*` — isolated feature work

New work should branch from `develop` and return through a pull request.

## Planned architecture

The frontend is intentionally deployable as a static Vite build, including on Simply.com. Supabase is the planned service for PostgreSQL data, authentication and floor-plan storage. A separate Python/FastAPI service can later handle computer-vision analysis without coupling it to the web client.

## Product status

This is a validation prototype, not an architectural or safety-certification tool. Sightline scores and venue dimensions are currently estimates.
