# Czech venue source survey and Reduta technical study

Checked 26 October 2026. This is a survey of prominent official venue sites, not an exhaustive list of every venue in Czechia. The best public technical source found is **Reduta Theatre in Brno**. The local preview imports its official SketchUp file into Three.js. It is technical geometry only; it is not a photographic or validated 1:1 replica.

| Venue | Official public material | Critical absence for a verified replica |
| --- | --- | --- |
| [Reduta Theatre, Brno](https://www.ndbrno.cz/o-divadle/budovy/divadlo-reduta-tech-udaje/) | Stage dimensions, [plan](https://www.ndbrno.cz/wp-content/uploads/2021/09/RedutaPudorys_A3.pdf), [section](https://www.ndbrno.cz/wp-content/uploads/2021/09/RedutaRez_A3.pdf), and [SketchUp model](https://www.ndbrno.cz/wp-content/uploads/2023/03/reduta_sketchup.zip). Official page lists 286 seats (241 stalls, 45 balcony). | SketchUp file is a technical shell/stage model, not 286 modelled seats; the plan only depicts the front rows. No complete seat-eye survey, calibrated photo set, detailed material scans, or explicit model/photo republication licence found. |
| [Janáček Theatre, Brno](https://www.ndbrno.cz/o-divadle/budovy/janackovo-divadlo-tech-udaje/) | 1,103-seat capacity, stage dimensions and downloadable plans/sections. | No public complete seat-centre/eye inventory or detailed photogrammetry. |
| [Rudolfinum Dvořák Hall](https://www.rudolfinum.cz/prostory/dvorakova-sin/) | Capacity, room areas, photos and floor-plan link. | No public measured 3D seat-eye model or calibrated photo set located. |
| [Antonín Dvořák Theatre, Ostrava](https://www.ndm.cz/cz/stranka/1033-vykresy-jeviste-divadla-antonina-dvoraka.html) | Stage drawings and sections. | Full audience-seat geometry and photorealistic material source absent. |
| [National Theatre, Prague](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste) | Official seating plan and stage technology; see [existing Prague study](PRAGUE_REAL_VENUE_PILOT.md). | Seat locations and eyes remain estimates. |

## Reproducible local Reduta import

The official Reduta ZIP downloaded on 26 October 2026 had SHA-256 `0042b8a2d158b962adc3b458155d105864c693964bb4e6bc8b79cd08f8f1a7cd`. The plan PDF hash was `829325adbfa9dfaaa422f175bd1380482ddb8be09d6f2fbf0e06590e2d77f44f`, and the section PDF hash was `07bb2fb9b36635f98a6935846d06da292aa4b4c3cfabe3cb9ffd15b1ae3ffe4e`. Those hashes document the exact files inspected, not their accuracy or licensing.

From the VenueTwin checkout:

```bash
npm ci
npm run reduta:prepare
npm run dev
```

Open the `/reduta-preview.html` page at the local address printed by Vite (often `http://127.0.0.1:5173/reduta-preview.html`). The importer downloads the free official ZIP, checks its known hash, and writes a GLB and source hash report into ignored `public/venues/reduta-study/v1/`. You can alternatively pass a local `reduta.skp` path as an argument. It makes no paid API call and performs no Blender render. It does not add the model to a managed customer release. The preview labels all authored geometry and viewpoints as estimates.

The later [photo-guided local study](REDUTA_REFERENCE_NOTES.md) adds 241 **inferred** stalls seat meshes and selectable illustrative eye views on the imported stepped floor. The page labels every view as estimated. Those positions are authored from the visible geometry and references, not from an official seat-centre or eye-point survey. The 45 balcony seats are not included. The photos are not bundled.

The inspected official SKP produced 55 GLB primitives and an approximately 16.3 × 18.8 × 39.2 metre axis-aligned bounding box. These are import diagnostics, not audited dimensions of the auditorium. The section shows stepped audience geometry and the plan depicts some front chairs; neither gives a complete, stable 286-seat 3D inventory. A 1:1 customer claim therefore cannot be validated from these files alone. Photos supplied later can inform materials and comparison only if their viewpoints and usage rights are known; they cannot turn missing seat coordinates into measurements.
