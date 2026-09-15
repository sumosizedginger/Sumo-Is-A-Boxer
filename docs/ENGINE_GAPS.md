# ENGINE GAPS — My Game Engine 1.0

Recorded while building **SUMO IS A BOXER** as a consumer of `@sumosizedginger/my-game-engine-1.0`.

**Updated VOXEL-PIVOT-001.** The engine **is** modified in this repository: Voxel Forge is a real public subsystem. Do not claim “engine untouched” or “read-only engine.”

Historical boxing-shaped examples below are provenance, not current art direction.

## Still open

### GAP-01 — Scene presentation is not public
**Severity: DETOUR.** `toBufferGeometry` and `createScenePresentation` remain withheld. The game still owns `asset-library.js` + `presenter.js`. Voxel environment placements go through that same game-owned door, now compiling MeshIR → Voxel Forge.

### GAP-02 — Modeling verbs still cannot revolve
**Severity: DETOUR.** Unchanged. Game-owned `kit.js` still supplies revolve / tube / roundedBox.

### GAP-03 — Fuse / part budget
**Severity: FRICTION.** Unchanged. `assemble()` / `fuse()` remain game-owned.

### GAP-06 — No texture / PNG pathway in Material Forge
**Severity: DETOUR.** Voxel colour is region/instance colour. PNG projection is a reserved artifact hook (`colorBinding.pngProjection = null`), not an engine material feature.

### GAP-07 — Character Forge material options
**Severity: FRICTION.** Guide mesh still takes raw colour/roughness; visible hero uses Voxel Forge instance colours.

### GAP-10 — No VFX subsystem
**Severity: DETOUR.** Impact debris is game-owned cubic points.

### GAP-12 — Character forward +Z vs scene −Z
**Severity: CONFLICT.** Unchanged. Opponent group still applies a half-turn.

## Closed or reduced this milestone

- **Voxel occupancy / surface / batched runtime** — IMPLEMENTED as Voxel Forge (`VOXEL_FORGE.md`).
- **“Engine must not change” game test** — replaced. The game still may not deep-import `engine/src`.

## New gaps

### GAP-V1 — No engine-owned voxel LOD
**Severity: DEFERRED.** Quality names exist; no distance LOD.

### GAP-V2 — No greedy meshing
**Severity: PLANNED / withheld.** Hidden-face culling exists. Aggressive greedy merge would erase hero microstructure.

### GAP-V3 — Deformation is LBS of centres, not a voxel soft-body solver
**Severity: PLANNED.** Sufficient for the pivot; not final sumo mass.
