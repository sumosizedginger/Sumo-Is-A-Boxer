import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { Scene, PerspectiveCamera } from 'three';
import { buildAllAssets } from '../src/game/app.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { createOpponentBoxer } from '../src/game/character/opponent-boxer.js';
import { createPlayerFists } from '../src/game/character/player-fists.js';
import { composeArenaScene } from '../src/game/scene/arena-scene.js';
import { createArenaPresentation } from '../src/game/presentation/presenter.js';

const start = performance.now(), assets = buildAllAssets(), assetGenerationMs = performance.now() - start;
const library = createAssetLibrary({ assets, materials: MATERIAL_DEFINITIONS });
const buildStart = performance.now(), opponent = createOpponentBoxer({ library });
const camera = new PerspectiveCamera(), fists = createPlayerFists({ library, camera });
const characterBuildMs = performance.now() - buildStart;
const { instance } = composeArenaScene(), presentation = createArenaPresentation({ instance, library });
const scene = new Scene(); scene.add(presentation.root, opponent.group, camera);
function inventory(root) {
  let triangles = 0, groups = 0; const geometries = new Set(), materials = new Set();
  root.traverse(o => { if (!o.isMesh) return;
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    groups += Array.isArray(o.material) ? o.geometry.groups.length : 1;
    geometries.add(o.geometry);
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
  });
  return { triangles, geometryGroups: groups, geometries: geometries.size, materials: materials.size };
}
const state = { state: 'idle', stateT: 0, stateDuration: .25, yaw: 0, attack: 'JAB', attackZone: 'high' };
const args = { state, position: { x: 0, z: 0 }, dt: 1 / 60, speed: 0 }, samples = [];
for (let i = 0; i < 900; i++) {
  state.state = ['idle', 'wind', 'strike', 'recover', 'block'][Math.floor(i / 30) % 5];
  state.stateT = (i % 30) / 120;
  const t = performance.now(); opponent.update(args); const elapsed = performance.now() - t;
  if (i >= 180) samples.push(elapsed);
}
samples.sort((a,b) => a-b);
const report = {
  method: 'Node CPU generation and opponent animation only. Scene inventory includes invisible meshes, excludes GPU passes and VFX. Not browser FPS or GPU cost.',
  assetGenerationMs, characterBuildMs,
  opponentSkinTriangles: opponent.character.geometry.index.count / 3,
  opponentEquipmentTriangles: inventory(opponent.group).triangles - opponent.character.geometry.index.count / 3,
  firstPerson: inventory(fists.root), scene: inventory(scene),
  animationUpdateMs: { p50: samples[360], p95: samples[684], p99: samples[712] },
  browser: { fps: null, p50: null, p95: null, p99: null, drawCalls: null, renderedTriangles: null, textures: null, programs: null, firstFrameMs: null },
};
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
fists.dispose(); opponent.dispose(); presentation.dispose(); library.dispose(); instance.dispose();
