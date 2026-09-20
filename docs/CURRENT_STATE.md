# Current state

**Branch:** `game-build`  
**Milestone:** VOXEL-HERO-003: REFERENCE-FITTED HERO SCULPTURE  
**Status:** IN PROGRESS — reference-fit convergence; visual acceptance pending.


## Hero architecture

- Character Forge humanoid + certified continuous guide body remain the **hidden** deformation authority (topology, skeleton, skin weights, landmarks, pose drivers).
- Visible hero is a **Voxel Forge** sculptural surface-cube InstancedMesh (`quality: HERO` at 0.012 m base unit cubes).
- Fully sculpted sumo anatomy matching reference turnaround and proportion sheets:
  - Total height: 1.86m, Head height: 0.245m (~1/7.6 proportion ratio).
  - Massive continuous abdominal mass projecting forward with low apron sag and navel pit cavity at y=1.12m.
  - Sternal notch depression flanked by twin sculpted pectoral plates.
  - Wide trapezius slope connecting seamlessly into thick muscular neck column (no skinny neck constriction).
  - Heavy muscular glute cheeks with deep midline cleft in posterior view.
  - Distinct patellar knee plates and rear popliteal fossa creases.
  - Muscular calf flare (gastrocnemius) with grounded calcaneus heel and planted metatarsal sole.
  - Sculpted hand: natural flared arm hanging angle (~18°), distinct wrist joint, thenar eminence, and readable cubic knuckle fist block.
  - 3D sculpted facial volume: heavy brow overhang, deep orbital pockets, 4-step nose (root, bridge, tip, wings), heavy cheek pads, wide jaw angles, large chin projection, double-chin neck fold.
- Dedicated `sumo_neutral` presentation pose: feet wide and planted (0.76m stance), knees flexed, arms relaxed down/outward, elbows naturally flared, chest facing camera.
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
- 26 canonical validation deliverables and side-by-side reference comparison boards generated in `artifacts/voxel-hero-003/`.
- Silhouette convergence against approved visual contract (`02-silhouette.png`):
  - Profile Mean Normalized Silhouette Error: **3.97%** of character height.
  - Front Mean Normalized Silhouette Error: **4.76%** of character height.

## Hero voxel metrics (HERO, canonical)

- occupied: 253,260 cells
- surface: 26,517 cells
- visible faces: 45,700 faces
- voxelSize: 0.012 m
- draw calls: 1 (single batched InstancedMesh)

## Next milestone

VOXEL-COMBAT-001 / VOXEL-ANIMATION-001 (pending milestone direction)

