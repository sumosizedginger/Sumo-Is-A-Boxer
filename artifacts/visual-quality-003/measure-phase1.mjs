import fs from 'node:fs';
import crypto from 'node:crypto';
import { Scene, PerspectiveCamera } from 'three';
import { createProceduralMaterials } from '../../src/game/presentation/procedural-materials.js';

const root = new URL('../../', import.meta.url);
async function measure(prefix, detailed) {
  const load = name => import(new URL(prefix + name, root));
  const [{buildAllAssets}, {createAssetLibrary}, {MATERIAL_DEFINITIONS}, {composeArenaScene}, {createArenaPresentation}, {createOpponentBoxer}, {createPlayerFists}] = await Promise.all([
    load('app.js'), load('presentation/asset-library.js'), load('assets/materials.js'), load('scene/arena-scene.js'),
    load('presentation/presenter.js'), load('character/opponent-boxer.js'), load('character/player-fists.js')
  ]);
  const start = performance.now(), assets = buildAllAssets(), buildMs = performance.now() - start;
  const surfaceDetail = detailed ? createProceduralMaterials() : null;
  const library = createAssetLibrary({assets, materials:MATERIAL_DEFINITIONS, surfaceDetail});
  const scene = new Scene(), camera = new PerspectiveCamera();
  const composition = composeArenaScene(), arena = createArenaPresentation({instance:composition.instance,library});
  const opponent = createOpponentBoxer({library}), fists = createPlayerFists({library,camera});
  surfaceDetail?.apply(opponent.character.material, 'opponent-skin', 'mat.skin.0');
  scene.add(arena.root, opponent.group, camera);
  const presentationMs = performance.now() - start - buildMs;
  const geometry = new Set(), materials = new Set(); let triangles = 0, submissions = 0;
  scene.traverse(o => {
    if (!o.isMesh) return;
    geometry.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m);
    triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    submissions += Array.isArray(o.material) ? o.geometry.groups.length : 1;
  });
  const prior = surfaceDetail?.stats();
  for (let i=0;i<20;i++) { opponent.reset(); fists.reset(); }
  const resetStable = !surfaceDetail || JSON.stringify(prior) === JSON.stringify(surfaceDetail.stats());
  const result = {
    method:'CPU only, all placements including viewmodel, no culling/shadow/VFX passes. Not rendered frame telemetry.',
    assetBuildMs:buildMs,presentationBuildMs:presentationMs,triangles,materialSubmissions:submissions,
    geometries:geometry.size,materials:materials.size,proceduralMaterials:prior??null,twentyPresentationResetsStable:resetStable,
    fps:null,p50:null,p95:null,p99:null,renderedTriangles:null,runtimeDrawCalls:null,runtimeTextures:null,firstFrameMs:null,gpuRematchDelta:null
  };
  fists.dispose(); opponent.dispose(); arena.dispose(); surfaceDetail?.dispose(); library.dispose(); composition.instance.dispose();
  return result;
}
const before = await measure('artifacts/visual-quality-003/before/src/game/',false);
const after = await measure('src/game/',true);
const hashes = JSON.parse(fs.readFileSync(new URL('baseline-hashes.json',import.meta.url)));
const changed = Object.entries(hashes).filter(([p,h])=>crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex')!==h).map(([p])=>p);
const result = {before,after,changedExistingFiles:changed,engineFilesChanged:changed.filter(p=>p.startsWith('engine/')),captureStatus:'No browser surface available; vision agent requested.'};
fs.writeFileSync(new URL('phase1-comparison.json',import.meta.url),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
