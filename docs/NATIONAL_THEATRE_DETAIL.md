# Detailed National Theatre photo study

This version responds to the supplied interior photographs with a complete hall
shell, side-box bays, profiled balcony fronts, repeated gilt scrolls and leaves,
gallery columns, a layered proscenium with the dedication NÁROD SOBĚ, pleated
curtain, framed ceiling fields and a multi-ring chandelier. Red upholstered
chairs replace the block seats when the detailed GLB is attached.

It remains a **photo-informed model, not a measured replica**. The previous
study's assumed levels, heights and seat transforms are preserved. Box spacing,
column profiles, rosettes and scrollwork are interpretations, not traced or
surveyed historical ornament. Side boxes do not add ticketable seats. The
curtain is plain fabric and the ceiling fields are unpainted: no claim is made
to reproduce the actual paintings or sculptural figures. Real aisle geometry,
the orchestra pit and validated sightline obstructions still need further work.

## Build locally

1. Open the National Theatre study in Studio. Save your project first.
2. In Blender bridge, choose **Export detailed theatre JSON**.
3. In Blender's Scripting workspace open `scripts/blender/build_national_theatre.py`
   and Run Script. Choose the newly exported JSON (the old basic export lacks
   the necessary metadata).
4. The script creates a new scene and writes uniquely named `.blend` and `.glb`
   files beside the JSON. Your current scene and existing files are preserved.
5. Open the generated `.blend` to edit the architecture and see the lighting,
   camera and chairs. In VenueTwin load the generated `.glb` into the same study.
6. Overview is a cutaway: the roof and rear wall are hidden so seats are clickable.
   **View from seat** shows the complete shell. Detailed chairs stay interactive;
   category assignments are unchanged even though upholstery is uniformly red.

No add-ons or packages need installing in Blender. The script has been run and
rendered with official Blender **4.5.3 LTS** on Linux. Blender 5.2 has not been
tested here. The GLB uses standard embedded glTF materials and geometry.

For command-line review renders:

```sh
blender -b --python scripts/blender/build_national_theatre.py -- /path/to/study.json --render
```

This creates audience and reverse review PNGs in addition to the model files.
The `.blend` includes seats; the GLB exports only architecture so web seats
are not duplicated. Materials are batched into meshes and browser chairs use
seven instanced parts. Web lighting differs from the Blender Cycles renders.

The detail generator requires centred, unrotated balcony arcs sharing one centre
and the original stage position. It rejects unsupported changes rather than
silently moving architecture away from the interactive seats. Heights and radii
are configurable within the documented validation limits in the script.
After edits, rebuild and reload the GLB. A GLB attachment remains local-only;
it is not included in cloud saves, shared previews, PNG or PDF plans.

## Sources and limits

- The user's seven interior photographs inform the visual relationships and
  palette. They are not redistributed or used as textures.
- Supplied stage/backstage PDFs do not measure the auditorium levels. DWG
  geometry has not been decoded. See `NATIONAL_THEATRE_STUDY.md` for assumptions.
- Official theatre page: https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo
- Official seating plan page, for future mapping (not implemented):
  https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo/planek-hlediste
- Blender runtime: https://download.blender.org/release/Blender4.5/
- Blender Python API: https://docs.blender.org/api/current/

The code creates all decorative geometry directly. No third-party models,
texture packs, generated historical paintings or external fonts are included.

Further fidelity needs high-resolution straight-on photographs of the portal,
balcony ornament and ceiling, plus measured auditorium sections and a seat map.
These would replace the remaining interpretations with traceable geometry.
