# Prague National Theatre: measured-venue intake

This is a **research and measurement intake, not a finished customer venue**. It targets only stalls rows 1–13 in the historical National Theatre building in Prague. It lives in the existing VenueTwin repository on a review branch. The official seat identifiers are useful immediately; accurate seat-view geometry is still missing. The existing Studio/Blender theatre study uses estimated dimensions and may be used for visual discussion only.

## What has actually been established

- The theatre's [official seating-plan page](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste) links to its [official PDF](https://media.narodni-divadlo.cz/11302/1764234380-nd-gold.pdf). As checked on 23 October 2026, the stalls study covers 13 rows and 263 numbered sale seats. The two row-7 service places are excluded. This supports **identities and row membership**, not metre-scale positions.
- The official PDF's SHA-256 on that check was `37978bed76957e3d976155b88e32389d49992995d6f0976c03175f39b863dbde`. It is recorded for source integrity; the PDF is not committed.
- The theatre's [stage-technology page](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/jevistni-technologie) links to [stage/backstage plans](https://media.narodni-divadlo.cz/11302/1578406532-nd-pudorys.pdf) and a [section](https://media.narodni-divadlo.cz/11302/1578406606-nd-rez.pdf). These do not establish the auditorium seat coordinates or tier elevations needed here.
- The [official gallery](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo) shows the architectural appearance. Its published images do not identify exact ticket seats, camera height or lens. They remain linked references, not redistributed model textures.

The source ledger is in [intake.json](../venue-data/national-theatre-prague/intake.json). The [seat survey table](../venue-data/national-theatre-prague/seat-survey.csv) carries all 263 stable IDs, with every coordinate and eye position blank. Empty fields are intentional. Nothing from the existing approximate model was copied into measurement columns.

## Local visual study

Run `npm run demo` and open [the unverified Prague study](http://127.0.0.1:4174/venue?venue=/venues/prague-national-theatre-study/v1/venue.json). It has 263 selectable sale-seat IDs and a first-person view from each **estimated** eye point. Every screen labels it an unverified study. It is a way to inspect the current approximation and plan measurements, not a customer venue or ticket-buying guide.

The [estimated production draft](../venue-data/national-theatre-prague/unverified-production-draft.json) comes from the existing Studio National Theatre study through `scripts/prepare-prague-study.mjs`. It retains the Studio's approximate geometry, adds a clearly assumed 0.9 m seat-anchor-to-eye offset and an estimated stage target, then runs through the strict production contract and local Blender/Three.js verifier. The generated [public study package](../venue-data/national-theatre-prague/public-study/venue.json) contains only seat labels, explicit approximate coordinates and the self-contained GLB; no official PDF or photo is redistributed. The source-aware intake table remains blank and separate. The package uses quality `study` and the real customer-release builder rejects it.

## Data needed from the venue owner or surveyor

Use a common measured coordinate frame with a documented origin and uncertainty. For **every sale seat**, supply the seat centre or anchor `(x,y,z)`, seated-eye point `(x,y,z)`, facing yaw, stable row/seat ID, source ID and positional uncertainty in metres. Capture a measured stage-view target. Supply dimensioned auditorium plan and longitudinal/cross sections, level elevations, shell geometry, aisles, columns, rails, balcony parapets, orchestra pit and all sightline obstructions. Record explicitly surveyed absence where no obstruction exists.

Supply reference photos from identifiable seat IDs across front, centre, rear and known restricted views. For each photo record capture date, exact seat, camera/eye height, focal length or field of view, crop, and permission to use it in model evaluation or publication. General gallery images are only architecture references. Venue staff should review representative first-person comparisons and the final 263-seat inventory, then record corrections and approval. Confirm who owns or licenses the plans, photos and final public model.

No one has contacted the theatre or obtained publication permission as part of this work. The official public plan does not by itself authorize redistribution of its artwork or certify derived geometry. The intake contains links and a transcription of row/seat identifiers; it does not bundle the PDF or photos.

## Deterministic readiness check

From the repo root:

```sh
PYTHONPATH=services/planner python3 -m venuetwin_planner.intake venue-data/national-theatre-prague
```

It currently exits with status 1 and reports **0/263 measured seats**, missing room/stage/obstruction measurements, photo calibration, source files, material/lighting references and owner approval. Invalid or duplicate seat IDs, malformed coordinates and unsupported measurement claims fail. Filling fields will only make the intake structurally complete; it never proves the measurements are true. The production v1 contract and its Blender/Three.js verification must still run, and a venue owner must compare the output with reality before any reviewed customer package can be created.

## Survey-to-Blender handoff

Once the survey and approvals are complete, compile the intake into Blender's production contract with:

```sh
PYTHONPATH=services/planner .venv/bin/python -m venuetwin_planner.compile_intake venue-data/national-theatre-prague measured-venue.json
```

This command currently **fails intentionally** for Prague because measured fields and approvals are missing. It never calls OpenAI or Blender. The output file must not already exist. Pass its resulting JSON to the existing local production builder; its manifest still requires human review and does not certify 1:1 accuracy.

The compiler expects each `measurement_source_files` entry to contain `id`, `kind` (`survey` or `drawing`), `file` (a local path beneath the intake directory), and `description`. Each `photo_records` entry needs `id`, `file`, and `description`; the photo file is hashed as reference evidence, not used as geometry. Only local source files are accepted, and their SHA-256 is recorded in the contract. `measured_level_elevations_m` maps level IDs to `{name, elevation_m, source_id, uncertainty_m}`. Each `room_shell_boxes` and `occluder_boxes` entry has `{id, position_m, size_m, yaw_rad, source_id, uncertainty_m}`. `occluder_assessment` records `{source_id, uncertainty_m}` even if no occluder exists. Stage, overall scale, and seat-inventory uncertainty fields are `stage_target_uncertainty_m`, `scale_uncertainty_m`, and `seat_inventory_uncertainty_m`; all are positive metres. `material_references` and `lighting_references` list local photo source IDs.

The production contract retains measured seat and seated-eye positions exactly. The Blender builder exports a GLB, and the Three.js verifier checks coordinates and camera positions after import. It cannot independently prove the survey or photorealistic likeness. Calibrated camera lenses, photo alignment, textured meshes, and venue-owner visual sign-off are still needed before claiming 1:1 results.

The current scope is stalls only. Boxes, balconies, galleries, service positions and standing places are outside this intake and cannot be shown as accurately covered. If the first customer venue is another auditorium, use this as an intake pattern and do not reuse the Prague identifiers.
