import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {certifyHeroBody,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
import {createOpponentSumo} from '../src/game/character/opponent-sumo.js';
import {createAssetLibrary} from '../src/game/presentation/asset-library.js';
import {buildHeroKitAssets} from '../src/game/assets/hero-kit.js';
import {MATERIAL_DEFINITIONS} from '../src/game/assets/materials.js';
import {generateContinuousBody,BODY_REGIONS} from '../src/game/character/continuous-body.js';
import {createPlayerFists} from '../src/game/character/player-fists.js';
import {PerspectiveCamera} from 'three';
import {createMatch} from '../src/game/combat/match.js';
import {poseModels} from '../src/game/validation/model-poses.js';

const library=createAssetLibrary({assets:buildHeroKitAssets(),materials:MATERIAL_DEFINITIONS});
const opponent=createOpponentSumo({library, voxelQuality: 'HIGH'});
const character=opponent.character,g=character.geometry;
test.after(()=>{opponent.dispose();library.dispose();});
const fields=['boundaryEdgeCount','boundaryLoopCount','nonManifoldEdgeCount','nonManifoldVertexCount','degenerateTriangleCount','duplicateTriangleCount','isolatedVertexCount','invalidNumericCount','invalidIndexCount'];
test('actual rendered hero skin is closed, manifold, connected and cannot regress to concatenated body pieces',t=>{
  const a=character.heroArtifact,r=validateTopology(g,{policy:HERO_BODY_TOPOLOGY_POLICY});
  assert.equal(a.certifiedClosedBody,true);assert.equal(r.valid,true);assert.equal(r.connectedComponentCount,1);
  for(const f of fields)assert.equal(r[f],0,f);
  assert.equal(certifyHeroBody(a).connectedComponentCount,1);
  assert.equal(a.provenance.assembly,'hero-skin-indexed-v1');assert.equal(character.mesh.geometry,g);
  assert.deepEqual(a.geometry.attributes.position,Array.from(g.attributes.position.array));assert.deepEqual(a.geometry.indices,Array.from(g.index.array));
  assert.equal(r.vertexCount-r.edgeCount+r.triangleCount,2,'genus-zero complete external skin');
  t.diagnostic(JSON.stringify(Object.fromEntries(['vertexCount','triangleCount','edgeCount','connectedComponentCount',...fields].map(k=>[k,r[k]]))));
});
test('actual skin preserves semantic regions, finite unit normals, UV and normalized same-side weights',()=>{
  const regions=new Set(g.attributes.regionId.array),names=character.bones.map(b=>b.name);
  for(const id of Object.values(BODY_REGIONS))assert.ok(regions.has(id),'missing region '+id);
  for(let i=0;i<g.attributes.position.count;i++){
    const normal=[g.attributes.normal.getX(i),g.attributes.normal.getY(i),g.attributes.normal.getZ(i)];assert.ok(Math.abs(Math.hypot(...normal)-1)<1e-5);
    let sum=0;const x=g.attributes.position.getX(i);
    for(let j=0;j<4;j++){const w=g.attributes.skinWeight.array[i*4+j],name=names[g.attributes.skinIndex.array[i*4+j]];assert.ok(Number.isFinite(w)&&w>=0);sum+=w;if(w>1e-7&&Math.abs(x)>1e-6)assert.ok(!name.endsWith(x>0?'_r':'_l'),'contralateral '+name);}
    assert.ok(Math.abs(sum-1)<1e-5);
  }
  for(const a of Object.values(g.attributes))assert.ok(Array.from(a.array).every(Number.isFinite));
  let uvDegenerates=0;const u=g.attributes.uv.array,ix=g.index.array;
  for(let i=0;i<ix.length;i+=3){const a=ix[i]*2,b=ix[i+1]*2,c=ix[i+2]*2;if(Math.abs((u[b]-u[a])*(u[c+1]-u[a+1])-(u[b+1]-u[a+1])*(u[c]-u[a]))<1e-12)uvDegenerates++;}
  assert.equal(uvDegenerates,0,'UV0 triangles retain area');
  for(const name of ['crown','jaw','neckBase','sternum','waist','pelvis','shoulder.L','elbow.L','wrist.L','hip.L','knee.L','ankle.L'])assert.ok(character.heroArtifact.semanticLandmarks[name]);
});
test('canonical generation is deterministic and shape parameters preserve index identity',()=>{
  const a=generateContinuousBody(character.landmarks),b=generateContinuousBody(character.landmarks),c=generateContinuousBody(character.landmarks,{widthScale:.98,leftArmScale:1.02});
  assert.deepEqual(a.surface.attributes.position,b.surface.attributes.position);assert.deepEqual(a.surface.indices,b.surface.indices);
  assert.throws(()=>generateContinuousBody(character.landmarks,{widthScale:0}),/shape scale/);
  assert.deepEqual(a.surface.indices,c.surface.indices);assert.notDeepEqual(a.surface.attributes.position,c.surface.attributes.position);
});
test('actual posed skin remains one finite closed surface throughout the stress envelope',t=>{
  const fists=createPlayerFists({library,camera:new PerspectiveCamera()}),match=createMatch(),v=new Vector3(),results=[];
  try{for(const name of ['front_neutral','high_guard','arm_raised','deep_elbow_flex','punch_extension','torso_twist','wide_stance','deep_knee_flex']){
    poseModels({opponent,fists,match},name);const p=new Float32Array(g.attributes.position.array.length);
    for(let i=0;i<g.attributes.position.count;i++){character.mesh.getVertexPosition(i,v);v.toArray(p,i*3);}
    const r=validateTopology({attributes:{position:p},indices:g.index.array},{policy:HERO_BODY_TOPOLOGY_POLICY,areaEpsilon:1e-14});
    assert.equal(r.valid,true,name+JSON.stringify(r.diagnostics));assert.equal(r.connectedComponentCount,1);
    let longest=0;for(let i=0;i<g.index.count;i+=3)for(let j=0;j<3;j++){const a=g.index.array[i+j]*3,b=g.index.array[i+(j+1)%3]*3;longest=Math.max(longest,Math.hypot(p[a]-p[b],p[a+1]-p[b+1],p[a+2]-p[b+2]));}
    assert.ok(longest<.18,name+' exploded edge '+longest);results.push({name,longestEdge:longest});
  }}finally{fists.dispose();match.dispose();opponent.reset();}t.diagnostic(JSON.stringify(results));
});
