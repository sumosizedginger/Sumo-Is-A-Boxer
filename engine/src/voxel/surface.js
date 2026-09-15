/**
 * My Game Engine 1.0 — Voxel Forge: Surface Extraction
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Hidden-interior rejection and hidden-face culling. Renderer-independent.
 * Earned by VOXEL-PIVOT-001.
 */

import { VOXEL_FACE_DIRS, gridIndex, isOccupied } from './grid.js';

/**
 * Classifies occupied cells as surface vs fully enclosed interior, and lists
 * the visible faces of every surface cell.
 *
 * A face is emitted only when the 6-neighbor in that direction is empty or
 * out of bounds.
 *
 * @param {object} grid
 * @returns {object}
 */
export function extractVoxelSurface(grid) {
  if (!grid || !grid.occupied || !grid.compact) {
    throw new TypeError('extractVoxelSurface requires a voxel occupancy grid');
  }
  const compact = grid.compact;
  const cellCount = compact.length / 3;
  const surfaceFlags = new Uint8Array(cellCount);
  const faces = [];
  let surfaceCount = 0;
  let visibleFaceCount = 0;
  let enclosedCount = 0;

  for (let c = 0; c < cellCount; c++) {
    const x = compact[c * 3];
    const y = compact[c * 3 + 1];
    const z = compact[c * 3 + 2];
    let exposed = 0;
    const cellFaces = [];
    for (let d = 0; d < 6; d++) {
      const dir = VOXEL_FACE_DIRS[d];
      if (!isOccupied(grid, x + dir[0], y + dir[1], z + dir[2])) {
        exposed += 1;
        cellFaces.push(d);
      }
    }
    if (exposed > 0) {
      surfaceFlags[c] = 1;
      surfaceCount += 1;
      visibleFaceCount += exposed;
      faces.push({ cell: c, x, y, z, dirs: cellFaces });
    } else {
      enclosedCount += 1;
    }
  }

  const naiveCubeFaces = cellCount * 6;
  const naiveSurfaceCubeFaces = surfaceCount * 6;

  return {
    surfaceFlags,
    surfaceCount,
    enclosedCount,
    visibleFaceCount,
    faces,
    naiveCubeFaces,
    naiveSurfaceCubeFaces,
    culledFaces: naiveCubeFaces - visibleFaceCount,
    occupiedCount: cellCount
  };
}

/**
 * Walks surface cells in deterministic XYZ order.
 *
 * @param {object} grid
 * @param {object} surface
 * @param {Function} visit - (cellIndex, x, y, z, dirs)
 */
export function forEachSurfaceCell(grid, surface, visit) {
  const compact = grid.compact;
  for (let c = 0; c < compact.length / 3; c++) {
    if (!surface.surfaceFlags[c]) continue;
    visit(c, compact[c * 3], compact[c * 3 + 1], compact[c * 3 + 2]);
  }
}

/**
 * @param {object} grid
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number} compact cell index, or -1
 */
export function findCompactIndex(grid, x, y, z) {
  const compact = grid.compact;
  for (let c = 0; c < compact.length / 3; c++) {
    if (compact[c * 3] === x && compact[c * 3 + 1] === y && compact[c * 3 + 2] === z) return c;
  }
  return -1;
}

export { gridIndex };
