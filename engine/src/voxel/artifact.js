/**
 * My Game Engine 1.0 — Voxel Forge: Artifact
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Deterministic, inspectable, serializable voxel artifact. Renderer-independent.
 * Earned by VOXEL-PIVOT-001.
 */

import {compileSurfaceInstances} from './surface-instances.js';
import { hashBytes } from '../geometry/mesh-codec.js';
import { VOXEL_ARTIFACT_VERSION } from './definition.js';
import { extractVoxelSurface } from './surface.js';

/**
 * Packs a surface voxel record. Color is authored albedo, not baked lighting.
 * pngProjection is a reserved hook for a future generated-PNG projection pass.
 *
 * @param {object} options
 * @returns {object}
 */
function createCellRecord({
  x, y, z,
  regionId,
  materialId,
  color,
  skinIndex,
  skinWeight,
  bindPosition,
  faceMask
}) {
  return Object.freeze({
    x, y, z,
    regionId: regionId | 0,
    materialId: materialId | 0,
    faceMask: faceMask | 0,
    color: Object.freeze([color[0], color[1], color[2]]),
    skinIndex: skinIndex ? Object.freeze([skinIndex[0] | 0, skinIndex[1] | 0, skinIndex[2] | 0, skinIndex[3] | 0]) : null,
    skinWeight: skinWeight ? Object.freeze([+skinWeight[0], +skinWeight[1], +skinWeight[2], +skinWeight[3]]) : null,
    bindPosition: Object.freeze([+bindPosition[0], +bindPosition[1], +bindPosition[2]])
  });
}

/**
 * Default muted color from region identity. Not a rainbow hash.
 *
 * @param {number} regionId
 * @param {number} x
 * @param {number} y
 * @param {number} z
 * @returns {number[]}
 */
export function defaultRegionColor(regionId, x, y, z) {
  const h = (Math.imul(regionId + 1, 0x9e3779b9) ^ Math.imul(x + 1, 0x85ebca6b) ^ Math.imul(y + 3, 0xc2b2ae35) ^ Math.imul(z + 7, 0x27d4eb2d)) >>> 0;
  const tone = 0.42 + ((h & 255) / 255) * 0.16;
  const cool = ((h >>> 8) & 31) / 255;
  return [
    Math.min(1, tone + cool * 0.04),
    Math.min(1, tone),
    Math.min(1, tone - cool * 0.03)
  ];
}

/**
 * Canonical fingerprint of a voxel artifact's occupancy and semantics.
 *
 * @param {object} artifact
 * @returns {string}
 */
export function voxelHash(artifact) {
  const cells = artifact.cells;
  const bytes = new Uint8Array(24 + cells.length * 16);
  const view = new DataView(bytes.buffer);
  view.setUint32(0, artifact.version, true);
  view.setFloat32(4, artifact.voxelSize, true);
  view.setFloat32(8, artifact.origin[0], true);
  view.setFloat32(12, artifact.origin[1], true);
  view.setFloat32(16, artifact.origin[2], true);
  view.setUint32(20, cells.length, true);
  let o = 24;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i];
    view.setInt16(o, c.x, true); o += 2;
    view.setInt16(o, c.y, true); o += 2;
    view.setInt16(o, c.z, true); o += 2;
    view.setUint16(o, c.regionId, true); o += 2;
    view.setUint8(o, Math.round(c.color[0] * 255)); o += 1;
    view.setUint8(o, Math.round(c.color[1] * 255)); o += 1;
    view.setUint8(o, Math.round(c.color[2] * 255)); o += 1;
    view.setUint8(o, 0); o += 1;
    view.setInt16(o, c.x ^ c.y ^ c.z, true); o += 2;
    view.setUint16(o, c.materialId, true); o += 2;
  }
  return hashBytes(bytes);
}

/**
 * Compiles occupancy + surface extraction into a frozen voxel artifact.
 *
 * @param {object} options
 * @returns {object}
 */
export function createVoxelArtifact({
  id,
  definition,
  grid,
  surface = null,
  colorForCell = null,
  provenance = null,
  surfaceMesh = null,
  surfaceSampling = {}
} = {}) {
  if (!id || typeof id !== 'string') {
    throw new TypeError('createVoxelArtifact requires a non-empty string id');
  }
  if (!grid) throw new TypeError('createVoxelArtifact requires a grid');
  const extracted = surface ?? extractVoxelSurface(grid);
  const compact = grid.compact;
  const faceMaskByCell = new Uint8Array(compact.length / 3);
  for (const face of extracted.faces) {
    let mask = 0;
    for (const dir of face.dirs) mask |= 1 << dir;
    faceMaskByCell[face.cell] = mask;
  }
  const cells = [];
  const seen = new Set();
  for (let c = 0; c < compact.length / 3; c++) {
    if (!extracted.surfaceFlags[c]) continue;
    const x = compact[c * 3];
    const y = compact[c * 3 + 1];
    const z = compact[c * 3 + 2];
    const key = `${x},${y},${z}`;
    if (seen.has(key)) {
      throw new Error(`createVoxelArtifact: duplicate cell ${key}`);
    }
    seen.add(key);
    const bind = [
      grid.bindPosition[c * 3],
      grid.bindPosition[c * 3 + 1],
      grid.bindPosition[c * 3 + 2]
    ];
    for (let k = 0; k < 3; k++) {
      if (!Number.isFinite(bind[k])) throw new RangeError(`createVoxelArtifact: non-finite bind position at ${key}`);
    }
    const regionId = grid.regionId ? grid.regionId[c] : 0;
    const color = colorForCell
      ? colorForCell({ x, y, z, regionId, bindPosition: bind, cellIndex: c })
      : defaultRegionColor(regionId, x, y, z);
    cells.push(createCellRecord({
      x, y, z,
      regionId,
      materialId: 0,
      color,
      skinIndex: grid.skinIndex ? grid.skinIndex.subarray(c * 4, c * 4 + 4) : null,
      skinWeight: grid.skinWeight ? grid.skinWeight.subarray(c * 4, c * 4 + 4) : null,
      bindPosition: bind,
      faceMask: faceMaskByCell[c]
    }));
  }

  const artifact = {
    version: VOXEL_ARTIFACT_VERSION,
    id,
    definition: definition ?? null,
    origin: grid.origin,
    voxelSize: grid.voxelSize,
    dimensions: grid.dimensions,
    occupiedCount: grid.occupiedCount,
    surfaceCount: extracted.surfaceCount,
    enclosedCount: extracted.enclosedCount,
    visibleFaceCount: extracted.visibleFaceCount,
    culledFaces: extracted.culledFaces,
    naiveCubeFaces: extracted.naiveCubeFaces,
    cells: Object.freeze(cells),
    colorBinding: Object.freeze({
      mode: colorForCell ? 'author-fn' : 'region',
      pngProjection: null
    }),
    provenance: Object.freeze({
      sourceGuideId: definition?.data?.sourceGuideId ?? null,
      fillInterior: grid.parameters?.fillInterior === true,
      quality: grid.parameters?.quality ?? null,
      sourceTriangleCount: grid.sourceTriangleCount,
      sourceVertexCount: grid.sourceVertexCount,
      generationMs: grid.generationMs,
      ...(provenance ?? {})
    }),
    hash: ''
  };
  artifact.hash = voxelHash(artifact);
  if(surfaceMesh)artifact.surfaceInstances=compileSurfaceInstances(surfaceMesh,artifact,surfaceSampling);
  return Object.freeze(artifact);
}
