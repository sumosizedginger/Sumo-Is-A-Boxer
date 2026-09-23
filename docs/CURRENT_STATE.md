# Current state

Branch: game-build
Milestone: VOXEL-HERO-003
Status: IN PROGRESS. Reference-fit convergence; visual acceptance pending.

## What is implemented

Character Forge topology, skeleton, landmarks, semantics and skin weights remain the deformation authority. The guide is a single closed manifold: 62,460 vertices and 124,916 triangles. This certifies connectivity and numeric validity, not anatomical quality or absence of geometric self-intersection.

The retained shoulder pass lowers and narrows the thoracic opening, uses a monotone inferior bridge and oblique proximal arm section, and ties junction weight diffusion to the opening. A shared authored arm centerline now fits existing bone pivots, semantic landmarks and bind inverses without replacing the skeleton. Neutral inspection wrist targets follow the fitted live shoulder. The clearance regression checks a local radial shell; it is not a general self-intersection proof. Earlier precision work keeps chest/back vertices from switching categorically to arm weights. Pectoral, sternal, lat and glute fields were adjusted. The anterior knee depth discontinuity is smoothed. Hands have a broader knuckle block, narrower wrist and a rounded thumb whose cross section rotates with its sweep. The longitudinal foot has a narrower midfoot and tapered forefoot. The foot sweep now preserves outward dorsal and plantar normals, turns more gradually through the instep, and carries explicit plantar heel volume. A shared height-based ankle weight transition replaces the domain switch. The sole is fitted to the neutral contact plane; exterior-normal, stitched-weight and actual skinned-contact regressions cover the repair. Connectivity remains unchanged.

Facial projection now runs before orbital pockets are stitched, so it no longer flattens them. Orbital planes and nose forms are broader, eye depth/spacing and ear placement were adjusted, and the cranial cap meets the forehead with continuous position and tangent. Enlarged eyeballs were visually rejected and removed.

The canonical HERO occupancy grid remains deterministic at 0.012 m. Grid, grid-normal and existing independent surface modes remain available. New explicit coherentSurface placement emits one bounded, guide-projected rigid cube per canonical surface cell. A deterministic triangle BVH, canonical neighbor smoothing, quantized normals and stable bind frames preserve cell identity, region and skin weights. Optional overlap scales all axes equally. Runtime still supports one InstancedMesh draw call.

## Visual decision

Existing surface presentation remains the default. The constrained mode is implemented and tested but did not win the visual comparison: local patches are more ordered, yet horizontal terraces and facial gaps remain. Projection-only, smoothed, 5/7.5/10/15-degree quantized and 4-percent-overlap variants were captured. Fixed diagonal frames and alternating-column center stagger were rejected and removed. Shoulder-union projection was also rejected because it squared the silhouette without curing the rear hollow.

The screenshots do not earn acceptance. The chest still forms a shelf, shoulder/axilla hollows expose the attachment, posterior masses remain weak, knees look punched, feet have solid volume but remain shoe-like with crude toe and ankle anatomy, and the face lacks the approved character's identity. The rounded thumb is a visible improvement, but the hand is still crude. Independent surface cubes retain stippling and micro-gaps. Raised-arm and guard stress views also expose severe axilla/pectoral folds and broad deformed shoulder flaps despite passing numeric deformation checks. This is not a reference match.

## Current measurements and evidence

Canonical occupancy: 269,401 cells. Canonical surface: 28,620 cells. Canonical visible faces: 48,362. Existing surface presentation: 45,796 instances, ratio 1.6001 instances per surface cell, 0.012 m cube size and one draw call. Constrained realization uses exactly 28,620 instances with 1.04 isotropic scale.

Fresh silhouette errors are front 4.3000 percent and profile 3.9640 percent of normalized character height. These are guardrails, not acceptance scores. Input image hashes are recorded with the measurements.

The canonical browser run recorded 36.788 seconds total voxel compilation (35.342 canonical + 1.447 realization) with other validation work active. Dedicated sequential Node checks measured surface mode at 42.013 seconds total (40.413 canonical + 1.599 realization) and coherentSurface at 39.541 seconds total (37.657 canonical + 1.884 realization). These single runs remain below the temporary 45-second ceiling; a concurrent local capture reached 46.266 seconds, so machine variance remains material. Both modes produced canonical hash aac035fe836f7641.

[Preview images and boards](../artifacts/voxel-hero-003/README.md) contain 39 camera captures, five silhouette-reference boards and five anatomy triptychs, including all five guide/HERO turnarounds, regional closeups. [Iteration evidence](VOXEL_HERO_003_PRECISION.md) records rejected experiments and verification. Reference coverage is five unique binaries across eight filenames; missing skeleton/helper/deformation sheets are not counted as inspected.

## Verification and milestone boundary

Root tests: 115/115. Engine tests: 613/613. Production build, changed-script syntax and whitespace checks pass. Fresh browser body validation passes with 30 captures, valid live geometry and zero browser errors. The 21-image face validation in validation-shoulder is historical evidence from c48c2c3; it was not rerun for this foot-only repair. Current canonical face closeups were regenerated. All final canonical, comparison and current body validation captures were inspected. The constrained mode has eleven fresh captures and three same-camera comparison boards. Both capture manifests match all 15 runtime source hashes and all 55 manifest image hashes. Current reports are in artifacts/voxel-hero-003-precision/validation-foot; validation-shoulder describes c48c2c3 and older validation/ reports describe 26811dd. Details and remaining failures are recorded in the iteration report.

Combat, clothing, production animation, materials polish and environment work remain out of scope.
