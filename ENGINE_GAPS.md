# ENGINE GAPS — My Game Engine 1.0

Recorded while building **SUMO IS A BOXER — Midnight Bout** as an external consumer
of `@sumosizedginger/my-game-engine-1.0`.

**Method.** Every entry below is a capability the game actually needed, tried to
obtain through the engine's published surface (`engine/full` /
`engine/runtime`), and could not. The public surface was enumerated from the
live package rather than from documentation:

```bash
node -e "import('@sumosizedginger/my-game-engine-1.0/full').then(m=>console.log(Object.keys(m).sort().join('\n')))"
```

132 exports. No engine file was modified; `tests/engine-consumption.test.js`
enforces that, both by scanning every import specifier in the game and by
asserting `git status --porcelain -- engine` is empty.

**Severity legend**

| | meaning |
|---|---|
| **BLOCKING** | the game could not do the thing at all through public API |
| **DETOUR** | achievable, but only by the game owning a layer the engine looks like it should own |
| **FRICTION** | achievable; costs more code or a worse result than it should |
| **CONFLICT** | the engine contradicts its own declared convention |

---

## GAP-01 — A compiled scene cannot be put on screen through public API
**Severity: BLOCKING (routing)**

- **Capability attempted.** Take a `SceneInstance` from `instantiateScene` plus a
  library of authored MeshIR and produce a renderable object tree.
- **Public API inspected.** `instantiateScene`, `members()`, `worldTransformOf`,
  `worldMatrixOf`, `createPreviewable`, `previewArtifact`, `createPreviewLab`,
  the `scene/affine` primitives, `AUTHORING_SURFACE.scene`.
- **Why it was insufficient.** The engine *has* the adapter —
  `src/render/scene-presentation.js`, accepted and covered by
  `tests/b2-presentation.test.js` — and it does exactly this job, correctly,
  including installing the compiled matrix without decomposing it. It is not
  exported from `engine/full`. `toBufferGeometry` is also deliberately withheld
  (`AUTHORING_SURFACE.notExported`). So the one accepted implementation of
  scene → renderer is unreachable from outside the repository. This is the same
  class of defect PUBLIC-SURFACE-001 fixed for the four Forges: implemented,
  accepted, intended for external use, no supported route.
- **Legal workaround used.** `src/game/presentation/asset-library.js` +
  `presenter.js`. One `createPreviewable` per distinct asset (the supported
  MeshIR → renderer route), its `geometry` and `compiledMaterials` then shared
  by every placement; world matrices read from the `SceneInstance` and installed
  with `matrixAutoUpdate = false`, never decomposed.
- **Whose fix.** **The engine's.** Either route `createScenePresentation`
  through `engine/full`, or state in `AUTHORING_SURFACE` that Previewable is the
  intended public route and that scene presentation is game-owned. Right now the
  repository implies the first and only permits the second.

---

## GAP-02 — The modeling verb set cannot express curved or bevelled form
**Severity: DETOUR**

- **Capability attempted.** Boxing gloves, turnbuckle pads, a heavy bag, corner
  padding, lamp shades, buckets, a human head — lathe and bevel forms.
- **Public API inspected.** `createBoxMesh`, `createCylinderMesh`,
  `extrudeProfile`, `transformMesh`, `mergeMeshIR`, `MESH_OP_DESCRIPTORS`.
- **Why it was insufficient.** Three verbs: box, cylinder, convex linear
  extrusion. There is no revolve/lathe, no sphere or ellipsoid, no torus, no
  bevel, no taper along a path, no sweep. `extrudeProfile` fails closed on a
  non-convex profile with caps, which is correct but leaves the gap wider. The
  engine's own laws already record topology-aware bevel/boolean/subdivision as
  out of scope for the tranche — but revolve is not topology-aware, it is a
  primitive, and without it every rounded object in this venue would have been a
  visibly faceted stack of cylinders. That is precisely the "procedural means
  crude" outcome this benchmark exists to disprove.
- **Legal workaround used.** `src/game/assets/kit.js` adds `revolve`,
  `sphereoid`, `roundedBox`, `tube` and `chain`, each emitting MeshIR through
  the **public** `createMesh` / `createPart` constructors with derived normals.
  These are new shapes, not reimplementations of existing engine verbs; engine
  verbs are used wherever they apply, and they carry most of the venue.
- **Whose fix.** **The engine's.** `revolve` and a chamfered box are foundational
  modeling verbs, not game features.

---

## GAP-03 — Semantic part identity is welded to draw-call count
**Severity: FRICTION**

- **Capability attempted.** Author a rope from a cord plus forty bindings and
  still call the whole thing `top-rope-north` at a cost of one draw call.
- **Public API inspected.** `createPart`, `createMesh`, `mergeMeshIR`,
  `PREVIEW_BUDGET_DEFAULTS` (`maxParts: 256`, `maxDrawCalls: 256`).
- **Why it was insufficient.** `toBufferGeometry` emits **one geometry group per
  part**, and `createPreviewable` predicts `drawCalls = parts.length` and budgets
  against it. Part identity is therefore a rendering cost, so the naming law
  ("anonymous parts are refused") and the performance budget pull in opposite
  directions: every name you add costs a draw call, even when fifty parts share
  one material.
- **Legal workaround used.** `fuse()` in `kit.js` concatenates many MeshIR inputs
  into **one** named part through the public constructors, and `assemble()`
  builds a multi-part asset from named groups. Result: 34 assets, 51,072 authored
  triangles, 131 parts, and 180-199 draw calls measured in the running build —
  with the semantic vocabulary intact.
- **Whose fix.** **The engine's**, if it wants both laws. A part table decoupled
  from draw groups (parts as named index ranges, groups merged by material) gives
  semantic naming for free.

---

## GAP-04 — Rotation authoring has no public helper
**Severity: FRICTION**

- **Capability attempted.** Place an authored mesh at an angle.
- **Public API inspected.** `transformMesh`, `validateTransform`,
  `identityTransform`, `createAnchor`, `QUATERNION_UNIT_TOLERANCE`.
- **Why it was insufficient.** `transformMesh` **requires a unit quaternion** and
  refuses anything else (correctly — a non-unit quaternion scales as a side
  effect). The engine owns the quaternion maths to build one —
  `multiplyQuaternions` and `rotateVectorByQuaternion` in
  `src/geometry/anchors.js` — but exports neither. Every consumer must therefore
  write Euler→quaternion conversion before it can rotate anything.
- **Legal workaround used.** `quat`, `quatAxis`, `quatFromUpTo` in `kit.js`.
- **Whose fix.** **The engine's.** Either export the two helpers that already
  exist, or let `transformMesh` accept a named Euler form and normalize it
  explicitly.

---

## GAP-05 — No public deterministic random service
**Severity: FRICTION**

- **Capability attempted.** Seeded variation for material families, canvas wear,
  crowd placement, AI decisions and VFX.
- **Public API inspected.** All 132 exports; `worldDataHash`, `meshHash`,
  `createWorldRecipe` (which takes a seed but only for world generation).
- **Why it was insufficient.** `AGENTS.md` explicitly forbids scattering
  `Math.random()` through deterministic systems and requires "explicit seeded
  random services". No such service is public. A consumer obeying the law has to
  write one.
- **Legal workaround used.** `createSeededRandom` in `kit.js` (mulberry32),
  named and seeded per subsystem. `tests/assets.test.js` asserts asset generation
  is byte-reproducible via `meshHash`.
- **Whose fix.** **The engine's.** The law exists; the service should too.

---

## GAP-06 — Material Forge cannot express surface detail
**Severity: DETOUR**

- **Capability attempted.** Aged concrete, worn canvas, rust bloom, chipped
  paint, dirty rope.
- **Public API inspected.** `createMaterialDefinition`, `MATERIAL_PRESETS`,
  `MATERIAL_PARAMETER_BOUNDS`, and `MeshIR`'s `OPTIONAL_ATTRIBUTES`.
- **Why it was insufficient.** A MaterialDefinition carries colour, roughness,
  metalness, emissive, emissiveIntensity, wireframe and `vertexColors`. There is
  no texture, map, noise, gradient or procedural pattern of any kind. Worse,
  `vertexColors` is a dead end from outside: MeshIR's optional attributes are
  `normal`, `uv`, `regionId`, `surfaceId` — **there is no colour attribute**, and
  `toBufferGeometry` therefore never sets one, so declaring `vertexColors: true`
  produces an unlit black surface. The one variation channel the material system
  advertises cannot be fed by the geometry system.
- **Legal workaround used.** Two channels instead. (a) **Material families**:
  `src/game/assets/materials.js` authors 37 families x seeded variants = 112
  MaterialDefinitions, so neighbouring panels, bays and boards differ in colour
  and roughness. (b) **Geometry-level breakup**: the canvas is a 9×9 tile field
  assigned to worn/stained variants by a smooth wear function; the walls carry a
  painted dado band, pilaster ribs and a brick repair patch as real geometry.
- **Whose fix.** **The engine's.** At minimum, a `color` vertex attribute in
  MeshIR, so the `vertexColors` flag the compiler already supports becomes
  reachable. Procedural material graphs are the larger, later answer.

---

## GAP-07 — A Character Forge humanoid is one material
**Severity: DETOUR**

- **Capability attempted.** A boxer whose skin, trunks, boots and gloves are
  visibly different materials.
- **Public API inspected.** `buildHumanoidCharacter`, `CHARACTER_REGIONS`,
  `computeSemanticLandmarks`, `HUMANOID_PARAMETER_BOUNDS`.
- **Why it was insufficient.** Two problems. (1) `buildHumanoidCharacter`
  constructs exactly one `MeshStandardMaterial` and accepts only
  `{ color, roughness, metalness, wireframe }` — **not a MaterialDefinition** —
  so Material Forge is bypassed at the one place a character's appearance is
  decided. (2) The geometry carries a `regionId` per vertex and
  `CHARACTER_REGIONS` is public, but nothing public turns regions into material
  slots, so the region data cannot be used for its obvious purpose.
- **Legal workaround used.** The authored skin MaterialDefinition's *resolved
  parameters* are read back and passed through as material options, keeping
  Material Forge the source of the value. Everything that is not skin — gloves,
  trunks, boots, hair, face detail — is authored as separate MeshIR and attached
  to the Forge's own semantic bones through `bonesByName`, which
  `AUTHORING_SURFACE` names as the intended attachment route.
- **Whose fix.** **The engine's.** `buildHumanoidCharacter` should accept
  MaterialDefinitions, ideally one per region.

---

## GAP-08 — The input system has no pointer, and simulated scalars cannot coexist with hardware
**Severity: DETOUR**

- **Capability attempted.** Mouse look and mouse buttons folded into the same
  semantic actions as the keyboard and the controller.
- **Public API inspected.** `createInputSystem`, `bindKey`, `bindScalarKey`,
  `bindGamepadButton`, `bindScalarButton`, `bindGamepadAxis`, `bindScalarAxis`,
  `simulateAction`, `simulateActionValue`, `captureSnapshot`,
  `getGamepadStatus`, `DEFAULT_*` binding tables.
- **Why it was insufficient.** Two distinct problems.
  1. **No pointer device.** The system binds keyboards and gamepads. There is no
     mouse button, wheel or pointer-motion binding of any kind, and no way to
     register a new device.
  2. **Simulation overrides hardware, including zero.** `captureSnapshot` applies
     `for (const [action, value] of simulatedValues) values[action] = value;`
     *after* merging hardware. So routing mouse look through
     `simulateActionValue('LOOK_X', dx)` silently kills the right stick on the
     very same action — and there is no way to clear a simulated scalar short of
     `clear()`, which also drops the gamepad. Boolean `simulateAction` is fine:
     it merges (true-only), so mouse **buttons** compose correctly.
- **Legal workaround used.** `src/game/input/input-router.js`. Keyboard and
  gamepad — digital, analog keys, triggers and both sticks with deadzones — are
  bound entirely through the engine. The pointer is a game-owned source: buttons
  and wheel go into the engine via `simulateAction` (safe merge); pointer motion
  is carried on the game's `ActionFrame` as an **impulse** (`frame.delta`)
  alongside the stick's **rate** (`frame.value`), which is also the physically
  correct distinction. Gameplay sees only semantic actions.
- **Whose fix.** **The engine's.** A pointer device, and a merge policy for
  simulated scalars that layers rather than replaces.

---

## GAP-09 — Motion Forge has one clip and no way to blend or mask it
**Severity: DETOUR**

- **Capability attempted.** Idle stance, boxing guard, jab, hook, block, stagger,
  knockdown, and directional footwork.
- **Public API inspected.** `createLocomotionEvaluator`, `MOTION_PRESETS`,
  `MOTION_PARAMETER_BOUNDS`, `computeGaitFootPlacement`, `solveTwoBoneIK`,
  `commitRootMotionIntent`.
- **Why it was insufficient.** Motion Forge produces exactly one thing: a forward
  walk cycle. `update()` writes pelvis, spine, chest, both legs, both arms and
  both hands every call. There is no idle, no second clip, no state machine, no
  blend weight, no additive layer, no bone mask, no strafe or backward
  locomotion, and no way to request a speed — `speed` is derived from
  `cadence × strideLength / 120`. An upper body doing anything other than walking
  has to be written by the consumer, and it has to be written *after* the
  evaluator, because the evaluator does not know how to leave bones alone.
- **Legal workaround used, stated precisely.**
  - **Motion Forge owns:** gait phase and its pelvis dynamics, foot grounding,
    root-motion intent, and — genuinely load-bearing — `solveTwoBoneIK`, which
    drives **every boxing arm pose in the game**. Each guard, jab and hook is a
    wrist target in character space solved through the engine's analytical
    solver, not a hand-tuned Euler triple.
  - **The game owns:** the boxing stance, guard height, punch poses, block,
    stagger and knockdown; and a stance-blend that slerps the legs back to a
    bladed boxing base as the fighter comes to rest.
  - The gait is played at `actualSpeed / evaluatorSpeed` so the feet do not
    skate, and `commitRootMotionIntent` is committed into a game-owned gait
    odometer that closes that loop. Motion never writes a world transform.
- **Whose fix.** **The engine's**, and it is the largest of these. Clip
  authoring, a blend graph, and bone masking are the difference between a motion
  system and a walk generator.

---

## GAP-10 — No VFX or particle capability
**Severity: DETOUR**

- **Capability attempted.** Impact sparks, sweat spray, hanging dust.
- **Public API inspected.** All 132 exports. Nothing particle-, emitter- or
  effect-shaped exists.
- **Legal workaround used.** `src/game/presentation/vfx.js`: two fixed-size
  `Points` clouds with ring-recycled particles, allocated once at boot. A punch
  never allocates. The round particle sprite is a radial gradient **drawn in
  code** into a canvas at boot — no image file in the project.
- **Whose fix.** Probably the engine's, eventually. Bounded, poolable emitters
  are cross-genre. Not urgent for this tranche.

---

## GAP-11 — AUDIO SUBSYSTEM. No audio capability of any kind
**Severity: BLOCKING (explicitly recorded as the brief requires)**

- **Capability attempted.** Jab whoosh, cross whoosh, block, impact, heavy
  impact, guard break, grunt, round bell, ambient crowd.
- **Public API inspected.** All 132 exports, and the whole `src/` tree. There is
  no audio module in the repository, public or private.
- **Legal workaround used.** `src/game/audio/audio.js` — game-owned Web Audio,
  fully synthesised: one shared brown-noise buffer, one master chain, filtered
  noise plus oscillators per hit, and a looping room tone that surges on
  knockdowns. Deliberately a concrete sound bank for this game, **not** a
  speculative universal engine audio architecture.
- **Whose fix.** **The engine's.** A browser-first game engine without audio is
  incomplete. When it lands, this file is what it replaces.

---

## GAP-12 — Character Forge faces +Z; the engine declares −Z forward
**Severity: CONFLICT**

- **What was observed.**
  ```
  MESH_FORWARD_AXIS   === '-Z'
  SCENE_FORWARD_AXIS  === '-Z'
  landmarks['toe.L'].z  >  0     (toes point +Z)
  landmarks['heel.L'].z <  0
  head/chin stations at z > 0    (the face is on +Z)
  locomotion.update().rootMotionIntent.deltaZ > 0   (walks toward +Z)
  ```
  So the humanoid faces **+Z**, and Motion Forge is self-consistent with the
  character — but both contradict the forward axis the engine declares for
  MeshIR and for scenes.
- **Why it matters.** A consumer that trusts the declared convention places every
  character backwards, and will not know why. This cost real time in this build:
  the opponent fought with its back to the player until the axes were measured
  rather than assumed.
- **Legal workaround used.** One half turn, in one place, documented at the point
  of use: the opponent's group is rotated `state.yaw + Math.PI`, and every pose
  target is authored in the Forge's own +Z-forward frame.
- **Whose fix.** **The engine's.** Either re-author the humanoid to −Z forward,
  or state the exception in `CHARACTER_FORGE.md` and in `AUTHORING_SURFACE`.

---

## GAP-13 — The Character Forge head has no face
**Severity: FRICTION**

- **Capability attempted.** An opponent that reads as a person at 1.8 m.
- **Public API inspected.** `buildHumanoidCharacter`, `computeSemanticLandmarks`
  (which gives `head` and `headApex` and nothing facial), `CHARACTER_REGIONS`.
- **Why it was insufficient.** The head is a smooth lofted ellipsoid. No brow,
  eyes, nose, ears or jaw, and no landmarks for any of them. At fighting distance
  it reads as a mannequin, which undercuts the whole character claim.
- **Legal workaround used.** `buildHeadDetail` in `fighter-kit.js` authors a brow
  ridge, deep-set eye recesses, nose, ears, cheeks, cropped hair, a taped eyebrow
  and a mouthguard, sized from Character Forge's **published** head parameters
  (`0.046 × height × headScale` across, `0.058` deep) so the features sit on the
  surface rather than floating off it. Attached to the `head` bone.
- **Whose fix.** Arguably shared. A face system is a large feature; facial
  landmarks (`brow`, `eye.L/R`, `nose`, `jaw`, `ear.L/R`) are not, and would let
  any consumer do this correctly instead of measuring the loft.

---

## GAP-14 — There is no public renderer, camera or light
**Severity: DETOUR (possibly by design, but undeclared)**

- **Capability attempted.** Put the game on screen.
- **Public API inspected.** All 132 exports. No renderer, camera, light,
  post-processing or render-graph surface.
- **Why it is ambiguous rather than simply missing.** Every game inside the
  engine repository owns its own renderer (`src/games/pong/renderer.js`,
  `racing/renderer.js`, `combat/renderer.js`, `sequence/renderer.js`), which
  suggests game-owned rendering is the intended architecture. But
  `ARCHITECTURE.md` also speaks of WebGPU-preferred/WebGL2-fallback as an engine
  runtime principle, which suggests the opposite. A consumer cannot tell which.
- **Legal workaround used.** The game owns its Three.js presentation entirely —
  renderer, camera rig, light rig, fog, tone mapping — consuming `three` at the
  same version the engine pins.
- **Whose fix.** **A decision, not code.** Declare in `AUTHORING_SURFACE` whether
  presentation is game-owned. If it is, this stops being a gap tomorrow.

---

## GAP-15 — Runtime collision is Pong
**Severity: DETOUR**

- **Capability attempted.** Keep two fighters inside a ring and out of each
  other.
- **Public API inspected.** `createCollisionSystem`, `checkAABB`.
- **Why it was insufficient.** The collision system's public methods are
  `clampPaddleToBounds`, `resolveArenaWalls`, `resolvePaddleCollision` and
  `checkGoal`. It is Proof A's Pong solver, in 2D, and it is the only collision
  capability on the surface. There is no capsule, sphere, ray, sweep or
  character controller.
- **Legal workaround used.** `constrainVelocity` in `combat/fighters.js` —
  planar ring clamp plus fighter separation, applied to **intent before commit**
  so `transforms.commitAll(dt)` remains the single authoritative writer for the
  step, as `CONSTITUTION.md` §13 requires.
- **Whose fix.** **The engine's.** Boxing needs almost nothing — a capsule and a
  bounds clamp — and almost every other genre needs the same nothing.

---

## GAP-16 — Geometry Forge's room generator cannot participate in the authoring pipeline
**Severity: FRICTION (inspected, then legitimately not used)**

- **Capability attempted.** Use `generateProceduralRoom` for the warehouse shell.
- **Public API inspected.** `createRoomDefinition`, `resolveRoomParameters`,
  `generateProceduralRoom`, `ROOM_PRESETS`, `SURFACE_TYPES`, `GEOMETRY_REGIONS`,
  `CONSTRAINT_FLAGS`.
- **Why it was insufficient.** Two reasons, and the second is the architectural
  one. (1) The generator produces a fixed form: floor slab, four perimeter walls,
  optional cylindrical pillars. No roof, trusses, openings, services or
  structural bays — it cannot describe this venue. (2) More importantly, it
  returns `visual.geometry` as a **Three.js BufferGeometry**, not MeshIR. Using
  it would have meant one asset in the venue bypassing the
  MeshIR → Previewable pipeline every other asset goes through, and being
  invisible to `validateMesh`, `meshHash` and the part/material contract the
  rest of the build is tested against.
- **Legal workaround used.** The warehouse is authored in MeshIR
  (`src/game/assets/warehouse.js`) with the same verbs as everything else, and
  Geometry Forge's **semantic vocabulary** is what the game actually consumes.
- **Whose fix.** **The engine's**, when convenient: a Forge that returns MeshIR
  composes with the authoring surface; one that returns renderer geometry does
  not.

---

## Summary

| ID | Area | Severity | Fix belongs to |
|---|---|---|---|
| GAP-01 | Scene → renderer routing | BLOCKING | Engine |
| GAP-02 | Modeling verbs (revolve, bevel) | DETOUR | Engine |
| GAP-03 | Part identity vs draw calls | FRICTION | Engine |
| GAP-04 | Quaternion helpers not public | FRICTION | Engine |
| GAP-05 | No seeded RNG service | FRICTION | Engine |
| GAP-06 | No material detail; no colour attribute | DETOUR | Engine |
| GAP-07 | One material per character | DETOUR | Engine |
| GAP-08 | No pointer device; simulation overrides hardware | DETOUR | Engine |
| GAP-09 | One motion clip, no blending or masking | DETOUR | Engine |
| GAP-10 | No VFX | DETOUR | Engine (later) |
| GAP-11 | **No audio subsystem** | BLOCKING | Engine |
| GAP-12 | Humanoid faces +Z vs declared −Z | CONFLICT | Engine |
| GAP-13 | No facial landmarks or features | FRICTION | Shared |
| GAP-14 | No public renderer; intent undeclared | DETOUR | Decision |
| GAP-15 | Collision is Pong-specific | DETOUR | Engine |
| GAP-16 | Room generator returns renderer geometry | FRICTION | Engine |

**What the engine got right, for balance.** The Forge definition/artifact/runtime
separation held under real use. `compileScene` → `instantiateScene` was exactly
the right shape for a venue and never needed working around. `solveTwoBoneIK` is
good enough to drive an entire boxing upper body. The Gameplay Foundation —
clock, entities, transform authority, state, rules, action input — carried the
whole fight without a single workaround; `createTransformManager`'s
intent/commit split is genuinely why this game has one authoritative writer.
`createPreviewable`'s fail-closed budget sat under every asset in the build
without a single violation, which is the quiet outcome a budget is for. And the
public surface's own
`AUTHORING_SURFACE` descriptor was the single most useful artifact in the
repository for building against it.
VISUAL-QUALITY-001 addendum, 2026-09-11

The engine directory was not edited. Existing GAP-02, GAP-06, GAP-09,
GAP-13 and GAP-14 remain relevant to this pass.

ENGINE GAP: authored athletic skin on the semantic skeleton.
Character Forge exposes a generated humanoid, skeleton, landmarks and skinned
mesh. Its accepted body parameter surface does not express the requested
pectoral shelf, sternum valley, recessed sockets, jaw planes or asymmetric
muscle profiles. The game builds section-loft MeshIR through createMesh and
createPart, compiles it with createPreviewable, and installs a cloned geometry
with game-authored normalized skin weights on the returned skeleton. The
stock parameter/landmark metadata still describes the underlying rig. It is
not a claim that Character Forge generated the new surface. This bespoke
skin targets this opponent's fixed 1.86 m proportions.

ENGINE GAP: boxing kinetic chain and persistent canvas-space contact.
createLocomotionEvaluator and computeGaitFootPlacement provide gait dynamics,
contact state and swing clearance. solveTwoBoneIK provides chain solving.
They do not author the game's jab/cross, protective guard, delayed head/body
reaction or world-space contact schedule for strafing and turning. Those are
game-owned in opponent-boxer.js and boxing-feet.js. commitRootMotionIntent
continues to feed a gait odometer, not a second gameplay transform writer.

ENGINE GAP: feathered volumetric shafts.
The accepted renderer/material route used by this game has no volumetric
lighting pass. No transparent light cones or new volumetric approximation
were shipped. Existing fog and sparse ambient dust remain.

VALIDATION TOOL LIMITATION, not an engine gap:
The browser tool returned no available browser. Its surface inventory was
apps: [], browsers: []. The server returned HTTP 200 at localhost:5180, but
no rendered stage inspection, captures, GPU frame pacing or browser rematch
measurement was possible in this session. See VISUAL-QUALITY-001.md.

VQ-003 PHASE 1: ENGINE GAP / CANDIDATE CAPABILITY
PROCEDURAL MATERIAL TEXTURE AUTHORING

Attempted capability: deterministic code-native height, roughness and albedo
microdetail, shared across compiled canvas, glove, skin, concrete and steel
materials, with explicit texture ownership and safe lifecycle.

Public API used: createMaterialDefinition and createPreviewable through the
accepted package surface. Their existing definition/compilation path supplies
base materials and renderable assets. The accepted definition does not carry
these generated texture fields or a consumer-owned texture resource contract.

Game-local workaround: procedural-materials.js generates six packed DataTextures
at setup, shares them across selected compiled materials, and adds bounded
Three.js onBeforeCompile sampling. Mipmaps and anisotropic filtering are enabled.
The game owns allocation, comparison switches and disposal. No engine changes.

Reuse candidate: seeded CPU texture generation and explicit resource ownership
may be generally reusable. Visual value and GPU cost have not yet been verified
in this session, so this is a candidate rather than a proven engine requirement.
Do not design a Texture Forge, graph editor, material compiler replacement,
asset marketplace or generalized volumetric system before the experiment passes.

No new dynamic-decal, volume or rope capability was attempted in Phase 1.
