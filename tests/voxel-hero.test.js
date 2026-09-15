import test from 'node:test';
import assert from 'node:assert/strict';
import { createOpponentSumo } from '../src/game/character/opponent-sumo.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { buildHeroKitAssets } from '../src/game/assets/hero-kit.js';
import { buildArenaAssets } from '../src/game/assets/arena.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { voxelHash } from '@sumosizedginger/my-game-engine-1.0/full';

const library = createAssetLibrary({ assets: buildHeroKitAssets(), materials: MATERIAL_DEFINITIONS });
const opponent = createOpponentSumo({ library, voxelQuality: 'HIGH' });
test.after(() => { opponent.dispose(); library.dispose(); });

test('hero voxel generation is deterministic and hashed', () => {
  const a = opponent.voxel.artifact;
  assert.equal(typeof a.hash, 'string');
  assert.equal(a.hash.length, 16);
  assert.equal(voxelHash(a), a.hash);
  const library2 = createAssetLibrary({ assets: buildHeroKitAssets(), materials: MATERIAL_DEFINITIONS });
  const again = createOpponentSumo({ library: library2, voxelQuality: 'HIGH' });
  try {
    assert.equal(again.voxel.artifact.hash, a.hash);
    assert.equal(again.voxel.artifact.cells.length, a.cells.length);
  } finally {
    again.dispose();
    library2.dispose();
  }
});

test('hero voxels have unique finite cells, preserved regions, and surface-only runtime', () => {
  const a = opponent.voxel.artifact;
  const seen = new Set();
  for (const cell of a.cells) {
    const key = `${cell.x},${cell.y},${cell.z}`;
    assert.equal(seen.has(key), false, key);
    seen.add(key);
    assert.ok(cell.bindPosition.every(Number.isFinite));
    assert.ok(cell.color.every((c) => c >= 0 && c <= 1));
    assert.ok(cell.regionId >= 0);
  }
  assert.ok(a.surfaceCount > 200);
  assert.equal(a.cells.length, a.surfaceCount);
  assert.equal(opponent.voxel.runtime.stats.drawCalls, 1);
  assert.equal(opponent.voxel.runtime.meshes[0].isInstancedMesh, true);
  assert.ok(a.visibleFaceCount < a.naiveCubeFaces);
});

test('boxing visual assets are absent from the active kit', () => {
  const kit = buildHeroKitAssets();
  const arena = buildArenaAssets();
  for (const key of [
    'asset.boxer.glove.left', 'asset.boxer.glove.right', 'asset.boxer.trunks',
    'asset.boxer.boot.left', 'asset.ring.ropes', 'asset.ring.posts', 'asset.corner.kit.red'
  ]) {
    assert.equal(kit.has(key) || arena.has(key), false, key);
  }
  assert.ok(arena.has('asset.arena.platform'));
  assert.ok(kit.has('asset.fp.arm.left'));
});

test('rigid voxel cubes keep uniform scale after a pose update', () => {
  const mesh = opponent.voxel.runtime.meshes[0];
  opponent.update({ state: { state: 'idle', stateT: 0, stateDuration: 1, yaw: 0, flash: 0, attack: 'JAB', attackZone: 'high' }, position: { x: 0, z: 0 }, dt: 1 / 60, speed: 0 });
  const e = mesh.instanceMatrix.array;
  const sx = Math.hypot(e[0], e[1], e[2]);
  const sy = Math.hypot(e[4], e[5], e[6]);
  const sz = Math.hypot(e[8], e[9], e[10]);
  assert.ok(Math.abs(sx - sy) < 1e-5 && Math.abs(sy - sz) < 1e-5);
  assert.ok(Math.abs(sx - opponent.voxel.artifact.voxelSize) < 1e-5);
});
