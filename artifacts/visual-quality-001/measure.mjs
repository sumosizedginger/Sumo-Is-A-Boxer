import fs from 'node:fs';
import crypto from 'node:crypto';
import { Scene, PerspectiveCamera } from 'three';
import { triangleCount } from '@sumosizedginger/my-game-engine-1.0/full';
const root=new URL('../../',import.meta.url);
const output=new URL('./',import.meta.url);
async function measure(prefix){
  const load=p=>import(new URL(prefix+p,root));
  const [{buildAllAssets},{createAssetLibrary},{MATERIAL_DEFINITIONS},{composeArenaScene},{createArenaPresentation},{createOpponentBoxer},{createPlayerFists}]=await Promise.all([
    load('app.js'),load('presentation/asset-library.js'),load('assets/materials.js'),load('scene/arena-scene.js'),load('presentation/presenter.js'),load('character/opponent-boxer.js'),load('character/player-fists.js')
  ]);
  const times=[];let assets;
  for(let i=0;i<3;i++){const start=performance.now();assets=buildAllAssets();times.push(performance.now()-start);}
  const start=performance.now();
  const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});
  const composition=composeArenaScene(),arena=createArenaPresentation({instance:composition.instance,library});
  const opponent=createOpponentBoxer({library}),scene=new Scene(),camera=new PerspectiveCamera();
  const fists=createPlayerFists({library,camera});scene.add(arena.root,opponent.group,camera);
  const compileMs=performance.now()-start;
  const geometries=new Set(),materials=new Set();let allPlacementTriangles=0,allPlacementParts=0;
  scene.traverse(o=>{if(!o.isMesh)return;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);allPlacementTriangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;allPlacementParts+=Array.isArray(o.material)?o.geometry.groups.length:1;});
  const report={
    method:'CPU-only. No WebGL render, frustum culling, shadows, lights or VFX. Counts are not renderer.info or FPS.',
    assetBuildMsSamples:times,assetBuildMsMedian:[...times].sort((a,b)=>a-b)[1],presentationCompileMs:compileMs,
    authoredAssets:assets.size,authoredTriangles:[...assets.values()].reduce((a,m)=>a+triangleCount(m),0),authoredParts:[...assets.values()].reduce((a,m)=>a+m.parts.length,0),
    opponentSkinTriangles:opponent.character.geometry.index.count/3,allPlacementTriangles,allPlacementParts,uniqueGeometries:geometries.size,uniqueMaterials:materials.size,
    runtimeFPS:null,runtimeDrawCalls:null,runtimeTextures:null,initialLoadMs:null,
    equipment:Object.fromEntries([...assets].filter(([k])=>k.includes('boxer')||k.includes('fp.arm')||k.includes('ring.')).map(([k,m])=>[k,{triangles:triangleCount(m),parts:m.parts.length}]))
  };
  fists.dispose();opponent.dispose();arena.dispose();library.dispose();composition.instance.dispose();
  return report;
}
const before=await measure('artifacts/visual-quality-001/before/src/game/');
const after=await measure('src/game/');
const hashes=JSON.parse(fs.readFileSync(new URL('engine-before.json',output)));
const changed=Object.entries(hashes).filter(([p,hash])=>!fs.existsSync(new URL(p,root))||crypto.createHash('sha256').update(fs.readFileSync(new URL(p,root))).digest('hex')!==hash).map(([p])=>p);
const report={before,after,engine:{filesChecked:Object.keys(hashes).length,changed},browser:{available:false,captures:[],reason:'CUA inventory returned apps: [], browsers: []'},auditorBaseline:{fps:60,drawCalls:'195-205',triangles:88000}};
fs.writeFileSync(new URL('comparison.json',output),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,before:{...before,equipment:undefined},after:{...after,equipment:undefined}},null,2));
