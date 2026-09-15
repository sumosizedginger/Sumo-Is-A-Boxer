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

const SKIN = [0.53, 0.40, 0.31];
const SKIN_WARM = [0.56, 0.41, 0.30];
const SKIN_DEEP = [0.48, 0.36, 0.28];
const HAIR = [0.09, 0.07, 0.06];

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
  REGION_COLOR[id] = name.includes('cranium') || name.includes('forehead') ? HAIR : SKIN;
}

function jitter(color, x, y, z) {
  const h = (Math.imul(x + 3, 0x9e3779b9) ^ Math.imul(y + 1, 0x85ebca6b) ^ Math.imul(z + 7, 0xc2b2ae35)) >>> 0;
  const j = ((h & 255) / 255 - 0.5) * 0.045;
  return [
    Math.max(0, Math.min(1, color[0] + j)),
    Math.max(0, Math.min(1, color[1] + j * 0.85)),
    Math.max(0, Math.min(1, color[2] + j * 0.7))
  ];
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
    provenance: { assembly: 'guide-to-voxel', milestone: 'VOXEL-PIVOT-001' }
  });
  const grid = voxelizeMesh(mesh, definition.data.parameters);
  const artifact = createVoxelArtifact({
    id: 'voxel.hero.sumo',
    definition,
    grid,
    colorForCell: ({ x, y, z, regionId }) => jitter(REGION_COLOR[regionId] ?? SKIN, x, y, z)
  });
  const runtime = instantiateVoxelArtifact(artifact, {
    mode: 'instances',
    bones: character.bones,
    name: 'hero-voxel'
  });
  runtime.object3D.frustumCulled = false;
  if (character.material) character.material.visible = false;
  character.mesh.visible = true;
  return { artifact, runtime, grid, generationMs: grid.generationMs };
}
