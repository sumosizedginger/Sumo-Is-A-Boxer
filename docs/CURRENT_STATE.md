# Current state

Branch: game-build
Milestone: VOXEL-HERO-003
Status: IN PROGRESS. Reference-fit convergence; visual acceptance pending.

## What is implemented

Character Forge topology, skeleton, landmarks, semantics and skin weights remain the deformation authority. The guide is a single closed manifold: 63,594 vertices and 127,184 triangles. This certifies connectivity and numeric validity, not anatomical quality or absence of geometric self-intersection.

The precision pass enlarges and curves the shoulder bridge, keeps chest/back vertices from switching categorically to arm weights, and broadens weight diffusion through the junction. Pectoral, sternal, lat and glute fields were adjusted. The anterior knee depth discontinuity is smoothed. Hands have a broader knuckle block, narrower wrist and a rounded thumb whose cross section rotates with its sweep. The longitudinal foot has a narrower midfoot and tapered forefoot.

Facial projection now runs before orbital pockets are stitched, so it no longer flattens them. Orbital planes and nose forms are broader, eye depth/spacing and ear placement were adjusted, and the cranial cap meets the forehead with continuous position and tangent. Enlarged eyeballs were visually rejected and removed.

The canonical HERO occupancy grid remains deterministic at 0.012 m. Grid, grid-normal and existing independent surface modes remain available. New explicit coherentSurface placement emits one bounded, guide-projected rigid cube per canonical surface cell. A deterministic triangle BVH, canonical neighbor smoothing, quantized normals and stable bind frames preserve cell identity, region and skin weights. Optional overlap scales all axes equally. Runtime still supports one InstancedMesh draw call.

## Visual decision

Existing surface presentation remains the default. The constrained mode is implemented and tested but did not win the visual comparison: local patches are more ordered, yet horizontal terraces and facial gaps remain. Projection-only, smoothed, 5/7.5/10/15-degree quantized and 4-percent-overlap variants were captured. Fixed diagonal frames and alternating-column center stagger were rejected and removed. Shoulder-union projection was also rejected because it squared the silhouette without curing the rear hollow.

The screenshots do not earn acceptance. The chest still forms a shelf, shoulder/axilla hollows expose the attachment, posterior masses remain weak, knees look punched, ankles/heels have an abrupt transition, and the face lacks the approved character's identity. The rounded thumb is a visible improvement, but the hand is still crude. Independent surface cubes retain stippling and micro-gaps. Raised-arm and guard stress views also expose large axilla/pectoral folds despite passing numeric deformation checks. This is not a reference match.

## Current measurements and evidence

Canonical occupancy: 260,815 cells. Canonical surface: 27,409 cells. Canonical visible faces: 46,888. Existing surface presentation: 45,280 instances, ratio 1.6520 instances per surface cell, 0.012 m cube size and one draw call. Constrained realization uses exactly 27,409 instances with 1.04 isotropic scale.

Fresh silhouette errors are front 5.7573 percent and profile 4.2410 percent of normalized character height. These are guardrails, not acceptance scores. Input image hashes are recorded with the measurements.

The canonical capture run recorded 41.914 seconds total voxel compilation, including 2.173 seconds realization, while tests were also running. Dedicated sequential Node checks measured surface mode at 28.303 seconds total (27.120 canonical + 1.183 realization) and coherentSurface at 28.999 seconds total (27.618 canonical + 1.381 realization). These are single-run measurements on the local validation machine, not a statistical performance baseline. Both modes produced canonical hash 2faf96ef90a4c4f1.

[Preview images and boards](../artifacts/voxel-hero-003/README.md) include all five guide/HERO turnarounds, regional closeups, five silhouette-reference boards and five anatomy triptychs. [Iteration evidence](VOXEL_HERO_003_PRECISION.md) records rejected experiments and verification. Reference coverage is five unique binaries across eight filenames; missing skeleton/helper/deformation sheets are not counted as inspected.

## Verification and milestone boundary

Root tests: 108/108. Engine tests: 613/613. Production build, changed-script syntax and whitespace checks pass. Browser body validation passes with 30 captures; face validation passes with 21 captures. Both report no browser errors and valid live geometry. All final camera, comparison and validation captures were inspected. Details and remaining failures are recorded in the iteration report.

Combat, clothing, production animation, materials polish and environment work remain out of scope.
