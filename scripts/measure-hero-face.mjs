import {writeFileSync,readFileSync} from 'node:fs';
import {createOpponentBoxer} from '../src/game/character/opponent-boxer.js';
import {createAssetLibrary} from '../src/game/presentation/asset-library.js';
import {buildFighterKitAssets} from '../src/game/assets/fighter-kit.js';
import {MATERIAL_DEFINITIONS} from '../src/game/assets/materials.js';
const library=createAssetLibrary({assets:buildFighterKitAssets(),materials:MATERIAL_DEFINITIONS});
const generationMs=[],sculptMs=[];let certification;
try{
  for(let i=0;i<3;i++){
    const start=performance.now(),opponent=createOpponentBoxer({library});
    generationMs.push(performance.now()-start);sculptMs.push(opponent.character.faceDesign.generationMs);
    certification=opponent.character.bodyCertification;opponent.dispose();
  }
}finally{library.dispose();}
const before=JSON.parse(readFileSync('artifacts/char-face-003/before.json','utf8'));
const result={method:before.method,generationMs,sculptMs,certification,
  beforeGenerationMs:before.generationMs,
  beforeMeanMs:before.generationMs.reduce((a,b)=>a+b)/before.generationMs.length,
  afterMeanMs:generationMs.reduce((a,b)=>a+b)/generationMs.length};
writeFileSync('artifacts/char-face-003/generation.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result));
