# Lantern showcase material sources

The six local 1K JPEGs in `venue-data/lantern-opera-house/materials/` come from [Poly Haven](https://polyhaven.com/license), which publishes these assets under CC0. They are embedded in the managed GLB and packed in `lantern-showcase.blend`; the browser does not request them from Poly Haven. They are appearance references, not material measurements of a real venue.

| Material | Official asset | Files | SHA-256 (diffuse / OpenGL normal) |
| --- | --- | --- | --- |
| Dark wood | [Dark Wood](https://polyhaven.com/a/dark_wood) | `dark_wood_{diff,nor_gl}_1k.jpg` | `d68da31655bf47024af893156a6a01a6c95bb60f55d97e2dc9bdd47be320e5b5` / `c42541f1bda0a14b39f120c24407eeba699af8ac85b371c7cef98ffd7d7b13bf` |
| Painted plaster | [Painted Plaster Wall](https://polyhaven.com/a/painted_plaster_wall) | `painted_plaster_wall_{diff,nor_gl}_1k.jpg` | `440310f05af089f2c93353167573403cbc3f805948203237b5d26431eeb9e19c` / `8eb01647d126eb5341e2c325821ad48c8ca11349dbef53447c95422c5d91cc9d` |
| Velour | [Velour Velvet](https://polyhaven.com/a/velour_velvet) | `velour_velvet_{diff,nor_gl}_1k.jpg` | `e6e92d808b3456deb892ff17905f3b44717fcfbcbce9fcf03ad7abcabda799df` / `046c92c48c1cb36656d394addf21dea9582f563479b73f2c0b16f356128e872b` |

The builder assigns planar UVs in metres and repeats these maps at authored visual scales (0.75–2 m per tile). Those scales are design estimates. The Blender scene uses the same maps and UV rule, and `npm run showcase:verify` checks that the GLB contains exactly the six local image bytes with no remote URI. The textures improve surface detail; they do not establish photographic or dimensional agreement with any building.
