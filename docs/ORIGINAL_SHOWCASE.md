# Lantern Opera House: original demonstration

The managed local preview includes Lantern Opera House, a fictional 225-seat theatre authored for VenueTwin. It demonstrates the product flow from an explicit metric blueprint to detailed auditorium geometry, a Blender-editable scene, an embedded GLB, and named seat views in Three.js. **It is not a replica of a real venue and is not photorealistic or a verified sightline.** Its 1:1 digital coordinate scale means one scene unit equals one authored metre; it does not establish physical accuracy against an existing building.

## Open the experience

From this repository branch:

```sh
npm ci
npm run demo:viewer
```

Open the printed local address, then choose **Explore Lantern Opera House**. The front page and Studio remain available separately with `npm run demo`. If port 4174 is busy, use `PORT=4175 npm run demo:viewer` and open `http://127.0.0.1:4175`.

## Rebuild and verify offline

```sh
npm run showcase:build
npm run showcase:verify
npm run build:managed:demo
```

The deterministic Python builder writes `venue-data/lantern-opera-house/blender-blueprint.json` plus the managed customer viewer's `public-demo/venue.json` and self-contained `venue.glb`. The verifier loads the actual GLB through Three.js without remote assets, checks its hash, all 225 seat anchors, camera eye positions, camera aim, lens and architectural mesh presence. The managed release accepts it only in `--demo` mode; the customer release requires `reviewed` quality.

The same blueprint can be passed to `scripts/blender/build_national_theatre.py` to produce an editable `.blend` and a detailed GLB with an original dedication. On this Mac, native Blender 5.2.2 crashes at startup. The existing local `venuetwin-phase1:local` container (Blender 3.4.1) builds the editable scene offline. The script selects Blender-compatible emission and colour management controls. No model or renderer API is called remotely. Blender's detailed GLB is an appearance asset; the managed viewer uses the separate versioned package whose camera anchors are verified.

The showroom is a strong **interactive technical demo** of architecture, level selection, seats and views. It still uses procedural materials, stylized chairs and authored lighting. Photorealism would require artist-grade or source-licensed textures, modelling, lighting and visual review. A 1:1 claim about an actual venue additionally requires an as-built survey, seat-eye survey, camera-calibrated reference images, and venue approval. See [the real-venue source audit](REAL_VENUE_SOURCE_AUDIT.md) for the best public-source candidate and its missing evidence.
