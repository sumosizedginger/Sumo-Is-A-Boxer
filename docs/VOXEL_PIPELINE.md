# Voxel pipeline

**Status:** IMPLEMENTED and certified for VOXEL-HERO-002.

## Flow

```
SMOOTH SEMANTIC GUIDE (hidden deformation authority)
        ↓
voxelizeMesh          occupancy grid sampling of continuous guide surface (fillInterior: true)
        ↓
extractVoxelSurface   6-neighbour boundary extraction & enclosed interior rejection
        ↓
createVoxelArtifact   serializable surface cells, region IDs, bind pose, hash, cavity occlusion
        ↓
instantiateVoxelArtifact
        instances  — InstancedMesh of rigid unit cubes (hero, single draw call)
        faces      — merged visible quads (static environment)
```

## Public engine APIs (`@sumosizedginger/my-game-engine-1.0/full`)

| Name | Role |
|---|---|
| `VOXEL_QUALITY` | `COARSE` 0.12m, `MEDIUM` 0.06m, `HIGH` 0.028m, `HERO` 0.012m |
| `createVoxelDefinition` | id, quality, voxelSize, fillInterior, sourceGuideId |
| `voxelizeMesh` | MeshIR or `{attributes, indices}` → occupancy grid |
| `extractVoxelSurface` | surface vs enclosed, visible faces |
| `createVoxelArtifact` | frozen artifact + `voxelHash` |
| `instantiateVoxelArtifact` | batched Three.js runtime; `dispose()` |

## Game wiring

- Guide: `src/game/character/continuous-body.js` + `head-profile.js` + `hero-face.js` + `skull-sections.js`
- Opponent & Hero compile: `src/game/character/opponent-sumo.js` + `src/game/voxel/hero-voxel.js`
- Default quality: `VOXEL.heroQuality = 'HERO'` (0.012 m base unit cubes)
- Environment: `createAssetLibrary({ voxelQuality })` voxelizes MeshIR placements
- First person: `src/game/assets/hero-kit.js` blocky fists, voxelized at HIGH

## Shading & Materials

- Base material: `MeshStandardMaterial` with `roughness = 0.68`, `metalness = 0.02`.
- Palettes: Sculptural terracotta and warm clay tones (`SKIN = [0.76, 0.62, 0.50]`, `SKIN_WARM = [0.79, 0.65, 0.52]`, `SKIN_DEEP = [0.70, 0.56, 0.44]`).
- Cavity Occlusion: Computed via 6-neighbor occupancy count (`1.10 - neighbors * 0.055`), darkening recessed corners and crevices for self-shadowing and form definition.

## Presentation Modes

- `VOXEL_CLAY`: Matte terracotta clay shading, 3-point neutral studio lighting (bright key, soft fill, warm rim, ambient bounce, neutral gray background `0x3a3f47`, `fog = null`).
- `VOXEL_COLOR`: Vertex-colored hero with cavity shading and studio illumination.
- `SILHOUETTE`: Pure binary silhouette validation (unlit solid black hero `0x050505` on clean bright background `0xeef0f2`).
- `GUIDE`: Certified continuous guide mesh visible.
- `WIREFRAME`: Wireframe representation of smooth guide mesh.
- `GRID`: Instance wireframe showcasing voxel grid alignment.
- `SEMANTIC`: Semantic anatomical region color map.
- `PERFORMANCE`: Production gameplay lighting and camera.

## Deformation

- Bind-space voxel centres with four bone weights sampled from the nearest guide vertex.
- Linear blend skinning of cube positions with blended bone rotation.
- **Rigid Unit Cubes:** Cubes maintain uniform isotropic 0.012m unit scale across all poses. No stretching.
- Soft-mass jiggle is **PLANNED** as secondary layer on top of rigid unit cells.
