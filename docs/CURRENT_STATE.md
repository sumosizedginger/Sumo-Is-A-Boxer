# Current state

**Branch:** `game-build`  
**Milestone:** VOXEL-PIVOT-001  
**Status:** voxel foundation established; reference-sheet fitting is next

## Hero architecture

- Character Forge humanoid + certified continuous guide body remain the **hidden** deformation authority (topology, skeleton, skin weights, landmarks, pose drivers).
- Visible hero is a **Voxel Forge** surface-cube InstancedMesh (`quality: HIGH` at boot, `HERO` via `?voxel=HERO`).
- Individual cubes stay rigid under skeleton-driven centre motion. Soft-body mass is **PLANNED**, not implemented.
- Eyes remain specialised volumetric components parented to the head bone.
- Hair remains a separate MeshIR attachment.

## Voxel architecture

Implemented in the engine (`engine/src/voxel/`, public through `engine/full`):

`createVoxelDefinition` → `voxelizeMesh` → `extractVoxelSurface` → `createVoxelArtifact` → `instantiateVoxelArtifact`

Runtime modes: `instances` (hero) and `faces` (static environment, hidden-face culled).

## Environment

- Boxing ring presentation is gone.
- Combat space is a voxel combat platform with the same playable half-extent.
- Warehouse / dressing MeshIR is voxelized at `COARSE` through the asset library.
- First-person arms are blocky fists, voxelized at `HIGH`, not boxing gloves.

## Gameplay

Unchanged combat rules: jab / cross / hook identifiers, guard heights, knockdowns, KO. These are **current gameplay mechanics**, not the art direction.

## Hero voxel metrics (HIGH, browser)

occupied 9648 · surface 2739 · visible faces 4742 · voxelSize 0.028 m · generation 155 ms · draw calls 1

## Known limitations

See [VOXEL_PIPELINE.md](VOXEL_PIPELINE.md) and [ENGINE_GAPS.md](ENGINE_GAPS.md). PNG projection, final costume, soft-body, and greedy meshing are **DEFERRED**.

## Next milestone

VOXEL HERO REFERENCE FITTING — replace provisional sumo proportions with approved `references/visual/` measurements.
