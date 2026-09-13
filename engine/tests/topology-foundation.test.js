import test from 'node:test';
import assert from 'node:assert/strict';
import {BufferGeometry,Float32BufferAttribute} from 'three';
import {createTopologySurface,concatenateTopologySurfaces,validateTopology,extractBoundaryLoops,findBoundaryEdges,weldTopologyVertices,bridgeTopologyLoops,stitchTopologySurfaces} from '../src/full/index.js';
import {section,topologyProof} from './fixtures/topology-proof.js';

const raw=(position,indices,extras={})=>({attributes:{position,...extras},indices});
const plane=()=>raw([0,0,0,1,0,0,1,1,0,0,1,0],[0,1,2,0,2,3]);
const rejected=code=>e=>e.code===code;

test('synthetic real MeshIR stitch proof closes two separate sections into one manifold',t=>{
  const {before,after,surface}=topologyProof();
  const metrics=r=>Object.fromEntries(['vertexCount','triangleCount','edgeCount','boundaryEdgeCount','boundaryLoopCount','nonManifoldEdgeCount','degenerateTriangleCount','connectedComponentCount'].map(k=>[k,r[k]]));
  t.diagnostic(JSON.stringify({before:metrics(before),after:metrics(after)}));
  assert.equal(before.connectedComponentCount,2);assert.equal(before.boundaryLoopCount,2);assert.equal(before.boundaryEdgeCount,16);
  assert.equal(after.valid,true,JSON.stringify(after.diagnostics));assert.equal(after.connectedComponentCount,1);assert.equal(after.boundaryEdgeCount,0);
  assert.equal(after.triangleCount-before.triangleCount,16);assert.equal(after.nonManifoldEdgeCount,0);assert.equal(after.inconsistentWindingEdgeCount,0);assert.equal(after.degenerateTriangleCount,0);
  assert.equal(extractBoundaryLoops(surface).length,0);
});
test('ordered boundaries distinguish open planes, open tubes and closed bodies',()=>{
  assert.equal(findBoundaryEdges(plane()).length,4);assert.deepEqual(extractBoundaryLoops(plane())[0].vertices,[0,1,2,3]);
  const tube=section('tube',0,1,{cap:null});assert.equal(extractBoundaryLoops(tube).length,2);
  assert.deepEqual(extractBoundaryLoops(tube),extractBoundaryLoops(tube));
  assert.equal(validateTopology(plane(),{policy:'OPEN_SURFACE_ALLOWED'}).valid,true);
  assert.equal(validateTopology(plane(),{policy:'CLOSED_MANIFOLD'}).valid,false);
  assert.throws(()=>extractBoundaryLoops(tube,{selectors:[{name:'ambiguous',regionId:7}]}),rejected('BOUNDARY_SELECTOR'));
});
test('validator diagnoses bad triangles, indices, numeric data, components and vertex bow ties',()=>{
  const p=plane();
  assert.equal(validateTopology({...p,indices:[...p.indices,0,1,2]}).duplicateTriangleCount,1);
  assert.equal(validateTopology({...p,indices:[...p.indices,0,1,1]}).degenerateTriangleCount,1);
  assert.equal(validateTopology(raw([...p.attributes.position,3,3,3],p.indices)).isolatedVertexCount,1);
  assert.equal(validateTopology(raw([...p.attributes.position,3,3,3],p.indices)).connectedComponentCount,2);
  for(const bad of [-1,100,1.5,NaN,Infinity])assert.equal(validateTopology({...p,indices:[0,1,bad]}).invalidIndexCount,1);
  for(const bad of [NaN,Infinity])assert.equal(validateTopology(raw([bad,0,0,1,0,0,0,1,0],[0,1,2])).invalidNumericCount,1);
  assert.equal(validateTopology({...p,indices:[0,1]}).valid,false);
  const nonmanifold=raw([0,0,0,1,0,0,0,1,0,0,-1,0,0,0,1],[0,1,2,1,0,3,0,1,4]);
  assert.equal(validateTopology(nonmanifold).nonManifoldEdgeCount,1);assert.throws(()=>extractBoundaryLoops(nonmanifold));
  const bow=raw([0,0,0,1,0,0,0,1,0,-1,0,0,0,-1,0],[0,1,2,0,3,4]);
  assert.ok(validateTopology(bow).nonManifoldVertexCount>0);assert.throws(()=>extractBoundaryLoops(bow));
  const reversed={...p,indices:[0,1,2,0,3,2]};assert.equal(validateTopology(reversed).inconsistentWindingEdgeCount,1);
});
test('real weld collapses compatible duplicates, remaps indices and removes collapsed/duplicate triangles',()=>{
  const input=raw([0,0,0,1,0,0,0,1,0,0,0,0],[0,1,2,3,1,2,0,3,1]);
  const a=weldTopologyVertices(input,{normalPolicy:'recompute'}),b=weldTopologyVertices(input,{normalPolicy:'recompute'});
  assert.equal(a.surface.attributes.position.length/3,3);assert.deepEqual([...a.oldToNew],[0,1,2,0]);assert.deepEqual([...a.surface.indices],[0,1,2]);
  assert.equal(a.removedTriangles.length,2);assert.equal(a.report.degenerateTriangleCount,0);assert.deepEqual(a,b);
  assert.equal(input.indices.length,9,'input is not mutated');
});
test('weld compatibility preserves UV seams, semantic identities, morph deltas and four normalized influences',()=>{
  const p=[0,0,0,1,0,0,0,1,0,0,0,0,-1,0,0,0,-1,0],ix=[0,1,2,3,4,5];
  const uv=[0,0,1,0,0,1,1,0,-1,0,0,-1],regions=[1,1,1,2,2,2];
  assert.equal(weldTopologyVertices(raw(p,ix,{uv,regionId:regions})).surface.attributes.position.length/3,6);
  // Duplicated source vertices of the same triangle avoid introducing a bow tie.
  const s=createTopologySurface(raw(p.slice(0,12),[0,1,2,3,1,2],{uv:[0,0,1,0,0,1,0,0],regionId:[9,9,9,9],surfaceId:[4,4,4,4],normal:Array(4).fill([0,0,1]).flat(),tangent:Array(4).fill([1,0,0,1]).flat(),
    skinIndex:[0,1,2,3,0,0,0,0,0,0,0,0,4,5,6,7],skinWeight:[.25,.25,.25,.25,1,0,0,0,1,0,0,0,.25,.25,.25,.25]}));
  s.morphTargets=[{name:'raise',relative:true,attributes:{position:Array(4).fill([0,0,.1]).flat()},metadata:{purpose:'test'}}];
  const result=weldTopologyVertices(s);assert.equal(result.surface.attributes.position.length/3,3);
  assert.deepEqual([...result.surface.attributes.skinIndex.slice(0,4)],[0,1,2,3]);assert.equal(result.surface.attributes.skinWeight.slice(0,4).reduce((a,b)=>a+b),1);
  assert.equal(result.surface.attributes.uv[2],1);assert.equal(result.surface.attributes.tangent[3],1);assert.equal(result.surface.attributes.regionId[0],9);
  assert.equal(result.surface.morphTargets[0].metadata.purpose,'test');assert.equal(result.surface.morphTargets[0].attributes.position.length,9);
  assert.throws(()=>weldTopologyVertices(s,{normalPolicy:'recompute'}),rejected('TANGENT_RECOMPUTE_REQUIRED'));
  s.attributes.regionId.fill(0xffffffff);s.attributes.surfaceId.fill(16777217);
  const integerSafe=weldTopologyVertices(s).surface;
  assert.equal(integerSafe.attributes.regionId[0],0xffffffff);assert.equal(integerSafe.attributes.surfaceId[0],16777217);
  s.morphTargets[0].attributes.position[9]=.2;
  assert.throws(()=>weldTopologyVertices(s,{candidatePairs:[[0,3]]}),rejected('INCOMPATIBLE_WELD'));
});
test('stitch weld consumes exactly the named seam and rejects incompatible semantics or unequal loops',()=>{
  const a=section('a',0,1),b=section('b',1,2,{cap:'top'});
  // Deliberately remove the UV discontinuity at the join by authoring y in a
  // shared chart. Welding must never quietly average two incompatible UVs.
  for(let i=0;i<b.attributes.uv.length;i+=2)b.attributes.uv[i+1]+=1;
  const result=stitchTopologySurfaces(a,b,{loopA:'join',loopB:'join',mode:'weld',normalPolicy:'recompute'});
  assert.equal(result.report.connectedComponentCount,1);assert.equal(result.report.boundaryEdgeCount,0);assert.equal(result.surface.attributes.position.length/3,26);
  b.attributes.regionId.fill(8);assert.throws(()=>stitchTopologySurfaces(a,b,{loopA:'join',loopB:'join',mode:'weld'}),rejected('INCOMPATIBLE_WELD'));
  assert.throws(()=>stitchTopologySurfaces(a,section('b',1.2,2,{cap:'top',segments:6}),{loopA:'join',loopB:'join'}),rejected('UNEQUAL_LOOP_COUNTS'));
});
test('bridge refuses reversed boundary winding, collapsed faces, and mismatched attribute schemas',()=>{
  const a=section('a',0,1),b=section('b',1,2,{cap:'top'}),s=concatenateTopologySurfaces([a,b]);
  assert.throws(()=>bridgeTopologyLoops(s,[...s.boundaries['source0:join']].reverse(),s.boundaries['source1:join']),rejected('LOOP_WINDING'));
  assert.throws(()=>bridgeTopologyLoops(s,'source0:join','source1:join'),rejected('DEGENERATE_BRIDGE'));
  delete b.attributes.uv;assert.throws(()=>concatenateTopologySurfaces([a,b]),rejected('ATTRIBUTE_SCHEMA_MISMATCH'));
});
test('BufferGeometry input is executable and critical unknown attributes are never silently discarded',()=>{
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(plane().attributes.position,3));g.setIndex(plane().indices);
  const result=weldTopologyVertices(g,{normalPolicy:'recompute'});assert.equal(result.report.triangleCount,2);assert.equal(result.surface.attributes.normal.length,12);
  g.setAttribute('mystery',new Float32BufferAttribute([1,2,3,4],1));assert.throws(()=>createTopologySurface(g),rejected('UNSUPPORTED_ATTRIBUTE'));g.dispose();
});
