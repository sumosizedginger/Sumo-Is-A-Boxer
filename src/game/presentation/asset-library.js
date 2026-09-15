/**
 * SUMO IS A BOXER — Asset library.
 *
 * The single door from authored MeshIR to a renderable object, and the single
 * owner of the GPU resources those assets allocate.
 *
 * The supported public route from MeshIR to a renderer object is
 * `createPreviewable` (engine/full). `toBufferGeometry` is deliberately
 * withheld from the public surface and the engine's own scene presentation
 * adapter is not exported (docs/ENGINE_GAPS.md — GAP-01), so the game owns this
 * layer. One Previewable per distinct asset; every placement of that asset
 * SHARES its geometry and compiled materials, so eight structural columns and
 * nine crowd rows upload one column and three crowd rows.
 */

import { applyCharacterSurface } from './character-surfaces.js';
import { Mesh } from 'three';
import {
  createPreviewable,
  createVoxelDefinition,
  voxelizeMesh,
  createVoxelArtifact,
  instantiateVoxelArtifact
} from '@sumosizedginger/my-game-engine-1.0/full';

function packedRgb(color) {
  const n = Number(color) || 0x888888;
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/**
 * @param {object} options
 * @param {Map<string, object>} options.assets - asset key -> MeshIR.
 * @param {Array<object>} options.materials - MaterialDefinitions.
 * @returns {object} Library.
 */
export function createAssetLibrary({ assets, materials, surfaceDetail = null, voxelQuality = null }) {
  const previewables = new Map();
  const voxelRuntimes = new Map();
  const missing = new Set();
  let disposed = false;
  const materialColor = new Map(materials.map((definition) => [definition.id, packedRgb(definition.data.parameters.color)]));

  function voxelize(key) {
    if (voxelRuntimes.has(key)) return voxelRuntimes.get(key);
    const mesh = assets.get(key);
    if (!mesh) {
      missing.add(key);
      voxelRuntimes.set(key, null);
      return null;
    }
    const quality = key.startsWith('asset.fp.') ? 'HIGH' : (voxelQuality || 'COARSE');
    const definition = createVoxelDefinition({ id: `voxel.${key}`, quality });
    const grid = voxelizeMesh(mesh, definition.data.parameters);
    const base = materialColor.get(mesh.parts[0]?.materialId) ?? [0.45, 0.42, 0.38];
    const artifact = createVoxelArtifact({
      id: `voxel.${key}`,
      definition,
      grid,
      colorForCell: ({ x, y, z }) => {
        const h = (Math.imul(x + 1, 0x9e3779b9) ^ Math.imul(y + 3, 0x85ebca6b) ^ Math.imul(z + 7, 0xc2b2ae35)) >>> 0;
        const j = ((h & 255) / 255 - 0.5) * 0.05;
        return [
          Math.max(0, Math.min(1, base[0] + j)),
          Math.max(0, Math.min(1, base[1] + j * 0.85)),
          Math.max(0, Math.min(1, base[2] + j * 0.7))
        ];
      }
    });
    const runtime = instantiateVoxelArtifact(artifact, { mode: 'faces', name: key });
    voxelRuntimes.set(key, runtime);
    return runtime;
  }

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
    for (let i = 0; i < built.compiledMaterials.length; i++) {
      surfaceDetail?.apply(built.compiledMaterials[i], key, built.materialOrder[i]);
      applyCharacterSurface(built.compiledMaterials[i], key, built.materialOrder[i]);
    }
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
      if (voxelQuality) {
        const runtime = voxelize(key);
        if (!runtime) return null;
        const clone = runtime.object3D.clone();
        clone.name = name;
        clone.traverse((node) => { node.frustumCulled = false; });
        return clone;
      }
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
      for (const runtime of voxelRuntimes.values()) runtime?.dispose();
      previewables.clear();
      voxelRuntimes.clear();
    }
  };
}
