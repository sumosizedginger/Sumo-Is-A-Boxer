import test from 'node:test';
import assert from 'node:assert/strict';
import {computeSemanticLandmarks,resolveHumanoidParameters} from '@sumosizedginger/my-game-engine-1.0/full';
import {generateContinuousBody} from '../src/game/character/continuous-body.js';
import {SUMO_PARAMETERS} from '../src/game/character/opponent-sumo.js';

test('longitudinal forefoot has outward dorsal and plantar normals on both sides',()=>{
 const {surface}=generateContinuousBody(computeSemanticLandmarks(resolveHumanoidParameters(SUMO_PARAMETERS).parameters));
 const p=surface.attributes.position,n=surface.attributes.normal;
 for(const side of ['l','r']){
  let dorsal=0,plantar=0;
  for(let i=0;i<p.length/3;i++){
   if(surface.metadata.domains[i]!=='foot_'+side)continue;
   const y=p[i*3+1],z=p[i*3+2];
   if(z<.13||z>.20)continue;
   if(y>.065){assert.ok(n[i*3+1]>0,'dorsal surface points inside the foot');dorsal++;}
   if(y<.017){assert.ok(n[i*3+1]<0,'plantar surface points inside the foot');plantar++;}
  }
  assert.ok(dorsal>10&&plantar>10,'both exterior surfaces must be represented');
  for(const z of [.09,.11,.16,.19]){
   let top=-1;
   for(let i=0;i<p.length/3;i++){
    if(surface.metadata.domains[i]!=='foot_'+side||Math.abs(p[i*3+2]-z)>.008)continue;
    if(top<0||p[i*3+1]>p[top*3+1])top=i;
   }
   assert.ok(top>=0&&n[top*3+1]>0,'instep folds back over its upper exterior');
  }
 }
});
