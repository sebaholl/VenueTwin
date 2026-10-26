# Real venue source audit: The Agenda

Checked 26 October 2026 for a real VenueTwin demonstration. This is a research record, not an approved venue package. No external venue source file is committed or released by VenueTwin. The user chose an [original fictional showcase](ORIGINAL_SHOWCASE.md) for the presentable demo while these real-venue gaps remain.

## Best available candidate

[The Agenda's official downloads page](https://www.theagenda.com/downloads) offers an auditorium SketchUp model, auditorium and seating CAD drawings, sections, PDFs and a seating workbook. The venue's [auditorium page](https://www.theagenda.com/venues) has appearance photographs and describes a 17 m high, reconfigurable room. This is substantially stronger geometry evidence than a seat chart alone.

| Source | Official location | Locally inspected SHA-256 | What it supports |
| --- | --- | --- | --- |
| Auditorium 3D model, SKP | [Official model download](https://public.3.basecamp.com/p/n2TJBDczLN4cnjNQgoDmgHUc) | `d0b437a2f870a8f1e8a01cdea8160d6d6fa59a0137723c2dde4984ea2a17ffc8` | A venue-authored 3D design file; as-built accuracy and contents still need validation. |
| Seating plan, DWG | [Official drawing download](https://public.3.basecamp.com/p/iAkeKWj3hRRAnhU34VoKRN8y) | `f16c82d5ff251a62bb96245fa77212a79a9c3b46b997e481483bb29f0fd623c5` | A named seating configuration; coordinate system and current configuration need confirmation. |
| Full-house seating workbook, XLSX | [Official workbook download](https://public.3.basecamp.com/p/tX8eEsWxF2jwi2x29ogNtQ77) | `aa7a4b118f57bd118db0d406971daf1468650d3eefd92ac259ebd9d3847faa16` | Seat numbering and visual grids. The workbook has three layout sheets whose displayed grand totals are 2,693, 2,999 and 2,094. It does not provide metre coordinates or seated-eye positions. |

The owner explicitly warns on its downloads page that seating plans are subject to update and that users should confirm the latest version. Its photograph gallery does not identify camera positions, lenses or seat IDs. Public downloads do not state permission to redistribute the CAD/model files, create and publish a derived photorealistic model, or reuse photos as textures. Those permissions must be obtained before a public or customer demo using these assets.

## Local source conversion and measured features

The official SKP was parsed locally with OpenSKP into a 31,793,180-byte GLB. It contains 2,477 glTF primitives and 83 material definitions. Its axis-aligned Y-up bounds are approximately 81.932 × 20.248 × 59.417 metres; this is a design-model bounding box, **not** a surveyed as-built auditorium measurement. The file exceeds VenueTwin's 25 MiB managed-viewer limit and has no VenueTwin seat cameras. Neither the SKP nor its derived GLB is committed or published.

The official seating DWG was read directly and converted offline to DXF. The drawing has 441,275 LINE entities, millimetre units, no named seat objects or text labels, and flattened Z=0 linework. The conversion preserves that entity count. The DXF SHA-256 is `f47b876ca8d4f9734fe6d0595a05887718bac839c80dc551f77fd3eef069ac4c`.

With the explicit main-auditorium crop X=[-30,000, 30,000] mm and Y=[-16,000, 10,000] mm, [the local CAD feature extractor](../scripts/inspect-seating-dxf.py) identifies **2,386 unique 400 mm horizontal chair-line midpoints**. Candidate coordinates span X=-27,710.610 to 28,489.389 mm and Y=-14,665.399 to 9,334.601 mm. These are reproducible drawing features, not yet verified seat centres. The count does not equal any of the workbook's 2,693/2,999/2,094 layout totals; the DWG and workbook must not be assumed to describe the same configuration. The cropped region also omits rear seating shown in the drawing. The candidate list stays outside the repository.

Reproduce the local extraction after obtaining the source DWG and converting it to DXF with a local DWG reader:

```bash
python3 -m pip install ezdxf
python3 scripts/inspect-seating-dxf.py /path/to/seating.dxf \
  --output /private/tmp/agenda-seat-features.json \
  --bounds-mm -30000 -16000 30000 10000
```

## Gate before calling this a 1:1 replica

1. Confirm a single current fixed seating configuration and obtain the dated, as-built coordinate system, dimensional tolerance and seat centres. The 2,693/2,999/2,094 workbook layouts cannot be blended into one seat inventory.
2. Obtain the seat-eye height/offset method or surveyed eye coordinates, plus stage target, rails and every relevant obstruction. CAD geometry alone does not establish the seated human eye.
3. Obtain original photographs from identified seats with camera pose/lens/crop and rights for private comparison and public appearance use. General marketing images can guide appearance but cannot calibrate a named seat.
4. Align the converted SKP and DWG coordinate systems, compare dimensions with dated plans/sections, and record any mesh simplification error. Local conversion and basic file inspection are complete; coordinate registration and physical accuracy checks are not.
5. Have the venue review the exact final model revision and rendered views. An official download page is evidence of provenance, not visual approval or publication consent.

VenueTwin's contract, Blender exporter and Three.js checks can process reviewed metre-scale meshes, seats, source-linked PNG textures and calibrated camera/photo landmarks. They cannot supply missing physical measurements or owner rights. Until all five gates are met, an Agenda model belongs in a clearly marked **study**, never the `reviewed` customer release.

For comparison, the [University of Edinburgh's St Cecilia's Hall scan](https://www.research.ed.ac.uk/en/datasets/st-cecilias-concert-hall) provides 13 registered laser-scan locations, but the public record does not provide a fixed sale-seat inventory or seat-identified calibrated reference photos. The [Berlin Philharmonie research capture](https://blog.rwth-aachen.de/akustik/paad-in-berlin-philharmonie/) describes exactly the geometry and audience-view panorama combination VenueTwin needs, but says those data **will become** openly available; it is not currently a downloadable production input.
