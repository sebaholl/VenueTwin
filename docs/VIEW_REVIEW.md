# Representative view review

Open Studio → **Review views**. This is a comparison workspace, not a validation certificate.

1. Open a source link or load the official gallery photograph. Local JPG/PNG/WebP images are also supported for the session (10 MB maximum).
2. Pick a representative model seat or a specific model label. These are candidate camera positions, not locations inferred from the photograph.
3. Match the framing using vertical field of view, eye height, yaw and pitch. Both panels use the photo's aspect ratio and the complete image is shown without cropping.
4. Try seating setback, level elevation and balcony parapet body height in a draft. Toggle the original geometry for comparison. Geometry changes temporarily use generated architecture because the loaded GLB is stale.
5. Download a review record containing source/location evidence, notes, exact camera settings, aspect ratio and both configurations. Photographs are not embedded. Every record is explicitly unverified.
6. Apply the geometry draft only when justified. It is one undoable project edit. Re-export detailed JSON, reopen the updated Blender script and rebuild the GLB after any geometry changes. Camera experiments do not change the customer camera.

No default auditorium dimensions were changed in this feature. An image match with unknown location, lens, crop and camera height cannot independently determine balcony height or stage distance. Rail trim may extend above its nominal body height. The new parapet setting affects curved balcony fronts, not decorative side-box rails or separate obstacle railings.

## Research checked 7 October 2026

- [Official theatre gallery](https://www.narodni-divadlo.cz/cs/sceny/narodni-divadlo): inspected curtain/boxes photo `1762521984-narodnidivadlooponahlediste2-2560px.jpg`. Side position is apparent; exact seat, level, camera height and lens are not documented. Suitable for architectural comparison, not verified sightlines.
- [Theatre partner collection](https://artsandculture.google.com/partner/n%C3%A1rodn%C3%AD-divadlo-national-theatre) lists [interior tour 1](https://artsandculture.google.com/streetview/prague-national-theatre-interior/KgH8C9a4VWANjw) and [interior tour 2](https://artsandculture.google.com/streetview/prague-national-theatre-interior/ogGklw813u2hhg). Listing and links checked; no ticket-seat metadata retrieved and interactive panorama navigation not validated here.
- [The theatre's own account of its Google collaboration](https://www.narodni-divadlo.cz/cs/emagazin/google-arts-culture-predstavil-prvni-digitalni-sbirku-venovanou-cesku-soucasti-je-144262236) corroborates the institutional relationship.
- The old `narodni-divadlo.cz/panorama/ND_vsechny` URL linked in a 2015 news report returned a 404 page in direct retrieval. It is not included in the app.
- A first-person Flickr caption supplied a gallery area/row but no precise photographic seat; it was insufficient for calibration. Generic “National Theatre” seat sites also returned other cities, which were excluded.

No web photograph is bundled or redistributed in the repository. The official image loads from its publisher only when requested. Source availability can change; use the original page link if loading fails.

## Checks

Run `npm test`, `npm run build`, `npm run lint` and `python3 scripts/blender/test_seat_rows.py`.
Locally check image loading, the reference aspect ratio, each camera control, original/draft toggle, download, Apply then Undo, and a regenerated detailed GLB. Browser interaction and full Blender rendering were not tested in this environment for this feature.
