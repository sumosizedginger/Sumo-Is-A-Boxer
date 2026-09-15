# GEOMETRY_FORGE.md

## Status

**CANONICAL SUBSYSTEM SPECIFICATION**  
Authority: Subsystem specification beneath `CONSTITUTION.md`, `PRD.md`, and `ARCHITECTURE.md`.  
Canonical repository: `sumosizedginger/My-Game-Engine-1.0`  
Earned by: **Proof B2 — Procedural Combat Room**

This document defines the durable procedural geometry architecture of My Game Engine 1.0. It documents the contracts, data structures, and mathematical invariants established and evidenced by Proof B2.

---

## 1. Core Architectural Laws

1. **Code-Native Generation**: Geometry definitions, vertex buffers, and collision bounds originate purely from deterministic code, parameters, and seeds. No external 3D asset downloads (e.g. FBX, OBJ, glTF) or third-party modeling software (Blender, Maya, ZBrush) are foundational requirements.
2. **Single-Truth Derivation**: The exact same `RoomDefinition` produces both the semantic visual `BufferGeometry` and the authoritative gameplay collision representation. Collision is never reverse-engineered or reconstructed post-hoc from rendered triangles.
3. **Explicit Semantic Attribution**: Every generated vertex carries immutable `regionId` and `surfaceId` attributes, enabling downstream systems (lighting, audio physics, character locomotion, AI navigation) to understand what physical and semantic surface each triangle represents.
4. **Direct Procedural Construction**: Direct algorithmic generation of geometric primitives (boxes, cylinders, slabs) is preferred over heavy runtime CSG boolean libraries, providing rock-solid numerical stability, zero compilation non-determinism, and zero external binary dependencies.
5. **Single-Writer Transform Authority Integration**: The collision representation exposes deterministic spatial resolution queries (`resolvePosition`, `isWalkable`) that act on movement intent to commit the single authoritative world transform for dynamic entities.
6. **Package Purity**: Geometry Forge lives in `src/geometry/` and is not prematurely exported through the lightweight `engine/runtime` or `engine/full` packages until broadly required.

---

## 2. Parameter Domain & Schema

Room parameters are strictly validated and clamped against the `ROOM_PARAMETER_BOUNDS` domain. Values outside bounds emit structured diagnostic warnings.

### 2.1 Bounded Parameter Domain

Room parameters and pillar parameters are strictly validated and clamped against their canonical schema bounds:

```text
Room Parameter (ROOM_PARAMETER_BOUNDS)
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
width               8.0       48.0      16.0       meters (X axis)
depth               8.0       48.0      16.0       meters (Z axis)
wallHeight          2.0       8.0       3.5        meters (Y axis)
wallThickness       0.2       1.5       0.4        meters
floorThickness      0.1       1.0       0.3        meters

Pillar Parameter (PILLAR_PARAMETER_BOUNDS)
Parameter           Min       Max       Default    Unit
-----------------------------------------------------------------
radius              0.3       2.0       0.75       meters
height              1.0       8.0       3.5        meters (clamped to wallHeight)
```

### 2.2 Standard Presets

- **`combat_arena`**: Standard enclosed 16x16m combat hall with 3.5m perimeter walls and 2 interior structural stone pillars positioned at `(-3.5, -2.5)` and `(+3.5, +2.5)`.
- **`small_chamber`**: Open 10x10m chamber with 3.0m walls and no interior pillars.

---

## 3. Semantic Surface & Region Architecture

### 3.1 Surface Types

Surfaces define physical interaction and material properties:

```javascript
export const SURFACE_TYPES = Object.freeze({
  FLOOR: 1,      // Walkable horizontal floor slab
  WALL: 2,       // Solid vertical barrier
  PILLAR: 3,     // Cylindrical interior structural column
  OBSTACLE: 4,   // General gameplay barrier
  CEILING: 5     // Overhead boundary surface
});

export const SURFACE_NAMES = Object.freeze({
  [SURFACE_TYPES.FLOOR]: 'floor',
  [SURFACE_TYPES.WALL]: 'wall',
  [SURFACE_TYPES.PILLAR]: 'pillar',
  [SURFACE_TYPES.OBSTACLE]: 'obstacle',
  [SURFACE_TYPES.CEILING]: 'ceiling'
});
```

### 3.2 Constraint Flags

Bitmask flags controlling traversal, physics, and gameplay interactions:

```javascript
export const CONSTRAINT_FLAGS = Object.freeze({
  NONE: 0,
  WALKABLE: 1 << 0,     // Characters can traverse (e.g. floor)
  SOLID: 1 << 1,        // Blocks translation and projectiles
  PERIMETER: 1 << 2,    // Defines enclosing room boundary
  CLIMBABLE: 1 << 3,    // Traversable vertical surface
  DESTRUCTIBLE: 1 << 4  // Targetable breakable barrier
});
```

### 3.3 Semantic Region Identifiers

Durable numeric region tags assigned to distinct architectural room features:

```javascript
export const GEOMETRY_REGIONS = Object.freeze({
  ARENA_FLOOR: 10,
  ARENA_WALL_NORTH: 20,
  ARENA_WALL_SOUTH: 21,
  ARENA_WALL_EAST: 22,
  ARENA_WALL_WEST: 23,
  ARENA_PILLAR_1: 30,
  ARENA_PILLAR_2: 31,
  ARENA_FEATURE: 40
});
```

---

## 4. Single-Truth Room Construction Pipeline

```text
       ┌────────────────────────┐
       │     RoomDefinition     │
       └───────────┬────────────┘
                   │
         ┌─────────┴─────────┐
         ▼                   ▼
┌──────────────────┐ ┌────────────────────────┐
│ Visual Geometry  │ │  Gameplay Collision    │
├──────────────────┤ ├────────────────────────┤
│ • Floor slab     │ │ • Inner bounds [min/max│
│ • Perimeter walls│ │ • Pillar circles (x,z) │
│ • Column meshes  │ │ • resolvePosition()    │
│ • regionId attr  │ │ • isWalkable()         │
│ • surfaceId attr │ │ • getFloorY() -> 0.000 │
└──────────────────┘ └────────────────────────┘
```

### 4.1 Visual Construction Contract

- Floor slab top surface sits precisely at ground datum $Y = 0.000\text{m}$.
- Perimeter walls span the room perimeter with thickness $T$, leaving an interior walkable expanse of $(W - 2T) \times (D - 2T)$.
- Cylindrical pillars are generated with smooth radial segments, a flat top cap, and an open bottom (`cappedBottom: false` by default) to eliminate redundant hidden polygons and coplanar z-fighting against the floor slab datum ($Y = 0.000\text{m}$). Closed bottom caps can be explicitly enabled via `cappedBottom: true` on the cylinder primitive.
- Vertex attributes include `position` (3 floats), `normal` (3 floats), `uv` (2 floats), `regionId` (1 float), and `surfaceId` (1 float).
- Sub-geometries merge into a single efficient draw call with index offsets preserved.

### 4.2 Gameplay Collision Contract

- **`resolvePosition(x, z, radius)`**: Clamps candidate coordinates against interior boundary walls $(X_{\min} + r, X_{\max} - r, Z_{\min} + r, Z_{\max} - r)$ and pushes coordinates outside pillar radii with guaranteed non-zero pushback $(r_{\text{pillar}} + r)$.
- **`isWalkable(x, z, radius)`**: Deterministic boolean query returning true if the candidate disk is entirely within the playable perimeter and clear of all obstacles.
- **`getFloorY(x, z)`**: Returns authoritative walking elevation ($0.000\text{m}$).

---

## 5. Verification & Acceptance Criteria

Every compliant Geometry Forge implementation must demonstrate:

1. **Parameter Clamping**: Out-of-bounds inputs clamp to defined bounds and log structured `WARN` diagnostics.
2. **Deterministic Attributes**: Semantic `regionId` and `surfaceId` vertex attributes match their geometric parts.
3. **Single Source of Truth**: Room bounds in the collision structure exactly match the outer geometry dimensions minus wall thickness.
4. **Collision Enclosure**: Entities cannot escape perimeter walls or clip through interior pillars under arbitrary velocities.
5. **Unit Tests**: Full coverage in `tests/geometry.test.js`.


## Topology-aware authoring boundary (CHAR-FOUNDATION-001)

Buffer merging and concatenation preserve disconnected components. They provide no continuity guarantee. Public full exports now include executable boundary detection, ordered semantic loops, compatible spatial-hash welding, equal-loop and explicitly parameterized unequal-loop bridges/stitches, and policy-based topology validation. See CHARACTER_FORGE.md section 10 for the exact continuity and attribute contract.

TopologySurface v1 accepts MeshIR and indexed BufferGeometry-shaped input without importing the renderer. It extends the authoring seam to uv, normal, tangent, regionId/region, surfaceId, skinIndex/skinWeight and morph registries. Legacy MeshIR v1 serialization remains unchanged and must not be used to serialize these extra fields. Unsupported attributes or incompatible schemas fail explicitly. Topology certification does not certify absence of geometric self-intersections, pose quality or visual quality.

## Local sculpt authoring

The public full surface provides renderer-independent sculpt fields on TopologySurface data. createFeatureFrame defines orthonormal local coordinates. ellipsoidMask, semanticSculptMask and composeSculptMasks scope fields. directionalSculptField, ellipsoidSculptField, normalSculptField, planeSculptField, ridgeSculptField and creaseSculptField return executable displacement operators. Ridge points are local to their supplied frame; plane points and normals are in model coordinates.

applySculptFields clones input, applies fields in order, rejects nonfinite displacements and rebuilds area-weighted shared normals. Mask callbacks receive (position, vertexIndex, surface); fields receive (position, normal, vertexIndex, surface). Normal displacement uses the input normal field for that application. Use separate applications when an intervening normal rebuild is required.

relaxSculptSurface supports supplied masks, pinned vertex indices, feature masks, bounded iterations and optional tangential Laplacian updates. An optional direction constrains relaxation to one model-space axis and requires tangential: false; transverse coordinates remain unchanged. A feature-mask value of one prevents movement. refineSculptTopology performs conforming local triangle refinement with shared edge midpoints. It returns surface and sourceVertex ancestry. It accepts position, normal and UV before categorical attributes, skinning, morphs and semantic anchors are authored; unsupported data fails explicitly.

Sculpting rebuilds normals and rejects existing tangent or morph data. Author sculpt, topology and constraints before skinning, tangent frames and corrective targets. Position-only sculpting does not establish manifold continuity or rule out self-intersections. Run topology certification and inspect the resulting surface.

### Explicit boundary correspondence

bridgeTopologyLoops(input, loopA, loopB, options) and stitchTopologySurfaces(left, right, options) accept loopParameters: {a, b}. Each array must match its traversal length, start at zero, increase strictly and remain below one. Parameters describe corresponding positions around an authored cyclic domain. The a traversal follows the first boundary; b follows the reversed second boundary starting at offset. A monotonic zipper emits n + m triangles, preserving both existing oriented boundaries and all original vertex attributes. Unequal counts without explicit correspondence fail. Weld mode still requires equal counts.

With equal-count implicit correspondence, maxSpan retains its original meaning: the distance between corresponding vertex pairs. For explicit parametric correspondence it bounds all new cross-boundary edges. Neither mode promises that arbitrary incompatible geometric loops avoid self-intersections. The caller must author compatible ordered loops and inspect their embedding; structural validation rejects degenerate triangles, invalid winding and non-manifold joins.
