import {createMesh,createPart,createTopologySurface,extractBoundaryLoops,concatenateTopologySurfaces,stitchTopologySurfaces,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '../../src/full/index.js';

// Two capped tube-like sections with facing open ends. Deliberately synthetic.
export function section(id,y0,y1,{cap='bottom',segments=8,radius=1}={}){
  const position=[],uv=[],regionId=[],surfaceId=[],skinIndex=[],skinWeight=[];
  for(const y of [y0,y1])for(let i=0;i<segments;i++){
    const t=i/segments*Math.PI*2;position.push(Math.cos(t)*radius,y,Math.sin(t)*radius);uv.push(i/segments,(y-y0)/(y1-y0));regionId.push(7);surfaceId.push(3);skinIndex.push(0,0,0,0);skinWeight.push(1,0,0,0);
  }
  const indices=[];for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(i,i+segments,j+segments,i,j+segments,j);}
  if(cap){
    position.push(0,cap==='bottom'?y0:y1,0);uv.push(.5,.5);regionId.push(7);surfaceId.push(3);skinIndex.push(0,0,0,0);skinWeight.push(1,0,0,0);
    for(let i=0;i<segments;i++){const j=(i+1)%segments;indices.push(segments*2,...(cap==='bottom'?[i,j]:[segments+j,segments+i]));}
  }
  const mesh=createMesh({id,attributes:{position,uv,regionId,surfaceId},indices,parts:[createPart({id,semanticName:id,indexStart:0,indexCount:indices.length})]});
  const s=createTopologySurface({...mesh,attributes:{...mesh.attributes,skinIndex,skinWeight}});
  const loop=extractBoundaryLoops(s,{selectors:cap?[{name:'join',regionId:7,centroid:[0,cap==='bottom'?y1:y0,0],tolerance:1e-6}]:[]});
  if(cap)s.boundaries.join=loop[0].vertices;
  return s;
}
export function topologyProof(){
  const torso=section('torso-proof',0,1),limb=section('limb-proof',1.2,2,{cap:'top',radius:.8});
  const before=validateTopology(concatenateTopologySurfaces([torso,limb]));
  const result=stitchTopologySurfaces(torso,limb,{loopA:'join',loopB:'join',mode:'bridge',maxSpan:.4});
  const after=validateTopology(result.surface,{policy:HERO_BODY_TOPOLOGY_POLICY});
  return {torso,limb,surface:result.surface,before,after};
}
