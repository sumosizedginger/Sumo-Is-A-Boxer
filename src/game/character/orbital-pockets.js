import {headSideX} from './head-profile.js';
import {
  createTopologySurface, extractBoundaryLoops, weldTopologyVertices,
  stitchTopologySurfaces, rebuildSculptNormals, relaxSculptSurface, createFeatureFrame, ridgeSculptField, ellipsoidSculptField, applySculptFields, refineSculptTopology
} from '@sumosizedginger/my-game-engine-1.0/full';

function regularizeAngles(raw){
  const steps=raw.map((a,i)=>Math.max(.0005,Math.atan2(Math.sin(raw[(i+1)%raw.length]-a),Math.cos(raw[(i+1)%raw.length]-a))));
  const sum=steps.reduce((a,b)=>a+b,0);let angle=raw[0];
  return steps.map(step=>{const value=angle;angle+=step/sum*Math.PI*2;return value;});
}

function correspondence(angles,count){
 return {a:angles.map((_,i)=>i===0?0:(angles[0]+2*Math.PI-angles[angles.length-i])/(2*Math.PI)),b:Array.from({length:count},(_,i)=>i/count)};
}
function sampleBoundary(surface,boundary,angles,angle){
 const start=angles[0],end=start+Math.PI*2;while(angle>=end)angle-=Math.PI*2;while(angle<start)angle+=Math.PI*2;
 let i=0;while(i<angles.length-1&&angles[i+1]<angle)i++;
 const next=(i+1)%angles.length,t=(angle-angles[i])/((next===0?end:angles[next])-angles[i]);
 const n=boundary.vertices.length,a=boundary.vertices[(n-i)%n]*3,b=boundary.vertices[(n-next)%n]*3,p=surface.attributes.position;
 return [0,1,2].map(k=>p[a+k]+(p[b+k]-p[a+k])*t);
}

// Replace canonical rectangular orbital patches with concentric eyelid flow.
// The recessed disk is facial skin, sharing every boundary with the skull.
// Selection uses the unsculpted template so identity parameters cannot change
// topology. Eyeballs occlude the inner pocket, never an unrelated hidden cap.
export function orbitalCutMask(surface) {
  const p=surface.attributes.position;
  const inside=i=>p[i*3+2]>.025&&Math.hypot((Math.abs(p[i*3])-.031)/.026,(p[i*3+1]-1.758)/.021)<1;
  return {reference:new Float32Array(p),removed:Array.from({length:surface.indices.length/3},(_,i)=>
    [0,1,2].every(k=>inside(surface.indices[i*3+k])))};
}

export function stitchOrbitalPockets(input,cut,landmarks) {
  const indices=[];
  for(let i=0;i<input.indices.length/3;i++)if(!cut.removed[i])indices.push(...input.indices.slice(i*3,i*3+3));
  const compact=weldTopologyVertices(createTopologySurface({
    attributes:{position:input.attributes.position},indices,forwardAxis:'+Z'
  }),{candidatePairs:[],normalPolicy:'recompute'});
  let surface=compact.surface;
  const domains=Array(surface.attributes.position.length/3),original=[];
  compact.oldToNew.forEach((id,i)=>{if(id>=0){domains[id]=input.metadata.domains[i];original[id]=i;}});
  for(const side of ['L','R']){
    const center=landmarks['eyeCenter.'+side],sign=side==='L'?1:-1;
    const boundary=extractBoundaryLoops(surface).find(loop=>Math.sign(loop.centroid[0])===sign);
    if(!boundary)throw new Error('Missing canonical orbital boundary '+side);
    const boundaryCount=boundary.vertices.length,count=96,position=[],triangles=[];
    const angles=regularizeAngles(boundary.vertices.map((_,j)=>{const id=original[boundary.vertices[(boundaryCount-j)%boundaryCount]];return Math.atan2((cut.reference[id*3+1]-1.758)/.021,(cut.reference[id*3]-sign*.031)/.026);}));
    // Outer skin transition, orbital rim, upper/lower lid margin, pocket wall.

    const rings=[[.0158,.0087],[.0134,.0054],[.0127,.0047],[.0118,.0042],[.007,.0025]],transitions=5,totalRows=transitions+rings.length;
    function ringPoint(row,j){
      const [rx,ry]=rings[row],angle=angles[0]+j/count*Math.PI*2+.005,dx=Math.cos(angle)*rx,dy=Math.sin(angle)*ry*(Math.sin(angle)>0?.80:.90)+sign*dx*.055;
      const globe=center[2]+Math.sqrt(Math.max(0,.0128**2-dx*dx-dy*dy));
      const z=row===0?Math.max(.061+.008*Math.max(0,Math.sin(angle)),globe+.002):row===1?globe+.0016:row===2?globe+.0009:row===3?globe-.006:center[2]-.007;
      return [center[0]+dx,center[1]+dy,z];
    }
    for(let row=0;row<totalRows;row++){
      for(let j=0;j<count;j++){
        let point;
        if(row<transitions){
          const start=sampleBoundary(surface,boundary,angles,angles[0]+j/count*Math.PI*2+.005),end=ringPoint(0,j),t=(row+1)/(transitions+1),ease=t*t*(3-2*t);
          point=start.map((v,k)=>v+(end[k]-v)*(k===2?ease:t));
        }else point=ringPoint(row-transitions,j);
        position.push(...point);
      }
      if(row)for(let j=0;j<count;j++){
        const k=(j+1)%count,a=(row-1)*count+j,b=(row-1)*count+k,c=row*count+j,d=row*count+k;triangles.push(a,b,d,a,d,c);
      }
    }
    const pole=position.length/3;position.push(center[0],center[1],center[2]-.009);
    for(let j=0;j<count;j++)triangles.push((totalRows-1)*count+j,(totalRows-1)*count+(j+1)%count,pole);
    const patch=createTopologySurface({attributes:{position},indices:triangles,forwardAxis:'+Z'});
    const opening=extractBoundaryLoops(patch)[0];
    const offset=opening.vertices.indexOf(0);
    // Both inputs carry normals through the public stitching seam.
    surface=stitchTopologySurfaces(surface,rebuildSculptNormals(patch),{
      loopA:boundary.vertices,loopB:opening.vertices,offset,mode:'bridge',loopParameters:correspondence(angles,count),partId:'orbital-'+side
    }).surface;
    domains.push(...Array(position.length/3).fill('axial'));
  }
  surface.metadata={...input.metadata,domains};
  return relaxSculptSurface(surface,{iterations:12,strength:.45,tangential:false,
    mask:p=>p[2]>.025&&Math.abs(p[1]-1.758)<.027&&Math.abs(Math.abs(p[0])-.031)<.032?1:0,
    featureMask:p=>{const side=p[0]>0?'L':'R',center=landmarks['eyeCenter.'+side];return Math.hypot((p[0]-center[0])/.0148,(p[1]-center[1])/.007)<1?1:0;}
  });
}

export function stitchAuricularPatches(input){
  const p=input.attributes.position,indices=[];
  const inside=i=>Math.abs(p[i*3])>.055&&Math.hypot((p[i*3+2]+.013)/.029,(p[i*3+1]-1.740)/.037)<1;
  for(let i=0;i<input.indices.length;i+=3)if(![0,1,2].every(k=>inside(input.indices[i+k])))indices.push(...input.indices.slice(i,i+3));
  const compact=weldTopologyVertices(createTopologySurface({attributes:{position:p},indices,forwardAxis:'+Z'}),{candidatePairs:[],normalPolicy:'recompute'});
  let surface=compact.surface;
  const domains=Array(surface.attributes.position.length/3);
  compact.oldToNew.forEach((id,i)=>{if(id>=0)domains[id]=input.metadata.domains[i];});
  for(const sign of [1,-1]){
    const boundary=extractBoundaryLoops(surface).find(l=>Math.sign(l.centroid[0])===sign);
    if(!boundary)throw new Error('Missing auricular boundary');
    const boundaryCount=boundary.vertices.length,count=96,position=[],faces=[];
    const angles=regularizeAngles(boundary.vertices.map((_,j)=>{const id=boundary.vertices[(boundaryCount-j)%boundaryCount],p=surface.attributes.position;return Math.atan2((p[id*3+1]-1.740)/.037,-sign*(p[id*3+2]+.013)/.029);}));
    // Side-skull attachment, helix, concha, antihelix and central bowl.

    const rows=Array.from({length:40},(_,i)=>{const r=1-i/40;return [.019*r,.029*r,.080];});
    const transitions=5,totalRows=transitions+rows.length;
    function ringPoint(row,j){
      const [rx,ry,x]=rows[row],a=angles[0]+j/count*Math.PI*2+.005,u=rx*Math.cos(a),v=ry*Math.sin(a),z=-.013-sign*u-.10*v;
      return [sign*(headSideX(1.740+v,z)+.006-.13*(z+.013)-.001*(ry/.029)*(1-Math.sin(a))-.007*(rx/.019)**2*Math.max(0,-sign*Math.cos(a))**4),1.740+v,z];
    }
    for(let row=0;row<totalRows;row++){
      for(let j=0;j<count;j++){
        let point;
        if(row<transitions){
          const start=sampleBoundary(surface,boundary,angles,angles[0]+j/count*Math.PI*2+.005),end=ringPoint(0,j),t=(row+1)/(transitions+1),ease=t*t*(3-2*t);
          point=start.map((v,k)=>v+(end[k]-v)*(k===0?ease:t));
        }else point=ringPoint(row-transitions,j);
        position.push(...point);
      }
      if(row)for(let j=0;j<count;j++){
        const k=(j+1)%count,a=(row-1)*count+j,b=(row-1)*count+k,c=row*count+j,d=row*count+k;faces.push(a,b,d,a,d,c);
      }
    }
    const pole=position.length/3;position.push(sign*.085,1.740,-.013);
    for(let j=0;j<count;j++)faces.push((totalRows-1)*count+j,(totalRows-1)*count+(j+1)%count,pole);
    const patch=rebuildSculptNormals(createTopologySurface({attributes:{position},indices:faces,forwardAxis:'+Z'}));
    const opening=extractBoundaryLoops(patch)[0],offset=opening.vertices.indexOf(0);
    surface=stitchTopologySurfaces(surface,patch,{loopA:boundary.vertices,loopB:opening.vertices,offset,loopParameters:correspondence(angles,count),partId:'auricle-'+sign}).surface;
    domains.push(...Array(position.length/3).fill('axial'));
  }
  surface.metadata={...input.metadata,domains};
  // Evaluate the auricular height surface after refinement. This gives every
  // shared sample the same smooth anatomical target, including fan midpoints.
  // Only lateral displacement changes; the certified YZ embedding is retained.
  const fields=[];
  for(const sign of [1,-1]){
    fields.push((p)=>{
      if(sign*p[0]<.055||Math.abs(p[1]-1.740)>.05||Math.abs(p[2]+.013)>.04)return [0,0,0];
      const u=(p[2]+.013+.10*(p[1]-1.740))/.019,v=(p[1]-1.740)/.029,r=Math.hypot(u,v);
      const t=Math.max(0,Math.min(1,(1.80-r)/.50)),blend=t*t*(3-2*t);
      const base=headSideX(p[1],p[2]);
      const helix=.011*Math.exp(-(((r-.86)/.16)**2))*(1-.55*Math.max(0,Math.min(1,(u+.2)/.8)));
      const bowl=-.003*Math.exp(-((r/.58)**4));
      const target=base+helix+bowl+.003*Math.exp(-(((v+.86)/.22)**2))*Math.exp(-((u/.50)**2));
      return [sign*(target-sign*p[0])*blend,0,0];
    });
    const frame=createFeatureFrame({center:[sign*.08,1.740,-.013],forward:[sign,0,0]});
    const mask=p=>sign*p[0]>.055?1:0;
    fields.push(ridgeSculptField({frame,points:[[sign*.002,-.014,0],[sign*.005,-.003,0],[sign*.003,.007,0],[-sign*.003,.018,0]],radius:.006,strength:.004,depthRadius:.05,mask}));
    fields.push(ridgeSculptField({frame,points:[[sign*.003,.007,0],[sign*.009,.015,0]],radius:.005,strength:.003,depthRadius:.05,mask}));
    fields.push(ellipsoidSculptField({frame:createFeatureFrame({center:[sign*.078,1.735,.001],forward:[sign,0,0]}),radii:[.005,.008,.03],strength:.006,direction:[0,0,1],mask}));
  }
  surface=applySculptFields(surface,fields);
  return relaxSculptSurface(surface,{iterations:12,strength:.35,tangential:true,
    mask:p=>{const r=Math.hypot((p[2]+.013)/.019,(p[1]-1.740)/.029);return Math.abs(p[0])>.055&&r>1.05&&r<1.8?Math.sin((r-1.05)/.75*Math.PI):0;}
  });
}
