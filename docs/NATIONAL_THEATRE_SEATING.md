# National Theatre seating study

In Studio, choose **New project → Open sourced stalls study · rows 1–13**.
This creates a separate project; it does not migrate existing projects.
Use **Customer preview** to choose Parterre, a numbered row and a seat.

## Source and scope

Transcribed and visually checked on 7 October 2026 against the theatre's
[official seating page](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste)
and its [linked PDF](https://media.narodni-divadlo.cz/11302/1764234380-nd-gold.pdf).
The PDF metadata records creation on 26 November 2025.

| Stalls row | Numbered sale seats |
| --- | --- |
| 1 | 1–21 |
| 2 | 1–22 |
| 3 | 1–21 |
| 4 | 1–22 |
| 5 | 1–21 |
| 6 | 1–22 |
| 7 | 1–19 |
| 8 | 1–22 |
| 9 | 1–21 |
| 10 | 1–20 |
| 11 | 1–19 |
| 12 | 1–18 |
| 13 | 1–15 |

263 numbered stalls seats. Row 7's two service places are excluded.
Boxes, standing places and service seats are not mapped. Upper tiers retain
the old study's placeholders; total study capacity is not official capacity.

## Geometry and Blender

Spacing, curvature, rise and positions remain estimates, not measured coordinates.
The plan verifies numbering, not camera sightlines. No source artwork is bundled.

The new layout has different row decks. Export **detailed theatre JSON**, run
`scripts/blender/build_national_theatre.py` with it, then load the new GLB.
Do not attach the old study's GLB to this layout. See
[the detailed model workflow](NATIONAL_THEATRE_DETAIL.md).

Source status checks row label, level, uniqueness and count. Editing these can
withdraw that status; restoring them can restore it. Geometry edits never imply
verified views. Existing projects and labels retain their previous behavior.

Validation: regression tests, TypeScript, production build and ESLint.
Browser interaction and the regenerated Blender model need local visual review.
