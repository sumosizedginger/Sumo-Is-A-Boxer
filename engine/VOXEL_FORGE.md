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
  → instantiateVoxelArtifact({ mode: 'instances' | 'faces', bones? })
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

- `instances`: one InstancedMesh of unit cubes, instance colour, optional bone LBS. Draw calls: 1.
- `faces`: merged visible quads from `faceMask`. Draw calls: 1.

`ownsRendererResources: true`. Call `dispose()`.

## 6. Labels

| Capability | State |
|---|---|
| Occupancy + surface extraction + hash | IMPLEMENTED |
| Instanced cubes / face-culled mesh | IMPLEMENTED |
| Rigid skeleton deformation | IMPLEMENTED (first production use) |
| Greedy meshing | PLANNED (withheld for microstructure) |
| Runtime LOD | DEFERRED |
| PNG projection | DEFERRED |
| Soft-body voxel mass | DEFERRED |

## 7. Tests

`engine/tests/voxel.test.js` plus public-surface / purity allowlists.
