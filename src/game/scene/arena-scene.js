/**
 * SUMO IS A BOXER — Authored scene.
 *
 * THIS FILE IS THE VENUE'S SOURCE OF TRUTH.
 *
 * The arena is composed as a SceneDefinition through the engine's Scene
 * Composition system (`createSceneNode` / `createSceneDefinition` ->
 * `compileScene` -> `instantiateScene`). The game does NOT build a second
 * authored hierarchy in Three.js: the presentation layer reads the COMPILED
 * world matrices out of the SceneInstance and installs them on renderer
 * objects, exactly as the engine's scene contract requires.
 *
 * Every node carries a persistent, machine-readable `pid`. Gameplay, lighting
 * and the AI all address the venue by those ids — `red-corner-post`,
 * `player-spawn`, `ring-lamp-key-nw` — never by a magic coordinate.
 */

import {
  createSceneDefinition,
  createSceneNode,
  compileScene,
  instantiateScene,
  validateSceneDefinition
} from '@sumosizedginger/my-game-engine-1.0/full';
import { ARENA } from '../assets/arena.js';
import { VENUE } from '../assets/warehouse.js';

export const SCENE_ID = 'sumo.is.a.boxer.voxel.arena.v1';

/** Height of the key lamps above the canvas. */
const LAMP_Y = VENUE.gantryY - 0.55;
const CORNER_LAMP_Y = VENUE.gantryY - 0.35;

/**
 * Y-axis rotation as the unit quaternion the scene contract requires.
 *
 * @param {number} yaw - radians
 * @returns {number[]}
 */
function yawQuat(yaw) {
  return [0, Math.sin(yaw / 2), 0, Math.cos(yaw / 2)];
}

/**
 * Authoring shorthand.
 *
 * @param {string} pid
 * @param {string} name
 * @param {object} [options]
 * @returns {object} SceneNode
 */
function node(pid, name, { parent = null, at = [0, 0, 0], yaw = 0, scale = [1, 1, 1], asset = null, tags = [] } = {}) {
  return createSceneNode({
    pid,
    name,
    parent,
    transform: { translation: at, rotation: yawQuat(yaw), scale },
    asset,
    tags
  });
}

/**
 * Builds the authored SceneDefinition for the venue.
 *
 * @returns {object} SceneDefinition
 */
export function createArenaSceneDefinition() {
  const nodes = [];
  const push = (...entries) => nodes.push(...entries);

  push(node('arena-root', 'Voxel Combat Arena', { tags: ['root'] }));

  // ---- VENUE SHELL -------------------------------------------------------
  push(node('venue', 'Warehouse Shell', { parent: 'arena-root', tags: ['structure'] }));
  push(
    node('warehouse-floor', 'Concrete Slab', { parent: 'venue', asset: 'asset.warehouse.floor', tags: ['structure', 'concrete'] }),
    node('warehouse-walls', 'Perimeter Walls', { parent: 'venue', asset: 'asset.warehouse.walls', tags: ['structure', 'concrete'] }),
    node('warehouse-roof-structure', 'Roof Deck and Trusses', { parent: 'venue', asset: 'asset.warehouse.roof', tags: ['structure', 'steel'] }),
    node('warehouse-services', 'Pipes, Conduit and Plant', { parent: 'venue', asset: 'asset.warehouse.services', tags: ['structure', 'services'] }),
    node('warehouse-doors', 'Loading Door and Fire Exit', { parent: 'venue', asset: 'asset.warehouse.doors', tags: ['structure', 'access'] })
  );

  // Eight structural columns, one shared asset placed by the scene.
  const columnSpots = [
    ['warehouse-column-west-north', -VENUE.halfX + 1.6, -VENUE.halfZ + 3.2],
    ['warehouse-column-west-mid', -VENUE.halfX + 1.6, 0],
    ['warehouse-column-west-south', -VENUE.halfX + 1.6, VENUE.halfZ - 3.2],
    ['warehouse-column-east-north', VENUE.halfX - 1.6, -VENUE.halfZ + 3.2],
    ['warehouse-column-east-mid', VENUE.halfX - 1.6, 0],
    ['warehouse-column-east-south', VENUE.halfX - 1.6, VENUE.halfZ - 3.2],
    ['warehouse-column-north-centre', 0, -VENUE.halfZ + 1.9],
    ['warehouse-column-south-centre', 0, VENUE.halfZ - 1.9]
  ];
  for (const [pid, x, z] of columnSpots) {
    push(node(pid, `Structural Column ${pid.replace('warehouse-column-', '')}`, {
      parent: 'venue', at: [x, VENUE.floorY, z], asset: 'asset.warehouse.column', tags: ['structure', 'column']
    }));
  }

  // ---- LIGHTING RIG ------------------------------------------------------
  push(node('lighting-rig', 'Lighting Rig', { parent: 'arena-root', tags: ['lighting'] }));
  push(node('lighting-gantry', 'Lighting Gantry', { parent: 'lighting-rig', asset: 'asset.warehouse.gantry', tags: ['lighting', 'steel'] }));

  const keyLamps = [
    ['ring-lamp-key-nw', -2.6, -2.4],
    ['ring-lamp-key-ne', 2.6, -2.4],
    ['ring-lamp-key-se', 2.6, 2.4],
    ['ring-lamp-key-sw', -2.6, 2.4]
  ];
  for (const [pid, x, z] of keyLamps) {
    push(node(pid, `Overhead Key Lamp ${pid.slice(-2).toUpperCase()}`, {
      parent: 'lighting-rig', at: [x, LAMP_Y, z], asset: 'asset.lamp.key', tags: ['lighting', 'fixture', 'key']
    }));
  }
  push(
    node('corner-lamp-nw', 'North-West Work Lamp', {
      parent: 'lighting-rig', at: [-4.6, CORNER_LAMP_Y, -4.6], yaw: Math.PI * 0.25,
      asset: 'asset.lamp.work', tags: ['lighting', 'fixture']
    }),
    node('corner-lamp-se', 'South-East Work Lamp', {
      parent: 'lighting-rig', at: [4.6, CORNER_LAMP_Y, 4.6], yaw: Math.PI * 1.25,
      asset: 'asset.lamp.work', tags: ['lighting', 'fixture']
    })
  );

  // ---- COMBAT PLATFORM ---------------------------------------------------
  push(node('arena', 'Combat Platform', { parent: 'arena-root', tags: ['arena'] }));
  push(
    node('arena-platform', 'Voxel Combat Platform', { parent: 'arena', asset: 'asset.arena.platform', tags: ['arena', 'platform'] })
  );

  // Semantic corner markers. Gameplay and the AI address these pids; they are
  // not boxing-corner dressing.
  push(
    node('red-corner-post', 'North-West Corner', { parent: 'arena', at: [-ARENA.postHalf, 0, -ARENA.postHalf], tags: ['corner'] }),
    node('blue-corner-post', 'South-East Corner', { parent: 'arena', at: [ARENA.postHalf, 0, ARENA.postHalf], tags: ['corner'] }),
    node('neutral-corner-north-east', 'North-East Corner', { parent: 'arena', at: [ARENA.postHalf, 0, -ARENA.postHalf], tags: ['corner'] }),
    node('neutral-corner-south-west', 'South-West Corner', { parent: 'arena', at: [-ARENA.postHalf, 0, ARENA.postHalf], tags: ['corner'] }),
    node('player-spawn', 'Player Start', { parent: 'arena', at: [0.9, 0, 2.1], yaw: Math.PI, tags: ['spawn', 'player'] }),
    node('opponent-spawn', 'Opponent Start', { parent: 'arena', at: [-0.9, 0, -2.1], yaw: 0, tags: ['spawn', 'opponent'] })
  );

  // ---- ARENA FLOOR -------------------------------------------------------
  push(node('ringside', 'Arena Floor', { parent: 'arena-root', tags: ['dressing'] }));

  const barrierRing = 6.6;
  const barrierSpots = [
    ['ringside-barrier-north-west', -2.3, -barrierRing, 0],
    ['ringside-barrier-north-east', 2.3, -barrierRing, 0],
    ['ringside-barrier-south-west', -2.3, barrierRing, Math.PI],
    ['ringside-barrier-south-east', 2.3, barrierRing, Math.PI],
    ['ringside-barrier-east-north', barrierRing, -1.2, Math.PI / 2],
    ['ringside-barrier-east-south', barrierRing, 1.2, Math.PI / 2],
    ['ringside-barrier-west-north', -barrierRing, -1.2, -Math.PI / 2],
    ['ringside-barrier-west-south', -barrierRing, 1.2, -Math.PI / 2]
  ];
  for (const [pid, a, b, yaw] of barrierSpots) {
    const isNorthSouth = pid.includes('north-') || pid.includes('south-');
    const x = isNorthSouth ? a : a;
    const z = isNorthSouth ? b : b;
    push(node(pid, `Ringside Barrier ${pid.replace('ringside-barrier-', '')}`, {
      parent: 'ringside', at: [x, VENUE.floorY, z], yaw, asset: 'asset.barrier', tags: ['barrier']
    }));
  }

  push(
    node('bleacher-north', 'North Bleachers', {
      parent: 'ringside', at: [-1.2, VENUE.floorY, -10.4], yaw: 0, asset: 'asset.bleacher', tags: ['seating']
    }),
    node('bleacher-south', 'South Bleachers', {
      parent: 'ringside', at: [1.2, VENUE.floorY, 10.4], yaw: Math.PI, asset: 'asset.bleacher', tags: ['seating']
    }),
    node('bleacher-east', 'East Bleachers', {
      parent: 'ringside', at: [11.6, VENUE.floorY, -2.4], yaw: -Math.PI / 2, asset: 'asset.bleacher', tags: ['seating']
    })
  );

  const crowdRows = [
    ['crowd-row-north-front', 0.4, -7.6, 0, 'asset.crowd.row.standing'],
    ['crowd-row-north-back', -0.6, -8.7, 0.06, 'asset.crowd.row.standing.b'],
    ['crowd-row-north-bleacher', -1.2, -9.9, 0, 'asset.crowd.row.seated'],
    ['crowd-row-south-front', -0.4, 7.6, Math.PI, 'asset.crowd.row.standing.b'],
    ['crowd-row-south-back', 0.7, 8.8, Math.PI - 0.05, 'asset.crowd.row.standing'],
    ['crowd-row-east-front', 7.8, -0.6, -Math.PI / 2, 'asset.crowd.row.standing'],
    ['crowd-row-east-back', 9.0, 0.4, -Math.PI / 2 + 0.05, 'asset.crowd.row.standing.b'],
    ['crowd-row-west-front', -7.8, 0.6, Math.PI / 2, 'asset.crowd.row.standing.b'],
    ['crowd-row-west-back', -9.1, -0.5, Math.PI / 2 - 0.04, 'asset.crowd.row.standing']
  ];
  for (const [pid, x, z, yaw, asset] of crowdRows) {
    push(node(pid, `Crowd ${pid.replace('crowd-row-', '')}`, {
      parent: 'ringside', at: [x, VENUE.floorY, z], yaw, asset, tags: ['crowd', 'silhouette']
    }));
  }

  push(
    node('ringside-clutter-west', 'Ringside Clutter West', {
      parent: 'ringside', at: [-9.6, VENUE.floorY, 4.6], yaw: 0.7, asset: 'asset.clutter', tags: ['dressing']
    }),
    node('ringside-clutter-north', 'Ringside Clutter North', {
      parent: 'ringside', at: [8.2, VENUE.floorY, -8.4], yaw: -1.9, asset: 'asset.clutter', tags: ['dressing']
    })
  );

  // ---- TRAINING AREA -----------------------------------------------------
  push(node('training-area', 'Training Corner', { parent: 'arena-root', tags: ['dressing'] }));
  push(
    node('heavy-bag', 'Heavy Bag', {
      parent: 'training-area', at: [-11.4, VENUE.floorY + 2.35, -7.4], yaw: 0.35, asset: 'asset.heavy.bag', tags: ['training', 'heavybag']
    }),
    node('heavy-bag-second', 'Second Heavy Bag', {
      parent: 'training-area', at: [-11.4, VENUE.floorY + 2.35, -9.4], yaw: -0.5, asset: 'asset.heavy.bag', tags: ['training', 'heavybag']
    }),
    node('training-lamp', 'Training Corner Work Lamp', {
      parent: 'training-area', at: [-11.6, VENUE.floorY + 3.7, -8.3],
      asset: 'asset.lamp.work', tags: ['lighting', 'fixture', 'work']
    }),
    node('door-lamp', 'Loading Door Work Lamp', {
      parent: 'training-area', at: [3.4, VENUE.floorY + 3.5, -VENUE.halfZ + 1.6],
      asset: 'asset.lamp.work', tags: ['lighting', 'fixture', 'work']
    }),
    node('training-rig', 'Speed Bag and Equipment Rack', {
      parent: 'training-area', at: [-VENUE.halfX + 0.9, VENUE.floorY + 2.5, -2.0], yaw: Math.PI / 2, asset: 'asset.training.rig', tags: ['training']
    })
  );

  return createSceneDefinition({ id: SCENE_ID, nodes });
}

/**
 * Authors, validates, compiles and instantiates the arena scene.
 *
 * Definition -> Artifact -> Instance, as the engine contract requires. Nothing
 * downstream may treat the Three.js object tree as the authored scene.
 *
 * @returns {{definition: object, artifact: object, instance: object, validation: object}}
 */
export function composeArenaScene() {
  const definition = createArenaSceneDefinition();
  const validation = validateSceneDefinition(definition);
  if (!validation.valid) {
    const detail = validation.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ');
    throw new Error(`Arena SceneDefinition is invalid: ${detail}`);
  }
  const artifact = compileScene(definition);
  const instance = instantiateScene(artifact);
  return { definition, artifact, instance, validation };
}
