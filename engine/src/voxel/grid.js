/**
 * My Game Engine 1.0 — Voxel Forge: Occupancy Grid
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * MeshIR / topology-surface occupancy sampling. Renderer-independent.
 * Earned by VOXEL-PIVOT-001.
 */

import { resolveVoxelParameters } from './definition.js';

/** Safety cap so a mistaken millimetre size cannot allocate a city-scale grid. */
export const VOXEL_GRID_CELL_LIMIT = 8_000_000;

const FACE_DIRS = Object.freeze([
  Object.freeze([1, 0, 0]),
  Object.freeze([-1, 0, 0]),
  Object.freeze([0, 1, 0]),
  Object.freeze([0, -1, 0]),
  Object.freeze([0, 0, 1]),
  Object.freeze([0, 0, -1])
]);

export const VOXEL_FACE_DIRS = FACE_DIRS;

/**
 * @param {*} value
 * @returns {ArrayLike<number>|null}
 */
function asArray(value) {
  if (!value) return null;
  if (value.array) return value.array;
  return value;
}

/**
 * @param {object} mesh
 * @returns {{ positions: ArrayLike<number>, indices: ArrayLike<number>, regionId: ArrayLike<number>|null, materialId: ArrayLike<number>|null, skinIndex: ArrayLike<number>|null, skinWeight: ArrayLike<number>|null, vertexCount: number }}
 */
export function readMeshBuffers(mesh) {
  if (!mesh || !mesh.attributes) {
    throw new TypeError('voxelizeMesh requires a mesh with attributes.position');
  }
  const positions = asArray(mesh.attributes.position);
  if (!positions || positions.length < 9) {
    throw new TypeError('voxelizeMesh requires position data with at least one triangle');
  }
  const indices = asArray(mesh.indices ?? mesh.index);
  if (!indices || indices.length < 3) {
    throw new TypeError('voxelizeMesh requires an index buffer');
  }
  const vertexCount = positions.length / 3;
  return {
    positions,
    indices,
    regionId: asArray(mesh.attributes.regionId),
    materialId: asArray(mesh.attributes.materialId),
    skinIndex: asArray(mesh.attributes.skinIndex),
    skinWeight: asArray(mesh.attributes.skinWeight),
    vertexCount
  };
}

/**
 * Triangle vs AABB SAT (Akenine-Möller).
 *
 * @returns {boolean}
 */
function triangleIntersectsAabb(
  v0x, v0y, v0z,
  v1x, v1y, v1z,
  v2x, v2y, v2z,
  cx, cy, cz,
  hx, hy, hz
) {
  const x0 = v0x - cx, y0 = v0y - cy, z0 = v0z - cz;
  const x1 = v1x - cx, y1 = v1y - cy, z1 = v1z - cz;
  const x2 = v2x - cx, y2 = v2y - cy, z2 = v2z - cz;

  const minX = Math.min(x0, x1, x2), maxX = Math.max(x0, x1, x2);
  if (maxX < -hx || minX > hx) return false;
  const minY = Math.min(y0, y1, y2), maxY = Math.max(y0, y1, y2);
  if (maxY < -hy || minY > hy) return false;
  const minZ = Math.min(z0, z1, z2), maxZ = Math.max(z0, z1, z2);
  if (maxZ < -hz || minZ > hz) return false;

  const e0x = x1 - x0, e0y = y1 - y0, e0z = z1 - z0;
  const e1x = x2 - x1, e1y = y2 - y1, e1z = z2 - z1;
  const e2x = x0 - x2, e2y = y0 - y2, e2z = z0 - z2;
  const nx = e0y * e1z - e0z * e1y;
  const ny = e0z * e1x - e0x * e1z;
  const nz = e0x * e1y - e0y * e1x;
  const d = nx * x0 + ny * y0 + nz * z0;
  const r = hx * Math.abs(nx) + hy * Math.abs(ny) + hz * Math.abs(nz);
  if (Math.abs(d) > r) return false;

  const axes = [
    [0, -e0z, e0y], [0, -e1z, e1y], [0, -e2z, e2y],
    [e0z, 0, -e0x], [e1z, 0, -e1x], [e2z, 0, -e2x],
    [-e0y, e0x, 0], [-e1y, e1x, 0], [-e2y, e2x, 0]
  ];
  const px = [x0, x1, x2], py = [y0, y1, y2], pz = [z0, z1, z2];
  for (let a = 0; a < 9; a++) {
    const ax = axes[a][0], ay = axes[a][1], az = axes[a][2];
    let pmin = Infinity, pmax = -Infinity;
    for (let i = 0; i < 3; i++) {
      const p = ax * px[i] + ay * py[i] + az * pz[i];
      if (p < pmin) pmin = p;
      if (p > pmax) pmax = p;
    }
    const rad = hx * Math.abs(ax) + hy * Math.abs(ay) + hz * Math.abs(az);
    if (pmin > rad || pmax < -rad) return false;
  }
  return true;
}

/**
 * Builds a spatial hash of vertices for nearest-attribute transfer.
 *
 * @param {ArrayLike<number>} positions
 * @param {number} vertexCount
 * @param {number} cellSize
 * @returns {{ get: Function }}
 */
function buildVertexHash(positions, vertexCount, cellSize) {
  const buckets = new Map();
  const inv = 1 / cellSize;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    const key = `${Math.floor(x * inv)},${Math.floor(y * inv)},${Math.floor(z * inv)}`;
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
    }
    list.push(i);
  }
  return {
    nearest(x, y, z) {
      const ix = Math.floor(x * inv);
      const iy = Math.floor(y * inv);
      const iz = Math.floor(z * inv);
      let best = -1;
      let bestD = Infinity;
      for (let dz = -1; dz <= 1; dz++) {
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const list = buckets.get(`${ix + dx},${iy + dy},${iz + dz}`);
            if (!list) continue;
            for (let n = 0; n < list.length; n++) {
              const i = list[n];
              const ddx = positions[i * 3] - x;
              const ddy = positions[i * 3 + 1] - y;
              const ddz = positions[i * 3 + 2] - z;
              const d = ddx * ddx + ddy * ddy + ddz * ddz;
              if (d < bestD) {
                bestD = d;
                best = i;
              }
            }
          }
        }
      }
      if (best >= 0) return best;
      for (const list of buckets.values()) {
        for (let n = 0; n < list.length; n++) {
          const i = list[n];
          const ddx = positions[i * 3] - x;
          const ddy = positions[i * 3 + 1] - y;
          const ddz = positions[i * 3 + 2] - z;
          const d = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d < bestD) {
            bestD = d;
            best = i;
          }
        }
      }
      return best;
    }
  };
}

/**
 * Flood-fills empty cells reachable from the grid boundary. Remaining empty
 * cells are interior and become occupied when fillInterior is set.
 *
 * @param {Uint8Array} occupied
 * @param {number} nx
 * @param {number} ny
 * @param {number} nz
 */
function fillInteriorCells(occupied, nx, ny, nz) {
  const n = nx * ny * nz;
  const exterior = new Uint8Array(n);
  const stack = [];
  const push = (i, j, k) => {
    if (i < 0 || j < 0 || k < 0 || i >= nx || j >= ny || k >= nz) return;
    const idx = i + nx * (j + ny * k);
    if (occupied[idx] || exterior[idx]) return;
    exterior[idx] = 1;
    stack.push(idx);
  };
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      push(i, j, 0);
      push(i, j, nz - 1);
    }
  }
  for (let k = 0; k < nz; k++) {
    for (let i = 0; i < nx; i++) {
      push(i, 0, k);
      push(i, ny - 1, k);
    }
    for (let j = 0; j < ny; j++) {
      push(0, j, k);
      push(nx - 1, j, k);
    }
  }
  while (stack.length) {
    const idx = stack.pop();
    const i = idx % nx;
    const tmp = (idx / nx) | 0;
    const j = tmp % ny;
    const k = (tmp / ny) | 0;
    push(i + 1, j, k);
    push(i - 1, j, k);
    push(i, j + 1, k);
    push(i, j - 1, k);
    push(i, j, k + 1);
    push(i, j, k - 1);
  }
  for (let idx = 0; idx < n; idx++) {
    if (!occupied[idx] && !exterior[idx]) occupied[idx] = 1;
  }
}

/**
 * Voxelizes a triangle mesh into a dense occupancy grid.
 *
 * @param {object} mesh - MeshIR or duck-typed { attributes, indices }
 * @param {object} [options]
 * @returns {object} Occupancy grid
 */
export function voxelizeMesh(mesh, options = {}) {
  const started = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  const { parameters, diagnostics } = resolveVoxelParameters(options);
  let { voxelSize } = parameters;
  const { fillInterior } = parameters;
  const { positions, indices, regionId, skinIndex, skinWeight, vertexCount } = readMeshBuffers(mesh);

  let minX = Infinity, minY = Infinity, minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
      throw new RangeError('voxelizeMesh: non-finite vertex position');
    }
    if (x < minX) minX = x; if (y < minY) minY = y; if (z < minZ) minZ = z;
    if (x > maxX) maxX = x; if (y > maxY) maxY = y; if (z > maxZ) maxZ = z;
  }

  const pad = voxelSize * 0.5;
  minX -= pad; minY -= pad; minZ -= pad;
  maxX += pad; maxY += pad; maxZ += pad;

  let nx = Math.max(1, Math.ceil((maxX - minX) / voxelSize));
  let ny = Math.max(1, Math.ceil((maxY - minY) / voxelSize));
  let nz = Math.max(1, Math.ceil((maxZ - minZ) / voxelSize));
  let cellCount = nx * ny * nz;
  if (cellCount > VOXEL_GRID_CELL_LIMIT) {
    const factor = Math.cbrt(cellCount / VOXEL_GRID_CELL_LIMIT) * 1.05;
    voxelSize *= factor;
    diagnostics.push({
      severity: 'WARN',
      code: 'VOXEL_SIZE_AUTOCOARSENED',
      message: `grid ${nx}x${ny}x${nz} exceeded ${VOXEL_GRID_CELL_LIMIT}; voxelSize scaled by ${factor.toFixed(3)} to ${voxelSize}`
    });
    nx = Math.max(1, Math.ceil((maxX - minX) / voxelSize));
    ny = Math.max(1, Math.ceil((maxY - minY) / voxelSize));
    nz = Math.max(1, Math.ceil((maxZ - minZ) / voxelSize));
    cellCount = nx * ny * nz;
  }
  if (cellCount > VOXEL_GRID_CELL_LIMIT) {
    throw new RangeError(
      `voxelizeMesh grid ${nx}x${ny}x${nz} (${cellCount} cells) exceeds VOXEL_GRID_CELL_LIMIT ${VOXEL_GRID_CELL_LIMIT}`
    );
  }

  const occupied = new Uint8Array(cellCount);
  const origin = Object.freeze([minX, minY, minZ]);
  const half = voxelSize * 0.5;
  const triangleCount = (indices.length / 3) | 0;

  for (let t = 0; t < triangleCount; t++) {
    const ia = indices[t * 3], ib = indices[t * 3 + 1], ic = indices[t * 3 + 2];
    const ax = positions[ia * 3], ay = positions[ia * 3 + 1], az = positions[ia * 3 + 2];
    const bx = positions[ib * 3], by = positions[ib * 3 + 1], bz = positions[ib * 3 + 2];
    const cx = positions[ic * 3], cy = positions[ic * 3 + 1], cz = positions[ic * 3 + 2];
    const tminX = Math.min(ax, bx, cx);
    const tminY = Math.min(ay, by, cy);
    const tminZ = Math.min(az, bz, cz);
    const tmaxX = Math.max(ax, bx, cx);
    const tmaxY = Math.max(ay, by, cy);
    const tmaxZ = Math.max(az, bz, cz);
    const i0 = Math.max(0, Math.floor((tminX - minX) / voxelSize));
    const j0 = Math.max(0, Math.floor((tminY - minY) / voxelSize));
    const k0 = Math.max(0, Math.floor((tminZ - minZ) / voxelSize));
    const i1 = Math.min(nx - 1, Math.floor((tmaxX - minX) / voxelSize));
    const j1 = Math.min(ny - 1, Math.floor((tmaxY - minY) / voxelSize));
    const k1 = Math.min(nz - 1, Math.floor((tmaxZ - minZ) / voxelSize));
    for (let k = k0; k <= k1; k++) {
      for (let j = j0; j <= j1; j++) {
        for (let i = i0; i <= i1; i++) {
          const idx = i + nx * (j + ny * k);
          if (occupied[idx]) continue;
          const ccx = minX + (i + 0.5) * voxelSize;
          const ccy = minY + (j + 0.5) * voxelSize;
          const ccz = minZ + (k + 0.5) * voxelSize;
          if (triangleIntersectsAabb(ax, ay, az, bx, by, bz, cx, cy, cz, ccx, ccy, ccz, half, half, half)) {
            occupied[idx] = 1;
          }
        }
      }
    }
  }

  let occupiedBeforeFill = 0;
  for (let i = 0; i < cellCount; i++) if (occupied[i]) occupiedBeforeFill += 1;
  if (fillInterior) fillInteriorCells(occupied, nx, ny, nz);

  let occupiedCount = 0;
  for (let i = 0; i < cellCount; i++) if (occupied[i]) occupiedCount += 1;

  const hash = buildVertexHash(positions, vertexCount, Math.max(voxelSize * 2, 0.02));
  const compact = [];
  const regions = new Uint16Array(occupiedCount);
  const skins = skinIndex && skinWeight ? new Uint16Array(occupiedCount * 4) : null;
  const weights = skinIndex && skinWeight ? new Float32Array(occupiedCount * 4) : null;
  const bind = new Float32Array(occupiedCount * 3);
  let cursor = 0;
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const idx = i + nx * (j + ny * k);
        if (!occupied[idx]) continue;
        compact.push(i, j, k);
        const cx = minX + (i + 0.5) * voxelSize;
        const cy = minY + (j + 0.5) * voxelSize;
        const cz = minZ + (k + 0.5) * voxelSize;
        bind[cursor * 3] = cx;
        bind[cursor * 3 + 1] = cy;
        bind[cursor * 3 + 2] = cz;
        const nearest = hash.nearest(cx, cy, cz);
        if (nearest >= 0) {
          if (regionId) regions[cursor] = regionId[nearest] | 0;
          if (skins && weights) {
            for (let w = 0; w < 4; w++) {
              skins[cursor * 4 + w] = skinIndex[nearest * 4 + w] | 0;
              weights[cursor * 4 + w] = skinWeight[nearest * 4 + w];
            }
          }
        }
        cursor += 1;
      }
    }
  }

  const ended = typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now();
  return {
    origin,
    voxelSize,
    dimensions: Object.freeze([nx, ny, nz]),
    occupied,
    occupiedCount,
    shellCount: occupiedBeforeFill,
    interiorFilled: Math.max(0, occupiedCount - occupiedBeforeFill),
    compact: Int16Array.from(compact),
    regionId: regions,
    skinIndex: skins,
    skinWeight: weights,
    bindPosition: bind,
    parameters,
    diagnostics: Object.freeze(diagnostics.slice()),
    sourceTriangleCount: triangleCount,
    sourceVertexCount: vertexCount,
    generationMs: ended - started
  };
}

/**
 * Packed linear index for a cell, or -1 if out of bounds.
 *
 * @param {object} grid
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number}
 */
export function gridIndex(grid, x, y, z) {
  const [nx, ny, nz] = grid.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return -1;
  return x + nx * (y + ny * z);
}

/**
 * @param {object} grid
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {boolean}
 */
export function isOccupied(grid, x, y, z) {
  const idx = gridIndex(grid, x, y, z);
  return idx >= 0 && grid.occupied[idx] !== 0;
}
