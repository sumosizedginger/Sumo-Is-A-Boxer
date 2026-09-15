/**
 * SUMO IS A BOXER — First-person voxel limbs.
 *
 * Boxing gloves are not part of the visual target. Visible first-person
 * geometry is a blocky forearm and fist that voxelizes cleanly.
 *
 * AUTHORING FRAME: +Y from elbow (y=0) toward the fist nose.
 */

import { assemble, createBoxMesh } from './kit.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';
import { mat } from './materials.js';
import { buildFighterFace } from './fighter-face.js';

export const FIST_TIP_Y = 0.46;

function buildVoxelArm({ id, side = 1 }) {
  const s = side;
  const forearm = createBoxMesh({
    width: 0.072, height: 0.28, depth: 0.064,
    origin: { x: 0, y: 0.14, z: 0 },
    semanticName: 'fp-forearm',
    materialId: mat('skinPlayer', 0)
  });
  const wrist = createBoxMesh({
    width: 0.056, height: 0.05, depth: 0.054,
    origin: { x: 0, y: 0.295, z: 0 },
    semanticName: 'fp-wrist',
    materialId: mat('skinPlayer', 0)
  });
  const fist = createBoxMesh({
    width: 0.10, height: 0.11, depth: 0.082,
    origin: { x: s * 0.008, y: 0.40, z: 0.008 },
    semanticName: 'fp-fist',
    materialId: mat('skinPlayer', 1)
  });
  const thumb = createBoxMesh({
    width: 0.032, height: 0.07, depth: 0.032,
    origin: { x: s * 0.058, y: 0.375, z: 0.02 },
    semanticName: 'fp-thumb',
    materialId: mat('skinPlayer', 0)
  });
  return assemble(id, [
    { name: 'fp-forearm', material: mat('skinPlayer', 0), meshes: [forearm] },
    { name: 'fp-wrist', material: mat('skinPlayer', 0), meshes: [wrist] },
    { name: 'fp-fist', material: mat('skinPlayer', 1), meshes: [fist, thumb] }
  ], {
    anchors: [createAnchor({ name: 'fist.contact', position: [0, FIST_TIP_Y, 0] })]
  });
}

/**
 * @returns {Map<string, object>}
 */
export function buildHeroKitAssets() {
  const assets = new Map();
  assets.set('asset.fp.arm.left', buildVoxelArm({ id: 'asset.fp.arm.left', side: -1 }));
  assets.set('asset.fp.arm.right', buildVoxelArm({ id: 'asset.fp.arm.right', side: 1 }));
  assets.set('asset.hero.hair', buildFighterFace());
  return assets;
}
