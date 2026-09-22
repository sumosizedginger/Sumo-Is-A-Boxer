import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry,Bone,Group,Matrix4,Quaternion,Vector3} from 'three';
import {voxelizeMesh,createVoxelArtifact,instantiateVoxelArtifact} from '../src/voxel/index.js';
import {compileCoherentSurface} from '../src/voxel/coherent-surface.js';
const g=new BoxGeometry(.12,.18,.09,2,3,2),count=g.attributes.position.count;
const mesh={attributes:{position:g.attributes.position.array,regionId:new Uint32Array(count).fill(7),skinIndex:new Uint16Array(count*4),skinWeight:Float32Array.from({length:count*4},(_,i)=>i%4===0?1:0)},indices:g.index.array};
const grid=voxelizeMesh(mesh,{quality:'HERO',fillInterior:true});
const compile=options=>createVoxelArtifact({id:'test.coherent',grid,surfaceMesh:mesh,surfaceSampling:{placement:'coherentSurface',...options}});
const a=compile({});
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
test('coherent realization preserves canonical cell count, order, semantics, weights and identity',()=>{
 const again=compile({});
 assert.equal(a.surfaceInstances.hash,again.surfaceInstances.hash);
 assert.deepEqual(a.surfaceInstances.samples,again.surfaceInstances.samples);
 assert.equal(a.hash,createVoxelArtifact({id:'canonical',grid}).hash);
 assert.equal(a.voxelSize,.012);assert.equal(a.surfaceInstances.samples.length,a.cells.length);
 a.surfaceInstances.samples.forEach((s,i)=>{
  const c=a.cells[i];assert.deepEqual(s.canonicalCell,[c.x,c.y,c.z]);
  assert.equal(s.regionId,c.regionId);assert.deepEqual(s.skinIndex,c.skinIndex);assert.deepEqual(s.skinWeight,c.skinWeight);
  assert.ok(Math.abs(s.skinWeight.reduce((v,w)=>v+w,0)-1)<1e-7);
  assert.ok(Math.hypot(...s.bindPosition.map((v,k)=>v-c.bindPosition[k]))<=.35*.012+1e-12);
  assert.ok([...s.bindPosition,...s.sourcePoint,...s.normal,...s.tangent,...s.bindOrientation].every(Number.isFinite));
  assert.ok(Math.abs(dot(s.normal,s.tangent))<1e-9);assert.ok(Math.abs(Math.hypot(...s.normal)-1)<1e-9);assert.ok(Math.abs(Math.hypot(...s.tangent)-1)<1e-9);
  const q=new Quaternion(...s.bindOrientation);assert.ok(Math.abs(q.length()-1)<1e-9);
  assert.ok(new Vector3(0,0,1).applyQuaternion(q).distanceTo(new Vector3(...s.normal))<1e-9);
  for(let k=0;k<3;k++)assert.ok(Math.abs(s.sourcePoint[k]-s.sourceVertices.reduce((v,id,j)=>v+mesh.attributes.position[id*3+k]*s.barycentric[j],0))<1e-10);
 });
});
test('projection finds triangle interiors and enforces Euclidean correction limits',()=>{
 const triangle={attributes:{position:[0,0,0,1,0,0,0,1,0]},indices:[0,1,2]};
 const canonical={voxelSize:.012,cells:[{x:2,y:2,z:0,bindPosition:[.03,.03,.009],regionId:99,skinIndex:null,skinWeight:null,color:[1,1,1]}]};
 for(const projection of [0,.25,.35,.45]){
  const result=compileCoherentSurface(triangle,canonical,{projection,orientation:'none'}).samples[0];
  assert.deepEqual(result.canonicalCell,[2,2,0]);assert.equal(result.regionId,99);
  assert.ok(Math.abs(result.sourcePoint[0]-.03)<1e-12&&Math.abs(result.sourcePoint[1]-.03)<1e-12&&result.sourcePoint[2]===0);
  assert.ok(Math.abs(result.bindPosition[2]-(.009-projection*.012))<1e-12);
  assert.deepEqual(result.bindOrientation,[0,0,0,1]);
 }
});
test('normal smoothing stays coherent on planar neighbors and quantization is deterministic',()=>{
 for(const quantization of [0,5,7.5,10,15]){
  const result=compile({quantization}),samples=result.surfaceInstances.samples;
  assert.equal(result.surfaceInstances.hash,compile({quantization}).surfaceInstances.hash);
  for(const s of samples){
   if(quantization){const step=quantization*Math.PI/180,elevation=Math.asin(Math.max(-1,Math.min(1,s.normal[1])));
    assert.ok(Math.abs(elevation/step-Math.round(elevation/step))<1e-6);}
  }
  const byCell=new Map(samples.map(s=>[s.canonicalCell.join(','),s]));let checked=0;
  for(const s of samples){const [x,y,z]=s.canonicalCell,neighbor=byCell.get([x+1,y,z].join(','));
   if(neighbor&&dot(s.rawNormal,neighbor.rawNormal)>.999999){assert.ok(dot(s.normal,neighbor.normal)>.999999);checked++;}
  }assert.ok(checked>20);
 }
});
test('overlap is isotropic at bind and after deterministic skeletal deformation',()=>{
 const bone=new Bone(),group=new Group();group.add(bone);group.updateMatrixWorld(true);
 const r=instantiateVoxelArtifact(a,{mode:'surfaceInstances',bones:[bone]});group.add(r.object3D);
 try{
  assert.equal(r.stats.drawCalls,1);assert.equal(r.meshes[0].geometry.type,'BoxGeometry');assert.equal(r.stats.voxelSize,.012);assert.equal(r.stats.cubeScale,1.04);
  const matrix=new Matrix4(),position=new Vector3(),rotation=new Quaternion(),scale=new Vector3();
  function check(){for(let i=0;i<r.meshes[0].count;i++){r.meshes[0].getMatrixAt(i,matrix);assert.ok(matrix.elements.every(Number.isFinite));matrix.decompose(position,rotation,scale);for(const v of scale.toArray())assert.ok(Math.abs(v-.012*1.04)<1e-7);}}
  check();group.rotation.y=.8;bone.rotation.x=.4;bone.position.y=.02;group.updateMatrixWorld(true);r.updateDeformation([bone]);check();
  const before=Array.from(r.meshes[0].instanceMatrix.array);r.updateDeformation([bone]);assert.deepEqual(Array.from(r.meshes[0].instanceMatrix.array),before);
  r.meshes[0].getMatrixAt(0,matrix);matrix.decompose(position,rotation,scale);
  const expected=new Quaternion().setFromAxisAngle(new Vector3(1,0,0),.4).multiply(new Quaternion(...a.surfaceInstances.samples[0].bindOrientation));assert.ok(1-Math.abs(rotation.dot(expected))<1e-6);
 }finally{r.dispose();}
});
test('invalid projection and frame settings fail before realization',()=>{
 for(const options of [{projection:NaN},{projection:.46},{smoothing:1.5},{quantization:11},{orientation:'random'},{overlap:1.07}])assert.throws(()=>compile(options),RangeError);
});
