import {headSection,foreheadSculptField} from '../src/game/character/head-profile.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { PerspectiveCamera, Vector3, ShaderLib, MeshStandardMaterial } from 'three';
import { meshHash, validateMesh } from '@sumosizedginger/my-game-engine-1.0/full';
import { buildHeroKitAssets } from '../src/game/assets/hero-kit.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { createOpponentSumo } from '../src/game/character/opponent-sumo.js';
import { createPlayerFists } from '../src/game/character/player-fists.js';
import { createMatch } from '../src/game/combat/match.js';
import { MODEL_STATES, poseModels } from '../src/game/validation/model-poses.js';
import { createProceduralMaterials } from '../src/game/presentation/procedural-materials.js';
import { applyCharacterSurface } from '../src/game/presentation/character-surfaces.js';
import { HEAD_BONE_BIND_Y } from '../src/game/assets/skull-sections.js';

const assets=buildHeroKitAssets();
function fixture(){
  const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});
  const opponent=createOpponentSumo({library, voxelQuality: 'HIGH'}),fists=createPlayerFists({library,camera:new PerspectiveCamera()}),match=createMatch();
  return {library,opponent,fists,match,dispose(){fists.dispose();opponent.dispose();match.dispose();library.dispose();}};
}
test('character equipment rebuilds byte-identically with valid named material groups',()=>{
  const again=buildHeroKitAssets(),ids=new Set(MATERIAL_DEFINITIONS.map(m=>m.id));
  for(const [key,mesh]of assets){assert.equal(meshHash(mesh),meshHash(again.get(key)));assert.ok(validateMesh(mesh).valid,key);for(const part of mesh.parts)assert.ok(ids.has(part.materialId));}
  const face=assets.get('asset.hero.hair');
  for(const name of ['boxer-hair','boxer-hair-fade'])assert.ok(face.parts.some(p=>p.semanticName===name),name);
  assert.ok(face.parts.every(p=>['boxer-hair','boxer-hair-fade'].includes(p.semanticName)), 'facial skin features live in the certified body; only hair remains separate');
});
test('all 27 inspection states are reproducible after unrelated poses and have finite deformed skin',()=>{
  const f=fixture(),v=new Vector3();
  const snapshot=()=>f.opponent.character.bones.flatMap(b=>b.matrixWorld.elements).concat(f.fists.arms.flatMap(a=>a.pivot.matrixWorld.elements),f.opponent.corrections.influences);
  try{
    assert.equal(Object.keys(MODEL_STATES).length,27);
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
test('stress poses keep voxel hero, hair attachment and planted foot heights',()=>{
  const f=fixture(),v=new Vector3();
  try{
    assert.ok(f.opponent.voxel?.runtime);
    assert.ok(f.opponent.character.bonesByName.head.children.some(o=>String(o.name).includes('hair')));
    for(const name of ['high_guard','jab_extension','cross_extension','deep_knee_flex','wide_stance','close_stance','torso_twist']){
      poseModels(f,name);
      for(const side of ['l','r']){
        const bone=f.opponent.character.bonesByName['foot_'+side];bone.getWorldPosition(v);assert.ok(Math.abs(v.y-.093)<1e-5,`${name} foot ${side}: ${v.y}`);
      }
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
  const mesh=assets.get('asset.hero.hair'),part=mesh.parts.find(p=>p.semanticName==='boxer-hair-fade');
  for(const i of new Set(mesh.indices.slice(part.indexStart,part.indexStart+part.indexCount))){
    const [x,localY,z]=mesh.attributes.position.slice(i*3,i*3+3),y=localY+HEAD_BONE_BIND_Y;
    // Undo the shared forehead field before measuring the base envelope.
    const model=[x,y,z+.005];let q=[...model];
    for(let pass=0;pass<6;pass++){const d=foreheadSculptField(q);q=model.map((v,k)=>v-d[k]);}
    const [w,f,b]=headSection(q[1]);
    const envelope=Math.pow(Math.abs(q[0]/w),2/.92)+(q[2]>=-.006?Math.pow((q[2]+.006)/f,2/.45):Math.pow((q[2]+.006)/b,2));
    assert.ok(envelope>1,'fade clears the actual shared skull envelope');
    assert.ok(envelope<1.35,'fade stays close to the scalp');
    if(Math.abs(x)<.04&&z>0)assert.ok(y>1.778,'fade must not cover the orbit');
  }
});
test('boxing garments are absent; voxel hero remains the visible body',()=>{
  const f=fixture();
  try{
    const panels=[];f.opponent.group.traverse(o=>{if(o.userData.garment)panels.push(o.userData.garment.mesh);});
    assert.equal(panels.length,0);
    assert.ok(f.opponent.voxel.artifact.cells.length>0);
  }finally{f.dispose();}
});

