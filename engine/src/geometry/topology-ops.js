import {createTopologySurface,concatenateTopologySurfaces,TOPOLOGY_ATTRIBUTE_SIZES as SIZES,fail} from './topology-surface.js';
import {validateTopology,extractBoundaryLoops,triangleAreaSquared,edgeKey} from './topology-analysis.js';

function normals(position,indices){
  const out=new Float32Array(position.length);
  for(let i=0;i<indices.length;i+=3){
    const a=indices[i]*3,b=indices[i+1]*3,c=indices[i+2]*3;
    const u=[0,1,2].map(k=>position[b+k]-position[a+k]),v=[0,1,2].map(k=>position[c+k]-position[a+k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    for(const j of [a,b,c])for(let k=0;k<3;k++)out[j+k]+=n[k];
  }
  for(let i=0;i<out.length;i+=3){const length=Math.hypot(out[i],out[i+1],out[i+2]);if(length<1e-15)fail('UNDEFINED_NORMAL','Cannot recompute a normal for isolated or cancelling faces',{vertex:i/3});for(let k=0;k<3;k++)out[i+k]/=length;}
  return out;
}
function finish(surface,normalPolicy){
  if(!['preserve','recompute'].includes(normalPolicy))fail('NORMAL_POLICY','Choose preserve or recompute normals');
  if(normalPolicy==='recompute'){
    if(surface.attributes.tangent||surface.morphTargets.some(m=>m.attributes.tangent))fail('TANGENT_RECOMPUTE_REQUIRED','Tangent frames cannot be retained when normals change; author tangents after topology or use compatible preserved frames');
    surface.attributes.normal=normals(surface.attributes.position,surface.indices);
    for(const m of surface.morphTargets){
      if(m.attributes.position){
        const p=Float32Array.from(m.attributes.position,(v,i)=>v+(m.relative?surface.attributes.position[i]:0));
        const n=normals(p,surface.indices);m.attributes.normal=Float32Array.from(n,(v,i)=>v-(m.relative?surface.attributes.normal[i]:0));
      }else if(m.attributes.normal)fail('MORPH_NORMAL_RECOMPUTE','Cannot recompute a normal-only morph without its target positions');
    }
  }
  return createTopologySurface(surface);
}
function equals(a,b,ia,ib,size,tolerance){for(let k=0;k<size;k++)if(Math.abs(a[ia*size+k]-b[ib*size+k])>tolerance)return false;return true;}
function compatible(s,a,b,{semanticPolicy,normalPolicy,attributeTolerance,compatibility}){
  for(const [name,attr]of Object.entries(s.attributes)){
    if(['position','skinIndex','skinWeight'].includes(name)||(name==='normal'&&normalPolicy==='recompute'))continue;
    if(['region','regionId','surfaceId'].includes(name)&&semanticPolicy==='representative')continue;
    if(!equals(attr,attr,a,b,SIZES[name],attributeTolerance))return false;
  }
  for(const m of s.morphTargets)for(const [name,attr]of Object.entries(m.attributes)){
    if(name==='normal'&&normalPolicy==='recompute')continue;
    if(!equals(attr,attr,a,b,SIZES[name],attributeTolerance))return false;
  }
  return !compatibility||compatibility(a,b,s)===true;
}

export function weldTopologyVertices(input,{tolerance=1e-6,attributeTolerance=1e-6,semanticPolicy='preserve',normalPolicy='preserve',compatibility=null,candidatePairs=null,maxComparisons=2000000,areaEpsilon=1e-12}={}){
  if(!Number.isFinite(tolerance)||tolerance<=0||!Number.isFinite(attributeTolerance)||attributeTolerance<0||!Number.isFinite(areaEpsilon)||areaEpsilon<0)fail('WELD_TOLERANCE','Tolerances must be finite and valid');
  if(!['preserve','representative'].includes(semanticPolicy))fail('SEMANTIC_POLICY','Choose preserve or representative semantics');
  const s=createTopologySurface(input),p=s.attributes.position,count=p.length/3,representatives=Int32Array.from({length:count},(_,i)=>i),buckets=new Map();
  const options={semanticPolicy,normalPolicy,attributeTolerance,compatibility};let comparisons=0;
  const matches=(a,b)=>{
    if(++comparisons>maxComparisons)fail('WELD_COMPARISON_BUDGET','Spatial buckets exceeded comparison budget; narrow candidates or semantics');
    return Math.hypot(p[a*3]-p[b*3],p[a*3+1]-p[b*3+1],p[a*3+2]-p[b*3+2])<=tolerance&&compatible(s,a,b,options);
  };
  if(candidatePairs){
    const touched=new Set();
    for(const [a,b]of candidatePairs){
      if(!Number.isInteger(a)||!Number.isInteger(b)||a<0||b<0||a>=count||b>=count||a===b||touched.has(a)||touched.has(b))fail('WELD_PAIRS','Candidate pairs must be disjoint valid vertex pairs');
      if(!matches(a,b))fail('INCOMPATIBLE_WELD','Explicit seam pair is not compatible',{a,b});
      touched.add(a);touched.add(b);representatives[Math.max(a,b)]=Math.min(a,b);
    }
  }else for(let i=0;i<count;i++){
    const cell=[0,1,2].map(k=>Math.floor(p[i*3+k]/tolerance));
    if(cell.some(v=>!Number.isSafeInteger(v)))fail('WELD_QUANTIZATION','Position/tolerance exceeds safe spatial hash domain');
    const semanticKey=semanticPolicy==='preserve'?['region','regionId','surfaceId'].map(k=>s.attributes[k]?.[i]??'').join('/') : '';
    let winner=i;
    for(let x=-1;x<=1;x++)for(let y=-1;y<=1;y++)for(let z=-1;z<=1;z++){
      const key=`${cell[0]+x},${cell[1]+y},${cell[2]+z}|${semanticKey}`;
      for(const j of buckets.get(key)??[])if(j<winner&&matches(i,j))winner=j;
    }
    representatives[i]=winner;
    if(winner===i){const key=cell.join(',')+'|'+semanticKey;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);}
  }
  const triangles=[],parts=[],removedTriangles=[],seen=new Map(),used=new Set();
  for(const part of s.parts){
    const indexStart=triangles.length;
    for(let i=part.indexStart;i<part.indexStart+part.indexCount;i+=3){
      const tri=[representatives[s.indices[i]],representatives[s.indices[i+1]],representatives[s.indices[i+2]]],key=tri.slice().sort((a,b)=>a-b).join(':');
      let reason=null;
      if(new Set(tri).size!==3||triangleAreaSquared(p,...tri)<=areaEpsilon**2)reason='degenerate';
      else if(seen.has(key))reason='duplicate';
      if(reason){removedTriangles.push({triangle:i/3,partId:part.id,reason});continue;}
      seen.set(key,i/3);for(const v of tri){triangles.push(v);used.add(v);}
    }
    if(triangles.length>indexStart)parts.push({...part,indexStart,indexCount:triangles.length-indexStart});
  }
  const survivors=Array.from(used).sort((a,b)=>a-b),toNew=new Map(survivors.map((v,i)=>[v,i])),oldToNew=Int32Array.from(representatives,r=>toNew.get(r)??-1);
  const groups=survivors.map(()=>[]);for(let i=0;i<count;i++)if(oldToNew[i]>=0)groups[oldToNew[i]].push(i);
  const remap=(a,size)=>a.constructor.from(survivors.flatMap(i=>Array.from(a.slice(i*size,(i+1)*size))));
  const attributes=Object.fromEntries(Object.entries(s.attributes).map(([k,a])=>[k,remap(a,SIZES[k])]));
  if(attributes.skinWeight){
    attributes.skinIndex=new Uint32Array(survivors.length*4);attributes.skinWeight=new Float32Array(survivors.length*4);
    groups.forEach((vertices,j)=>{
      const influences=new Map();for(const v of vertices)for(let k=0;k<4;k++){const bone=s.attributes.skinIndex[v*4+k],weight=s.attributes.skinWeight[v*4+k];if(weight>0)influences.set(bone,(influences.get(bone)??0)+weight);}
      const best=Array.from(influences).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=best.reduce((n,v)=>n+v[1],0);
      if(sum<=0)fail('SKIN_WEIGHT','Cannot normalize an empty influence set');
      best.forEach(([bone,w],k)=>{attributes.skinIndex[j*4+k]=bone;attributes.skinWeight[j*4+k]=w/sum;});
    });
  }
  const morphTargets=s.morphTargets.map(m=>({...m,attributes:Object.fromEntries(Object.entries(m.attributes).map(([k,a])=>[k,remap(a,SIZES[k])]))}));
  const boundaries={};for(const [name,loop]of Object.entries(s.boundaries)){
    const mapped=loop.map(i=>oldToNew[i]);if(mapped.some(i=>i===undefined||i<0))fail('BOUNDARY_REMAP','Weld removed a named boundary vertex',{name});boundaries[name]=mapped;
  }
  const partIds=new Set(parts.map(p=>p.id));if(s.anchors.some(a=>a.partId&&!partIds.has(a.partId)))fail('ANCHOR_PART_REMOVED','Weld would orphan an anchor on an entirely removed part');
  let surface=finish({...s,attributes,indices:triangles.map(i=>toNew.get(i)),parts,morphTargets,boundaries},normalPolicy);
  // Consumed seam names are retired. Remaining names retain their vertex map.
  const actual=extractBoundaryLoops(surface,{areaEpsilon});
  const edgeSet=new Set(actual.flatMap(l=>l.vertices.map((v,i)=>edgeKey(v,l.vertices[(i+1)%l.vertices.length]))));
  surface.boundaries=Object.fromEntries(Object.entries(boundaries).filter(([,loop])=>loop.every((v,i)=>edgeSet.has(edgeKey(v,loop[(i+1)%loop.length])))));
  return {surface,oldToNew,removedTriangles,comparisons,diagnostics:semanticPolicy==='representative'?[{severity:'WARN',code:'SEMANTIC_REPRESENTATIVE',message:'Conflicting categorical values resolve to the lowest original vertex; oldToNew retains provenance'}]:[],report:validateTopology(surface,{areaEpsilon})};
}

function orderedLoop(s,requested){
  const vertices=typeof requested==='string'?s.boundaries[requested]:requested?.vertices??requested;
  if(!Array.isArray(vertices)||vertices.length<3||new Set(vertices).size!==vertices.length)fail('LOOP_REQUIRED','Provide a named or ordered simple boundary loop');
  const loops=extractBoundaryLoops(s),actual=loops.find(l=>l.vertices.length===vertices.length&&l.vertices.includes(vertices[0]));
  if(!actual)fail('LOOP_NOT_BOUNDARY','Requested loop does not identify a current boundary');
  const start=actual.vertices.indexOf(vertices[0]);
  if(!vertices.every((v,i)=>v===actual.vertices[(start+i)%vertices.length]))fail('LOOP_WINDING','Loop must follow the existing oriented boundary winding');
  return vertices;
}
export function bridgeTopologyLoops(input,loopA,loopB,{offset=0,partId='bridge',semanticName='bridge',materialId=null,normalPolicy='recompute',areaEpsilon=1e-12,maxSpan=Infinity}={}){
  if(!Number.isFinite(areaEpsilon)||areaEpsilon<0||!(maxSpan>0))fail('BRIDGE_TOLERANCE','Area must be finite and nonnegative; maxSpan must be positive');
  const s=createTopologySurface(input),a=orderedLoop(s,loopA),boundaryB=orderedLoop(s,loopB);
  if(a.length!==boundaryB.length)fail('UNEQUAL_LOOP_COUNTS','Only equal-sized loops are supported');
  if(a.some(v=>boundaryB.includes(v)))fail('OVERLAPPING_LOOPS','Bridge loops must be vertex-disjoint');
  if(!Number.isInteger(offset)||offset<0||offset>=a.length)fail('LOOP_OFFSET','Offset must index the second boundary');
  if(s.parts.some(p=>p.id===partId))fail('PART_ID_COLLISION','Bridge part identity is already used');
  // B is reversed so new faces oppose both old boundary half-edges.
  const b=a.map((_,i)=>boundaryB[(offset-i+a.length)%a.length]),newIndices=[];
  for(let i=0;i<a.length;i++){
    const j=(i+1)%a.length;
    const span=Math.hypot(...[0,1,2].map(k=>s.attributes.position[a[i]*3+k]-s.attributes.position[b[i]*3+k]));
    if(span>maxSpan)fail('BRIDGE_SPAN','Bridge exceeds authored span limit',{span,maxSpan});
    for(const tri of [[a[j],a[i],b[i]],[a[j],b[i],b[j]]]){
      if(triangleAreaSquared(s.attributes.position,...tri)<=areaEpsilon**2)fail('DEGENERATE_BRIDGE','Bridge would contain zero-area triangles',{triangle:tri});newIndices.push(...tri);
    }
  }
  const parts=[...s.parts,{id:partId,semanticName,materialId,indexStart:s.indices.length,indexCount:newIndices.length,regionId:null,surfaceId:null}];
  const consumed=new Set([...a,...boundaryB]);const boundaries=Object.fromEntries(Object.entries(s.boundaries).filter(([,loop])=>!loop.some(v=>consumed.has(v))));
  const surface=finish({...s,indices:[...s.indices,...newIndices],parts,boundaries},normalPolicy),report=validateTopology(surface,{areaEpsilon});
  if(!report.valid)fail('INVALID_BRIDGE','Bridge failed topology validation',{diagnostics:report.diagnostics});
  return {surface,addedTriangleCount:newIndices.length/3,report};
}
export function stitchTopologySurfaces(left,right,{loopA,loopB,mode='bridge',...options}={}){
  const a=createTopologySurface(left),b=createTopologySurface(right),la=orderedLoop(a,loopA),lb=orderedLoop(b,loopB);
  if(la.length!==lb.length)fail('UNEQUAL_LOOP_COUNTS','Only equal-sized loops can be stitched');
  const combined=concatenateTopologySurfaces([a,b]),shift=a.attributes.position.length/3,B=lb.map(v=>v+shift);
  if(mode==='bridge')return bridgeTopologyLoops(combined,la,B,options);
  if(mode!=='weld')fail('STITCH_MODE','Choose bridge or weld');
  const offset=options.offset??0;if(!Number.isInteger(offset)||offset<0||offset>=la.length)fail('LOOP_OFFSET','Offset must index the second loop');
  const candidatePairs=la.map((v,i)=>[v,B[(offset-i+la.length)%la.length]]);
  const result=weldTopologyVertices(combined,{...options,candidatePairs});
  if(!result.report.valid||result.report.connectedComponentCount>=validateTopology(combined).connectedComponentCount)fail('STITCH_FAILED','Weld did not join compatible manifold boundaries');
  return result;
}
