# Voxel pipeline

**Status:** IMPLEMENTED APIs below are real. Items marked PLANNED / DEFERRED are not.

## Flow

```
SMOOTH SEMANTIC GUIDE (hidden)
        ↓
voxelizeMesh          occupancy sampling of MeshIR / topology surface
        ↓
extractVoxelSurface   6-neighbour hidden-face / interior rejection
        ↓
createVoxelArtifact   serializable cells, region ids, bind pose, hash
        ↓
instantiateVoxelArtifact
        instances  — InstancedMesh of rigid cubes (hero)
        faces      — merged visible quads (static environment)
```

## Public engine APIs (`@sumosizedginger/my-game-engine-1.0/full`)

| Name | Role |
|---|---|
| `VOXEL_QUALITY` | `COARSE` 0.12m, `MEDIUM` 0.06m, `HIGH` 0.028m, `HERO` 0.012m |
| `createVoxelDefinition` | id, quality, voxelSize, fillInterior, sourceGuideId |
| `voxelizeMesh` | MeshIR or `{attributes, indices}` → occupancy grid |
| `extractVoxelSurface` | surface vs enclosed, visible faces |
| `createVoxelArtifact` | frozen artifact + `voxelHash` |
| `instantiateVoxelArtifact` | batched Three.js runtime; `dispose()` |

## Game wiring

- Guide: `src/game/character/continuous-body.js` + `hero-guide-body.js` + `hero-face.js`
- Hero compile: `src/game/voxel/hero-voxel.js` → `createOpponentSumo`
- Environment: `createAssetLibrary({ voxelQuality })` voxelizes MeshIR placements
- First person: `src/game/assets/hero-kit.js` blocky fists, voxelized at HIGH

## Deformation

**IMPLEMENTED (experimental in the sense of first production use):** bind-space voxel centres, four bone weights copied from the nearest guide vertex, LBS of the centre, blended bone rotation, **uniform** cube scale. Cubes do not stretch.

Soft-mass (belly/flank/glute jiggle) is **PLANNED**. The representation stores per-voxel bind samples so it remains possible.

## LOD

**DEFERRED.** Quality names exist; no runtime LOD switch yet.

## PNG projection

`artifact.colorBinding.pngProjection` is reserved and **null**. Colour today is region palette + mild coordinate jitter, **not** baked lighting. Future: generated PNG → directional / semantic projection → per-voxel albedo → runtime lighting.

## Metrics

Hero diagnostics expose occupied / surface / visible faces / voxelSize / generationMs / drawCalls via `opponent.diagnostics().voxel`.
