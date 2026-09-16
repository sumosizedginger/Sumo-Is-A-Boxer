# Current state

**Branch:** `game-build`  
**Milestone:** VOXEL-HERO-002  
**Status:** Hero visual ceiling achieved; sculpturally fitted to visual reference sheets.

## Hero architecture

- Character Forge humanoid + certified continuous guide body remain the **hidden** deformation authority (topology, skeleton, skin weights, landmarks, pose drivers).
- Visible hero is a **Voxel Forge** sculptural surface-cube InstancedMesh (`quality: HERO` at 0.012 m base unit cubes).
- Fully sculpted sumo anatomy:
  - Giant hemispherical abdomen projecting +0.44m forward with lower sag.
  - Huge ribcage (+0.37m lateral, +0.33m depth) and thick lateral flank pads.
  - Colossal thighs (0.36m radius) and heavy calves (0.26m) grounded into wide stance.
  - Massive muscular neck (0.24m width) and broad trapezius slope.
  - 3D sculpted facial volume: heavy brow overhang, deep orbital pockets, 4-step nose (root, bridge, tip, wings), heavy cheek pads, wide jaw angles, large chin projection, double-chin neck fold.
- Dedicated `sumo_neutral` presentation pose: feet wide and planted, knees flexed, arms relaxed down/outward, elbows naturally flared, chest facing camera.
- Warm terracotta/sandstone clay skin palette matching Reference Sheet 07 with 6-neighbor directional cavity occlusion.
- Individual cubes stay rigid under skeleton-driven centre motion with uniform isotropic scale.

## Voxel architecture

Implemented in the engine (`engine/src/voxel/`, public through `engine/full`):

`createVoxelDefinition` → `voxelizeMesh` → `extractVoxelSurface` → `createVoxelArtifact` → `instantiateVoxelArtifact`

- Canonical base unit size: `VOXEL_QUALITY.HERO` = 0.012m.
- Full 6-neighbor surface extraction with enclosed interior rejection.
- Single draw call (`InstancedMesh`) with cavity-occluded vertex colors and standard PBR response (roughness 0.68, metalness 0.02).

## Validation & Presentation

- Dedicated neutral 3-point clay light rig (bright key, soft fill, warm rim, ambient bounce, neutral gray background `0x3a3f47`, no atmospheric fog).
- Pure silhouette validation mode (solid black hero `0x050505`, clean bright background `0xeef0f2`).
- 15 canonical validation view presets in `PRESETS` and automated capture pipeline in `scripts/capture-voxel-hero-002.mjs`.

## Hero voxel metrics (HERO, canonical)

- occupied: 253,497 cells
- surface: 24,611 cells
- visible faces: 42,288 faces
- voxelSize: 0.012 m
- draw calls: 1 (single batched InstancedMesh)

## Next milestone

VOXEL-COMBAT-001 — Dynamic hit reaction deformations, impact sparks, and voxel damage shedding.
