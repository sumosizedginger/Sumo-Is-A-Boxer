import { createTopologySurface, values, fail } from './topology-surface.js';

export const TOPOLOGY_POLICIES=Object.freeze({OPEN_SURFACE_ALLOWED:'OPEN_SURFACE_ALLOWED',CLOSED_MANIFOLD:'CLOSED_MANIFOLD',SINGLE_COMPONENT:'SINGLE_COMPONENT',DEFORMATION_SURFACE:'DEFORMATION_SURFACE'});
export const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
export function triangleAreaSquared(p,a,b,c){
  const ux=p[b*3]-p[a*3],uy=p[b*3+1]-p[a*3+1],uz=p[b*3+2]-p[a*3+2];
  const vx=p[c*3]-p[a*3],vy=p[c*3+1]-p[a*3+1],vz=p[c*3+2]-p[a*3+2];
  return ((uy*vz-uz*vy)**2+(uz*vx-ux*vz)**2+(ux*vy-uy*vx)**2)/4;
}
export function analyzeTopology(input,{areaEpsilon=1e-12}={}){
  if(!Number.isFinite(areaEpsilon)||areaEpsilon<0)fail('AREA_TOLERANCE','Area tolerance must be finite and nonnegative');
  const rawP=values(input?.attributes?.position),rawI=values(input?.indices??input?.index);
  const report={vertexCount:rawP?Math.floor(rawP.length/3):0,triangleCount:rawI?Math.floor(rawI.length/3):0,edgeCount:0,boundaryEdgeCount:0,boundaryLoopCount:0,nonManifoldEdgeCount:0,nonManifoldVertexCount:0,inconsistentWindingEdgeCount:0,degenerateTriangleCount:0,duplicateTriangleCount:0,isolatedVertexCount:0,connectedComponentCount:0,invalidNumericCount:0,invalidIndexCount:0,boundaryEdges:[],boundaryLoops:[],diagnostics:[]};
  const diagnostic=(code,message,data={})=>report.diagnostics.push({severity:'ERROR',subsystem:'topology',code,message,data});
  if(!rawP||rawP.length%3)diagnostic('POSITION_SHAPE','Missing or incomplete position vertices');
  if(rawP)for(const v of rawP)if(!Number.isFinite(v))report.invalidNumericCount++;
  if(!rawI||rawI.length%3)diagnostic('INDEX_SHAPE','Missing or incomplete triangle indices');
  if(rawI)for(const v of rawI)if(!Number.isInteger(v)||v<0||v>=report.vertexCount)report.invalidIndexCount++;
  if(report.invalidNumericCount)diagnostic('NON_FINITE_POSITION','Non-finite position data');
  if(report.invalidIndexCount)diagnostic('INVALID_INDEX','Invalid triangle index');
  if(report.diagnostics.length)return report;
  // Validate all other attributes too, without coercing bad indices into uints.
  try{createTopologySurface(input);}catch(e){diagnostic(e.code??'INVALID_SURFACE',e.message);return report;}
  const p=rawP,indices=rawI,n=report.vertexCount,edges=new Map(),used=new Uint8Array(n),parents=Array.from({length:n},(_,i)=>i),links=Array.from({length:n},()=>[]),triangles=new Set();
  const find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
  const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[Math.max(a,b)]=Math.min(a,b);};
  for(let t=0;t<indices.length;t+=3){
    const a=indices[t],b=indices[t+1],c=indices[t+2],v=[a,b,c];
    const duplicate=v.slice().sort((a,b)=>a-b).join(':');if(triangles.has(duplicate))report.duplicateTriangleCount++;triangles.add(duplicate);
    if(a===b||b===c||a===c||triangleAreaSquared(p,a,b,c)<=areaEpsilon**2)report.degenerateTriangleCount++;
    for(let j=0;j<3;j++){
      const from=v[j],to=v[(j+1)%3];used[from]=1;union(from,to);
      const key=edgeKey(from,to);if(!edges.has(key))edges.set(key,[]);edges.get(key).push({from,to,triangle:t/3});
      links[from].push([to,v[(j+2)%3]]);
    }
  }
  report.edgeCount=edges.size;
  for(const incidences of edges.values()){
    if(incidences.length===1)report.boundaryEdges.push(incidences[0]);
    if(incidences.length>2)report.nonManifoldEdgeCount++;
    if(incidences.length===2&&incidences[0].from===incidences[1].from)report.inconsistentWindingEdgeCount++;
  }
  report.boundaryEdges.sort((a,b)=>a.from-b.from||a.to-b.to);
  report.boundaryEdgeCount=report.boundaryEdges.length;
  report.connectedComponentCount=new Set(parents.map((_,i)=>find(i))).size;
  report.isolatedVertexCount=used.reduce((sum,v)=>sum+!v,0);
  // A manifold vertex has one connected link: a cycle (interior) or a path
  // (boundary). This catches bow ties that edge-valence checks alone miss.
  for(let v=0;v<n;v++)if(used[v]){
    const adjacency=new Map();for(const [a,b]of links[v]){if(!adjacency.has(a))adjacency.set(a,[]);if(!adjacency.has(b))adjacency.set(b,[]);adjacency.get(a).push(b);adjacency.get(b).push(a);}
    const visited=new Set(),stack=[adjacency.keys().next().value];while(stack.length){const i=stack.pop();if(visited.has(i))continue;visited.add(i);for(const j of adjacency.get(i)??[])if(!visited.has(j))stack.push(j);}
    const degree=Array.from(adjacency.values(),a=>a.length),ends=degree.filter(v=>v===1).length;
    if(visited.size!==adjacency.size||degree.some(v=>v!==1&&v!==2)||(ends!==0&&ends!==2))report.nonManifoldVertexCount++;
  }
  const outgoing=new Map(),incoming=new Map();
  for(const edge of report.boundaryEdges){if(!outgoing.has(edge.from))outgoing.set(edge.from,[]);outgoing.get(edge.from).push(edge.to);incoming.set(edge.to,(incoming.get(edge.to)??0)+1);}
  const malformed=Array.from(new Set([...outgoing.keys(),...incoming.keys()])).some(v=>outgoing.get(v)?.length!==1||incoming.get(v)!==1);
  if(malformed)diagnostic('NON_LOOP_BOUNDARY','Boundary branches or has inconsistent winding');
  else{
    const visited=new Set();
    for(const edge of report.boundaryEdges)if(!visited.has(edge.from)){
      const vertices=[];let v=edge.from;do{visited.add(v);vertices.push(v);v=outgoing.get(v)[0];}while(v!==edge.from&&!visited.has(v));
      if(v!==edge.from||vertices.length<3){diagnostic('NON_LOOP_BOUNDARY','Boundary is not a simple closed loop');continue;}
      const centroid=[0,0,0];for(const i of vertices)for(let k=0;k<3;k++)centroid[k]+=p[i*3+k]/vertices.length;
      const semantics={};for(const name of ['region','regionId','surfaceId'])if(input.attributes[name])semantics[name]=Array.from(new Set(vertices.map(i=>values(input.attributes[name])[i]))).sort((a,b)=>a-b);
      report.boundaryLoops.push({id:`boundary:${vertices[0]}`,vertices,centroid,semantics});
    }
  }
  report.boundaryLoopCount=report.boundaryLoops.length;
  return report;
}
export function validateTopology(input,{policy=TOPOLOGY_POLICIES.OPEN_SURFACE_ALLOWED,...options}={}){
  const policies=Array.isArray(policy)?policy:[policy];
  if(policies.some(p=>!Object.values(TOPOLOGY_POLICIES).includes(p)))fail('UNKNOWN_TOPOLOGY_POLICY','Unknown topology policy',{policy});
  const report=analyzeTopology(input,options),diagnostics=[...report.diagnostics];
  const forbid=(field)=>{if(report[field])diagnostics.push({severity:'ERROR',subsystem:'topology',code:field,message:`${field} must be zero`,data:{actual:report[field]}});};
  for(const k of ['nonManifoldEdgeCount','nonManifoldVertexCount','inconsistentWindingEdgeCount','degenerateTriangleCount','duplicateTriangleCount'])forbid(k);
  if(policies.includes('CLOSED_MANIFOLD')){forbid('boundaryEdgeCount');forbid('boundaryLoopCount');}
  if(policies.includes('DEFORMATION_SURFACE'))forbid('isolatedVertexCount');
  if(policies.includes('SINGLE_COMPONENT')&&report.connectedComponentCount!==1)diagnostics.push({severity:'ERROR',subsystem:'topology',code:'MULTIPLE_COMPONENTS',message:'Exactly one component required',data:{actual:report.connectedComponentCount}});
  if(!report.triangleCount)diagnostics.push({severity:'ERROR',subsystem:'topology',code:'EMPTY_SURFACE',message:'At least one triangle required',data:{}});
  return {...report,policy:policies,valid:diagnostics.length===0,diagnostics};
}
export function findBoundaryEdges(input,options){const report=analyzeTopology(input,options);if(report.diagnostics.length)fail('INVALID_TOPOLOGY','Cannot discover reliable boundaries',{diagnostics:report.diagnostics});return report.boundaryEdges;}
export function extractBoundaryLoops(input,{selectors=[],...options}={}){
  const report=validateTopology(input,options);if(!report.valid)fail('INVALID_BOUNDARY_TOPOLOGY','Cannot extract manifold ordered loops',{diagnostics:report.diagnostics});
  const loops=report.boundaryLoops.map(loop=>({...loop})),names=new Set();
  for(const selector of selectors){
    if(!selector.name||names.has(selector.name))fail('BOUNDARY_NAME','Boundary names must be unique');names.add(selector.name);
    const matches=loops.filter(loop=>['regionId','region','surfaceId'].every(k=>selector[k]===undefined||(loop.semantics[k]?.length===1&&loop.semantics[k][0]===selector[k]))&&
      (!selector.centroid||Math.hypot(...loop.centroid.map((v,i)=>v-selector.centroid[i]))<=(selector.tolerance??1e-6)));
    if(matches.length!==1||matches[0].name)fail('BOUNDARY_SELECTOR','A semantic selector must identify exactly one unused loop',{selector,matches:matches.length});
    matches[0].name=selector.name;
  }
  return loops;
}
