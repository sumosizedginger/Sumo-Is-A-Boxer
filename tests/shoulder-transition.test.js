import test from 'node:test';
import assert from 'node:assert/strict';
import {shoulderBridgePoint} from '../src/game/character/continuous-body.js';

test('inferior shoulder bridge never doubles back between thorax and humerus',()=>{
 for(const sign of [-1,1])for(const z of [-.16,-.08,0,.08,.16]){
  const start=[sign*.31,1.31,z],end=[sign*.335,1.30,z*.7];
  let previous=start;
  for(let step=0;step<=64;step++){
   const p=shoulderBridgePoint(start,end,sign,step/64);
   assert.ok(p.every(Number.isFinite));
   for(let axis=0;axis<3;axis++){
    assert.ok(p[axis]>=Math.min(start[axis],end[axis])-1e-12&&p[axis]<=Math.max(start[axis],end[axis])+1e-12);
    assert.ok((p[axis]-previous[axis])*(end[axis]-start[axis])>=-1e-12,'axis reverses inside the lower axilla');
   }previous=p;
  }
  assert.deepEqual(shoulderBridgePoint(start,end,sign,0),start);
  assert.deepEqual(shoulderBridgePoint(start,end,sign,1),end);
 }
});

// Connectivity alone permits one closed branch to pass through another.
// The proximal arm below the thoracic opening must stay outside that shell.
test('proximal arm clears the intact thorax below the shoulder opening',async()=>{
 const {computeSemanticLandmarks,resolveHumanoidParameters}=await import('@sumosizedginger/my-game-engine-1.0/full');
 const {SUMO_PARAMETERS}=await import('../src/game/character/opponent-sumo.js');
 const {generateContinuousBody,SHOULDER_OPENING_BOTTOM}=await import('../src/game/character/continuous-body.js');
 const {anatomicalTorsoPoint}=await import('../src/game/character/sumo-body-sculpt.js');
 const landmarks=computeSemanticLandmarks(resolveHumanoidParameters(SUMO_PARAMETERS).parameters);
 const {surface}=generateContinuousBody(landmarks),p=surface.attributes.position;
 let examined=0;
 for(let i=0;i<surface.metadata.domains.length;i++){
  if(!surface.metadata.domains[i].startsWith('arm_'))continue;
  const [x,y,z]=p.slice(i*3,i*3+3);if(y<1.10||y>=SHOULDER_OPENING_BOTTOM-.01)continue;
  examined++;
  const torso=anatomicalTorsoPoint(y,Math.atan2(z,x));
  const penetration=Math.hypot(torso[0],torso[2])-Math.hypot(x,z);
  assert.ok(penetration<=.001,`arm vertex ${i} penetrates intact thorax by ${penetration} m`);
 }
 assert.ok(examined>100);
});
