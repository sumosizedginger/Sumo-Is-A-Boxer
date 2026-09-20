/** Renderer-independent realization. Occupancy cells are never moved or replaced. */
import {readMeshBuffers} from './grid.js';
import {hashBytes} from '../geometry/mesh-codec.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);if(!Number.isFinite(l)||l<1e-12)throw new RangeError('Surface frame requires a finite nonzero normal');return a.map(v=>v/l);};
const frozen=a=>Object.freeze(Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a,v=>Object.is(v,-0)?0:v):a);
function frame(normal){
 const n=unit(normal),up=Math.abs(n[1])<.995?[0,1,0]:[0,0,1];
 const tangent=unit(cross(up,n)),bitangent=cross(n,tangent);
 // Matrix columns are a right-handed orthonormal basis. A tangent sign flip
 // is a 180 degree cube symmetry; no random triangle tangents are used.
 const m=[tangent,bitangent,n],trace=m[0][0]+m[1][1]+m[2][2];let q;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[1][2]-m[2][1])/s,(m[2][0]-m[0][2])/s,(m[0][1]-m[1][0])/s,s/4];}
 else {const i=m[0][0]>m[1][1]&&m[0][0]>m[2][2]?0:m[1][1]>m[2][2]?1:2,j=(i+1)%3,k=(i+2)%3,s=Math.sqrt(1+m[i][i]-m[j][j]-m[k][k])*2;q=[0,0,0,0];q[i]=s/4;q[j]=(m[i][j]+m[j][i])/s;q[k]=(m[i][k]+m[k][i])/s;q[3]=(m[j][k]-m[k][j])/s;}
 const l=Math.hypot(...q);q=q.map(v=>v/l);if(q[3]<0)q=q.map(v=>-v);
 return {normal:frozen(n),tangent:frozen(tangent),bindOrientation:frozen(q)};
}
export function compileSurfaceInstances(mesh,artifact,{placement='surface',spacing=.65,candidateDensity=10}={}){
 if(!['surface','grid-normal'].includes(placement))throw new RangeError('Unknown surface placement');
 if(!Number.isFinite(spacing)||spacing<.5||spacing>1||!Number.isFinite(candidateDensity)||candidateDensity<4||candidateDensity>24)throw new RangeError('Invalid surface sampling density');
 const started=performance.now(),b=readMeshBuffers(mesh),p=b.positions,ix=b.indices,size=artifact.voxelSize;
 const normals=new Float64Array(p.length),areas=new Float64Array(ix.length/3);let area=0;
 for(let i=0;i<p.length;i++)if(!Number.isFinite(p[i]))throw new RangeError('Non-finite surface vertex');
 for(let i=0;i<ix.length;i+=3){
  const ids=[ix[i],ix[i+1],ix[i+2]];if(!ids.every(v=>Number.isInteger(v)&&v>=0&&v<b.vertexCount))throw new RangeError('Invalid surface index');
  const [a,c,d]=ids.map(v=>Array.from(p.slice(v*3,v*3+3))),n=cross(c.map((v,k)=>v-a[k]),d.map((v,k)=>v-a[k]));
  area+=Math.hypot(...n)/2;areas[i/3]=area;for(const id of ids)for(let k=0;k<3;k++)normals[id*3+k]+=n[k];
 }
 if(!(area>0))throw new RangeError('Surface has zero area');
 for(let i=0;i<normals.length;i+=3){const n=unit(Array.from(normals.slice(i,i+3)));normals.set(n,i);}
 const samples=[],radius=size*spacing,buckets=new Map(),key=(x,y,z)=>x+','+y+','+z;
 const cellMap=new Map(artifact.cells.map(c=>[key(c.x,c.y,c.z),c]));
 const record=(position,ids,weights,canonical=null)=>{
  const normal=[0,0,0],influences=new Map();let regionVertex=ids[0],largest=-1;
  for(let j=0;j<ids.length;j++){
   const id=ids[j],w=weights[j];for(let k=0;k<3;k++)normal[k]+=normals[id*3+k]*w;
   if(w>largest){regionVertex=id;largest=w;}
   if(b.skinWeight&&b.skinIndex)for(let k=0;k<4;k++){const sw=b.skinWeight[id*4+k],bi=b.skinIndex[id*4+k];if(!Number.isFinite(sw)||sw<0||!Number.isInteger(bi)||bi<0)throw new RangeError('Invalid surface skin weights');influences.set(bi,(influences.get(bi)||0)+sw*w);}
  }
  const f=frame(normal),top=[...influences].filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=top.reduce((v,x)=>v+x[1],0);
  if(b.skinWeight&&!sum)throw new RangeError('Surface weights have zero sum');
  const xyz=position.map((v,k)=>Math.floor((v-artifact.origin[k])/size)),cell=canonical??cellMap.get(key(...xyz));
  samples.push(frozen({...f,bindPosition:frozen([...position]),regionId:canonical?.regionId??b.regionId?.[regionVertex]??0,
   skinIndex:canonical?.skinIndex??(sum?frozen(Array.from({length:4},(_,i)=>top[i]?.[0]??0)):null),
   skinWeight:canonical?.skinWeight??(sum?frozen(Array.from({length:4},(_,i)=>(top[i]?.[1]??0)/sum)):null),
   color:cell?.color??frozen([.7,.7,.7]),canonicalCell:frozen(xyz),sourceVertices:frozen([...ids]),barycentric:frozen([...weights])}));
 };
 if(placement==='surface'){
  const count=Math.ceil(area/(size*size)*candidateDensity);if(count>4000000)throw new RangeError('Surface candidate limit exceeded');
  let triangle=0;
  for(let i=0;i<count;i++){
   const target=(i+.5)*area/count;while(areas[triangle]<target)triangle++;
   const ids=[ix[triangle*3],ix[triangle*3+1],ix[triangle*3+2]];
   // Global low-discrepancy barycentrics, stratified by cumulative area.
   // No seed, clock, triangle-local reset, or random rotation enters ordering.
   const u=Math.sqrt(((i+.5)*.7548776662466927)%1),v=((i+.5)*.5698402909980532)%1,w=[1-u,u*(1-v),u*v];
   const point=[0,1,2].map(k=>ids.reduce((a,id,j)=>a+p[id*3+k]*w[j],0));
   const bucket=point.map(v=>Math.floor(v/radius));let near=false;
   for(let z=-1;z<=1&&!near;z++)for(let y=-1;y<=1&&!near;y++)for(let x=-1;x<=1&&!near;x++){
    const list=buckets.get(key(bucket[0]+x,bucket[1]+y,bucket[2]+z));if(!list)continue;
    for(const q of list){if(point.reduce((a,v,k)=>a+(v-q[k])**2,0)<radius*radius){near=true;break;}}
   }
   if(near)continue;const k=key(...bucket);if(!buckets.has(k))buckets.set(k,[]);record(point,ids,w);buckets.get(k).push([...point]);
  }
 }else{
  // Controlled experiment: orientation changes, Cartesian centres do not.
  const pitch=size*3,hash=new Map();for(let i=0;i<b.vertexCount;i++){const k=key(...[0,1,2].map(j=>Math.floor(p[i*3+j]/pitch)));if(!hash.has(k))hash.set(k,[]);hash.get(k).push(i);}
  for(const cell of artifact.cells){const point=cell.bindPosition,bin=point.map(v=>Math.floor(v/pitch));let best=-1,distance=Infinity;
   for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++)for(const id of hash.get(key(bin[0]+x,bin[1]+y,bin[2]+z))??[]){const d=point.reduce((a,v,k)=>a+(v-p[id*3+k])**2,0);if(d<distance){distance=d;best=id;}}
   if(best<0)throw new RangeError('No guide vertex near canonical surface cell');record(point,[best],[1],cell);
  }
 }
 const settings={version:1,placement,spacing,candidateDensity,voxelSize:size};
 const hash=hashBytes(new TextEncoder().encode(JSON.stringify({settings,samples})));
 return frozen({...settings,samples:frozen(samples),hash,sourceArea:area,generationMs:performance.now()-started});
}
