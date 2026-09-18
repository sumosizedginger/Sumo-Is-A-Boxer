/**
 * SUMO IS A BOXER — Hero voxel compilation.
 *
 * Guide mesh stays the deformation authority. Visible art is a Voxel Forge
 * artifact of rigid surface cubes.
 */

import {
  createVoxelDefinition,
  voxelizeMesh,
  createVoxelArtifact,
  instantiateVoxelArtifact
} from '@sumosizedginger/my-game-engine-1.0/full';
import { BODY_REGIONS } from '../character/continuous-body.js';
import { FACE_REGIONS } from '../character/hero-face.js';

const VOXEL_FACE_DIRS = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1]
];

function isOccupied(grid, x, y, z) {
  const [nx, ny, nz] = grid.dimensions;
  if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return false;
  return grid.occupied[x + nx * (y + ny * z)] !== 0;
}

// Authoritative warm clay / skin palette matching Reference Sheet 07
const SKIN = [0.76, 0.62, 0.50];
const SKIN_WARM = [0.79, 0.65, 0.52];
const SKIN_DEEP = [0.70, 0.56, 0.44];

const REGION_COLOR = {
  [BODY_REGIONS.head]: SKIN,
  [BODY_REGIONS.neck]: SKIN_DEEP,
  [BODY_REGIONS.chest]: SKIN,
  [BODY_REGIONS.back]: SKIN_DEEP,
  [BODY_REGIONS.abdomen]: SKIN_WARM,
  [BODY_REGIONS.pelvis]: SKIN_WARM,
  [BODY_REGIONS.shoulder_l]: SKIN,
  [BODY_REGIONS.shoulder_r]: SKIN,
  [BODY_REGIONS.upperarm_l]: SKIN,
  [BODY_REGIONS.upperarm_r]: SKIN,
  [BODY_REGIONS.elbow_l]: SKIN_DEEP,
  [BODY_REGIONS.elbow_r]: SKIN_DEEP,
  [BODY_REGIONS.forearm_l]: SKIN,
  [BODY_REGIONS.forearm_r]: SKIN,
  [BODY_REGIONS.hip_l]: SKIN_WARM,
  [BODY_REGIONS.hip_r]: SKIN_WARM,
  [BODY_REGIONS.thigh_l]: SKIN_WARM,
  [BODY_REGIONS.thigh_r]: SKIN_WARM,
  [BODY_REGIONS.knee_l]: SKIN_DEEP,
  [BODY_REGIONS.knee_r]: SKIN_DEEP,
  [BODY_REGIONS.calf_l]: SKIN,
  [BODY_REGIONS.calf_r]: SKIN
};

for (const [name, id] of Object.entries(FACE_REGIONS)) {
  if (name.includes('orbit') || name.includes('lid') || name.includes('nostril') || name.includes('neck_interface')) {
    REGION_COLOR[id] = SKIN_DEEP;
  } else if (name.includes('cheek') || name.includes('jaw') || name.includes('brow') || name.includes('wing') || name.includes('lip') || name.includes('mouth')) {
    REGION_COLOR[id] = SKIN_WARM;
  } else {
    REGION_COLOR[id] = SKIN;
  }
}

function jitter(color, x, y, z, cavityFactor = 1.0) {
  const h = (Math.imul(x + 3, 0x9e3779b9) ^ Math.imul(y + 1, 0x85ebca6b) ^ Math.imul(z + 7, 0xc2b2ae35)) >>> 0;
  const j = ((h & 255) / 255 - 0.5) * 0.022;
  return [
    Math.max(0, Math.min(1, (color[0] + j) * cavityFactor)),
    Math.max(0, Math.min(1, (color[1] + j * 0.85) * cavityFactor)),
    Math.max(0, Math.min(1, (color[2] + j * 0.7) * cavityFactor))
  ];
}

const _voxelArtifactCache = new Map();

function computeGeometryHash(geometry, quality) {
  const pos = geometry.attributes.position.array;
  let h = 0x811c9dc5;
  const step = Math.max(1, Math.floor(pos.length / 1500));
  for (let i = 0; i < pos.length; i += step) {
    const v = Math.round(pos[i] * 10000) | 0;
    h ^= v;
    h = Math.imul(h, 0x01000193);
  }
  const idx = geometry.index ? geometry.index.array : null;
  if (idx) {
    h ^= idx.length;
    h = Math.imul(h, 0x01000193);
    const idxStep = Math.max(1, Math.floor(idx.length / 800));
    for (let i = 0; i < idx.length; i += idxStep) {
      h ^= idx[i];
      h = Math.imul(h, 0x01000193);
    }
  }
  return `${quality}_${(h >>> 0).toString(16)}_v3`;
}

/**
 * Compiles the certified guide geometry into a visible voxel hero.
 *
 * @param {object} character
 * @param {object} [options]
 * @returns {object} { artifact, runtime, generationMs }
 */
export function createHeroVoxel(character, { quality = 'HERO' } = {}) {
  const geometry = character.geometry;
  const cacheKey = computeGeometryHash(geometry, quality);
  let cached = _voxelArtifactCache.get(cacheKey);
  let artifact, grid, generationMs;

  if (cached) {
    artifact = cached.artifact;
    grid = cached.grid;
    generationMs = 0;
  } else {
    const mesh = {
      attributes: {
        position: geometry.attributes.position.array,
        regionId: geometry.attributes.regionId.array,
        skinIndex: geometry.attributes.skinIndex.array,
        skinWeight: geometry.attributes.skinWeight.array
      },
      indices: geometry.index.array
    };
    const definition = createVoxelDefinition({
      id: 'voxel.hero.sumo',
      quality,
      fillInterior: true,
      sourceGuideId: character.heroArtifact?.id ?? 'hero.guide',
      provenance: { assembly: 'guide-to-voxel', milestone: 'VOXEL-HERO-003' }
    });
    grid = voxelizeMesh(mesh, definition.data.parameters);
    artifact = createVoxelArtifact({
      id: 'voxel.hero.sumo',
      definition,
      grid,
      colorForCell: ({ x, y, z, regionId }) => {
        let neighbors = 0;
        for (let d = 0; d < 6; d++) {
          const dir = VOXEL_FACE_DIRS[d];
          if (isOccupied(grid, x + dir[0], y + dir[1], z + dir[2])) neighbors++;
        }
        const cavity = 1.10 - neighbors * 0.055;
        return jitter(REGION_COLOR[regionId] ?? SKIN, x, y, z, cavity);
      }
    });
    generationMs = grid.generationMs;
    _voxelArtifactCache.set(cacheKey, { artifact, grid, generationMs });
  }

  const runtime = instantiateVoxelArtifact(artifact, {
    mode: 'instances',
    bones: character.bones,
    name: 'hero-voxel'
  });
  runtime.object3D.frustumCulled = false;
  runtime.material.roughness = 0.68;
  runtime.material.metalness = 0.02;
  if (character.material) {
    character.material.visible = false;
  }
  character.mesh.visible = true;
  character.mesh.castShadow = false;
  character.mesh.receiveShadow = false;
  for (const m of runtime.meshes) {
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  }
  return { artifact, runtime, grid, generationMs };
}

