import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, ShaderLib, MeshStandardMaterial } from 'three';
import { meshHash, validateMesh } from '@sumosizedginger/my-game-engine-1.0/full';
import { buildFighterKitAssets } from '../src/game/assets/fighter-kit.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { createOpponentBoxer } from '../src/game/character/opponent-boxer.js';
import { createPlayerFists } from '../src/game/character/player-fists.js';
import { createMatch } from '../src/game/combat/match.js';
import { MODEL_STATES, poseModels } from '../src/game/validation/model-poses.js';
import { createProceduralMaterials } from '../src/game/presentation/procedural-materials.js';
import { applyCharacterSurface } from '../src/game/presentation/character-surfaces.js';
import { facePoint } from '../src/game/assets/fighter-face.js';
import { skullAt, HEAD_BONE_BIND_Y } from '../src/game/assets/skull-sections.js';

const assets=buildFighterKitAssets();
function fixture(){
  const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});
  const opponent=createOpponentBoxer({library}),fists=createPlayerFists({library,camera:new PerspectiveCamera()}),match=createMatch();
  return {library,opponent,fists,match,dispose(){fists.dispose();opponent.dispose();match.dispose();library.dispose();}};
}
test('character equipment rebuilds byte-identically with valid named material groups',()=>{
  const again=buildFighterKitAssets(),ids=new Set(MATERIAL_DEFINITIONS.map(m=>m.id));
  for(const [key,mesh]of assets){assert.equal(meshHash(mesh),meshHash(again.get(key)));assert.ok(validateMesh(mesh).valid,key);for(const part of mesh.parts)assert.ok(ids.has(part.materialId));}
  const face=assets.get('asset.boxer.head.detail');
  for(const name of ['boxer-eyes-sclera','boxer-eyes-iris','boxer-lips','boxer-hair-fade'])assert.ok(face.parts.some(p=>p.semanticName===name),name);
  assert.notEqual(facePoint(.033,1.756)[2],facePoint(-.033,1.756)[2]);
});
test('all 25 inspection states are reproducible after unrelated poses and have finite deformed skin',()=>{
  const f=fixture(),v=new Vector3();
  const snapshot=()=>f.opponent.character.bones.flatMap(b=>b.matrixWorld.elements).concat(f.fists.arms.flatMap(a=>a.pivot.matrixWorld.elements),f.opponent.corrections.influences);
  try{
    assert.equal(Object.keys(MODEL_STATES).length,25);
    for(const name of Object.keys(MODEL_STATES)){
      poseModels(f,name);const before=snapshot();
      poseModels(f,'body_reaction');poseModels(f,name);const after=snapshot();
      assert.equal(before.length,after.length);
      for(let i=0;i<before.length;i++)assert.ok(Math.abs(before[i]-after[i])<1e-7,`${name} transform ${i}: ${before[i]} / ${after[i]}`);
      for(let i=0;i<f.opponent.character.geometry.attributes.position.count;i++){
        f.opponent.character.mesh.getVertexPosition(i,v);assert.ok(Number.isFinite(v.x+v.y+v.z),`${name} vertex ${i}`);
      }
    }
  }finally{f.dispose();}
});
test('morph offsets have explicit metre bounds and corrective update retains fixed buffers/state',()=>{
  const f=fixture(),c=f.opponent.corrections,g=f.opponent.character.geometry;
  try{
    const positions=g.morphAttributes.position,normals=g.morphAttributes.normal,influences=c.influences;
    assert.equal(positions.length,10);assert.equal(normals.length,10);
    for(let j=0;j<positions.length;j++)for(let i=0;i<positions[j].count;i++){
      const p=positions[j];assert.ok(Math.hypot(p.getX(i),p.getY(i),p.getZ(i))<=c.limits[j]+1e-7);
      const n=normals[j];assert.ok(Number.isFinite(n.getX(i)+n.getY(i)+n.getZ(i)));
    }
    for(let i=0;i<2000;i++)c.update();
    assert.equal(g.morphAttributes.position,positions);assert.equal(g.morphAttributes.normal,normals);assert.equal(c.influences,influences);
    poseModels(f,'deep_elbow_flex');assert.ok(influences.some(v=>v>.1));
    assert.ok(influences.every(v=>v>=0&&v<=1));c.reset();assert.ok(influences.every(v=>v===0));
  }finally{f.dispose();}
});
test('stress poses keep semantic equipment attachments and planted foot heights',()=>{
  const f=fixture(),v=new Vector3();
  try{
    for(const name of ['high_guard','jab_extension','cross_extension','deep_knee_flex','wide_stance','close_stance','torso_twist']){
      poseModels(f,name);
      for(const side of ['l','r']){
        const bone=f.opponent.character.bonesByName['foot_'+side];bone.getWorldPosition(v);assert.ok(Math.abs(v.y-.093)<1e-5,`${name} foot ${side}: ${v.y}`);
        const hand=f.opponent.character.bonesByName['hand_'+side];assert.ok(hand.children.some(o=>o.name==='attach:hand_'+side));
      }
      assert.equal(f.opponent.character.bonesByName.head.children.find(o=>o.name==='attach:head').position.length(),0);
    }
  }finally{f.dispose();}
});
test('first-person compression is bounded, pose-dependent, and resettable without geometry growth',()=>{
  const f=fixture();try{
    poseModels(f,'fp_neutral');const arm=f.fists.arms[0],mesh=arm.rollNode.children[0],g=mesh.geometry,neutral=mesh.morphTargetInfluences[0];
    poseModels(f,'fp_jab_extension');assert.ok(mesh.morphTargetInfluences[0]>neutral+.4);assert.equal(mesh.geometry,g);
    for(const a of g.morphAttributes.position)for(let i=0;i<a.count;i++)assert.ok(Math.hypot(a.getX(i),a.getY(i),a.getZ(i))<.005);
    poseModels(f,'fp_neutral');assert.equal(mesh.morphTargetInfluences[0],neutral);
  }finally{f.dispose();}
});
test('regional standard-material hook preserves Phase 1 shader integration and cache identity',()=>{
  const detail=createProceduralMaterials(),m=new MeshStandardMaterial();
  try{
    detail.apply(m,'opponent-skin','mat.skin.0');applyCharacterSurface(m,'opponent-skin','mat.skin.0');
    const shader={vertexShader:ShaderLib.standard.vertexShader,fragmentShader:ShaderLib.standard.fragmentShader,uniforms:{}};
    m.onBeforeCompile(shader,{});
    assert.ok(shader.uniforms.tactileEnabled);assert.ok(shader.vertexShader.includes('vCharacterPosition=position'));
    assert.ok(shader.fragmentShader.includes('float sweat='));assert.ok(shader.fragmentShader.includes('tactileSample()'));
    assert.match(m.customProgramCacheKey(),/vq003-surface-v1.*character-ceiling-v1/);
    const roughness=shader.fragmentShader.split('#include <metalnessmap_fragment>')[0];
    assert.doesNotMatch(roughness,/abs\(normal\./,'roughness runs before the fragment normal is defined');
  }finally{detail.dispose();m.dispose();}
});

test('actual fade geometry clears the skull and leaves the central forehead exposed',()=>{
  const mesh=assets.get('asset.boxer.head.detail'),part=mesh.parts.find(p=>p.semanticName==='boxer-hair-fade');
  for(const i of new Set(mesh.indices.slice(part.indexStart,part.indexStart+part.indexCount))){
    const [x,localY,z]=mesh.attributes.position.slice(i*3,i*3+3),y=localY+HEAD_BONE_BIND_Y,q=skullAt(y);
    assert.ok(Math.hypot((x-q.cx)/q.width,(z-q.cz)/q.depth)>1.025);
    if(Math.abs(x)<.04&&z>0)assert.ok(y>1.778,'fade must not cover the orbit');
  }
});
test('garment skin binds without a rest jump and its hems follow semantic thighs under flexion',()=>{
  const f=fixture(),a=new Vector3(),b=new Vector3();
  try{
    const panels=[];f.opponent.group.traverse(o=>{if(o.userData.garment)panels.push(o.userData.garment.mesh);});
    assert.equal(panels.length,2);f.opponent.group.updateMatrixWorld(true);
    for(const panel of panels){
      const p=panel.geometry.attributes.position;
      for(let i=0;i<p.count;i+=7){panel.getVertexPosition(i,a);b.fromBufferAttribute(p,i);assert.ok(a.distanceTo(b)<1e-6,'garment bind changed rest surface');}
    }
    for(const name of ['deep_knee_flex','cross_extension','wide_stance']){
      poseModels(f,name);
      for(const panel of panels){
        const p=panel.geometry.attributes.position,w=panel.geometry.attributes.skinWeight;
        for(let i=0;i<p.count;i+=7){
          panel.getVertexPosition(i,a);assert.ok(Number.isFinite(a.x+a.y+a.z));
          assert.ok(Math.abs(w.getX(i)+w.getY(i)-1)<1e-6);
          if(p.getY(i)<-.20){b.fromBufferAttribute(p,i);assert.ok(a.distanceTo(b)<1e-5,'hem must remain thigh-local');}
        }
      }
    }
  }finally{f.dispose();}
});
