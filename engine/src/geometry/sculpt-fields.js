import {createTopologySurface,TOPOLOGY_ATTRIBUTE_SIZES,fail} from './topology-surface.js';
const add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,t)=>a.map(v=>v*t),dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=v=>{if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)||Math.hypot(...v)<1e-12)fail('SCULPT_VECTOR','Expected a finite nonzero 3-vector');return mul(v,1/Math.hypot(...v));};
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
export function createFeatureFrame({center,forward=[0,0,1],up=[0,1,0],right=null}){
 if(!center?.every(Number.isFinite)||center.length!==3)fail('SCULPT_CENTER','Finite center required');
 center=Object.freeze([...center]);
 const f=unit(forward),u=unit(sub(up,mul(f,dot(up,f)))),r=unit(cross(u,f));
 if(right&&dot(unit(right),r)<1-1e-6)fail('SCULPT_FRAME','Right axis conflicts with orthonormal forward/up frame');
 Object.freeze(f);Object.freeze(u);Object.freeze(r);
 return Object.freeze({center,forward:f,up:u,right:r,toLocal:p=>{const d=sub(p,center);return [dot(d,r),dot(d,u),dot(d,f)];},vectorToModel:v=>add(add(mul(r,v[0]),mul(u,v[1])),mul(f,v[2]))});
}
export function ellipsoidMask({frame=createFeatureFrame({center:[0,0,0]}),radii,falloff=2}){
 if(!radii||radii.length!==3||!radii.every(v=>Number.isFinite(v)&&v>0)||!Number.isFinite(falloff)||falloff<1)fail('SCULPT_RADII','Positive radii and falloff >= 1 required');
 return p=>{const q=frame.toLocal(p),r=Math.hypot(...q.map((v,i)=>v/radii[i]));return r>=1?0:Math.pow(1-r*r,falloff);};
}
export function composeSculptMasks(operation,...masks){
 if(!['multiply','max','min','subtract','smoothUnion'].includes(operation)||masks.length<2)fail('SCULPT_MASK_OPERATION','Unknown operation or fewer than two masks');
 return (...args)=>masks.map(m=>clamp(m(...args))).reduce((a,b)=>operation==='multiply'?a*b:operation==='max'?Math.max(a,b):operation==='min'?Math.min(a,b):operation==='subtract'?Math.max(0,a-b):a+b-a*b);
}
export const semanticSculptMask=regions=>{const set=new Set(regions);return (_p,i,s)=>set.has(s.attributes.regionId?.[i])?1:0;};
export function directionalSculptField({direction=[0,0,1],strength,mask=()=>1,frame=null}){
 if(!Number.isFinite(strength))fail('SCULPT_STRENGTH','Finite strength required');const d=unit(frame?frame.vectorToModel(direction):direction);
 return (p,n,i,s)=>mul(d,strength*clamp(mask(p,i,s)));
}
export function ellipsoidSculptField({center,radii,strength,direction=[0,0,1],falloff=2,mask=()=>1,frame=createFeatureFrame({center})}){
 return directionalSculptField({direction,strength,frame,mask:composeSculptMasks('multiply',ellipsoidMask({frame,radii,falloff}),mask)});
}
export function normalSculptField({strength,mask=()=>1}){
 if(!Number.isFinite(strength))fail('SCULPT_STRENGTH','Finite strength required');return (p,n,i,s)=>mul(n,strength*clamp(mask(p,i,s)));
}
export function planeSculptField({point,normal,strength=1,offset=0,mask=()=>1,maxDisplacement=Infinity}){
 const n=unit(normal);if(!point?.every(Number.isFinite)||point.length!==3||!Number.isFinite(strength)||!Number.isFinite(offset)||!(maxDisplacement>0))fail('SCULPT_PLANE','Invalid plane constraint');
 return (p,_n,i,s)=>mul(n,Math.max(-maxDisplacement,Math.min(maxDisplacement,(offset-dot(sub(p,point),n))*strength))*clamp(mask(p,i,s)));
}
export function ridgeSculptField({points,radius,strength,direction=[0,0,1],mask=()=>1,frame=createFeatureFrame({center:[0,0,0]}),depthRadius=Infinity}){
 if(!points||points.length<2||!points.every(p=>p.length===3&&p.every(Number.isFinite))||!(radius>0)||!Number.isFinite(strength))fail('SCULPT_RIDGE','Ridge needs finite polyline, radius and strength');
 const d=unit(frame.vectorToModel(direction));
 return (p,_n,i,s)=>{const q=frame.toLocal(p);let distance=Infinity;
   for(let j=0;j<points.length-1;j++){const a=points[j],v=sub(points[j+1],a),v2=[v[0],v[1],0],delta=[q[0]-a[0],q[1]-a[1],0],t=clamp(dot(delta,v2)/Math.max(dot(v2,v2),1e-20)),c=add(a,mul(v,t));distance=Math.min(distance,Math.hypot((q[0]-c[0])/radius,(q[1]-c[1])/radius,(q[2]-c[2])/depthRadius));}
   return mul(d,strength*Math.pow(Math.max(0,1-distance*distance),2)*clamp(mask(p,i,s)));
 };
}
export const creaseSculptField=options=>ridgeSculptField({...options,strength:-Math.abs(options.strength)});
export function rebuildSculptNormals(input){
 const s=createTopologySurface(input);if(s.attributes.tangent||s.morphTargets.length)fail('SCULPT_DERIVED_DATA','Sculpt before tangent/morph generation');
 const p=s.attributes.position,n=new Float32Array(p.length);
 for(let i=0;i<s.indices.length;i+=3){const a=s.indices[i]*3,b=s.indices[i+1]*3,c=s.indices[i+2]*3,u=[0,1,2].map(k=>p[b+k]-p[a+k]),v=[0,1,2].map(k=>p[c+k]-p[a+k]),normal=cross(u,v);for(const j of [a,b,c])for(let k=0;k<3;k++)n[j+k]+=normal[k];}
 for(let i=0;i<n.length;i+=3){const len=Math.hypot(n[i],n[i+1],n[i+2]);if(len<1e-20)fail('SCULPT_NORMAL','Undefined normal',{vertex:i/3});for(let k=0;k<3;k++)n[i+k]/=len;}s.attributes.normal=n;return s;
}
export function applySculptFields(input,fields){
 let s=createTopologySurface(input);if(!s.attributes.normal)s=rebuildSculptNormals(s);
 for(const field of fields){const p=s.attributes.position,n=s.attributes.normal;for(let i=0;i<p.length/3;i++){const q=Array.from(p.slice(i*3,i*3+3)),normal=Array.from(n.slice(i*3,i*3+3)),d=field(q,normal,i,s);if(!d||d.length!==3||!d.every(Number.isFinite))fail('SCULPT_RESULT','Field produced invalid displacement',{vertex:i});for(let k=0;k<3;k++)p[i*3+k]+=d[k];}}
 return rebuildSculptNormals(s);
}
export function relaxSculptSurface(input,{mask=()=>1,pinned=[],iterations=4,strength=.3,featureMask=()=>0,tangential=true,direction=null}={}){
 if(!Number.isInteger(iterations)||iterations<0||iterations>100||!Number.isFinite(strength)||strength<0||strength>1)fail('SCULPT_RELAX','Invalid relaxation settings');
 const axis=direction?unit(direction):null;if(axis&&tangential)fail('SCULPT_RELAX_CONSTRAINT','Choose tangential or directional relaxation, not both');
 let s=rebuildSculptNormals(input);const locked=new Set(pinned),neighbors=Array.from({length:s.attributes.position.length/3},()=>new Set());
 for(let i=0;i<s.indices.length;i+=3){const t=s.indices.slice(i,i+3);for(let j=0;j<3;j++){neighbors[t[j]].add(t[(j+1)%3]);neighbors[t[j]].add(t[(j+2)%3]);}}
 for(let pass=0;pass<iterations;pass++){const p=s.attributes.position,next=new Float32Array(p),n=s.attributes.normal;for(let i=0;i<neighbors.length;i++){if(locked.has(i)||!neighbors[i].size)continue;const q=Array.from(p.slice(i*3,i*3+3)),amount=strength*clamp(mask(q,i,s))*(1-clamp(featureMask(q,i,s)));if(!amount)continue;const mean=[0,0,0];for(const j of neighbors[i])for(let k=0;k<3;k++)mean[k]+=p[j*3+k]/neighbors[i].size;let delta=sub(mean,q);if(tangential){const normal=Array.from(n.slice(i*3,i*3+3));delta=sub(delta,mul(normal,dot(delta,normal)));}if(axis)delta=mul(axis,dot(delta,axis));for(let k=0;k<3;k++)next[i*3+k]+=amount*delta[k];}s.attributes.position=next;}
 return rebuildSculptNormals(s);
}

// Conforming local refinement. Every marked edge gets one shared midpoint.
// Author before skinning/morphs; categorical attributes need an explicit policy.
export function refineSculptTopology(input,{mask,iterations=1}={}){
 let s=createTopologySurface(input),sourceVertex=Array.from({length:s.attributes.position.length/3},(_,i)=>i);
 if(!Number.isInteger(iterations)||iterations<0||iterations>4||typeof mask!=='function')fail('SCULPT_REFINE','Mask and 0..4 refinement passes required');
 if(Object.keys(s.attributes).some(k=>!['position','normal','uv'].includes(k))||s.morphTargets.length||Object.keys(s.boundaries).length||s.anchors.length)fail('SCULPT_REFINE_ATTRIBUTES','Refine before semantic/skinning/morph/anchor authoring');
 for(let pass=0;pass<iterations;pass++){
  const attrs=Object.fromEntries(Object.entries(s.attributes).map(([k,v])=>[k,Array.from(v)])),edges=new Map(),out=[],parts=[];
  const midpoint=(a,b)=>{const key=a<b?a+':'+b:b+':'+a;if(edges.has(key))return edges.get(key);const p=s.attributes.position,pa=Array.from(p.slice(a*3,a*3+3)),pb=Array.from(p.slice(b*3,b*3+3));if(!mask(pa,a,s)||!mask(pb,b,s))return null;
    const id=attrs.position.length/3;for(const [name,array]of Object.entries(attrs)){const size=TOPOLOGY_ATTRIBUTE_SIZES[name];for(let k=0;k<size;k++)array.push((array[a*size+k]+array[b*size+k])/2);}sourceVertex.push(sourceVertex[a]);edges.set(key,id);return id;};
  for(const part of s.parts){const start=out.length;for(let i=part.indexStart;i<part.indexStart+part.indexCount;i+=3){let v=Array.from(s.indices.slice(i,i+3)),m=v.map((a,j)=>midpoint(a,v[(j+1)%3])),count=m.filter(x=>x!==null).length;
    if(count===0)out.push(...v);
    else if(count===3)out.push(v[0],m[0],m[2],m[0],v[1],m[1],m[2],m[1],v[2],m[0],m[1],m[2]);
    else {const r=count===1?m.findIndex(x=>x!==null):(m.findIndex(x=>x===null)+1)%3;v=[v[r],v[(r+1)%3],v[(r+2)%3]];m=[m[r],m[(r+1)%3],m[(r+2)%3]];
      if(count===1)out.push(v[0],m[0],v[2],m[0],v[1],v[2]);else out.push(v[1],m[1],m[0],v[0],m[0],v[2],m[0],m[1],v[2]);}
   }parts.push({...part,indexStart:start,indexCount:out.length-start});}
  s=createTopologySurface({...s,attributes:attrs,indices:out,parts});
 }return {surface:rebuildSculptNormals(s),sourceVertex};
}
