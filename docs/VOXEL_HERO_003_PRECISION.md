# VOXEL-HERO-003 precision pass

Status: IN PROGRESS. Visual acceptance pending.

## Verified starting point

Branch game-build; local HEAD and origin/game-build both b424b6775746fd7681bb90b2977aa324b74c2876. Existing untracked artifact directories and index.tmp are preserved. Specification: user attachment pasted-text-1.txt, anatomical authority plus coherent surface lattice.

## Baseline inspection

All 34 canonical PNGs and the surface experiment front PNG were visually inspected. The five unique reference sheets were inspected. Guide defects: broad chest shelf, weak deltoid boundaries, pinched axilla, flat back, weak glute cleft, punched knee appearance, pointed thumb, thin flat foot, forehead transition ridge, and eyes visibly misaligned with orbital recesses. Surface turnarounds have dense stippling and local gaps. Most voxel closeups and all reference/voxel comparison boards still depict the earlier grid mode. They cannot establish acceptance of the surface mode.

The capture script previously claimed all views even for filtered runs. It now records actual files, hashes, realization metrics, source commit, filter, and completeness. Chest and calf views are added for both guide and voxel.

## Required execution and evidence

1. Guide iterations: chest/shoulders, back/glutes, leg masses/knees/calves, palm/thumb, longitudinal foot, broad facial planes. Preserve connected manifold topology and skin semantics. Capture and inspect each major change in a separate iteration directory.
2. Coherent realization: one sample per canonical surface cell; closest guide triangle; bounded center correction (0.25 to 0.45 pitch); preserve canonical region, skin and cell identity. Keep grid, grid-normal and existing surface modes available.
3. Orientation experiments: projection only, adjacency-smoothed normals, quantization at 5/7.5/10/15 degrees, optional 1.02 to 1.06 isotropic overlap. Compare identical neutral-clay cameras against existing surface samples. No secondary point spraying.
4. Tests: deterministic projection/order/hash, displacement bounds, neighbor orientation, quantization, orthonormal frames, semantic/skin inheritance, finite isotropic matrices and deformation, one draw call and legacy compatibility. Run full root and engine suites plus syntax/build and voxel validation.
5. Final evidence: full guide and voxel turnarounds, face/shoulder/chest/belly/pelvis/thigh-knee/calf/hand/foot closeups, same-camera realization comparisons, current silhouette measurements and metrics. Inspect all final images before selecting a winner.
6. Update CURRENT_STATE and engine documentation with measured counts, timings, instance/canonical ratio, visual gains and remaining failures. Commit and push game-build only after validation.

## Iterations

Guide 01: fuller paired pec volumes, broader inferior transition, stronger sternum valley, deltoid wrap, lat/rhomboid separation and paired glute volumes. Capture target: artifacts/voxel-hero-003-precision/guide-01. Visual result pending.

Guide 01 result: 12 topology/face tests pass, 15 filtered guide captures complete. Chest volume increased, but sharp under-pec fold and rear shoulder pinching remain unacceptable. Numeric authored torso contour is smooth through the offending height range. Skinning inspection found that all axial vertices above y=1.38 with abs(x)>0.18 were categorically assigned to arm bones, including anterior pecs and posterior lats. Guide 02 replaces that classification with a continuous lateral attachment envelope while preserving thoracic weights on chest/back. Validation and visual review pending.

Guide 02 preliminary result: all 12 targeted tests pass (70.6 seconds). Front/rear/profile captures inspected. Pectoral overhang changes, but axilla and rear shoulder pinching remain severe. Do not treat the binding edit as a completed repair. Next: inspect bind-space versus posed geometry and local shoulder boundary correspondence; current test suite proves manifold connectivity but does not detect geometric self-intersection. Capture process unified session 42949 remains live; finish polling it before starting another capture server. No coherent lattice implementation yet; all A-E experiments and remaining anatomy work are still required.

Bind diagnostic complete (3 captures). The folds are present without skeletal deformation. The upper-arm ring at y=1.385 placed its medial point at x=0.214, inside the torso. Guide 03 moves the upper-arm center from 0.350 to 0.445 and reduces its lateral radius to 0.118, retaining the same stitched topology. Continuous torso weights from guide 02 remain.

Guide 03 completed: 15 captures. Shoulder medial-ring relocation alone did not resolve the rear pinch. Guide 04 uses cubic shoulder tangents, moves broad face projection before orbital insertion, and joins the cranial cap continuously. All 12 targeted tests pass (64.7 sec), 15 captures complete. Face pocket is no longer flattened after construction, but eyes remain visibly too deep relative to the brow. Shoulder still needs work. Guide 05 replaces the abrupt 22% anterior knee depth discontinuity with a smooth shin taper, thickens the longitudinal foot and blunts the thumb termination.

Guide 05: all four foundation tests passed (44 sec), 15 captures complete. Shin discontinuity removed, but posed knees still need refinement. Guide 06 expanded the shoulder opening from 12 cm to 23 cm vertically and to wider front/rear boundaries. Manifold checks passed, but high guard exposed a 47 cm seam edge outside the old skin diffusion band. Guide 07 extends diffusion down to y=1.24; all four foundation tests pass (49.6 sec), maximum stress edge 12.5 cm. Five focused captures inspected. Eyes now meet the facial surface more closely, although facial identity remains weak. Shoulder depression persists despite improved top continuity. Guide 08 adds a bounded deltoid exterior envelope and carries paired glutes into the proximal hamstrings.

Guide 08: four foundation tests passed (56.2 sec), five captures inspected. Rejected the deltoid envelope because it introduced a ridge without removing the shoulder depression; removed it. Reduced the added proximal posterior thigh depth from 105 mm to 35 mm because it produced an abrupt shelf. Coherent compiler now implemented as a separate explicit mode: deterministic triangle BVH closest points, bounded Euclidean projection, canonical 26-neighbor normal smoothing with sharp-sheet rejection, angular quantization, and isotropic overlap. All 10 old/new surface tests pass. No visual winner selected yet.

Engine full suite: 613/613 pass (14.7 sec). First coherent capture (coherent-10-overlap) is provisional: detected retained instance albedo in clay mode, because Three.js instancing colors are independent of material.vertexColors. Validation now explicitly neutralizes instance colors and restores authored colors in other presentations. Guide casting/receiving shadows is enabled in guide mode. Regenerate all comparison evidence with this correction before judging modes.

Full root suite: 107/107 pass (159.6 sec). Production build passes (122 modules; existing large-chunk advisory remains). Reference SHA-256 audit reconfirms five unique binaries across eight filenames; missing reference sheets are now explicitly labelled as not present locally.

A–E comparison complete: 24 identical-camera captures and three labelled eight-mode boards. A retains speckling; B loses form and exposes strong steps; C and D improve local ordering but retain bands; E reduces small gaps without fixing facial rows. No mode visually accepted. Follow-up guide 09 increases the eyelid opening above a single HERO pitch, expands the orbital recess, and fits ear depth to the actual head envelope. A fixed 45-degree tangent phase is an additional explicit experiment, never random sample rotation.

Guide 09 rejected: enlarged eyelid opening/globe produced a cartoon protruding-eye result despite 19 passing targeted tests. Restored the original eyelid/globe dimensions; retained broader orbital planes, intermediate eye depth and head-envelope ear placement. Fixed diagonal tangent tests pass 6/6.

Final strategy decision: fixed diagonal frames produced chainmail/porcupine microstructure and were removed. Retain existing surface sampling as the presentation default; constrained coherentSurface remains explicit and tested for further work, not adopted as visually superior. No A–E mode passes the full visual gate. Face/head closeup cameras were corrected for the actual crouched neutral head height so final evidence includes the jaw rather than clipping it. Final captures record content hashes for the new untracked source modules as well as tracked diffs.

Canonical baseline regenerated: 38 captures, all five required reference silhouette boards, plus five anatomy triptychs. Fresh errors: front 5.69%, profile 4.26%. These are a baseline, not acceptance. Reference/guide/HERO triptychs show the shoulder depression remains the largest structural defect. Next guide iteration projects the retained shoulder patch onto the smooth union of torso, deltoid and upper-arm anatomical volumes using an analytic field gradient. This replaces local bridge shape authority while preserving indices and global topology.

Guide 10 passes four foundation tests (56.3 sec), but the gradient projection creates shoulder ridges and does not remove the posterior depression. Replaced closest-gradient projection with an exterior radial intersection of the anatomical union, preserving the scaffold angular order. Guide 11 also curves the thumb downward beside the palm, broadens the knuckle termination, narrows the midfoot, and tapers forefoot height. Foot closeup now uses an oblique camera to expose heel-to-toe architecture.

Guide 11/12 review: four foundation checks pass on guide 11; six foundation/cap checks pass on guide 12. The thumb flap was caused by sweeping an unrotated cross section along a bent branch. Rotating that section with the branch and using a rounded terminal cap produces a visibly better thumb. The cranial cap now preserves the forehead tangent as well as position.

Rejected follow-ups: radial shoulder projection squared the shoulder silhouette without resolving the posterior hollow, so the entire experimental shoulder field was removed. The additional posterior thigh sweep created a shelf and was removed. The regular alternating-column center stagger preserved one sample per cell and passed bounds/determinism tests, but its four captures show checkerboard gaps across the face and chest. Removed its implementation, preset and test. Captures remain in convergence-coherent-staggered. No rejected option is a production default.

Retained engine suite after rollback: 613/613 passing. Canonical evidence is being regenerated from the retained guide; earlier silhouette values above must not be presented as current.

Retained final root suite: 108/108 pass (227.2 seconds); manifold guide has 63,594 vertices, 127,184 triangles and one connected component, with zero boundary, nonmanifold, degenerate, duplicate, isolated or invalid elements. Maximum tested posed edge is 0.12094 m. Build passes (122 modules; existing large-bundle advisory), changed/new script syntax checks and git diff whitespace check pass. Body validation initially hit its legacy 30-second navigation timeout during compilation; navigation now uses the same 120-second boot allowance as the current capture workflow.

Final canonical inspection: all 33 camera PNGs, all ten reference boards and all seven retained constrained-mode PNGs were visually inspected through labelled contact sheets and same-camera boards. Canonical set comprises 38 outputs including five silhouette comparisons, plus five structure triptychs. Fresh errors: front 5.7573%, profile 4.2410%. The constrained mode has cleaner planar patches but strong horizontal rows and inferior facial readability; existing surface remains the presentation choice, with its stippling explicitly unresolved.

Body browser validation passes: 15 inspection views, 30 PNGs total, no browser errors, valid live geometry certification and zero skin-weight violations. All 30 PNGs inspected. Stress images expose large axilla/pectoral folds during raised-arm and guard poses despite manifold connectivity; numeric deformation validity must not be mistaken for acceptable deformation art. These folds remain unresolved. The legacy production-material diagnostic is dark and is not used for clay acceptance.

Face browser validation passes with 21 captures and no browser errors. All 21 inspected. Remaining face defects include a pointed profile nose, weak cheek/jaw planes, narrow eye openings, and pinched ear-to-head attachment triangles. This fails the approved facial identity despite the improved cranial cap and corrected pocket ordering. Canonical provenance verification checks all 12 recorded source hashes and all 38 image hashes with zero mismatches.

Dedicated sequential Node HERO validation passes for both retained modes. Surface: 28.303 s total, 27.120 s canonical, 1.183 s realization, 45,280 instances / 27,409 cells = 1.6520. Coherent: 28.999 s total, 27.618 s canonical, 1.381 s realization, 27,409 / 27,409 = 1.0. Both have 260,815 occupied cells, 46,888 canonical visible faces, 0.012 m pitch, one draw call and canonical hash 2faf96ef90a4c4f1. Single runs are reported as measurements, not a variance-qualified baseline.

Completion audit: deterministic engine implementation, tests, captures, reference identity audit, fresh measurements and documentation are present. The visual acceptance requirements are contradicted by the captures. Anatomical authority and coherent surface quality remain incomplete; no downstream milestone is authorized by this checkpoint.
