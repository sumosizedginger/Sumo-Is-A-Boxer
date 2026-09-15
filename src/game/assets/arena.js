/**
 * SUMO IS A BOXER — Voxel combat platform.
 *
 * Gameplay bounds stay the same. The boxing ring presentation is gone:
 * no ropes, turnbuckles, corner padding, canvas, apron, or stools.
 */

import { slab, assemble } from './kit.js';
import { createAnchor } from '@sumosizedginger/my-game-engine-1.0/full';
import { mat } from './materials.js';

export const ARENA = Object.freeze({
  fightHalf: 3.15,
  postHalf: 3.42,
  platformHalf: 4.0,
  canvasY: 0,
  floorY: -1.05
});

function buildPlatform() {
  const half = ARENA.platformHalf;
  const deck = slab([half * 2, 0.28, half * 2], [0, -0.14, 0], { name: 'arena-deck-slab' });
  const curb = [];
  for (const [sx, sz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const along = sx === 0 ? 'x' : 'z';
    const length = half * 2;
    const size = along === 'x' ? [length, 0.16, 0.22] : [0.22, 0.16, length];
    curb.push(slab(size, [sx * half, 0.02, sz * half], { name: `arena-curb-${sx}${sz}` }));
  }
  const legs = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      for (const t of [-0.55, 0, 0.55]) {
        const x = sx === -1 ? -half + 0.4 : half - 0.4;
        const z = sz * (half - 0.55) + (sx === sz ? t * 0.2 : 0);
        legs.push(slab([0.22, 0.82, 0.22], [x + t * (sz === 0 ? 1.6 : 0), ARENA.floorY + 0.41, z], { name: `arena-leg-${sx}${sz}-${t}` }));
      }
    }
  }
  return assemble('asset.arena.platform', [
    { name: 'arena-deck-slab', material: mat('concrete', 0), meshes: [deck] },
    { name: 'arena-edge-curb', material: mat('concreteDark', 1), meshes: curb },
    { name: 'arena-support-legs', material: mat('steel', 0), meshes: legs }
  ], {
    anchors: [
      createAnchor({ name: 'arena.corner.nw', position: [-ARENA.postHalf, 0, -ARENA.postHalf] }),
      createAnchor({ name: 'arena.corner.se', position: [ARENA.postHalf, 0, ARENA.postHalf] })
    ]
  });
}

/**
 * @returns {Map<string, object>}
 */
export function buildArenaAssets() {
  const assets = new Map();
  assets.set('asset.arena.platform', buildPlatform());
  return assets;
}
