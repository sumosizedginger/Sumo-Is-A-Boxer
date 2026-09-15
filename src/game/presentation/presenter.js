/**
 * SUMO IS A BOXER — Scene presentation.
 *
 * Turns a compiled SceneInstance into a Three.js object tree.
 *
 * DIRECTION IS ONE-WAY, exactly as the engine's scene contract requires: this
 * module READS the scene and produces renderer objects. It never writes scene
 * state. The authored SceneDefinition remains the only authored hierarchy; the
 * Object3D tree below is a flat consumer of already-composed world matrices,
 * which is also why nothing here re-composes parent/child transforms — the
 * scene compiler already did, and doing it twice is how the two disagree.
 */

import { Group, Matrix4 } from 'three';

/** Tags whose objects should cast shadows into the ring. */
const CASTS = new Set(['arena', 'platform', 'corner', 'fixture', 'heavybag', 'barrier']);
/** Tags whose objects should receive the key light's shadow. */
const RECEIVES = new Set(['arena', 'platform', 'concrete', 'structure']);

/**
 * Builds the renderer representation of an instantiated arena scene.
 *
 * @param {object} options
 * @param {object} options.instance - SceneInstance.
 * @param {object} options.library - Asset library.
 * @returns {object} Presentation handle with dispose().
 */
export function createArenaPresentation({ instance, library }) {
  const root = new Group();
  root.name = `scene:${instance.sceneId}`;
  root.matrixAutoUpdate = false;

  const objectsByPid = new Map();
  const scratch = new Matrix4();
  let placements = 0;

  for (const member of instance.members()) {
    if (!member.asset) continue;
    const object = library.object(member.asset, member.pid);
    if (!object) continue;

    // The compiled matrix is INSTALLED, never decomposed: a composed hierarchy
    // is not always TRS-representable and the compiler already resolved it.
    object.matrixAutoUpdate = false;
    scratch.fromArray(member.world.matrix);
    object.matrix.copy(scratch);
    object.matrixWorldNeedsUpdate = true;

    const tags = member.tags ?? [];
    object.castShadow = tags.some((tag) => CASTS.has(tag));
    object.receiveShadow = tags.some((tag) => RECEIVES.has(tag));

    object.userData = {
      scenePid: member.pid,
      sceneId: instance.sceneId,
      semanticName: member.name,
      tags,
      asset: member.asset
    };

    root.add(object);
    objectsByPid.set(member.pid, object);
    placements += 1;
  }

  let disposed = false;

  return {
    root,
    stats: Object.freeze({ placements, ...library.stats() }),

    /**
     * The renderer object placed for an authored node.
     *
     * @param {string} pid
     * @returns {object|null}
     */
    objectFor(pid) {
      return objectsByPid.get(pid) ?? null;
    },

    /**
     * The compiled world position of an authored node, as a plain triple.
     * Lighting and gameplay ask the SCENE where things are.
     *
     * @param {string} pid
     * @returns {number[]|null}
     */
    positionOf(pid) {
      const world = instance.worldTransformOf(pid);
      return world ? [...world.translation] : null;
    },

    get disposed() {
      return disposed;
    },

    /**
     * Detaches every placement. The GPU resources belong to the shared asset
     * library, which is disposed once by the owner of the whole presentation.
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const object of objectsByPid.values()) object.removeFromParent();
      objectsByPid.clear();
      root.removeFromParent();
      root.clear();
    }
  };
}
