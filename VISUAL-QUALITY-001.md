VISUAL-QUALITY-001

STATUS: BUILT  AWAITING VISUAL VALIDATION

Independent inspection URL: http://localhost:5180

The server returned HTTP 200. The browser tool repeatedly returned no available
browser, with inventory apps: [], browsers: []. Therefore the requested rendered
iteration was not completed. No visual acceptance, after FPS, frame pacing,
browser load time or GPU lifecycle result is claimed.

1. Files changed

Game files:

- src/game/app.js
- src/game/assets/fighter-kit.js
- src/game/assets/materials.js
- src/game/assets/ring.js
- src/game/assets/sculpt.js, new
- src/game/assets/warehouse.js
- src/game/character/athletic-body.js, new
- src/game/character/boxing-feet.js, new
- src/game/character/opponent-boxer.js
- src/game/character/player-fists.js
- src/game/combat/match.js
- src/game/config.js
- src/game/presentation/asset-library.js
- src/game/presentation/camera-rig.js
- src/game/presentation/lighting.js
- src/game/presentation/vfx.js

Supporting files: tests/visual-quality.test.js, ENGINE_GAPS.md, this handoff,
and artifacts/visual-quality-001/. Source snapshots, engine hashes, comparison
data, measurement script and test/build logs are preserved there. Existing
unrelated workspace changes were left in place.

2. Visual changes by category

Implemented in the requested sequence: light balance; opponent skin and
equipment; body-driven poses and foot contact; first-person arms; ring
construction; limited warehouse structure. Impact timing, camera response and
pooled particles were integrated with those presentation systems. Rendered
success remains pending in every category.

3. Before/after captures

None available. The before source is preserved in Git commit history for
reproduction (with comparison metadata retained in artifacts/visual-quality-001/).
Source comparisons and CPU tests are not substitutes for captures.

The following views remain uninspected for all six stages: title/establishing
shot, default first-person view, opponent close and medium range, opponent jab
and cross, player jab and cross, block, ring corner, canvas, ceiling, knockdown
and get-up. No transparent light-shaft prototype was shipped.

4. Engine APIs used

All engine imports use @sumosizedginger/my-game-engine-1.0/full.

Geometry continues through createMesh, createPart, createBoxMesh,
createCylinderMesh, transformMesh, mergeMeshIR, extrudeProfile and createAnchor.
The new sculpt helper emits MeshIR. createPreviewable remains the compile route,
and createMaterialDefinition remains the material definition route.

Character: createCharacterDefinition, buildHumanoidCharacter,
resolveHumanoidParameters and computeSemanticLandmarks. The returned skeleton
and semantic bones support the game-authored skin and equipment.

Motion: createMotionDefinition, createLocomotionEvaluator,
computeGaitFootPlacement, solveTwoBoneIK and commitRootMotionIntent. The latter
feeds the gait odometer; it does not become a second gameplay position writer.

Scene composition and createSimulationClock retain their existing ownership.
Three.js owns the game renderer, lights, camera, skin attributes and effects.

5. Engine gaps encountered

Existing gaps remain: detailed anatomical and facial authoring, authored boxing
pose composition, persistent canvas-space contact scheduling, richer material
detail and volumetric lighting. ENGINE_GAPS.md explains the legal game-owned
implementations. Motion Forge is not credited with authoring boxing technique.
Browser unavailability is a tool limitation, not an engine gap.

6. Opponent geometry changes

Replaced the stock rendered skin with a game-authored 4,800-triangle skin on
the same 22-bone skeleton, up from 2,676 skin triangles. It has normalized joint
weights and a shared skin material. This is a bespoke surface for the fixed
1.86 m opponent, not a general Character Forge extension.

Torso sections define the ribcage, paired pectoral planes, sternum valley,
clavicular direction, lat width, abdominal taper and neck base. Limb sections
define shoulder caps, upper-arm and forearm bellies, elbows, wrists, thigh sweep,
knees, calves and ankle taper. Head sections define socket recession, cheek
planes, jaw taper and chin; attached brow, nose, ears and hair were adjusted.

Trunks now have a pelvis waistband/yoke and separate thigh-attached legs, with
flared openings, side slits, hems and modest asymmetry. Boots have ankle collars,
instep profiles, heel blocks, curved soles, tongues and sparse laces. Gloves have
shaped padded masses, connected thumbs/webs, cuffs, welts and recessed lace beds.

7. Animation and pose changes

Jabs and rear crosses use opposing thoracic rotation, pelvic pressure shifts,
clavicle advance/elevation, head counter-motion, wrist rotation and different
recovery rates. The legacy opponent attack identifier HOOK is now presented
as the requested rear straight cross; its combat timing and damage rules remain.

Foot contacts persist in canvas space. Step duration and landing prediction
follow travel speed. Only one foot swings at a time. Motion Forge supplies the
clearance profile and analytical solves. Idle breathing and balance changes
are restrained and use pose time rather than wall-clock time.

Head and body impacts have different asymmetric reaction paths with rapid
onset and slower decaying follow-through. Hit-stop is 20 ms for jabs, 45 ms for
heavy crosses and 12 ms for blocks, capped at 55 ms. The work order's joined
numbers were interpreted as 15–25 ms and 35–55 ms ranges. Rendering and camera
recovery continue while simulation and fighter pose time hold.

8. Viewmodel changes

Extended asymmetric forearm sections, narrower wrists, ulnar prominence,
overlapping helical wrap bands and tucked tails. Shared glove construction
includes thumb web, crest/welt, cuff and a recessed lace region. Entry offsets,
breathing, movement lag, sprint settling, punch roll, body rotation, dodge and
block shove were adjusted. Their appearance at screen edges still needs review.

9. Ring changes

Existing rope sag was retained and refined to 30–42 mm with more curve samples.
Added two vertical spacers per side, rivets, clevises, tension rods and locknuts.
Replaced square canvas wear tiles with a continuous sheet and localized lane,
corner and pivot marks. The shorter hanging apron reveals support structure;
support legs were extended to meet the joists.

10. Lighting, color and environment

Inspected before editing: sRGB output, ACES tone mapping, exposure 0.96,
PCFSoftShadowMap, four spots at intensity 58 and a single shadow key at 108.

Retained sRGB and ACES. Candidate exposure is 0.86; the four spots are 31 and
the offset shadow key is 68. Penumbrae increased, shadow bias decreased,
and PCFShadowMap uses radius 4. The installed Three.js shader was inspected
to confirm radius-dependent PCF filtering. No extra shadow-casting light was
added. Cool fill increased, fog density decreased, and hit light flashes reduced.
Concrete variants now remain exactly dielectric without random metalness drift.

Added a few longitudinal roof ties, plan braces, a suspended feed, a junction
box and a service chain. Existing dark warehouse composition is retained as
the intended direction; actual silhouette readability is unverified.

11. Performance before/after

Auditor baseline: approximately 60 FPS, 195–205 draw calls and 88k triangles.
After runtime equivalents are unavailable.

The following are CPU-only inventories, not renderer.info measurements. They
include every arena/fighter/viewmodel placement, without frustum culling,
shadow passes, lighting or VFX. Timings are one local diagnostic run.

| Measurement | Before | After |
|---|---:|---:|
| All-placement triangles | 89,776 | 107,064 |
| All-placement material parts | 196 | 200 |
| Unique geometry objects | 35 | 37 |
| Unique material objects | 122 | 126 |
| Authored asset count | 34 | 36 |
| Asset generation median, 3 samples | 43.5 ms | 50.2 ms |
| CPU presentation compilation, 1 sample | 46.7 ms | 34.2 ms |
| Runtime FPS / draw calls / textures | Auditor values above | Unmeasured |
| Initial browser load | Unmeasured | Unmeasured |

Full data and method: artifacts/visual-quality-001/comparison.json and
measure.mjs. Do not interpret the single compilation sample as a speedup.

The runtime report now exposes rendered triangles, geometry/texture/material
counts, presentation compilation time, first-frame timings, FPS and rolling
p50/p95/p99 frame times. Frame timing samples retain stalls beyond the simulation
delta clamp. An independent browser inspector can read
window.__SUMO_IS_A_BOXER__.report().

12. Tests and build

64 tests passed. Production build passed, with the existing-style large-chunk
warning: approximately 749 kB minified JavaScript, 205 kB gzip. Logs are saved
in artifacts/visual-quality-001/tests.log and build.log.

Added checks cover normalized skin weights, finite deformed vertices through
combat and knockdown poses, idle ankle pinning, travelling support contacts,
actual ankle heights at approach/retreat speeds, opposing punch rotation,
viewmodel pose holds and twenty presentation resets. Existing tests cover
combat, input, scene lifecycle and twenty gameplay rematches.

All 197 recorded engine-file hashes match. The engine subtree test passes.
No engine internals were modified or deep-imported.

13. Known defects and limits

- Required browser visual iteration and captures remain blocked.
- Canvas highlight detail, face readability, clothing intersections, lace
  visibility, shadow softness and screen entrance angles are not visually proven.
- Knockdown still uses a root-body fall rather than a fully articulated fall.
- Fast direction reversals and large heading changes need visual footwork review.
- Canvas wear uses opaque procedural geometry, so patch boundaries may need tuning.
- Sparse impact droplets are unlit point sprites, not physically shaded liquid.
- No volumetric shafts, cloth simulation or external image/model assets were added.
- Stable GPU frame pacing and browser rematch resource behavior remain unmeasured.

14. Independent inspection

http://localhost:5180

The server is reachable. This handoff deliberately does not assign a visual
score or certify any success criterion that requires seeing the rendered game.
