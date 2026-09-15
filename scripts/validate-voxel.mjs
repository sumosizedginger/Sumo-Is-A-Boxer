/**
 * Headless voxel compile check. Browser captures remain a separate pass.
 */
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { buildHeroKitAssets } from '../src/game/assets/hero-kit.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { createOpponentSumo } from '../src/game/character/opponent-sumo.js';

const library = createAssetLibrary({ assets: buildHeroKitAssets(), materials: MATERIAL_DEFINITIONS });
const opponent = createOpponentSumo({ library, voxelQuality: 'HIGH' });
const voxel = opponent.diagnostics().voxel;
console.log(JSON.stringify({
  occupied: voxel.occupied,
  surface: voxel.surface,
  faces: voxel.faces,
  voxelSize: voxel.voxelSize,
  generationMs: voxel.generationMs,
  drawCalls: voxel.drawCalls,
  hash: opponent.voxel.artifact.hash
}, null, 2));
opponent.dispose();
library.dispose();
