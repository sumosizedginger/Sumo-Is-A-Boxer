import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_CORE_SKELETON, buildHumanoidCharacter, createHeroCharacterArtifact, instantiateHeroCharacterArtifact, certifyHeroBody, createPoseDriverDefinition, evaluatePoseDriver, decomposeSwingTwist, poseDriverDistance } from '../src/full/index.js';
import { topologyProof } from './fixtures/topology-proof.js';

const rotation=(axis,degrees)=>axis.map(v=>v*Math.sin(degrees*Math.PI/360)).concat(Math.cos(degrees*Math.PI/360));
const helper={name:'forearm_twist_l',parent:'forearm_l',restLocalPosition:[0,-.05,0],restOrientation:[0,0,0,1],purpose:'twist'};

test('core identity remains stable when deterministic helper bones extend the real runtime rig',()=>{
  const base=buildHumanoidCharacter(),extended=buildHumanoidCharacter('average',{}, {helpers:[helper]});
  try{
    assert.deepEqual(CHARACTER_CORE_SKELETON,base.bonesData.map(({name,index,parent})=>({name,index,parent})));
    assert.equal(base.bones.length,22);assert.equal(extended.bones.length,23);
    for(let i=0;i<22;i++){assert.equal(extended.coreBones[i],extended.bones[i]);assert.equal(extended.bones[i].name,base.bones[i].name);assert.deepEqual(extended.bones[i].position.toArray(),base.bones[i].position.toArray());}
    assert.equal(extended.bonesByName.forearm_twist_l.parent,extended.coreBonesByName.forearm_l);
    assert.equal(extended.deformationJoints[0].index,22);
    assert.throws(()=>buildHumanoidCharacter('average',{}, {helpers:[{...helper,name:'head'}]}));
  }finally{for(const c of [base,extended]){c.geometry.dispose();c.material.dispose();c.skeleton.dispose();}}
});

test('immutable hero artifact survives JSON, topology certification and real BufferGeometry instantiation',()=>{
  const base=buildHumanoidCharacter(),surface=topologyProof().surface;
  surface.attributes.skinIndex.fill(22);surface.attributes.skinWeight.fill(0);
  for(let i=0;i<surface.attributes.skinWeight.length;i+=4)surface.attributes.skinWeight[i]=1;
  surface.morphTargets=[{name:'test-flex',relative:true,attributes:{position:new Float32Array(surface.attributes.position.length)},metadata:{purpose:'proof'}}];
  const driver=createPoseDriverDefinition({id:'test',bone:'forearm_l',samples:[{name:'flex',output:'test-flex',radius:1,orientations:{forearm_l:[0,0,0,1]}}]});
  const artifact=createHeroCharacterArtifact({id:'proof',geometry:surface,coreSkeleton:base.bonesData,deformationSkeleton:[helper],semanticLandmarks:base.landmarks,semanticRegions:[{id:7,name:'proof-skin'}],attachmentAnchors:[{name:'cuff',bone:'forearm_l',position:[0,0,0]}],poseDrivers:[driver]});
  assert.equal(artifact.certifiedClosedBody,true);assert.equal(certifyHeroBody(artifact).connectedComponentCount,1);
  assert.equal(artifact.attributes.tangent,false);assert.equal(artifact.attributes.normal,true);
  assert.equal(artifact.morphRegistry[0].name,'test-flex');assert.equal(artifact.poseDriverRegistry[0].bone,'forearm_l');
  assert.ok(Object.isFrozen(artifact.geometry.attributes.position));assert.deepEqual(JSON.parse(JSON.stringify(artifact)),artifact);
  const instance=instantiateHeroCharacterArtifact(JSON.parse(JSON.stringify(artifact)));
  try{assert.equal(instance.skeleton.bones.length,23);assert.equal(instance.geometry.attributes.skinIndex.array[0],22);assert.equal(instance.geometry.morphAttributes.position.length,1);assert.equal(instance.geometry.groups.length,surface.parts.length);assert.equal(instance.mesh.morphTargetDictionary['test-flex'],0);assert.notEqual(instance.geometry.attributes.position.array,artifact.geometry.attributes.position);}
  finally{instance.dispose();instance.dispose();base.geometry.dispose();base.material.dispose();base.skeleton.dispose();}
  const forged=JSON.parse(JSON.stringify(artifact));forged.geometry.indices.splice(0,3);forged.geometry.parts=[];
  assert.throws(()=>certifyHeroBody(forged));
  assert.throws(()=>createHeroCharacterArtifact({id:'bad',geometry:surface}),/missing core\/helper/);
  assert.throws(()=>createHeroCharacterArtifact({id:'bad',geometry:surface,coreSkeleton:CHARACTER_CORE_SKELETON.slice(1)}),/Canonical/);
});

test('opposite 80 degree swings and signed twists produce different driver values and outputs',t=>{
  const plus=rotation([1,0,0],80),minus=rotation([1,0,0],-80);
  const def=createPoseDriverDefinition({id:'shoulder',bone:'upperarm_l',samples:[{name:'forward',output:'forward-shape',radius:1,orientations:{upperarm_l:plus}},{name:'backward',output:'backward-shape',radius:1,orientations:{upperarm_l:minus}}]});
  const a=evaluatePoseDriver(def,{upperarm_l:plus}),b=evaluatePoseDriver(def,{upperarm_l:minus});
  assert.ok(a.swing[0]>0&&b.swing[0]<0);assert.ok(poseDriverDistance(a,b)>2.79);
  assert.deepEqual(a.outputWeights,{'forward-shape':1,'backward-shape':0});assert.deepEqual(b.outputWeights,{'forward-shape':0,'backward-shape':1});
  const tw1=decomposeSwingTwist(rotation([0,1,0],65)),tw2=decomposeSwingTwist(rotation([0,1,0],-65));
  assert.ok(tw1.twist>1&&tw2.twist< -1);assert.ok(Math.abs(tw1.twist+tw2.twist)<1e-12);
  assert.deepEqual(decomposeSwingTwist(plus),decomposeSwingTwist(plus.map(v=>-v)));
  const rest=rotation([0,0,1],30);assert.ok(Math.abs(decomposeSwingTwist(rest,{restOrientation:rest}).twist)<1e-12);
  assert.throws(()=>decomposeSwingTwist([1,0,0,0]),/no unique twist/);
  t.diagnostic(JSON.stringify({positiveSwing:a.swing,negativeSwing:b.swing,distance:poseDriverDistance(a,b),positiveTwist:tw1.twist,negativeTwist:tw2.twist}));
});

test('neighbor forearm rotation is independent of elbow flexion and sample weights remain bounded',()=>{
  const def=createPoseDriverDefinition({id:'elbow',bone:'forearm_l',twistAxis:[0,1,0],neighbors:[{bone:'hand_l',twistAxis:[0,1,0]}]});
  const a=evaluatePoseDriver(def,{forearm_l:rotation([1,0,0],80),hand_l:rotation([0,1,0],45)});
  const b=evaluatePoseDriver(def,{forearm_l:rotation([1,0,0],80),hand_l:rotation([0,1,0],-45)});
  assert.deepEqual(a.swing,b.swing);assert.equal(a.twist,b.twist);assert.ok(poseDriverDistance(a,b)>1.57);
  assert.throws(()=>createPoseDriverDefinition({id:'bad',bone:'head',neighbors:[{bone:'head'}]}));
  assert.throws(()=>decomposeSwingTwist([0,0,0,2]));
});
