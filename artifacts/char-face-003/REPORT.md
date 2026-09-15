# CHAR-FACE-003 build record

Status: BUILT, awaiting independent head validation. This is a builder's implementation and evidence record, not an independent visual score.

Starting branch: game-build
Starting local and remote checkpoint: 30b1ecd99f69c5d862cbfe37ae5e3e694b9eee93
The final handoff records the resulting commit and remote SHA.

## Runtime architecture

The actual opponent uses generateContinuousBody -> local conforming refinement -> skull fit -> anatomical and facial fields -> constrained relaxation -> stitched orbital pockets -> stitched auricular surfaces -> semantic skinning -> runtime BufferGeometry -> immutable Hero Character Artifact. The renderer and certificate consume the same geometry. No imported character model is used.

The first refinement pass covers the head. A second pass covers the face and ear interfaces. The cranial vault does not receive the unnecessary second pass. All topology decisions precede the supported nose-deviation, eye-spacing and chin-projection parameters; tests compare complete index arrays across variants.

The 22 core bones retain their names and gameplay identity. Head vertices blend through the upper neck into the head bone; the eyes use that same bone and semantic bind coordinates. Existing body corrections and gameplay animation remain intact. Facial expressions and new helper joints were not added.

## New engine sculpt capabilities

All are public exports from @sumosizedginger/my-game-engine-1.0/full:

- createFeatureFrame({center, forward, up, right}): immutable orthonormal local frame with toLocal and vectorToModel.
- ellipsoidMask({frame, radii, falloff}): compact ellipsoidal influence.
- semanticSculptMask(regions): regionId mask.
- composeSculptMasks(operation, ...masks): multiply, max, min, subtract, smoothUnion.
- directionalSculptField({direction, strength, mask, frame}): directed displacement.
- ellipsoidSculptField({center, radii, strength, direction, falloff, mask, frame}): localized volume shaping.
- normalSculptField({strength, mask}): displacement along supplied normals.
- planeSculptField({point, normal, strength, offset, mask, maxDisplacement}): bounded plane attraction/repulsion.
- ridgeSculptField({points, radius, strength, direction, mask, frame, depthRadius}): polyline feature ridge in a local frame.
- creaseSculptField(options): recessed ridge counterpart.
- applySculptFields(surface, fields): ordered field evaluation and normal rebuild.
- rebuildSculptNormals(surface): finite normalized area-weighted indexed normals.
- relaxSculptSurface(surface, {mask, pinned, iterations, strength, featureMask, tangential, direction}): masked relaxation with pins, protected features and optional single-axis constraint.
- refineSculptTopology(surface, {mask, iterations}): conforming shared-edge subdivision and sourceVertex ancestry.

The existing bridgeTopologyLoops and stitchTopologySurfaces now accept explicit loopParameters: {a, b}. This permits unequal boundary sampling with deterministic winding-aware n+m triangle stitching. The two cyclic parameter arrays must start at zero, increase strictly and stay below one. Without explicit correspondence unequal counts still fail. No vertex attributes are fabricated; existing attributes are retained. Tests prove closed, consistently wound, connected output and attribute preservation. The previous implicit equal-loop maxSpan behavior is preserved.

Sculpting rejects existing tangents/morph data rather than silently invalidating them. Refinement is deliberately before categorical semantics, skinning, morphs and anchors. Its accepted position/normal/UV data has an explicit ancestry map. Neither operation claims to prove absence of arbitrary self-intersection.

## Head construction

Skull: compact vault, frontal plane, temporal narrowing and posterior volume; shared profile supplies the hair fitting envelope. The head remains part of the continuous body, with a jaw-to-throat and rear-skull-to-neck transition.

Orbit/eyes: the skin is cut at deterministic orbital boundaries and stitched to shaped, closed recessed pockets. Two volumetric 12.8 mm radius globes use semantic eye centers, a +Z forward axis and explicit head-local placement. They add two eye draws and no textures.

Eyelids: upper and lower aperture rings wrap the globe; surrounding transition rows connect to brow, canthi and cheek. The globe occludes the connected recessed skin. No floating lid tubes or eye patches remain.

Nose: root/dorsum ridge, sidewall planes, tip and alar volumes, columellar projection and recessed nostril fields are sculpted into the skin. The nose has a restrained 2.4 mm deviation parameter, not a separate nose mesh or black nostril primitive.

Cheeks: paired zygomatic fields and oblique side planes define the midface and its transition into temples and jaw. This is a compact pressure fighter, not an inflated bodybuilding face.

Mouth/lips: upper and lower vermilion volumes, Cupid's bow, philtrum ridges, mouth corners, central closed crease and labiomental transition belong to the facial surface. There is no tube-lip attachment or oral cavity in this neutral expression.

Jaw/chin: masseter fields, oblique mandibular planes, lower-face taper and a bounded chin plane/projection control define the lower face.

Ears: deterministic side-skull openings are bridged to continuous auricular surfaces. Regular radial sampling, an authored lateral height field, helix/concha/lobe forms and branching antihelix/tragus fields replace primitive ears. A projection test checks real inner-ear triangles for reversed local orientation. Outer attachment relaxation removes the earlier ridged seam.

Identity: compact skull, substantial brow, tapered broad jaw, slight nasal deviation, 0.7 mm brow/eye-height difference, offset chin mass and a restrained brow scar field. No per-frame random asymmetry.

Semantics: 30 populated face regions, deterministic fitted landmarks and serializable local feature frames live in the hero artifact's metadata.face and semantic registries. Eye centers remain volumetric centers; surface landmarks are fitted to actual skin vertices. Parameters, eye radius/orientation, authoring stages and topology identity are recorded.

Legacy removal: fighter-face.js now produces only the existing short hair/fade attachments. Old eyePatch, tubular lids/brows/lips, detached nose/nostril pieces and primitive ear rendering are removed. The old shapeFace field is removed from the continuous body path and anatomy-fields.js. The hair uses the new skull/forehead envelope and correct head-bone Z offset; ray tests check clearance against the actual runtime skull.

## Browser sculpt iterations

The initial six passes were executed and captured in the browser, followed by further repairs:

1. Skull/jaw proportions. Exposed the initial banded mannequin silhouette.
2. Volumetric eyes and orbital fields. Exposed protruding eyes and inadequate lids.
3. Nasal and cheek fields. Corrected primary facial projection.
4. Integrated mouth, lips and chin. Removed the attached-lip architecture.
5. Ears and restrained asymmetry. Exposed unstable ear shaping.
6. Full multi-view clay review and shadow/normal diagnostics. The early head was not checkpointed.
7-9. Eye seating, local relaxation and stitched orbital pockets replaced the first field-only eyelid attempt.
10-17. Stitched ear patches, ordered boundary correspondence, transition rows, antihelix/tragus fields and lid opening revisions.
18-23. Normal diagnostics and a local projection test exposed ear folds. Corrected the pole position and constrained relaxation.
24-27. Explicit unequal-loop bridging, regular auricular sampling and a continuous lateral height field removed radial normal artifacts. Shared skull hair fitting replaced the oversized old cap.
28-30. Lower-lid fullness, nose projection/sidewalls, jaw taper, ear attachment relaxation and head-local hair offset were revised in front/profile/three-quarter views.
31. Selective refinement reduced cost but exposed the need to retain extra topology around ear interfaces.
32. Retained face/ear refinement while reducing vault refinement. Rechecked the resulting shape and regenerated final evidence.

Intermediate JSON reports are historical diagnostics, not final acceptance artifacts. Some failed iterations include recorded browser errors. final.json is the final source-hashed runtime report. Selected early images are retained; additional local exploratory captures are ignored by Git.

## Actual hero topology certificate

Source: live opponent.character.geometry, also matched byte-for-byte to the Hero Artifact by tests.

| Metric | Value |
|---|---:|
| vertexCount | 56023 |
| triangleCount | 112042 |
| edgeCount | 168063 |
| boundaryEdgeCount | 0 |
| boundaryLoopCount | 0 |
| nonManifoldEdgeCount | 0 |
| nonManifoldVertexCount | 0 |
| inconsistentWindingEdgeCount | 0 |
| degenerateTriangleCount | 0 |
| duplicateTriangleCount | 0 |
| isolatedVertexCount | 0 |
| connectedComponentCount | 1 |
| invalidNumericCount | 0 |
| invalidIndexCount | 0 |
| skinWeightViolationCount | 0 |

## Performance evidence

Same-machine Chrome, 1000x1000 viewport, model inspection presentation. Each steady sample has a 1.5 second warm-up then five seconds of foreground RAF intervals. These include vsync and are not GPU execution timings. Baseline source substitution reconstructs the starting game checkpoint without changing the checkout. Clay baseline hides the legacy separate face pieces; the final clay view includes the volumetric eyes. Production includes equipment in both samples.

| Metric | Before | After |
|---|---:|---:|
| Opponent generation, Node mean of 3 | 4446.44 ms | 19381.22 ms |
| Skin vertices | 23354 | 56023 |
| Skin triangles | 46704 | 112042 |
| Total scene triangles | 223086 | 302752 |
| Production inspection FPS | 59.9988 | 60.0012 |
| Production p50 / p95 / p99 | 16.7 / 16.8 / 16.9 ms | 16.7 / 16.8 / 16.9 ms |
| Production draw calls | 56 | 46 |
| Production rendered triangles, including passes | 219058 | 354198 |
| Scene geometry identities | 38 | 40 |
| Renderer geometries | 11 | 13 |
| Renderer textures | 10 | 10 |
| Programs after inspection | 19 | 22 |
| Scene material identities | 133 | 129 |
| Equipment asset generation | 96.70 ms | 95.40 ms |
| First rendered CPU frame since game creation | 3850.60 ms | 17437.70 ms |

After generation runs: 19805.87, 18894.81, 19442.99 ms. Sculpt portions: 13158.40, 12516.54, 12834.30 ms. Final clay draws: 6, baseline clay draws: 4. Eyeballs add two draws; retiring old separate features reduces the equipped total. The first-person model remains 25816 triangles and is unchanged.

Final jab rehearsal: 59.9988 FPS; animation-update p50 0.40 ms, p95 1.00 ms, p99 12.10 ms. This includes inspection rehearsal resets and is not a measured production combat CPU profile. No facial sculpt is evaluated per frame.

Startup is a material regression, not a free upgrade: mean opponent construction is 4.36 times the baseline. Topology authoring/certification and existing corrective target generation run synchronously. Rematch reuses the existing geometry; a page reload pays the construction cost again. No claim is made about low-end mobile performance or GPU headroom beyond this browser sample.

## Tests and builds

- node --test tests/*.test.js: 102 passed, 0 failed, final duration 113260.6313 ms.
- npm --prefix engine test: 592 passed, 0 failed.
- npm run build: passed. Vite reports the existing large-chunk advisory; no build error.
- npm --prefix engine run build: passed.
- node scripts/validate-hero-face.mjs final: passed, 41 captures, zero browser errors, actual runtime certificate valid.
- node scripts/measure-hero-face.mjs: three measured constructions, each disposed.
- node scripts/smoke-hero-face.mjs: normal game start, movement and mouse attack smoke; actual runtime skin count checked, zero page errors.

New tests cover field determinism, semantic masks, local direction, immutable frames, pins and feature constraints, single-axis relaxation, conforming refinement, unequal-loop bridging, parameter-stable indices, populated face regions, finite landmarks/normals/UVs, four normalized skin influences, ear projection, eye placement, removal of legacy pieces, runtime/artifact equality and hair clearance against the real skin. Existing combat, AI, inputs, materials, feet, garments, camera, reset and rematch assertions remain.

## Browser inspection

Live local build: http://127.0.0.1:5173/?validation=models
Evidence gallery: http://127.0.0.1:5173/artifacts/char-face-003/index.html

Commands:

```js
const m = window.__SUMO_IS_A_BOXER__.validation.models;
m.show('front_neutral');
m.head.hair(false);
m.head.mode('clay'); // production, wireframe, silhouette; normals diagnostic
m.head.view('front_left_three_quarter');
m.head.views;       // all 16 named head cameras
m.body.equipment(false);
m.play('head_reaction');
m.pause();
m.scrub(0.25);
m.rotate(true);
m.body.certification();
await m.sample(5000);
```

Final cameras: front, left_profile, right_profile, front_left_three_quarter, front_right_three_quarter, rear, rear_left_three_quarter, rear_right_three_quarter, high_angle, low_angle, eye_closeup, nose_closeup, mouth_closeup, left_ear, right_ear, jaw_neck. Additional captures: wireframe, silhouette, normals, production without hair, production with hair. Jab, cross, head reaction and body reaction each have five deterministic sampled frames and were also played in the live harness.

The captures expose the unclothed head in ordinary neutral inspection light. No face texture, final skin shader or dramatic lighting was added to hide the geometry. Head/neck, orbital and ear surfaces remain connected in sampled motion; no open skin holes or floating legacy face components were observed.

## Limits and review risks

- The expression is a fixed, stern closed-mouth neutral. Eyebrows are skin form, with no hair fibers. There are no blink, speech or facial reaction shapes.
- The upper lids are deliberately heavy; the iris/pupil treatment is simple vertex color without corneal refraction. These should be judged directly at eye-closeup scale.
- The ear antihelix is simplified, and small angular transitions are visible at its branch and lower attachment in the closest views. The bowl is closed and connected, not an open ear canal.
- The rear cranial and mandibular planes are broad. Clay exposes those planes more strongly than production skin. The independent reviewer should assess whether that stylization is convincing.
- UV0 remains the existing overlapping planar authoring chart. Tangents are supported by the artifact but are not generated for the new skin yet. Final material atlas work is outside this head turn.
- Topological manifoldness does not certify arbitrary geometric self-intersection. The extra ear projection gate and inspected motion provide bounded evidence only.
- Startup cost is substantially higher, as measured above.
- Final hair, full neck/trapezius anatomy, body PSD, first-person models, garments, gloves and boots were not rebuilt.

Builder response to the requested final question: yes, I would use this neutral-clay head to demonstrate the new code-native sculpt authoring capability. That is not an independent premium-quality rating; the supplied closeups and limitations must remain visible to the verifier.

## Changed implementation paths

Engine:
engine/src/geometry/sculpt-fields.js; engine/src/geometry/topology-ops.js; engine/src/full/authoring.js; engine/tests/sculpt-fields.test.js; engine/tests/topology-foundation.test.js; engine/tests/purity.test.js; engine/GEOMETRY_FORGE.md; engine/CHARACTER_FORGE.md.

Game:
src/game/character/hero-face.js; src/game/character/head-profile.js; src/game/character/orbital-pockets.js; src/game/character/hero-eyes.js; src/game/character/athletic-body.js; src/game/character/continuous-body.js; src/game/character/anatomy-fields.js; src/game/character/opponent-boxer.js; src/game/assets/fighter-face.js; src/game/validation/models.js.

Tests/tooling:
tests/hero-face.test.js; tests/character-ceiling.test.js; tests/engine-consumption.test.js; scripts/validate-hero-face.mjs; scripts/measure-face-baseline.mjs; scripts/measure-hero-face.mjs; scripts/smoke-hero-face.mjs; .gitignore.

Evidence: artifacts/char-face-003/. MANIFEST.json lists each checkpoint evidence path and digest.

Unrelated starting files preserved and excluded: artifacts/char-topology-002/after-production-front.png and the pre-existing untracked root PNG files. Their exact names are recorded in unrelated-starting-files.json. No main merge, branch creation, atmosphere work or Turn 4 work occurred.
