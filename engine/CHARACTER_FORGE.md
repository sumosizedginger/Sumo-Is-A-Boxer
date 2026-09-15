# CHARACTER_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof B1 — Motion Truth**

This document defines the durable procedural character generation architecture of My Game Engine 1.0. It documents the contracts, data structures, and mathematical invariants established and evidenced by Proof B1.

---

## 1. Core Architectural Laws

1. **Code-Native Generation**: Character meshes, armatures, and skinning weights originate purely from deterministic TypeScript/JavaScript algorithms, parameters, and seeds. No external finished mesh downloads (e.g. FBX, glTF, OBJ) or third-party modeling software (Blender, Maya, ZBrush) are foundational requirements.
2. **Definition / Artifact / Runtime Separation**: Character definitions specify anatomical parameters and presets; the compiler seam compiles them into immutable artifacts with content fingerprints; the runtime instantiates transient skinned meshes.
3. **Semantic Landmarks as Stable Anchors**: Limb attachments, joints, and skeletal positions derive from semantic landmark vectors in 3D character space, never from brittle vertex indices.
4. **Deformation-Ready Loop Topology**: Cylindrical limb and torso meshes feature explicit multi-ring edge loop clusters concentrated at articulated bend axes (knees, elbows, waist/spine, neck) to prevent volume loss, pinched dome caps, and candy-wrapper twisting during rotation.
5. **Canonical 22-Bone Armature**: Characters utilize a deterministic, hierarchical 22-bone skeleton (`root`, `pelvis`, `spine`, `chest`, `neck`, `head`, bilateral `shoulder/upperarm/forearm/hand`, and bilateral `thigh/shin/foot/toe`).
6. **Strict Normalization Invariant**: Skinning influences are strictly clamped to a maximum of 4 bones per vertex, and the sum of weights must equal 1.0 ($\sum_{k=0}^3 w_k = 1.0$) with maximum error $< 10^{-5}$ across 100% of vertices.
7. **Region-Gated Influence Attribution**: Every vertex carries an immutable semantic body region tag (e.g. `UPPER_ARM_L`, `THIGH_R`). Skinning distance fields only evaluate candidate bones permitted for that region, eliminating contralateral weight bleeding.

---

## 2. Parameter Domain & Presets

Character dimensions derive from the machine-readable `HUMANOID_PARAMETER_BOUNDS` domain. Values outside bounds are clamped deterministically and emit diagnostic warnings.

### 2.1 Bounded Parameter Domain

```text
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
height              1.40      2.20      1.80       meters
shoulderWidth       0.32      0.60      0.44       meters
chestWidth          0.12      0.28      0.18       meters
chestDepth          0.08      0.22      0.13       meters
waistWidth          0.09      0.24      0.14       meters
waistDepth          0.07      0.20      0.11       meters
pelvisWidth         0.11      0.26      0.16       meters
pelvisDepth         0.08      0.20      0.12       meters
armLength           0.50      0.90      0.70       meters
armMass             0.60      1.60      1.00       scalar
legLength           0.70      1.20      0.92       meters
legMass             0.60      1.60      1.00       scalar
headScale           0.80      1.30      1.00       scalar
neckLength          0.07      0.18      0.11       meters
neckThickness       0.04      0.10      0.06       meters
radialSegments      8         32        16         count
torsoSegments       10        32        16         count
limbSegments        8         24        12         count
```

### 2.2 Standard Presets

- **`average`**: Standard adult proportions (1.80m height, 0.44m shoulder, 0.92m leg length).
- **`athletic`**: Enhanced shoulder width and arm/leg mass (1.85m height, 0.48m shoulder, 1.15x arm mass).
- **`heavy`**: Broad torso, expanded chest and waist depth (1.78m height, 0.50m shoulder, 1.35x arm mass).

---

## 3. Semantic Landmarks

Semantic landmarks provide definition-space 3D vectors $\{x, y, z\}$ for skeletal joints and attachment points. These are the current deterministic definition-space landmark formulas computed by `computeSemanticLandmarks()`:

```text
Spine Chain:
  root       -> (0, 0, 0)
  pelvis     -> (0, hipY, -0.020)
  spine      -> (0, waistY, 0.008)
  chest      -> (0, chestY, 0.010)
  neck       -> (0, neckBaseY, -0.010)
  head       -> (0, headCenterY, 0.005)
  headApex   -> (0, height, -0.010)

Left Upper Limb (mirrored X for Right):
  clavicle.L -> (shoulderHalf * 0.35, neckBaseY - 0.015, 0.005)
  shoulder.L -> (shoulderHalf * 0.86, shoulderY, 0.002)
  elbow.L    -> (shoulderHalf * 0.82, shoulderY - upperArmL, -0.015)
  wrist.L    -> (shoulderHalf * 0.78, shoulderY - upperArmL - forearmL, 0)
  hand.L     -> (shoulderHalf * 0.76, shoulderY - upperArmL - forearmL - handL, 0)

Left Lower Limb (mirrored X for Right):
  hip.L      -> (hipHalf, hipY, -0.015)
  knee.L     -> (hipHalf, hipY - thighL, 0.012)
  ankle.L    -> (hipHalf, footH, 0)
  heel.L     -> (hipHalf, 0, -footLength * 0.30)
  toe.L      -> (hipHalf, 0, footLength * 0.70)
```

---

## 4. Deformation-Ready Geometry & Topology

Humanoid meshes are generated using lofted cross-sectional rings.

### 4.1 Topology Rules

1. **Continuous Limb Tubes**: Limbs are generated as continuous parametric tubes spanning proximal to distal joints (shoulder $\to$ elbow $\to$ wrist, hip $\to$ knee $\to$ ankle). Internal interior dome caps are strictly prohibited between adjacent limb segments. Proximal limb origins (deltoid and femoral head) utilize coaxial dome caps aligned with the limb's longitudinal axis to prevent angular fins and bat-wing distortion.
2. Articulated regions must contain sufficient directionally arranged support topology to preserve silhouette and volume throughout the certified pose envelope. Density follows deformation need, never a universal fixed loop count.
3. Shoulder and trapezius continuity must be established by shared indexed topology and validated seams. Adjacent or overlapping deltoid and torso lofts do not establish continuity.
4. Head and neck continuity requires a validated shared boundary connection. A smooth-looking cervical loft or nested skull is not proof of continuity. Proportions and pose silhouette require separate visual validation.
5. **Flat Foot Base**: The sole of the foot geometry rests cleanly on the ground plane $Y = 0$ (lowest vertices $|Y| \le 0.001\text{ m}$), guaranteeing zero penetration beneath the floor.
6. **Dynamic Segment Resolution**: Mesh polygon resolution scales dynamically with definition parameters `torsoSegments` and `limbSegments`.
7. **Semantic Body Regions**: Vertices carry explicit semantic region IDs (`REGIONS.PELVIS` through `REGIONS.FOOT_R`, including `REGIONS.TORSO`). Torso vertices are attributed exclusively to axial spine bones (`pelvis`, `spine`, `chest`).

---

## 5. Canonical 22-Bone Skeleton Hierarchy

The canonical 22 bones form the stable core gameplay and animation skeleton, not a maximum deformation rig. Names, indices 0 through 21, and core parent relationships remain stable. Deterministic helper joints append at index 22 onward, with unique names and an earlier core or helper parent. Helpers never replace or reparent a core bone. Gameplay continues to address the core semantic names.

The core bone tree is ordered such that every parent precedes its descendants:

```text
Index  Bone Name      Parent Bone    Landmark Anchor
------------------------------------------------------
0      root           (null)         root
1      pelvis         root           pelvis
2      spine          pelvis         spine
3      chest          spine          chest
4      neck           chest          neck
5      head           neck           head
6      shoulder_l     chest          clavicle.L
7      upperarm_l     shoulder_l     shoulder.L
8      forearm_l      upperarm_l     elbow.L
9      hand_l         forearm_l      wrist.L
10     shoulder_r     chest          clavicle.R
11     upperarm_r     shoulder_r     shoulder.R
12     forearm_r      upperarm_r     elbow.R
13     hand_r         forearm_r      wrist.R
14     thigh_l        pelvis         hip.L
15     shin_l         thigh_l        knee.L
16     foot_l         shin_l         ankle.L
17     toe_l          foot_l         toe.L
18     thigh_r        pelvis         hip.R
19     shin_r         thigh_r        knee.R
20     foot_r         shin_r         ankle.R
21     toe_r          foot_r         toe.R
```

Local bone positions are calculated as relative offsets from parent landmarks:
$$\vec{p}_{\text{local}} = \vec{p}_{\text{landmark}} - \vec{p}_{\text{parent\_landmark}}$$

Bind matrices and inverse bind matrices are computed synchronously via Three.js `Skeleton.calculateInverses()`.

---

## 6. Procedural Skinning & Normalization Invariant

### 6.1 Distance-to-Segment Math

For every vertex $P(x, y, z)$ and bone segment $AB$:
$$\vec{u} = \vec{B} - \vec{A}$$
$$t = \text{clamp}\left( \frac{(\vec{P} - \vec{A}) \cdot \vec{u}}{|\vec{u}|^2}, 0, 1 \right)$$
$$\text{proj} = \vec{A} + t \cdot \vec{u}$$
$$d = |\vec{P} - \text{proj}|$$

The raw bone weight uses inverse distance with smoothing radius $\epsilon = 0.015\text{ m}$:
$$w_{\text{raw}} = \frac{1}{(d + \epsilon)^2}$$

### 6.2 Normalization Invariant

The top 4 candidate bone weights are selected, and all 4 weights are normalized:
$$S = \sum_{k=0}^3 w_k$$
$$w_k = \frac{w_k}{S}$$

The primary influence absorbs any floating-point residual:
$$w_0 \mathrel{+}= 1.0 - \sum_{k=0}^3 w_k$$

Guaranteeing:
$$\left| \sum_{k=0}^3 w_k - 1.0 \right| < 10^{-5} \quad \forall \text{ vertices}$$

---

## 7. Kiln Seam & High-Level Assembly

The `buildHumanoidCharacter(input, materialOptions)` factory executes the complete pipeline:
1. Resolves parameters via `resolveHumanoidParameters()`.
2. Computes landmarks via `computeSemanticLandmarks()`.
3. Generates deformation geometry via `createHumanoidGeometry()`.
4. Instantiates skeleton via `createHumanoidSkeleton()`.
5. Synthesizes skin weights via `applyHumanoidSkinning()`.
6. Binds `Skeleton` to `SkinnedMesh`.
7. Returns a self-contained character record with geometry, skeleton, root bone, and metadata.

---

## 8. Non-Goals & Boundaries for Character Forge

1. **No Hero Mesh Import**: Does not load static binary models as base meshes.
2. **No Hair or Dynamic Cloth Sim**: Secondary physics belongs to later dedicated FX proofs.
3. **No Facial Rigging**: Facial animation and phoneme shapes belong to later character expression proofs.
4. **No Transform Authority Mutation**: Character Forge does not mutate entity world transforms; transforms are owned solely by the engine runtime.

---

## 9. Donor Provenance

In accordance with `AGENTS.md` and `DEPENDENCY_POLICY.md`, procedural character concepts and algorithms adapted from prior donor repositories are cataloged below:

```text
Donor Repository: sumosizedginger/my-engine-2
Source Commit SHA: 08d3fde6840754a0734e967cea94c4c3805115ee
License: MIT

1. Path: src/character/humanoid-parameters.js
   Classification: ADAPT
   Why: Provided validated anatomical parameter domains and default bounds for height, limbs, and proportions.
   Material Changes: Converted to pure JavaScript module with explicit clamping diagnostics and frozen presets.
   Tests: tests/character.test.js ('resolves standard average preset', 'clamps out-of-bounds parameter values').

2. Path: src/character/skeleton-forge.js
   Classification: ADAPT
   Why: Established the canonical 22-bone humanoid topological hierarchy and parent-child link ordering.
   Material Changes: Aligned bone offsets strictly to semantic landmark vectors rather than procedural math shortcuts.
   Tests: tests/character.test.js ('instantiates the canonical 22-bone hierarchy with valid bind matrices').

3. Path: src/character/skeleton-skinning-proof.js
   Classification: ADAPT
   Why: Established distance-to-segment bone weight synthesis and the strict sum(w_i) == 1.0 normalization invariant.
   Material Changes: Added region-gated candidate bone sets to eliminate contralateral weight bleeding; tuned smoothing radius to 0.015m.
   Tests: tests/character.test.js ('satisfies the strict normalization invariant', 'prevents contralateral weight bleeding').

4. Path: src/character/canonical-humanoid.js
   Classification: REFERENCE
   Why: Provided architectural precedent for procedural assembly of SkinnedMesh from generated buffers.
   Material Changes: Re-implemented loft authoring. Historical claims of zero mesh seams did not establish shared topology; certification now requires the executable gate below.
   Tests: tests/character.test.js ('builds complete SkinnedMesh for average, athletic, and heavy presets').
```


## 10. Hero topology and artifact foundation (CHAR-FOUNDATION-001)

Buffer concatenation is not topology fusion. mergeMeshes, game fuse, and concatenateTopologySurfaces batch independent geometry. They do not weld vertices, bridge loops, or certify a body. Deliberately separate eyeballs, teeth, tongue, hair, garments, gloves, boots and equipment are legitimate components. Continuous body skin must pass its own policy independently of that equipment.

The public full package exports createTopologySurface, findBoundaryEdges, extractBoundaryLoops, weldTopologyVertices, bridgeTopologyLoops, stitchTopologySurfaces, analyzeTopology and validateTopology. These execute on MeshIR, indexed BufferGeometry data or TopologySurface v1. Geometry authoring remains renderer-independent. The legacy MeshIR v1 codec does not carry extended hero attributes: retain the TopologySurface or HeroCharacterArtifact instead of routing extended data through that codec.

Boundary loops follow existing triangle winding, start deterministically, and can be selected by regionId, region, surfaceId and centroid into explicit semantic names. Ambiguous selectors and branched/non-manifold boundaries fail with diagnostics. A bridge reverses the correspondence of the second boundary, adds indexed faces, and validates the result. Weld stitching joins only explicit compatible seam pairs. Equal-sized loops are supported; unequal counts fail. Author the loop correspondence and bounded span intentionally. This validator proves combinatorial continuity and finite nonzero-area faces, not freedom from geometric self-intersection or anatomical quality.

Welding uses spatial buckets with a comparison budget, or explicit disjoint candidate pairs. Positions must be within tolerance; UV, semantic attributes, tangent frames and morph values must be compatible. The default preserves categorical boundaries. An explicit representative semantic policy can choose the lowest source vertex and emits a warning. Welds remap every supported attribute, remove duplicate/degenerate triangles with diagnostics, compact unused vertices and expose oldToNew. Four skin influences are accumulated, deterministically ranked, truncated and renormalized. Normals are preserved compatibly or recomputed from indexed faces. Morph normal recomputation requires target positions. Recomputing normals with existing tangents fails explicitly: regenerate tangent frames after topology authoring. Unknown attributes and mismatched schemas fail; critical data is never silently zero-filled.

Policies are composable: OPEN_SURFACE_ALLOWED permits intentional boundaries and multiple components; CLOSED_MANIFOLD forbids boundaries; SINGLE_COMPONENT requires one component; DEFORMATION_SURFACE rejects isolated vertices. All reject malformed numeric/index data, duplicate or degenerate faces, inconsistent edge winding, non-manifold edges and non-manifold vertex links. certifyHeroBody always reapplies CLOSED_MANIFOLD + SINGLE_COMPONENT + DEFORMATION_SURFACE and requires UV, normal and normalized skin attributes. A permissive artifact policy cannot weaken this gate.

createHeroCharacterArtifact produces an owned, deeply immutable, JSON-serializable versioned snapshot containing geometry, coreSkeleton, deformationSkeleton, semanticRegions, semanticLandmarks, materialRegions, attachmentAnchors, attribute availability (uv/normal/tangent/skinIndex/skinWeight), morphRegistry, poseDriverRegistry, topologyReport, topologyPolicy, closedBodyTopology, certifiedClosedBody, lod and provenance. Position/normal/UV/tangent/semantic/skinning buffers and morph metadata live in geometry, not anonymous runtime fields. instantiateHeroCharacterArtifact creates fresh runtime buffers and the core/helper skeleton with explicit disposal. Its initial material adapter supports one material identity; multiple identities fail pending an explicit binding map. Definition-side material regions remain intact.

createPoseDriverDefinition represents a named primary semantic joint, rest quaternion, local twist axis, optional neighboring joints and named pose samples with output morph identities and radii. decomposeSwingTwist computes rest-inverse times current orientation, a signed swing rotation vector, and signed principal twist radians. Opposite equal-angle swings and twists remain distinct. evaluatePoseDriver exposes values, distances and bounded compact radial output weights. This is a directional foundation, not a fitted RBF solver or final PSD shapes. The 180-degree perpendicular swing singularity fails explicitly. Evaluation allocates result objects and is an authoring/reference evaluator, not an allocation-free combat update loop.

Turn 1 certified the machinery and synthetic fixture, not the legacy boxer body. CHAR-TOPOLOGY-002 replaces that consumer body with an actually certified shared skin. Consumer body authoring must call certifyHeroBody on the runtime geometry and test its own deformation envelope; neither buffer merging nor the existence of a certificate field is sufficient.


Runtime adapter correction (CHAR-TOPOLOGY-002): createHeroRuntimeGeometry is the public renderer seam for TopologySurface data. It retains Uint32 authoring identities but supplies Float32 GPU attributes to the standard Three skinning shader. Uint32 vertex attribute bindings are integer inputs and cannot feed its floating-point skinIndex declaration. Categorical values exceeding exact Float32 range fail explicitly. Both artifact instantiation and the game body use this adapter. The actual browser test additionally checks visible skin pixels, so a numerically valid but invisible mesh cannot pass.

## Sculpted hero surfaces

Hero authoring may use Geometry Forge local fields and conforming refinement before the artifact's skinning, morph and tangent stages. Character identity fields and facial layouts belong to the game. Durable semantic regions and model-space landmarks belong in the artifact. Definition-side geometry metadata can record authoring parameters, feature frames and separate component placement such as eye centers.

Orbital pockets and auricular patches can remain part of a single closed skin by stitching their ordered boundaries through the public topology API. A globe may occlude a recessed, connected orbital skin pocket. Neither overlapping primitives nor concatenation establish this connection. Closed-manifold certification remains mandatory, and does not substitute for visual inspection of folds, self-intersection, facial form or eye seating.
