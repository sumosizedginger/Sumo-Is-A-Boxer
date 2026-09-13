/**
 * SUMO IS A BOXER — Asset library.
 *
 * The single door from authored MeshIR to a renderable object, and the single
 * owner of the GPU resources those assets allocate.
 *
 * The supported public route from MeshIR to a renderer object is
 * `createPreviewable` (engine/full). `toBufferGeometry` is deliberately
 * withheld from the public surface and the engine's own scene presentation
 * adapter is not exported (ENGINE_GAPS.md — GAP-01), so the game owns this
 * layer. One Previewable per distinct asset; every placement of that asset
 * SHARES its geometry and compiled materials, so eight structural columns and
 * nine crowd rows upload one column and three crowd rows.
 */

import { Mesh } from 'three';
import { createPreviewable } from '@sumosizedginger/my-game-engine-1.0/full';

/**
 * @param {object} options
 * @param {Map<string, object>} options.assets - asset key -> MeshIR.
 * @param {Array<object>} options.materials - MaterialDefinitions.
 * @returns {object} Library.
 */
export function createAssetLibrary({ assets, materials }) {
  const previewables = new Map();
  const missing = new Set();
  let disposed = false;

  /**
   * @param {string} key
   * @returns {object|null} Previewable.
   */
  function previewable(key) {
    if (previewables.has(key)) return previewables.get(key);
    const mesh = assets.get(key);
    if (!mesh) {
      missing.add(key);
      previewables.set(key, null);
      return null;
    }
    const referenced = new Set(mesh.parts.map((part) => part.materialId).filter(Boolean));
    const built = createPreviewable({
      mesh,
      materials: materials.filter((definition) => referenced.has(definition.id)),
      type: 'game-asset',
      source: { definitionId: key }
    });
    // The Previewable allocates a prototype Mesh; placements make their own.
    built.object3D.removeFromParent();
    previewables.set(key, built);
    return built;
  }

  return {
    /**
     * A new renderer object sharing the asset's uploaded geometry and
     * materials. The caller owns the Object3D; the library owns the resources.
     *
     * @param {string} key
     * @param {string} [name]
     * @returns {Mesh|null}
     */
    object(key, name = key) {
      const built = previewable(key);
      if (!built) return null;
      const mesh = new Mesh(
        built.geometry,
        built.compiledMaterials.length === 1 ? built.compiledMaterials[0] : built.compiledMaterials
      );
      mesh.name = name;
      return mesh;
    },

    previewable,

    /** @returns {Array<string>} Asset keys that were requested but not authored. */
    get missingAssets() {
      return [...missing];
    },

    /** @returns {object} Upload statistics. */
    stats() {
      let triangles = 0;
      let drawCalls = 0;
      let uploads = 0;
      const materialSet=new Set();
      for (const built of previewables.values()) {
        if (!built) continue;
        uploads += 1;
        for(const material of built.compiledMaterials)materialSet.add(material);
        triangles += built.stats.triangles;
        drawCalls += built.stats.drawCalls;
      }
      return { uploads, triangles, materials:materialSet.size, drawCallsPerPlacement: drawCalls };
    },

    get disposed() {
      return disposed;
    },

    /** Releases every geometry and material this library uploaded. */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const built of previewables.values()) built?.dispose();
      previewables.clear();
    }
  };
}
