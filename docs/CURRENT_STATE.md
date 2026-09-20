# Current state

**Branch:** `game-build`  
**Milestone:** VOXEL-HERO-003: REFERENCE-FIT CONVERGENCE  
**Status:** IN PROGRESS — reference-fit convergence; visual acceptance pending.

## Hero architecture

Character Forge topology, skeleton, landmarks, skin weights, and the certified continuous guide remain the deformation authority. The guide now adds semantic anatomical masses for the ribcage, paired pectorals, traps, lats, abdomen, apron, pelvis, glutes, thighs, hamstrings, calves, hands, and feet while preserving the connected global topology.

The HERO voxel path keeps a deterministic 0.012 m canonical occupancy grid for analysis, semantic binding, collision, hashing, and artifact generation. Runtime can realize that authority as the legacy grid cubes, orientation-only grid cubes, or deterministic surface-conforming rigid cubes. The current HERO presentation default adopts the surface-conforming realization because it removes the dominant Cartesian terrace bands while preserving the same canonical occupancy artifact. Surface samples keep bind position, stable surface frame, region, skin weights, and canonical cell association. All visible cubes remain isotropic BoxGeometry instances and can stay in one draw call.

The guide is materially improved but is not accepted as a final reference match yet. The remaining risk areas are the shoulder/axilla transition, rear torso mass separation, foot macro shape, and face readability after voxel quantization.

## Validation and presentation

Validation uses a neutral gray clay rig with bright neutral lighting, shadows, no fog, and no texture camouflage. Current canonical capture work is in `artifacts/voxel-hero-003/`; fresh complete boards are regenerated at the end of this pass.

Silhouette measurements are regenerated from the current captures. They are evidence for tuning, not an acceptance claim.

## Current HERO metrics

The current surface realization records 244,575 occupied cells, 25,820 canonical surface cells, 43,632 canonical visible faces, 43,733 surface instances, 0.012 m cubes, one draw call, and 23.0 s generation in `artifacts/voxel-hero-003-surface/metrics.json`. These values are intentionally kept provisional while reference-fit convergence continues.

## Milestone boundary

Combat, clothing, and production animation remain out of scope until this naked clay hero earns visual acceptance.
