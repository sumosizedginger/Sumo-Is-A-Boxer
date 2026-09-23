// Canonical indexed skin. Branches share boundary edges; no internal caps.
import {createTopologySurface,extractBoundaryLoops,weldTopologyVertices,stitchTopologySurfaces,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
import {anatomicalTorsoPoint} from './sumo-body-sculpt.js';
import {skullAt} from '../assets/skull-sections.js';
import {HERO_ARM_CENTERLINE} from './hero-rig.js';

export const SHOULDER_OPENING_BOTTOM=1.24;
export const SHOULDER_OPENING_TOP=1.49;
export const BODY_REGIONS=Object.freeze(Object.fromEntries(['head','neck','chest','back','abdomen','pelvis','shoulder_l','shoulder_r','upperarm_l','upperarm_r','elbow_l','elbow_r','forearm_l','forearm_r','hip_l','hip_r','thigh_l','thigh_r','knee_l','knee_r','calf_l','calf_r'].map((n,i)=>[n,i+1])));
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function lerpRows(rows,y){for(let i=0;i<rows.length-1;i++)if(y<=rows[i+1][0]){const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]));const prev=rows[Math.max(0,i-1)],next=rows[Math.min(rows.length-1,i+2)],h=b[0]-a[0];return a.slice(1).map((v,k)=>{const m0=(b[k+1]-prev[k+1])/(b[0]-prev[0]),m1=(next[k+1]-a[k+1])/(next[0]-a[0]);return (2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*b[k+1]+(t*t*t-t*t)*h*m1;});}return rows.at(-1).slice(1);}
function axial(y,t){
 if(y>=1.69){const h=skullAt(y);return [Math.cos(t)*h.width,y,h.cz+Math.sin(t)*h.depth];}
 const p=anatomicalTorsoPoint(y,t);
 if(y>1.61){const h=skullAt(1.69),blend=smooth((y-1.61)/.08);p[0]+=(Math.cos(t)*h.width-p[0])*blend;p[2]+=(h.cz+Math.sin(t)*h.depth-p[2])*blend;}
 return p;
}

function raw(position,indices){return createTopologySurface({attributes:{position},indices,forwardAxis:'+Z'});}
function joinFaces(indices,a,b){for(let i=0;i<a.length;i++){const j=(i+1)%a.length;indices.push(a[j],a[i],b[i],a[j],b[i],b[j]);}}
function cap(indices,loop,center){for(let i=0;i<loop.length;i++)indices.push(loop[(i+1)%loop.length],loop[i],center);}

// The inferior axilla must reach the humerus without an S-shaped reversal.
// Blend its monotone loft into the outward deltoid tangent above the fold.
export function shoulderBridgePoint(start,end,sign,t){
 const u=1-t,cap=smooth((start[1]-1.32)/.10);
 return start.map((value,axis)=>{
  const linearA=value+(end[axis]-value)/3,linearB=value+2*(end[axis]-value)/3;
  const curvedA=value+(axis===0?sign*.060:axis===1?(start[1]-1.425)*.45:start[2]*.16);
  const curvedB=end[axis]+(axis===1?.065:0);
  const a=linearA+(curvedA-linearA)*cap,b=linearB+(curvedB-linearB)*cap;
  return u*u*u*value+3*u*u*t*a+3*u*t*t*b+t*t*t*end[axis];
 });
}

export function generateContinuousBody(landmarks,{widthScale=1,leftArmScale=1}={}){
  if(![widthScale,leftArmScale].every(v=>Number.isFinite(v)&&v>=.8&&v<=1.2))throw new Error('Body shape scale must be finite and between .8 and 1.2');
  const N=64,position=[],indices=[],rings=[],ys=[];
  const vertex=p=>{const i=position.length/3;position.push(...p);return i;};
  // Fixed row counts and labels, independent of shape parameters.
  for(let j=0;j<=57;j++)ys.push(.95+j*.01);
  for(let j=1;j<=66;j++)ys.push(1.52+j*.005);
  ys.push(1.855,1.858);
  for(const y of ys)rings.push(Array.from({length:N},(_,i)=>vertex(axial(y,i/N*Math.PI*2))));
  for(let j=0;j<rings.length-1;j++)for(let i=0;i<N;i++){
    // Two actual rectangular openings in the lateral upper thorax.
    if(ys[j]>=SHOULDER_OPENING_BOTTOM&&ys[j]<SHOULDER_OPENING_TOP&&((i>=58||i<6)||(i>=26&&i<38)))continue;
    const k=(i+1)%N,a=rings[j][i],b=rings[j][k],c=rings[j+1][i],d=rings[j+1][k];indices.push(a,c,d,a,d,b);
  }
  const top=rings.at(-1),crown=vertex([0,1.86,-.013]);
  // Close only the exterior crown pole. No cap exists at the jaw or neck.
  cap(indices,top,crown);
  // Pelvic saddle: front and rear midline are joined by a shared crotch chain.
  // Each side owns half the torso rim and the opposite side of that chain.
  const bottom=rings[0],pF=axial(.95,Math.PI/2),pR=axial(.95,3*Math.PI/2),crotch=[];
  for(let i=1;i<8;i++){const t=i/8;crotch.push(vertex([0,.95-.085*Math.sin(Math.PI*t),pF[2]*(1-t)+pR[2]*t]));}
  const legLoops=[];
  const left=[bottom[48],...Array.from({length:32},(_,i)=>bottom[(49+i)%64]),...crotch];
  const right=[bottom[16],...Array.from({length:32},(_,i)=>bottom[17+i]),...[...crotch].reverse()];
  const legCenterX=.182,legCenterZ=-.015,legRadiusX=.156,legRadiusZ=.176;
  for(const [side,sign,loop] of [['l',1,left.reverse()],['r',-1,right.reverse()]]){
    const next=loop.map((id,i)=>{const p=position.slice(id*3,id*3+3),angle=Math.atan2(p[2]-legCenterZ,p[0]-sign*legCenterX);return vertex([sign*legCenterX+Math.cos(angle)*legRadiusX,.845,Math.sin(angle)*legRadiusZ+legCenterZ]);});
    joinFaces(indices,loop,next);legLoops.push({side,sign,vertices:next});
  }
  // Compact only unused vertices inside the removed shoulder windows.
  let compact=weldTopologyVertices(raw(position,indices),{candidatePairs:[]}),surface=compact.surface;
  const shoulderLoops=extractBoundaryLoops(surface).filter(l=>l.centroid[1]>1.3);
  if(shoulderLoops.length!==2)throw new Error('Canonical shoulder boundary identity failed');
  const domains=Array(surface.attributes.position.length/3).fill('axial');
  for(const l of legLoops)for(const i of l.vertices)domains[compact.oldToNew[i]]='leg_'+l.side;
  const legBoundaries=legLoops.map(l=>({...l,vertices:l.vertices.map(i=>compact.oldToNew[i])}));
  const branches=[...shoulderLoops.map(l=>({kind:'arm',side:l.centroid[0]>0?'l':'r',sign:l.centroid[0]>0?1:-1,vertices:l.vertices})),...legBoundaries.map(l=>({...l,kind:'leg'}))];
  for(const branch of branches){
    const {kind,side,sign}=branch,key=side==='l'?'L':'R',loop=branch.vertices,count=loop.length;
    // Previous stitches append vertices, preserving all original boundary ids.
    const base=loop.map(i=>Array.from(surface.attributes.position.slice(i*3,i*3+3)));
    const out=[],faces=[],rows=[];
    const push=p=>{const id=out.length/3;out.push(...p);return id;};
    let angles,shapeRows,begin,end;
    if(kind==='arm'){
      angles=base.map(p=>Math.atan2(p[2]/.150,(p[1]-(SHOULDER_OPENING_BOTTOM+SHOULDER_OPENING_TOP)/2)/((SHOULDER_OPENING_TOP-SHOULDER_OPENING_BOTTOM)/2)));
      const e=landmarks['elbow.'+key].y,w=landmarks['wrist.'+key].y;
      shapeRows=[
        [w-.165, .052, .040],
        [w-.125, .066, .046],
        [w-.085, .064, .048],
        [w-.045, .055, .044],
        [w,      .044, .040],
        [w+.06,  .076, .070],
        [e-.10,  .095, .088],
        [e-.04,  .092, .086],
        [e,      .086, .080],
        [e+.04,  .096, .090],
        [e+.12,  .120, .145],
        [1.35,   .117, .170],
        [1.385,  .118, .180]
      ];
      begin=1.33;end=w-.165;
    }else{
      angles=base.map(p=>Math.atan2(p[2]-legCenterZ,p[0]-sign*legCenterX));
      const k=landmarks['knee.'+key].y,a=landmarks['ankle.'+key].y;
      shapeRows=[
        [0.015,  .080, .145],
        [0.035,  .078, .138],
        [0.060,  .076, .122],
        [a,      .082, .090],
        [a+.08,  .115, .120],
        [a+.16,  .125, .127],
        [a+.24,  .132, .135],
        [k-.12,  .130, .135],
        [k-.05,  .113, .115],
        [k,      .115, .120],
        [k+.06,  .128, .140],
        [k+.16,  .172, .176],
        [.74,    .185, .188],
        [.845,   .192, .195]
      ];
      begin=.827;end=.105;
    }
    const ringAt=(y)=>{
      const [w,d]=lerpRows(shapeRows,y);
      return angles.map(t=>{
        const ct=Math.cos(t), st=Math.sin(t);
        let x, z;
        if(kind==='arm'){
          const e=landmarks['elbow.'+key].y,wr=landmarks['wrist.'+key].y;
          const elbowX=sign*HERO_ARM_CENTERLINE.elbowX,wristX=sign*HERO_ARM_CENTERLINE.wristX,shoulderX=sign*HERO_ARM_CENTERLINE.shoulderX;
          x=y>=e?elbowX+(shoulderX-elbowX)*clamp((y-e)/(1.385-e)):elbowX+(wristX-elbowX)*clamp((e-y)/(e-wr));
          if(y<wr){
            x=wristX+(sign*HERO_ARM_CENTERLINE.handX-wristX)*clamp((wr-y)/.165);
          }
          let dx=sign*ct*w, dz=st*d-.008-.030*smooth((y-e)/.20);
          // The humerus sits medial to the deltoid's outer mass.
          dx*=1-smooth((y-e)/.14)*(.175-.125*ct);
          if(y<wr){
            const ht=clamp((wr-y)/.165),palm=Math.sin(Math.PI*Math.min(1,ht/.90));
            dx=sign*Math.sign(ct)*Math.pow(Math.abs(ct),.62)*w;
            dz=Math.sign(st)*Math.pow(Math.abs(st),.72)*d-.008;
            const thumb=Math.exp(-(((ht-.40)/.18)**2))*Math.pow(Math.max(0,-ct),6);
            dx-=sign*.012*thumb;dz+=.009*thumb;
            dz-=.012*palm*Math.max(0,-st);
          }
          // Oblique humeral section: deltoid summit above the medial axilla.
          const shoulderRise=.080*smooth((y-e)/.26);
          return [x+dx,y+ct*shoulderRise,dz];
        } else {
          const k=landmarks['knee.'+key].y,a=landmarks['ankle.'+key].y;
          let lx=sign*legCenterX, lz=legCenterZ;
          let dx=ct*w, dz=st*d;
          if(y<k&&st>0)dz*=1-.22*smooth((k-y)/.11);
          // Medial adductor fullness (massive inner thighs filling groin)
          if(y>0.66&&y<0.84&&ct*sign<0){
            const ay=Math.sin((y-0.66)/0.18*Math.PI);
            dx-=sign*0.016*ay*Math.abs(ct);
          }
          // Knee patella and popliteal shaping
          if(y>k-0.07&&y<k+0.07){
            const ky=Math.sin((y-k+0.07)/0.14*Math.PI);
            if(st>0) dz+=0.008*ky*st;
            if(st<0) dz+=0.008*ky*Math.abs(st);
          }
          // Calf gastrocnemius medial fullness
          if(y>a+0.06&&y<k-0.02){
            const cy=Math.sin((y-a-0.06)/(k-a-0.08)*Math.PI);
            if(st<0){
              const medialBias = ct*sign < 0 ? 0.018 : 0.010;
              dz-=medialBias*cy*Math.abs(st);
            }
          }
          // Foot shaping below ankle
          if(y<a){
            const footT=clamp((a-y)/(a-0.015));
            lz=legCenterZ+0.022*footT;
            if(st<0) dz-=(0.060+0.020*Math.abs(st))*footT;
            if(st>0) {
              dz+=(0.086+0.028*st)*footT;
              if(ct*sign<0) dz+=0.026*footT*Math.max(0,-ct*sign);
            }
            if(ct*sign>0&&y<0.05) dx+=sign*0.016*footT;
          }
          let finalX = lx + dx;
          if (finalX * sign < 0.008) finalX = sign * 0.008;
          return [finalX,y,lz+dz];
        }
      });
    };
    const target=ringAt(begin);
    const transition=kind==='arm'?8:1;
    for(let j=1;j<=transition;j++){
      const t=j/transition;
      rows.push(base.map((p,i)=>push(kind==='arm'
        ?shoulderBridgePoint(p,target[i],sign,t)
        :p.map((v,k)=>v+(target[i][k]-v)*t))));
    }
    const steps=kind==='arm'?72:96;
    for(let j=1;j<=steps;j++)rows.push(ringAt(begin+(end-begin)*j/steps).map(push));
    let footStart=Infinity;
    if(kind==='leg'){
      footStart=out.length/3;
      // Heel to toe: transport the ankle ring toward +Z without reversing its outward winding.
      // The anterior half rises over the instep; the posterior half becomes the sole.
      for(let j=1;j<=24;j++){
        const t=j/24,turn=clamp(t/.65),cy=.105-.070*turn-.012*smooth((t-.65)/.35),cz=-.015+.238*t;
        const rw=.070+.015*Math.exp(-2*((t-.70)/.22)**2)-.015*Math.exp(-2*((t-.35)/.16)**2),rd=.090*(1-turn)+(.038-.013*smooth((t-.60)/.40))*turn;
        rows.push(angles.map(angle=>{
          const c=Math.cos(angle),sn=Math.sin(angle),localX=c*rw;
          const heel=Math.sin(Math.PI*clamp(t/.45))**2*Math.max(0,-sn);
          const bend=turn*Math.PI/2,yy=cy+sn*rd*Math.sin(bend)-.075*heel,zz=cz+sn*rd*Math.cos(bend)+.016*Math.max(0,-c*sign)*turn-.030*heel;
          return push([sign*legCenterX+localX,Math.max(0,yy),zz]);
        }));
      }
    }
    for(let j=0;j<rows.length-1;j++)joinFaces(faces,rows[j],rows[j+1]);
    const last=rows.at(-1),center=[0,0,0];for(const id of last)for(let k=0;k<3;k++)center[k]+=out[id*3+k]/count;
    if(kind==='arm') center[1]-=.008;
    else center[2]+=.008;
    cap(faces,last,push(center));
    domains.push(...Array.from({length:out.length/3},(_,i)=>(i>=footStart?'foot':kind)+'_'+side));
    const section=raw(out,faces),opening=extractBoundaryLoops(section)[0];
    const offset=opening.vertices.indexOf(0);
    surface=stitchTopologySurfaces(surface,section,{loopA:loop,loopB:opening.vertices,mode:'bridge',offset,normalPolicy:'preserve',partId:'join-'+kind+'-'+side}).surface;
  }
  // Thumb topology: remove one medial palm patch per hand and grow a closed
  // taper from its actual boundary, preserving a single external skin.
  for(const sign of [1,-1]){
    const side=sign>0?'l':'r',wr=landmarks['wrist.'+(sign>0?'L':'R')].y,p=surface.attributes.position;
    const inside=id=>domains[id]==='arm_'+side&&p[id*3]*sign<.425&&Math.hypot((p[id*3+1]-(wr-.065))/.036,(p[id*3+2]-.005)/.030)<1;
    const ix=[];for(let i=0;i<surface.indices.length;i+=3)if(![0,1,2].every(k=>inside(surface.indices[i+k])))ix.push(...surface.indices.slice(i,i+3));
    const compact=weldTopologyVertices(raw(p,ix),{candidatePairs:[],normalPolicy:'recompute'});
    const remapped=Array(compact.surface.attributes.position.length/3);compact.oldToNew.forEach((id,i)=>{if(id>=0)remapped[id]=domains[i];});domains.length=0;domains.push(...remapped);surface=compact.surface;
    const loop=extractBoundaryLoops(surface)[0];if(!loop)throw new Error('Missing thumb opening '+side);
    const base=loop.vertices.map(i=>Array.from(surface.attributes.position.slice(i*3,i*3+3))),center=loop.centroid,pos=[],ix2=[],rows=[];
    for(let j=1;j<=10;j++){
      const t=j/10,scale=t<.65?1-.18*smooth(t/.65):.82*Math.sqrt(Math.max(.03,1-((t-.65)/.38)**2)),row=[];
      const tilt=.85*smooth(t/.45),cy=center[1]-.052*t,cx=center[0]-sign*.043*Math.sin(t*Math.PI/2);
      for(const p of base){row.push(pos.length/3);const transverse=(p[1]-center[1])*scale;pos.push(cx+(p[0]-center[0])*scale*(1-smooth(t/.3))-sign*transverse*Math.sin(tilt),cy+transverse*Math.cos(tilt),center[2]+(p[2]-center[2])*scale+.025*t);}
      rows.push(row);if(j>1)joinFaces(ix2,rows[j-2],row);
    }
    const pole=pos.length/3;pos.push(center[0]-sign*.044,center[1]-.058,center[2]+.026);cap(ix2,rows.at(-1),pole);
    const patch=weldTopologyVertices(raw(pos,ix2),{candidatePairs:[],normalPolicy:'recompute'}).surface,opening=extractBoundaryLoops(patch)[0];
    surface=stitchTopologySurfaces(surface,patch,{loopA:loop.vertices,loopB:opening.vertices,offset:opening.vertices.indexOf(0),mode:'bridge',partId:'thumb-'+side}).surface;
    domains.push(...Array(pos.length/3).fill('arm_'+side));
  }
  const neighbors=Array.from({length:surface.attributes.position.length/3},()=>new Set());
  for(let i=0;i<surface.indices.length;i+=3){const t=surface.indices.slice(i,i+3);for(let j=0;j<3;j++){neighbors[t[j]].add(t[(j+1)%3]);neighbors[t[j]].add(t[(j+2)%3]);}}
  let source=surface.attributes.position;
  for(let pass=0;pass<16;pass++){
    const next=new Float32Array(source);
    for(let i=0;i<neighbors.length;i++){
      const y=source[i*3+1],band=(y>1.34&&y<1.61)||(y>.82&&y<1.06),amount=band?.42:pass<8?.30:0;
      if(!amount)continue;
      for(let k=0;k<3;k++){let mean=0;for(const j of neighbors[i])mean+=source[j*3+k];mean/=neighbors[i].size;next[i*3+k]+=amount*(mean-source[i*3+k]);}
    }source=next;
  }
  surface.attributes.position=source;
  // Shape parameters never change index identity, and left shaping is independent.
  const p=surface.attributes.position;
  for(let i=0;i<p.length;i+=3){p[i]*=widthScale;if(p[i]>.24&&p[i+1]<1.5)p[i]+=(leftArmScale-1)*(p[i]-.24);}
  surface=weldTopologyVertices(surface,{candidatePairs:[],normalPolicy:'recompute'}).surface;
  const report=validateTopology(surface,{policy:HERO_BODY_TOPOLOGY_POLICY});
  if(!report.valid)throw new Error('Continuous body topology rejected: '+JSON.stringify(report.diagnostics));
  surface.metadata={...surface.metadata,template:'hero-skin-indexed-v1',domains};
  return {surface,report,template:'hero-skin-indexed-v1'};
}

export function skinContinuousBody(surface,character){
  const p=surface.attributes.position,n=p.length/3,L=character.landmarks;
  const ids=Object.fromEntries(character.bones.map((b,i)=>[b.name,i]));
  const regionId=new Uint32Array(n),surfaceId=new Uint32Array(n).fill(1),uv=new Float32Array(n*2),skinIndex=new Uint32Array(n*4),skinWeight=new Float32Array(n*4);
  const vertexSides = new Array(n);
  for(let i=0;i<n;i++){
    const x=p[i*3],y=p[i*3+1],z=p[i*3+2];
    const domain=surface.metadata.domains[i];
    const side=domain.endsWith('_l')?'l':domain.endsWith('_r')?'r':(x>=0?'l':'r');
    vertexSides[i]=side;
    const key=side==='l'?'L':'R',ax=Math.abs(x);let region,w;
    const arm=domain.startsWith('arm_'),leg=domain.startsWith('leg_')||domain.startsWith('foot_');
    if(arm){
      const e=L['elbow.'+key].y, wLandmark=L['wrist.'+key].y;
      const t=smooth((y-e+.09)/.18);
      region=y>1.40?'shoulder_'+side:Math.abs(y-e)<.055?'elbow_'+side:y>e?'upperarm_'+side:'forearm_'+side;
      const attach=smooth((y-1.35)/.17)*(1-smooth((ax-.155)/.14));
      const handT = y < wLandmark ? smooth((wLandmark - y) / 0.12) : 0;
      const handBone = 'hand_' + side, forearmBone = 'forearm_' + side;
      w=[
        [handBone, handT * (1 - attach)],
        [forearmBone, (1 - handT) * (1 - t) * (1 - attach)],
        ['upperarm_'+side, t*(1-attach)],
        ['shoulder_'+side, attach*.6]
      ];
      if (attach > 0) {
        // distribute chest influence
        w[3][1] = attach * 0.35;
        w.push(['chest', attach * 0.25]);
      }
    }else if(leg){
      const k=L['knee.'+key].y, aLandmark=L['ankle.'+key].y;
      const t=smooth((y-k+.10)/.20),hip=smooth((y-.78)/.18);
      region=y>.80?'hip_'+side:Math.abs(y-k)<.065?'knee_'+side:y>k?'thigh_'+side:'calf_'+side;
      // Blend through the shared ankle boundary, rather than switching by domain.
      const footT = smooth((aLandmark + .08 - y) / .07);
      const footBone = 'foot_' + side, shinBone = 'shin_' + side;
      w=[
        [footBone, footT * (1 - hip)],
        [shinBone, (1 - footT) * (1 - t) * (1 - hip)],
        ['thigh_'+side, t*(1-hip)],
        ['pelvis', hip]
      ];
    }else{
      region=y>1.67?'head':y>1.54?'neck':y<1.10?'pelvis':y<1.28?'abdomen':z<0?'back':'chest';
      const stations=[['pelvis',1.01],['spine',1.19],['chest',1.45],['neck',1.61],['head',1.70]];w=[['head',1]];
      for(let j=0;j<stations.length-1;j++)if(y<=stations[j+1][1]){const t=smooth((y-stations[j][1])/(stations[j+1][1]-stations[j][1]));w=[[stations[j][0],1-t],[stations[j+1][0],t]];break;}
    }
    // Torso vertices must not switch wholesale to arm skinning at a Y row.
    // Only the lateral clavicle/axilla blends toward the humerus; anterior
    // pectorals and posterior lats retain thoracic authority.
    if(domain==='axial'){
      const attachment=smooth((ax-.23)/.13)*(1-smooth(Math.abs(z)/.20))
        *smooth((y-(SHOULDER_OPENING_BOTTOM-.01))/.12)*(1-smooth((y-1.50)/.10));
      if(attachment>0){
        w=w.map(([bone,weight])=>[bone,weight*(1-attachment)]);
        w.push(['upperarm_'+side,attachment*.70],['shoulder_'+side,attachment*.30]);
        if(attachment>.3)region='shoulder_'+side;
      }
    }
    regionId[i]=BODY_REGIONS[region];
    const top4 = w.filter(v=>v && v[1]>0).sort((a,b)=>b[1]-a[1]).slice(0,4);
    const sum = top4.reduce((acc,v)=>acc+v[1],0) || 1;
    for(let j=0;j<4;j++){skinIndex[i*4+j]=ids[top4[j]?.[0]]??0;skinWeight[i*4+j]=(top4[j]?.[1]??0)/sum;}
    uv[i*2]=.5+x+.23*z;uv[i*2+1]=(y+.071*z)/1.86;
  }
  // Relax the weight field across shared junctions, not across separate shells.
  // This removes categorical axial/branch discontinuities without adding PSD.
  const adjacency=Array.from({length:n},()=>new Set());for(let i=0;i<surface.indices.length;i+=3){const t=surface.indices.slice(i,i+3);for(let j=0;j<3;j++){adjacency[t[j]].add(t[(j+1)%3]);adjacency[t[j]].add(t[(j+2)%3]);}}
  const B=character.bones.length;let field=new Float32Array(n*B);
  for(let i=0;i<n;i++)for(let j=0;j<4;j++)field[i*B+skinIndex[i*4+j]]+=skinWeight[i*4+j];
  for(let pass=0;pass<24;pass++){
    const next=new Float32Array(field);
    for(let i=0;i<n;i++){
      const y=p[i*3+1];if(!((y>SHOULDER_OPENING_BOTTOM-.07&&y<1.62)||(y>.81&&y<1.07)))continue;
      for(let b=0;b<B;b++){
        const name=character.bones[b].name,wrong=(vertexSides[i]==='l'&&name.endsWith('_r'))||(vertexSides[i]==='r'&&name.endsWith('_l'));
        if(wrong){next[i*B+b]=0;continue;}
        let mean=0;for(const j of adjacency[i])mean+=field[j*B+b];mean/=adjacency[i].size;next[i*B+b]=field[i*B+b]*.5+mean*.5;
      }
    }field=next;
  }
  for(let i=0;i<n;i++){
    const best=Array.from({length:B},(_,b)=>[b,field[i*B+b]]).filter(v=>v[1]>0).sort((a,b)=>b[1]-a[1]||a[0]-b[0]).slice(0,4),sum=best.reduce((a,b)=>a+b[1],0);
    for(let j=0;j<4;j++){skinIndex[i*4+j]=best[j]?.[0]??0;skinWeight[i*4+j]=(best[j]?.[1]??0)/sum;}
  }
  return createTopologySurface({...surface,attributes:{...surface.attributes,regionId,surfaceId,uv,skinIndex,skinWeight}});
}
