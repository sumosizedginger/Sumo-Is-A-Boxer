# VOXEL_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **VOXEL-PIVOT-001**

This document describes **implemented** Voxel Forge contracts. Do not read PLANNED items as shipped.

## 1. Laws

1. A voxel artifact is code-reachable: constructible, inspectable, serializable, reproducible, semantic, testable.
2. Occupancy and artifacts are renderer-independent. Runtime realization may use Three.js, like Character Forge.
3. Visible default is **surface-only**. Fully enclosed cells are not submitted.
4. Adjacent occupied 6-neighbours occlude the shared face.
5. Hero cubes remain **rigid**. Deformation moves centres (and optional orientation); it does not stretch cubes into bricks.
6. Quality is parameterized. `HERO` is the visual ceiling and must not be silently coarsened.
7. PNG-driven albedo is a reserved colour-binding hook, not a current compiler.

## 2. Pipeline

```
DEFINITION (quality, voxelSize, fillInterior)
  → voxelizeMesh(MeshIR | topology buffers)
  → extractVoxelSurface
  → createVoxelArtifact
  → instantiateVoxelArtifact({ mode: 'instances' | 'surfaceInstances' | 'faces', bones? })
```

## 3. Public API

Exported from `engine/full`:

`VOXEL_ARTIFACT_VERSION`, `VOXEL_QUALITY`, `VOXEL_PARAMETER_BOUNDS`, `resolveVoxelParameters`, `createVoxelDefinition`, `voxelizeMesh`, `extractVoxelSurface`, `createVoxelArtifact`, `voxelHash`, `instantiateVoxelArtifact`.

Not exported: dense occupancy arrays, greedy meshing, renderer builders.

## 4. Quality

| Name | voxelSize (m) |
|---|---|
| COARSE | 0.12 |
| MEDIUM | 0.06 |
| HIGH | 0.028 |
| HERO | 0.012 |

## 5. Runtime

- `instances`: one InstancedMesh of canonical grid cubes, optional bone LBS. Draw calls: 1.
- `surfaceInstances`: one InstancedMesh of deterministic guide-surface samples. Samples carry a stable orthonormal frame and preserve rigid isotropic cubes under deformation. Draw calls: 1.
- `faces`: merged visible quads from `faceMask`. Draw calls: 1.

The occupancy grid remains canonical. Surface realization is an explicit HERO presentation mode, so environment and static voxel users keep the existing grid behavior.

`ownsRendererResources: true`. Call `dispose()`.

## 6. Labels

| Capability | State |
|---|---|
| Occupancy + surface extraction + hash | IMPLEMENTED |
| Instanced cubes / face-culled mesh | IMPLEMENTED
| Surface-conforming rigid HERO samples | IMPLEMENTED (opt-in realization) |
| Rigid skeleton deformation | IMPLEMENTED (first production use) |
| Greedy meshing | PLANNED (withheld for microstructure) |
| Runtime LOD | DEFERRED |
| PNG projection | DEFERRED |
| Soft-body voxel mass | DEFERRED |

## 7. Tests

`engine/tests/voxel.test.js` plus public-surface / purity allowlists.

## Canonical-cell-constrained realization

Pass `surfaceSampling: { placement: 'coherentSurface' }` with `surfaceMesh` to `createVoxelArtifact`, then instantiate with `mode: 'surfaceInstances'`. This is explicit and does not change environment or legacy grid behavior. Existing `surface` and `grid-normal` placement modes remain available.

The compiler emits exactly one sample for each canonical surface cell, in canonical order. A deterministic triangle BVH finds the closest guide point. Euclidean center correction is limited to `projection * voxelSize` (default 0.35; allowed 0 through 0.45). Samples retain the original cell coordinate, region, color, skin indices and weights. Source triangle, barycentrics, closest point, and raw normal remain inspectable. The occupancy artifact and its hash are unchanged.

The orientation field uses 26-neighbor canonical adjacency, rejecting neighbors whose raw normals differ by 60 degrees or more. `smoothing` selects 0 through 8 passes (default 2). `quantization` selects 0, 5, 7.5, 10 or 15 degree azimuth/elevation increments (default 10). A projected world-up tangent, with a polar fallback, produces a right-handed orthonormal bind frame. `orientation: 'none'` retains identity orientation for the projection-only experiment. All settings and ordered samples contribute to a separate deterministic realization hash.

`overlap` scales every cube axis equally, from 1 through 1.06 (default 1.04). Canonical `voxelSize` remains unchanged; runtime reports `cubeScale` separately. Bind and deformed matrices use the same isotropic scale. Skeletal rotation composes with the bind frame; centers retain canonical skeletal influences.

Tests: `engine/tests/voxel-coherent.test.js` covers deterministic identity/order, nearest triangle interiors, bounded displacement, canonical inheritance, normal/frame validity, quantization, isotropic overlap, deformation, and invalid settings. `voxel-surface.test.js` retains the previous-mode and renderer compatibility checks. Visual mode selection is a game-level evidence decision, not an engine test assertion.

A fixed 45-degree tangent-phase experiment was visually rejected for producing a chainmail-like shell and removed from the implementation. Its comparison captures remain in the game evidence directory.

The additional regular column-stagger experiment was also rejected after capture review: bounded tangential center shifts retained cell identity but exposed checkerboard gaps. It is not an available realization option. The canonical-cell-constrained mode remains an explicit experimental alternative, not an accepted replacement for the current hero presentation.
