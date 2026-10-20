# Blender round-trip (local prototype)

This bridge creates an approximate architectural scaffold from existing VenueTwin
geometry. It does **not** reconstruct a real venue from a floor-plan image.
Target: Blender 5.x using the built-in glTF exporter. Actual execution in Blender
5.2.2 still needs verification on the user's machine; no Blender runtime is
available in the development workspace.

## First run on your Mac

1. In Studio, open **Blender bridge · local preview** and choose **Export Blender
   scene JSON**. This is a dedicated blueprint, not the normal project backup.
2. In Blender, open the **Scripting** workspace. In the Text Editor use **Open**
   to open `scripts/blender/build_venue.py` from your local VenueTwin repository.
3. Switch to Object Mode if necessary and press **Run Script** (the play icon).
4. In the file picker choose the exported `.venuetwin-blender.json`.
5. The script adds an architecture collection and non-exported seat-reference
   empties. It exports a uniquely named `.glb` next to the chosen JSON. Look at
   Blender's status message for the output path.
6. In VenueTwin's Blender panel, load that GLB and switch to **3D model**. Select
   a seat, then **View from seat**. Compare front/back and left/right seats.

Existing Blender objects are preserved and excluded from this automatic export.
The default cube may still be visible in Blender: hide it for inspection; it is
not included in the generated GLB. Use File > Save As if you want a `.blend` file.
Each script run creates another collection and a new GLB; nothing is overwritten.

## Geometry contract

- One numerical unit = one metre; no automatic centering or scaling on import.
- Web local coordinates are X right, Y up, Z toward the back of the venue.
- Blender coordinates are `(web X, -web Z, web Y)`, with positive Z rotation
  corresponding to the web model's positive Y rotation.
- GLB export has `export_yup=True`; this restores the web coordinate convention.
- Do not bake the web display offset `(0, -1.4, -2.8)` into the GLB. The viewer
  applies it once to both architecture and interactive seats.
- Architecture replaces the default stage/screen/floor. Seats and configured
  obstacles remain rendered by VenueTwin; do not include duplicates in the GLB.
- Seat-reference empties help manual modeling and are excluded from export.
- Initial row decks are axis-aligned bounding boxes: curved/rotated/moved rows
  may produce overlapping decks. Manually refine these; no stairs, aisle design,
  room envelope, balconies or certification are inferred.

## After editing in Blender

Select **only** your architecture objects, then File > Export > glTF 2.0.
Choose **glTF Binary (.glb)**, **Selected Objects** and **+Y Up**. Do not enable
Draco/compressed texture extensions for this initial loader. Keep the original
origin and scale. Reimport the new GLB in Studio.

## Current limits

The file is local to the current browser session. Refreshing or opening another
project removes the attachment. It is not uploaded to Supabase, saved in JSON,
included in PNG/PDF, or shown in public shared links. Only self-contained GLB
files up to 25 MB are accepted; external-resource URLs are rejected. Large
textures or complex models may still be too heavy for phones. No animation or
camera from the GLB is used. Rebuild or realign after changing venue geometry.

## Verification

`npm test` covers blueprint coordinates and GLB validation.
`python3 -m unittest discover -s scripts/blender -p 'test_*.py'` tests coordinate
conversion and input checks without Blender. These are not an end-to-end Blender
test. The first user run must verify export, orientation, scale and seat alignment.

Official API reference: https://docs.blender.org/api/5.2/bpy.ops.export_scene.html
