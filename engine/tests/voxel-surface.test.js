import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Bone,Matrix4,Quaternion,Vector3,Group} from 'three';
import {voxelizeMesh,createVoxelArtifact,instantiateVoxelArtifact,voxelHash} from '../src/voxel/index.js';
const geometry=new BoxGeometry(.12,.18,.09,2,3,2),count=geometry.attributes.position.count;
const skinIndex=new Uint16Array(count*4),skinWeight=new Float32Array(count*4);
for(let i=0;i<count;i++){skinIndex[i*4+1]=1;skinWeight[i*4]=.6;skinWeight[i*4+1]=.4;}
const mesh={attributes:{position:geometry.attributes.position.array,skinIndex,skinWeight,regionId:new Uint16Array(count).fill(7)},indices:geometry.index.array};
const grid=voxelizeMesh(mesh,{quality:'HERO',fillInterior:true});
const compile=placement=>createVoxelArtifact({id:'test.surface',grid,surfaceMesh:mesh,surfaceSampling:{placement}});
const artifact=compile('surface');
const dot=(a,b)=>a.reduce((v,x,i)=>v+x*b[i],0);
test('surface sample count, order, attributes and hashes reproduce without caching',()=>{
 const again=compile('surface');assert.deepEqual(artifact.surfaceInstances, {...again.surfaceInstances,generationMs:artifact.surfaceInstances.generationMs});
 assert.equal(artifact.hash,voxelHash(artifact));assert.equal(artifact.voxelSize,.012);
 assert.equal(artifact.hash,createVoxelArtifact({id:'test.grid',grid}).hash);
 assert.ok(artifact.surfaceInstances.samples.length>100);
 assert.deepEqual(JSON.parse(JSON.stringify(artifact)).surfaceInstances.samples,artifact.surfaceInstances.samples);
});
test('surface samples lie on source triangles with finite orthonormal frames and normalized inherited skin',()=>{
 for(const s of artifact.surfaceInstances.samples){
  assert.ok([...s.bindPosition,...s.normal,...s.tangent,...s.bindOrientation].every(Number.isFinite));
  assert.ok(Math.abs(Math.hypot(...s.normal)-1)<1e-8);assert.ok(Math.abs(Math.hypot(...s.tangent)-1)<1e-8);assert.ok(Math.abs(dot(s.normal,s.tangent))<1e-8);
  assert.ok(Math.abs(Math.hypot(...s.bindOrientation)-1)<1e-8);
  const q=new Quaternion().fromArray(s.bindOrientation),n=new Vector3(0,0,1).applyQuaternion(q),t=new Vector3(1,0,0).applyQuaternion(q);
  assert.ok(n.distanceTo(new Vector3(...s.normal))<1e-8);assert.ok(t.distanceTo(new Vector3(...s.tangent))<1e-8);
  assert.equal(s.regionId,7);assert.ok(Math.abs(s.skinWeight.reduce((a,b)=>a+b,0)-1)<1e-7);
  for(let k=0;k<3;k++)assert.ok(Math.abs(s.bindPosition[k]-s.sourceVertices.reduce((a,id,j)=>a+mesh.attributes.position[id*3+k]*s.barycentric[j],0))<1e-9);
 }
});
test('orientation-only experiment preserves exact grid centres; surface centres escape grid planes',()=>{
 const oriented=compile('grid-normal');assert.equal(oriented.surfaceInstances.samples.length,artifact.cells.length);
 oriented.surfaceInstances.samples.forEach((s,i)=>assert.deepEqual(s.bindPosition,artifact.cells[i].bindPosition));
 assert.ok(artifact.surfaceInstances.samples.some(s=>Math.abs((s.bindPosition[1]-artifact.origin[1])/.012-.5-Math.round((s.bindPosition[1]-artifact.origin[1])/.012-.5))>.1));
});
test('surface cubes remain finite, isotropic and deterministic under blended rotations and transformed parents',()=>{
 const bones=[new Bone(),new Bone()],group=new Group();group.add(...bones);group.updateMatrixWorld(true);
 const r=instantiateVoxelArtifact(artifact,{mode:'surfaceInstances',bones});group.add(r.object3D);
 try{
  assert.equal(r.stats.drawCalls,1);assert.equal(r.meshes[0].geometry.type,'BoxGeometry');assert.equal(r.stats.surfaceVoxels,artifact.surfaceCount);
  group.rotation.y=.8;bones[0].rotation.x=.25;bones[1].rotation.x=-.4;bones[0].position.y=.03;group.updateMatrixWorld(true);r.updateDeformation(bones);
  const before=Array.from(r.meshes[0].instanceMatrix.array);r.updateDeformation(bones);assert.deepEqual(Array.from(r.meshes[0].instanceMatrix.array),before);
  const m=new Matrix4(),pos=new Vector3(),q=new Quaternion(),scale=new Vector3();
  for(let i=0;i<r.meshes[0].count;i++){r.meshes[0].getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));m.decompose(pos,q,scale);assert.ok(Math.abs(scale.x-.012)<1e-7&&Math.abs(scale.y-.012)<1e-7&&Math.abs(scale.z-.012)<1e-7);}
  r.meshes[0].getMatrixAt(0,m);m.decompose(pos,q,scale);
  const expected=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.25*.6-.4*.4).multiply(new Quaternion(...artifact.surfaceInstances.samples[0].bindOrientation));
  assert.ok(1-Math.abs(q.dot(expected))<1e-6,'root rotation cancels and bind frame survives the actual blend');
 }finally{r.dispose();}
});
test('old grid and face modes coexist and missing/invalid realizations fail explicitly',()=>{
 for(const mode of ['instances','faces']){const r=instantiateVoxelArtifact(artifact,{mode});assert.equal(r.stats.drawCalls,1);r.dispose();}
 assert.throws(()=>instantiateVoxelArtifact(createVoxelArtifact({id:'plain',grid}),{mode:'surfaceInstances'}),/requires compiled/);
 assert.throws(()=>compile('wrong'),/Unknown surface/);
 assert.throws(()=>createVoxelArtifact({id:'bad',grid,surfaceMesh:mesh,surfaceSampling:{spacing:NaN}}),/Invalid surface/);
});
