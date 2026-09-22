/** Canonical-cell-preserving guide projection. No occupancy data is modified. */
import {readMeshBuffers} from './grid.js';
import {hashBytes} from '../geometry/mesh-codec.js';
import {surfaceFrame} from './surface-frame.js';
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const length=Math.hypot(...a);if(!Number.isFinite(length)||length<1e-12)throw new RangeError('Undefined coherent surface normal');return a.map(v=>v/length);};
const key=(x,y,z)=>x+','+y+','+z;
const freeze=a=>Object.freeze(a);

// Closest point in the seven Voronoi regions of a nondegenerate triangle.
function closest(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return [1,0,0];
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)return [0,1,0];
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [1-v,v,0];}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)return [0,0,1];
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [1-w,0,w];}
 const va=d3*d6-d5*d4;
 if(va<=0&&d4-d3>=0&&d5-d6>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return [0,1-w,w];}
 const inverse=1/(va+vb+vc),v=vb*inverse,w=vc*inverse;return [1-v-w,v,w];
}
function distanceToBox(p,node){let d=0;for(let k=0;k<3;k++){const v=Math.max(node.min[k]-p[k],0,p[k]-node.max[k]);d+=v*v;}return d;}
function tree(triangles){
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const t of triangles)for(let k=0;k<3;k++){min[k]=Math.min(min[k],t.min[k]);max[k]=Math.max(max[k],t.max[k]);}
 const node={min,max};if(triangles.length<=12){node.triangles=triangles;return node;}
 let axis=0;for(let k=1;k<3;k++)if(max[k]-min[k]>max[axis]-min[axis])axis=k;
 triangles.sort((a,b)=>(a.min[axis]+a.max[axis])-(b.min[axis]+b.max[axis])||a.id-b.id);
 const mid=triangles.length>>1;node.left=tree(triangles.slice(0,mid));node.right=tree(triangles.slice(mid));return node;
}
function nearest(root,p){
 let best=Infinity,result=null;
 function visit(node){
  if(distanceToBox(p,node)>best+1e-20)return;
  if(node.triangles){for(const t of node.triangles){
   const weights=closest(p,...t.points),point=[0,1,2].map(k=>t.points.reduce((sum,v,j)=>sum+v[k]*weights[j],0)),delta=sub(point,p),distance=dot(delta,delta);
   if(distance<best||(distance===best&&t.id<result.triangle.id)){best=distance;result={triangle:t,point,weights};}
  }return;}
  const left=distanceToBox(p,node.left),right=distanceToBox(p,node.right);
  if(left<=right){visit(node.left);visit(node.right);}else{visit(node.right);visit(node.left);}
 }
 visit(root);return result;
}
export function compileCoherentSurface(mesh,artifact,{
 projection=.35,smoothing=2,quantization=10,orientation='surface',overlap=1.04
}={}){
 if(!Number.isFinite(projection)||projection<0||projection>.45)throw new RangeError('Projection must be between 0 and .45 pitches');
 if(!Number.isInteger(smoothing)||smoothing<0||smoothing>8)throw new RangeError('Invalid smoothing pass count');
 if(![0,5,7.5,10,15].includes(quantization))throw new RangeError('Invalid orientation quantization');
 if(!['surface','none'].includes(orientation))throw new RangeError('Invalid coherent orientation');
 if(!Number.isFinite(overlap)||overlap<1||overlap>1.06)throw new RangeError('Overlap must be isotropic and between 1 and 1.06');
 const started=performance.now(),b=readMeshBuffers(mesh),p=b.positions,ix=b.indices,size=artifact.voxelSize,triangles=[],normals=new Float64Array(p.length);
 if(!Number.isFinite(size)||size<=0||!Array.from(p).every(Number.isFinite))throw new RangeError('Invalid coherent surface geometry');
 let sourceArea=0;
 for(let i=0;i<ix.length;i+=3){
  const ids=[ix[i],ix[i+1],ix[i+2]];
  if(!ids.every(id=>Number.isInteger(id)&&id>=0&&id<b.vertexCount))throw new RangeError('Invalid coherent triangle index');
  const points=ids.map(id=>Array.from(p.slice(id*3,id*3+3))),n=cross(sub(points[1],points[0]),sub(points[2],points[0])),length=Math.hypot(...n);
  if(length<1e-16)continue;
  sourceArea+=length/2;for(const id of ids)for(let k=0;k<3;k++)normals[id*3+k]+=n[k];
  triangles.push({id:i/3,ids,points,normal:unit(n),min:[0,1,2].map(k=>Math.min(...points.map(v=>v[k]))),max:[0,1,2].map(k=>Math.max(...points.map(v=>v[k])))});
 }
 if(!triangles.length)throw new RangeError('Coherent surface has no nondegenerate triangles');
 for(let i=0;i<normals.length;i+=3){const length=Math.hypot(normals[i],normals[i+1],normals[i+2]);if(length>1e-12)for(let k=0;k<3;k++)normals[i+k]/=length;}
 const bvh=tree(triangles),samples=[],index=new Map();
 artifact.cells.forEach((cell,i)=>index.set(key(cell.x,cell.y,cell.z),i));
 for(const cell of artifact.cells){
  if(!cell.bindPosition.every(Number.isFinite))throw new RangeError('Non-finite canonical center');
  const hit=nearest(bvh,cell.bindPosition),delta=sub(hit.point,cell.bindPosition),distance=Math.hypot(...delta),amount=distance>0?Math.min(1,size*projection/distance):0;
  let normal=[0,1,2].map(k=>hit.triangle.ids.reduce((sum,id,j)=>sum+normals[id*3+k]*hit.weights[j],0));
  if(Math.hypot(...normal)<1e-12)normal=hit.triangle.normal;
  samples.push({bindPosition:freeze(cell.bindPosition.map((v,k)=>v+delta[k]*amount)),rawNormal:freeze(unit(normal)),
   canonicalCell:freeze([cell.x,cell.y,cell.z]),regionId:cell.regionId,skinIndex:cell.skinIndex,skinWeight:cell.skinWeight,color:cell.color,
   sourceVertices:freeze([...hit.triangle.ids]),barycentric:freeze(hit.weights),sourcePoint:freeze(hit.point)});
 }
 // 26-cell adjacency follows the canonical shell, not a second sample cloud.
 // Reject neighbors across sharp/opposed sheets before smoothing.
 const neighbors=artifact.cells.map((cell,i)=>{
  const result=[];for(let z=-1;z<=1;z++)for(let y=-1;y<=1;y++)for(let x=-1;x<=1;x++){
   if(!x&&!y&&!z)continue;const j=index.get(key(cell.x+x,cell.y+y,cell.z+z));
   if(j!==undefined&&dot(samples[i].rawNormal,samples[j].rawNormal)>.5)result.push([j,1/Math.hypot(x,y,z)]);
  }return result;
 });
 let field=samples.map(s=>s.rawNormal);
 for(let pass=0;pass<smoothing;pass++)field=field.map((normal,i)=>{
  const n=normal.map(v=>v*2);for(const [j,w]of neighbors[i])for(let k=0;k<3;k++)n[k]+=field[j][k]*w;return unit(n);
 });
 const step=quantization*Math.PI/180;
 for(let i=0;i<samples.length;i++){
  let normal=field[i];
  if(orientation==='none')normal=[0,0,1];
  else if(step){const azimuth=Math.round(Math.atan2(normal[0],normal[2])/step)*step,elevation=Math.round(Math.asin(Math.max(-1,Math.min(1,normal[1])))/step)*step;normal=[Math.sin(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.cos(azimuth)*Math.cos(elevation)];}
  samples[i]=freeze({...samples[i],...surfaceFrame(normal)});
 }
 const settings={version:2,placement:'coherentSurface',projection,smoothing,quantization,orientation,overlap,voxelSize:size};
 const hash=hashBytes(new TextEncoder().encode(JSON.stringify({settings,samples})));
 return freeze({...settings,samples:freeze(samples),sourceArea,hash,generationMs:performance.now()-started});
}
