# Current state

Branch: game-build
Milestone: VOXEL-HERO-003
Status: IN PROGRESS. Reference-fit convergence; visual acceptance pending.

## What is implemented

Character Forge topology, skeleton, landmarks, semantics and skin weights remain the deformation authority. The guide is a single closed manifold: 62,460 vertices and 124,916 triangles. This certifies connectivity and numeric validity, not anatomical quality or absence of geometric self-intersection.

The retained shoulder pass lowers and narrows the thoracic opening, uses a monotone inferior bridge and oblique proximal arm section, and ties junction weight diffusion to the opening. A shared authored arm centerline now fits existing bone pivots, semantic landmarks and bind inverses without replacing the skeleton. Neutral inspection wrist targets follow the fitted live shoulder. The clearance regression checks a local radial shell; it is not a general self-intersection proof. Earlier precision work keeps chest/back vertices from switching categorically to arm weights. Pectoral, sternal, lat and glute fields were adjusted. The anterior knee depth discontinuity is smoothed. Hands have a broader knuckle block, narrower wrist and a rounded thumb whose cross section rotates with its sweep. The longitudinal foot has a narrower midfoot and tapered forefoot.

Facial projection now runs before orbital pockets are stitched, so it no longer flattens them. Orbital planes and nose forms are broader, eye depth/spacing and ear placement were adjusted, and the cranial cap meets the forehead with continuous position and tangent. Enlarged eyeballs were visually rejected and removed.

The canonical HERO occupancy grid remains deterministic at 0.012 m. Grid, grid-normal and existing independent surface modes remain available. New explicit coherentSurface placement emits one bounded, guide-projected rigid cube per canonical surface cell. A deterministic triangle BVH, canonical neighbor smoothing, quantized normals and stable bind frames preserve cell identity, region and skin weights. Optional overlap scales all axes equally. Runtime still supports one InstancedMesh draw call.

## Visual decision

Existing surface presentation remains the default. The constrained mode is implemented and tested but did not win the visual comparison: local patches are more ordered, yet horizontal terraces and facial gaps remain. Projection-only, smoothed, 5/7.5/10/15-degree quantized and 4-percent-overlap variants were captured. Fixed diagonal frames and alternating-column center stagger were rejected and removed. Shoulder-union projection was also rejected because it squared the silhouette without curing the rear hollow.

The screenshots do not earn acceptance. The chest still forms a shelf, shoulder/axilla hollows expose the attachment, posterior masses remain weak, knees look punched, guide feet flatten into thin fins beneath abrupt ankle transitions, and the face lacks the approved character's identity. The rounded thumb is a visible improvement, but the hand is still crude. Independent surface cubes retain stippling and micro-gaps. Raised-arm and guard stress views also expose severe axilla/pectoral folds and broad deformed shoulder flaps despite passing numeric deformation checks. This is not a reference match.

## Current measurements and evidence

Canonical occupancy: 266,922 cells. Canonical surface: 28,349 cells. Canonical visible faces: 47,884. Existing surface presentation: 45,387 instances, ratio 1.6010 instances per surface cell, 0.012 m cube size and one draw call. Constrained realization uses exactly 28,349 instances with 1.04 isotropic scale.

Fresh silhouette errors are front 4.3641 percent and profile 4.1938 percent of normalized character height. These are guardrails, not acceptance scores. Input image hashes are recorded with the measurements.

The canonical browser run recorded 43.774 seconds total voxel compilation (41.933 canonical + 1.840 realization) with other validation work active. Dedicated sequential Node checks measured surface mode at 39.246 seconds total (37.766 canonical + 1.479 realization) and coherentSurface at 38.492 seconds total (36.570 canonical + 1.922 realization). These single runs remain below the temporary 45-second ceiling, but are slower than the prior checkpoint runs; machine variance has not been isolated. Both modes produced canonical hash 856c70ae8364a9ba.

[Preview images and boards](../artifacts/voxel-hero-003/README.md) contain 35 camera captures, five silhouette-reference boards and five anatomy triptychs, including all five guide/HERO turnarounds, regional closeups. [Iteration evidence](VOXEL_HERO_003_PRECISION.md) records rejected experiments and verification. Reference coverage is five unique binaries across eight filenames; missing skeleton/helper/deformation sheets are not counted as inspected.

## Verification and milestone boundary

Root tests: 112/112. Engine tests: 613/613. Production build, changed-script syntax and whitespace checks pass. Browser body validation passes with 30 captures; face validation passes with 21 captures. Both report no browser errors and valid live geometry. All final camera, comparison and validation captures were inspected. The constrained mode has nine fresh captures and three same-camera comparison boards. Runtime source hashes and all 49 manifest image hashes match the current files. Reports are in artifacts/voxel-hero-003-precision/validation-shoulder; older validation/ reports describe checkpoint 26811dd. Details and remaining failures are recorded in the iteration report.

Combat, clothing, production animation, materials polish and environment work remain out of scope.
