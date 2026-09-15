import {writeFileSync,readFileSync} from 'node:fs';
import {createOpponentSumo} from '../src/game/character/opponent-sumo.js';
import {createAssetLibrary} from '../src/game/presentation/asset-library.js';
import {buildHeroKitAssets} from '../src/game/assets/hero-kit.js';
import {MATERIAL_DEFINITIONS} from '../src/game/assets/materials.js';
const library=createAssetLibrary({assets:buildHeroKitAssets(),materials:MATERIAL_DEFINITIONS});
const generationMs=[],sculptMs=[];let certification;
try{
  for(let i=0;i<3;i++){
    const start=performance.now(),opponent=createOpponentSumo({library, voxelQuality: 'HIGH'});
    generationMs.push(performance.now()-start);sculptMs.push(opponent.character.faceDesign.generationMs);
    certification=opponent.character.bodyCertification;opponent.dispose();
  }
}finally{library.dispose();}
const result={generationMs,sculptMs,certification,
  afterMeanMs:generationMs.reduce((a,b)=>a+b)/generationMs.length};
console.log(JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
