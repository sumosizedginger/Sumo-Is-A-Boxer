/**
 * My Game Engine 1.0 — Voxel Forge: Public API
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Native voxel occupancy, surface extraction, artifact identity and batched
 * runtime realization. Follows VOXEL_FORGE.md.
 */

export {
  VOXEL_ARTIFACT_VERSION,
  VOXEL_QUALITY,
  VOXEL_PARAMETER_BOUNDS,
  resolveVoxelParameters,
  createVoxelDefinition
} from './definition.js';

export {
  VOXEL_GRID_CELL_LIMIT,
  VOXEL_FACE_DIRS,
  voxelizeMesh,
  readMeshBuffers,
  gridIndex,
  isOccupied
} from './grid.js';

export {
  extractVoxelSurface,
  forEachSurfaceCell
} from './surface.js';

export {
  createVoxelArtifact,
  voxelHash,
  defaultRegionColor
} from './artifact.js';

export {
  instantiateVoxelArtifact
} from './runtime.js';

export { compileSurfaceInstances } from './surface-instances.js';
