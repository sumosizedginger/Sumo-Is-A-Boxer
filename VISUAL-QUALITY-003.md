VISUAL-QUALITY-003

STATUS: PHASE 1 BUILT, AWAITING VISUAL/PERFORMANCE GATE

This is a progress record. The full tranche is not complete and visual acceptance
is not claimed. Browser tooling returned apps: [], browsers: []; localhost
responds with HTTP 200. A vision-agent review has been requested.

Current inspection URLs:

- http://localhost:5180/?surfaceDetail=1
- http://localhost:5180/?surfaceDetail=0

The off switch bypasses detail sampling while retaining the same material/shader
setup and texture allocations. It supports visual comparison, not a measurement
of the original build's boot cost. The original source is preserved in Git
history (with baseline hashes retained in artifacts/visual-quality-003/).

Files changed in Phase 1

- src/game/presentation/procedural-materials.js, new texture generator and owner
- src/game/presentation/asset-library.js, applies detail after public compilation
- src/game/app.js, owner setup/disposal, comparison switch, report data
- tests/procedural-materials.test.js, new determinism/lifecycle/consumer checks
- ENGINE_GAPS.md, procedural material authoring candidate capability
- This report and artifacts/visual-quality-003/ evidence

Procedural texture architecture

One game-owned resource owner allocates maps lazily during asset setup. It
reuses them across 24 selected material bindings and never generates or uploads
new content in combat updates or rematches. Destruction restores prior material
hooks and disposes each owned texture once. No per-frame map generation.

Each RGBA8 texture packs height in R, roughness modulation in G and grayscale
albedo gain in B. These are linear data, not sRGB images. Original material
colors, metalness and calibrated roughness values are retained; shaders add
restrained modulation. Concrete's dielectric metalness remains unchanged.

Triplanar sampling uses original surface positions and normals to avoid existing
UV seams and stretched tile UVs. It stays attached to skinned surfaces in bind
space. The shader samples three planes per microdetail field. Canvas also samples
one full-sheet history map. Height gradients perturb the lighting normal; no
geometry is displaced. Skin receives roughness modulation only, masked toward
the upper torso and brow. No pores or albedo noise are added to skin.

Generated texture inventory

| Texture | Size | Purpose |
|---|---:|---|
| canvas | 256 x 256 | restrained woven crosshatch and roughness |
| leather | 256 x 256 | shallow irregular cellular grain, roughness |
| skin | 256 x 256 | low-amplitude roughness breakup |
| concrete | 256 x 256 | aggregate microvariation and roughness |
| steel | 256 x 256 | directional abrasion and roughness |
| canvasHistory | 512 x 512 | static corner discoloration and footwork tracks |

canvasHistory is authored static history, not the deferred dynamic fight-history
system. It covers the entire 8.5 m canvas without repetition. Microdetail maps
repeat, with periodic generation, mipmaps, linear filtering and anisotropy capped
at eight and the renderer's supported maximum. Estimated RGBA8 GPU storage with
mipmaps is approximately 3 MiB, excluding driver overhead. CPU pixel data is
approximately 2.25 MiB.

Determinism

Seed 310903. Integer hashing, periodic value noise, bounded cellular grain and
analytical stain fields produce byte-identical content for identical kind, seed
and dimensions. Tests verify repeatability and changes across different seeds.
No external files, image services or network data contribute to generated maps.

Current validation and performance

79 tests pass; production build succeeds. Minified JS is approximately 760 kB,
209 kB gzip. The large-chunk warning remains. Shader hook tests exercise source
composition against the installed Three.js ShaderLib, but do not constitute a
WebGL shader compilation test. That remains part of browser validation.

CPU comparison, all placements, excluding culling, shadows and VFX:

| Measurement | Before | Phase 1 |
|---|---:|---:|
| Triangles | 107,864 | 107,864 |
| Material submissions | 200 | 200 |
| Geometry objects | 37 | 37 |
| Material objects | 126 | 126 |
| Asset generation, one sample | 119.4 ms | 88.2 ms |
| Presentation setup, one sample | 74.7 ms | 161.9 ms |
| Procedural texture generation within setup | none | 116.4 ms |
| Owned procedural textures | none | 6 |

Single CPU timing samples are order/JIT dependent and are not performance claims.
The supplied independent baseline remains 60 FPS, p50/p95/p99
16.7/16.8/16.8 ms, 209 draw calls, 118,228 rendered triangles, 39 geometries,
114 materials / 125 compiled, 135 ms asset build, 74 ms presentation build,
298 ms first frame and zero rematch resource delta.

After FPS, percentiles, rendered triangles, draw calls, runtime textures, first
frame and GPU rematch deltas remain unmeasured here. Read the running report:

    window.__SUMO_IS_A_BOXER__.report()

Live comparison without reloading:

    window.__SUMO_IS_A_BOXER__.surfaceDetail.setEnabled(false)
    window.__SUMO_IS_A_BOXER__.surfaceDetail.setEnabled(true)

Twenty CPU presentation resets retain identical detail resource counts and
generation time. Resource-owner tests verify sharing, no regeneration on toggles,
restored hooks and idempotent disposal. Browser rematch resource checks remain
pending. Baseline hashes confirm no engine-file changes. Protected character,
combat, lighting, ring, warehouse, HUD and impact-effect source files are unchanged.

Required next gate

Capture canvas close/gameplay distance, glove leather, opponent skin under key,
concrete floor and selected gantry/utility steel, plus the full first-person and
title frames. Compare on/off at the same camera. Inspect moire, grazing-angle
shimmer, texture swimming, repetitive weave and specular glitter. Check the
browser console for shader errors. Collect foreground frame percentiles and
resource counts before/after rematches. Supply those findings before advancing.

Remaining phases

Atmosphere, additional warehouse/ringside structure and dynamic fight history
have not started. Dynamic history requires successful static visual validation
as specified in the work order. Rope response and post-processing have not been
attempted. No experiment has been reverted yet. Screenshots captured: none.

Engine gap

ENGINE_GAPS.md records PROCEDURAL MATERIAL TEXTURE AUTHORING as a candidate,
including the accepted APIs, limitation, game-local workaround and what not to
generalize prematurely. No Texture Forge or engine internals were created.

Known limits

- Rendered material appearance and GPU shader compilation remain unverified.
- Six additional textures and fragment sampling add real costs; CPU geometry
  counts do not establish GPU safety.
- Skin sheen and normal amplitudes require the vision agent's moving-light review.
- This is Phase 1 only. The full VQ-003 completion status is not warranted yet.

Evidence: artifacts/visual-quality-003/phase1-comparison.json,
phase1-tests.log, phase1-build.log, phase1-git-status.txt and baseline-hashes.json.
The workspace already contained uncommitted work; it was preserved, not reset.
