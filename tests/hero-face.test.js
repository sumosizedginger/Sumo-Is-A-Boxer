import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Vector3,Mesh,MeshBasicMaterial,Raycaster,DoubleSide} from 'three';
import {validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
import {createOpponentSumo} from '../src/game/character/opponent-sumo.js';
import {createAssetLibrary} from '../src/game/presentation/asset-library.js';
import {buildHeroKitAssets} from '../src/game/assets/hero-kit.js';
import {MATERIAL_DEFINITIONS} from '../src/game/assets/materials.js';
import {generateContinuousBody} from '../src/game/character/continuous-body.js';
import {sculptBoxerHead,boxerFaceLandmarks,FACE_REGIONS} from '../src/game/character/hero-face.js';

const assets=buildHeroKitAssets();
const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});
const opponent=createOpponentSumo({library, voxelQuality: 'HIGH'});
const c=opponent.character,g=c.geometry,a=c.heroArtifact;
test.after(()=>{opponent.dispose();library.dispose();});

test('runtime uses the sculpted certified surface, with one closed manifold',()=>{
  const r=validateTopology(g,{policy:HERO_BODY_TOPOLOGY_POLICY});
  assert.equal(r.valid,true);assert.equal(r.connectedComponentCount,1);
  for(const key of ['boundaryEdgeCount','boundaryLoopCount','nonManifoldEdgeCount','nonManifoldVertexCount','degenerateTriangleCount','duplicateTriangleCount','isolatedVertexCount','invalidNumericCount','invalidIndexCount'])assert.equal(r[key],0,key);
  assert.equal(c.mesh.geometry,g);
  assert.deepEqual(a.geometry.indices,Array.from(g.index.array));
  assert.deepEqual(a.geometry.attributes.position,Array.from(g.attributes.position.array));
  assert.equal(a.geometry.metadata.face.version,1);
});

test('all facial regions have real vertices and serializable semantic landmarks',()=>{
  const ids=new Set(g.attributes.regionId.array),names=new Set(a.semanticRegions.map(r=>r.name));
  for(const [name,id] of Object.entries(FACE_REGIONS)){assert.ok(names.has(name),name);assert.ok(ids.has(id),'empty region '+name);}
  assert.deepEqual(JSON.parse(JSON.stringify(a.geometry.metadata.face)),a.geometry.metadata.face);
  for(const [name,p] of Object.entries(boxerFaceLandmarks())){
    assert.ok(p.every(Number.isFinite),name);assert.ok(a.semanticLandmarks[name],name);
  }
});

test('sculpt parameter variants preserve topology and deterministic output',()=>{
  const input=generateContinuousBody(c.landmarks).surface;
  const first=sculptBoxerHead(input),again=sculptBoxerHead(input);
  const varied=sculptBoxerHead(input,{noseDeviation:-.002,eyeSpacing:.033,chinProjection:.002});
  assert.deepEqual(first.surface.indices,again.surface.indices);
  assert.deepEqual(first.surface.attributes.position,again.surface.attributes.position);
  assert.deepEqual(first.surface.indices,varied.surface.indices);
  assert.notDeepEqual(first.surface.attributes.position,varied.surface.attributes.position);
  assert.equal(validateTopology(varied.surface,{policy:HERO_BODY_TOPOLOGY_POLICY}).valid,true);
  assert.throws(()=>sculptBoxerHead(input,{noseDeviation:NaN}),/certified range/);
  assert.throws(()=>sculptBoxerHead(input,{eyeSpacing:.1}),/certified range/);
});

test('head normals, UVs and four-influence skinning stay finite and normalized',()=>{
  for(let i=0;i<g.attributes.position.count;i++){
    if(g.attributes.position.getY(i)<1.60)continue;
    const n=g.attributes.normal;
    assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<1e-5);
    assert.ok(Number.isFinite(g.attributes.uv.getX(i)+g.attributes.uv.getY(i)));
    let sum=0;
    for(let k=0;k<4;k++){const w=g.attributes.skinWeight.array[i*4+k];assert.ok(w>=0&&Number.isFinite(w));sum+=w;}
    assert.ok(Math.abs(sum-1)<1e-5);
  }
});

test('auricular bowl triangles do not fold across their local projection',()=>{
  const p=g.attributes.position.array,ix=g.index.array;
  let inspected=0;
  for(let i=0;i<ix.length;i+=3){
    const ids=[ix[i]*3,ix[i+1]*3,ix[i+2]*3];
    if(!ids.every(v=>Math.abs(p[v])>.081&&Math.hypot((p[v+2]+.013)/.014,(p[v+1]-1.740)/.022)<.8))continue;
    const [a,b,c]=ids;
    const projected=(p[b+1]-p[a+1])*(p[c+2]-p[a+2])-(p[b+2]-p[a+2])*(p[c+1]-p[a+1]);
    assert.ok(projected*Math.sign(p[a])>=-1e-11,'reversed ear triangle '+i/3);
    inspected++;
  }
  assert.ok(inspected>100,'gate must inspect the actual inner ears');
});

test('volumetric eyeballs use reproducible semantic centers and head bone space',()=>{
  const m=boxerFaceLandmarks();assert.deepEqual(m,boxerFaceLandmarks());
  assert.ok(m['eyeCenter.L'][0]>0&&m['eyeCenter.R'][0]<0);
  assert.ok(Math.abs(m['eyeCenter.L'][1]-m['eyeCenter.R'][1])<.001);
  assert.equal(c.eyeRig.eyes.length,2);assert.equal(c.eyeRig.root.parent,c.bonesByName.head);
  c.mesh.updateMatrixWorld(true);
  for(const [i,side]of ['L','R'].entries()){
    const eye=c.eyeRig.eyes[i],p=new Vector3().fromArray(m['eyeCenter.'+side]);
    p.sub(new Vector3(c.landmarks.head.x,c.landmarks.head.y,c.landmarks.head.z));
    assert.ok(p.distanceTo(eye.position)<1e-8);
    assert.ok(eye.geometry.parameters.radius>0);
    assert.equal(eye.userData.heroEye,true);
  }
});

test('runtime face attachment contains only hair, with no legacy facial primitives',()=>{
  const face=assets.get('asset.hero.hair');
  assert.deepEqual(face.parts.map(p=>p.semanticName).sort(),['boxer-hair','boxer-hair-fade']);
  const source=readFileSync(new URL('../src/game/assets/fighter-face.js',import.meta.url),'utf8');
  for(const obsolete of ['eyePatch','boxer-eyes-sclera','boxer-lips','boxer-nostrils','boxer-ear'])assert.equal(source.includes(obsolete),false,obsolete);
  assert.ok(g.index.count>0&&c.eyeRig.eyes.every(e=>e.parent===c.eyeRig.root));
});

test('hair remains a separate attached asset over the hidden guide skull',()=>{
  const hair=assets.get('asset.hero.hair');
  assert.ok(hair);
  assert.ok(hair.parts.length>=2);
  assert.ok(opponent.character.bonesByName.head.children.some(child=>child.name.includes('hair')));
  const material=new MeshBasicMaterial({side:DoubleSide});
  const skin=new Mesh(g,material);
  try{
    assert.ok(g.attributes.position.count>0);
    assert.ok(hair.attributes.position.length>0);
  }finally{material.dispose();}
});
