# National Theatre Prague: estimated spatial study

This is a configurable prototype inspired by the supplied auditorium photographs,
not an official digital twin, measured reconstruction or ticketing seating chart.
No uploaded photographs, PDFs or DWG originals are published in this repository.

## Use

Open Studio > New project (reset-arrow icon) > **Open National Theatre study**.
Export/save your current project first if you need to retain a local-only draft.
The sample is a new project with five levels. Switch to 3D to see the live
balcony decks and parapets; select a seat and choose View from seat.
In 2D, **Visible level** isolates the seats of one level. All-level mode and
PNG/PDF plans overlay levels; they are not individual floor drawings.

In **Seating levels**, edit base heights; select a row through a seat in 3D or
the Seat categories controls to edit its local rise, level and arc parameters.
Seat labels A-X are prototype identifiers, not the theatre's official numbering.
The normal single-level auto-layout tool is disabled for multi-level projects.

The Blender export uses the same deck segments as the live preview. Update your
local `build_venue.py` from this branch before running it: the scene validator
now permits up to 2,000 architecture pieces. Existing GLB attachments are static;
remove/rebuild/reimport after changing layout or height.

## What the supplied sources actually establish

- Interior photos: qualitative auditorium form, red upholstery, gold-toned
  balcony fronts, multiple tiers and side boxes.
- `1578406532-nd-pudorys.pdf`: stage and backstage technical layout, not a full
  auditorium seating plan. Stage machinery rectangles must not be read as seats.
- `1578406606-nd-rez.pdf`: stage/fly-tower section and orchestra-pit context;
  does not provide the audience balcony elevations used here.
- DWG files were received, but their geometry has not been decoded/validated.
- Official seating-plan page for future seat mapping:
  https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste
  The current sample does not transcribe or claim agreement with its seat counts.

## Explicit modeling assumptions (all unmeasured)

| Level | Base height | Rows | Local row rise |
|---|---:|---:|---:|
| Parterre | 0 m | 10 | 0.11 m |
| Balcony 1 | 3.7 m | 4 | 0.24 m |
| Balcony 2 | 6.9 m | 4 | 0.24 m |
| Gallery 1 | 10.1 m | 3 | 0.38 m |
| Gallery 2 | 13.1 m | 3 | 0.38 m |

Upper rows use 155-degree arcs with starting radii 10.6/10.95/11.3/11.65 m,
increasing by 0.85 m per row. Parapets are estimated at 0.8 m. Stage width is
11.5 m. These values are design assumptions, **not measurements from the PDFs**.
Decks use short box segments to leave the centre open. No side-box partitions,
accurate aisle layout, orchestra-pit depression, ceiling, painted curtain,
ornament, lighting reproduction or occupied-seat obstructions are reconstructed.

## Next evidence needed

Measured auditorium/section drawings to calibrate tier heights and distances;
official per-level seating maps to replace placeholder rows, seats and IDs.
Validate representative real-seat views before any customer-facing accuracy claim.
