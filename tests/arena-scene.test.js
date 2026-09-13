/**
 * SUMO IS A BOXER — authored scene contract.
 *
 * The venue is a SceneDefinition, not an ad-hoc Three.js tree, and these are the
 * assertions that keep it that way: it validates, it compiles, its semantic ids
 * are the ones gameplay addresses, and every asset key it references is an asset
 * the game actually authored.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateSceneDefinition, compileScene, instantiateScene, liveSceneInstanceCount,
  SCENE_MAX_NODES
} from '@sumosizedginger/my-game-engine-1.0/full';

import { createArenaSceneDefinition, composeArenaScene, SCENE_ID } from '../src/game/scene/arena-scene.js';
import { buildRingAssets } from '../src/game/assets/ring.js';
import { buildWarehouseAssets } from '../src/game/assets/warehouse.js';
import { buildDressingAssets } from '../src/game/assets/dressing.js';
import { buildFighterKitAssets } from '../src/game/assets/fighter-kit.js';

const definition = createArenaSceneDefinition();

function allAssets() {
  const assets = new Map();
  for (const source of [buildRingAssets(), buildWarehouseAssets(), buildDressingAssets(), buildFighterKitAssets()]) {
    for (const [key, mesh] of source) assets.set(key, mesh);
  }
  return assets;
}

test('the arena SceneDefinition is valid engine data', () => {
  const report = validateSceneDefinition(definition);
  assert.ok(report.valid, report.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; '));
  assert.equal(definition.id, SCENE_ID);
  assert.ok(definition.nodes.length > 40, `expected a composed venue, got ${definition.nodes.length} nodes`);
  assert.ok(definition.nodes.length < SCENE_MAX_NODES);
});

test('the scene holds no geometry — only opaque asset keys', () => {
  const serialized = JSON.stringify(definition);
  assert.ok(!serialized.includes('Float32Array'), 'the scene is carrying geometry');
  for (const node of definition.nodes) {
    assert.ok(node.asset === null || typeof node.asset === 'string', `${node.pid} carries a non-key asset`);
  }
});

test('every node has a persistent id and a human-meaningful name', () => {
  const seen = new Set();
  for (const node of definition.nodes) {
    assert.ok(node.pid && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(node.pid), `bad pid "${node.pid}"`);
    assert.ok(!seen.has(node.pid), `duplicate pid ${node.pid}`);
    seen.add(node.pid);
    assert.ok(node.name && node.name.length > 2, `${node.pid} has no name`);
  }
});

test('the semantic ids gameplay and lighting address all exist', () => {
  const pids = new Set(definition.nodes.map((n) => n.pid));
  const required = [
    'arena-root', 'venue', 'ring', 'ringside', 'lighting-rig', 'training-area',
    'ring-platform', 'ring-posts', 'ring-ropes', 'ring-steps-red', 'ring-steps-blue',
    'red-corner-post', 'blue-corner-post', 'neutral-corner-north-east', 'neutral-corner-south-west',
    'player-spawn', 'opponent-spawn',
    'warehouse-floor', 'warehouse-walls', 'warehouse-roof-structure', 'warehouse-services', 'warehouse-doors',
    'warehouse-column-east-mid', 'warehouse-column-west-mid',
    'lighting-gantry', 'ring-lamp-key-nw', 'ring-lamp-key-se', 'corner-lamp-red', 'corner-lamp-blue',
    'heavy-bag', 'bleacher-north', 'crowd-row-north-front', 'ringside-barrier-north-west', 'training-rig'
  ];
  for (const pid of required) assert.ok(pids.has(pid), `scene is missing semantic node "${pid}"`);
});

test('every referenced asset key is authored by the game', () => {
  const assets = allAssets();
  const missing = [];
  for (const node of definition.nodes) {
    if (node.asset && !assets.has(node.asset)) missing.push(`${node.pid} -> ${node.asset}`);
  }
  assert.deepEqual(missing, [], `unresolved asset keys:\n${missing.join('\n')}`);
});

test('repeated dressing is placed by the scene, not duplicated as assets', () => {
  const counts = new Map();
  for (const node of definition.nodes) {
    if (!node.asset) continue;
    counts.set(node.asset, (counts.get(node.asset) ?? 0) + 1);
  }
  assert.ok(counts.get('asset.warehouse.column') >= 6, 'columns are not reused across the scene');
  assert.ok(counts.get('asset.barrier') >= 6, 'barriers are not reused across the scene');
});

test('compiling and instantiating the scene is clean and reversible', () => {
  const before = liveSceneInstanceCount();
  const { artifact, instance } = composeArenaScene();

  assert.equal(artifact.id, SCENE_ID);
  assert.equal(artifact.nodeCount, definition.nodes.length);
  assert.ok(artifact.sourceHash, 'compiled artifact has no source hash');

  // World placement is the compiler's, not the author's: a child of `ring`
  // inherits its parent's transform.
  const spawn = instance.worldTransformOf('player-spawn');
  assert.ok(spawn, 'player-spawn did not instantiate');
  assert.equal(spawn.translation.length, 3);

  const corner = instance.worldTransformOf('red-corner-post');
  assert.ok(corner.translation[0] < 0 && corner.translation[2] < 0, 'the red corner is not north-west');

  assert.equal(liveSceneInstanceCount(), before + 1);
  instance.dispose();
  assert.equal(liveSceneInstanceCount(), before, 'scene instance leaked');
});

test('the compiled scene is deterministic across runs', () => {
  const a = composeArenaScene();
  const b = composeArenaScene();
  assert.equal(a.artifact.sourceHash, b.artifact.sourceHash);
  assert.equal(a.artifact.artifactHash, b.artifact.artifactHash);
  a.instance.dispose();
  b.instance.dispose();
});
