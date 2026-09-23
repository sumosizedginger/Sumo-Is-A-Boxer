import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {buildHumanoidCharacter} from '@sumosizedginger/my-game-engine-1.0/full';
import {fitHeroArmRig,HERO_ARM_CENTERLINE} from '../src/game/character/hero-rig.js';

test('hero rig fit preserves bone identity and makes bind pivots agree with guide centerline',()=>{
 const c=buildHumanoidCharacter('heavy'),bones=[...c.bones],skeleton=c.skeleton;
 try{
  fitHeroArmRig(c);c.mesh.updateMatrixWorld(true);c.skeleton.update();
  assert.equal(c.skeleton,skeleton);assert.deepEqual(c.bones,bones);
  for(const [side,sign] of [['l',1],['r',-1]])for(const [bone,joint,x] of [['upperarm','shoulder',HERO_ARM_CENTERLINE.shoulderX],['forearm','elbow',HERO_ARM_CENTERLINE.elbowX],['hand','wrist',HERO_ARM_CENTERLINE.wristX]]){
   const name=bone+'_'+side,world=c.bonesByName[name].getWorldPosition(new Vector3());
   assert.ok(Math.abs(world.x-sign*x)<1e-12);
   assert.equal(c.bonesData.find(d=>d.name===name).restWorldPosition.x,sign*x);
   assert.equal(c.landmarks[joint+'.'+side.toUpperCase()].x,sign*x);
  }
  const p=c.geometry.attributes.position;
  for(let i=0;i<p.count;i+=Math.max(1,Math.floor(p.count/50))){
   const actual=c.mesh.getVertexPosition(i,new Vector3()),expected=new Vector3().fromBufferAttribute(p,i);
   assert.ok(actual.distanceTo(expected)<1e-6,'rebinding changes the undeformed surface');
  }
  const first=JSON.stringify(c.bonesData);fitHeroArmRig(c);
  assert.equal(JSON.stringify(c.bonesData),first,'fit must be deterministic and idempotent');
 }finally{c.geometry.dispose();c.material.dispose();c.skeleton.dispose();}
});
