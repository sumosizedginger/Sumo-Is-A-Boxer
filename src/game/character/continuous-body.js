// Canonical indexed skin. Branches share boundary edges; no internal caps.
import {createTopologySurface,extractBoundaryLoops,weldTopologyVertices,stitchTopologySurfaces,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
import {skullAt} from '../assets/skull-sections.js';

export const BODY_REGIONS=Object.freeze(Object.fromEntries(['head','neck','chest','back','abdomen','pelvis','shoulder_l','shoulder_r','upperarm_l','upperarm_r','elbow_l','elbow_r','forearm_l','forearm_r','hip_l','hip_r','thigh_l','thigh_r','knee_l','knee_r','calf_l','calf_r'].map((n,i)=>[n,i+1])));
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function lerpRows(rows,y){for(let i=0;i<rows.length-1;i++)if(y<=rows[i+1][0]){const a=rows[i],b=rows[i+1],t=clamp((y-a[0])/(b[0]-a[0]));return a.slice(1).map((v,k)=>v+(b[k+1]-v)*t);}return rows.at(-1).slice(1);}
const torsoRows=[
  [.95, .340, .295, .008],
  [1.02, .370, .326, .040],
  [1.10, .388, .348, .062],
  [1.18, .390, .352, .066],
  [1.27, .378, .335, .050],
  [1.36, .365, .306, .035],
  [1.43, .355, .280, .020],
  [1.48, .325, .252, .014],
  [1.52, .280, .224, .010],
  [1.56, .228, .195, .008],
  [1.60, .172, .168, .006],
  [1.64, .134, .142, .006],
  [1.67, .112, .122, .008]
];
function axial(y,t){const c=Math.cos(t),s=Math.sin(t);let p;
  if(y>=1.69){const h=skullAt(y);p=[h.cx+c*h.width,y,h.cz+s*h.depth];}
  else {const [w,d,z]=lerpRows(torsoRows,y);p=[c*w,y,z+s*d];if(y>1.67){const h=skullAt(1.69),a=(y-1.67)/.02;p=[p[0]*(1-a)+c*h.width*a,y,p[2]*(1-a)+(h.cz+s*h.depth)*a];}
    // Broad chest/back planes
    if(y>1.17&&y<1.50)p[2]+=.016*Math.sin((y-1.17)/.33*Math.PI)*Math.sign(s)*Math.pow(Math.abs(s),.5);
    // Sculpted pectoral plates with central sternal notch
    if(y>1.28&&y<1.48&&s>0){
      const vy=Math.sin((y-1.28)/0.20*Math.PI);
      p[2]+=s*s*(0.018+0.038*(c*c))*vy;
      if(Math.abs(c)<0.16){
        p[2]-=0.012*(1-Math.abs(c)/0.16)*vy;
      }
    }
    // Smooth, rounded abdominal volume with organic forward sweep and lower hang
    if(y>0.95&&y<1.36&&s>0){
      const v=Math.sin((y-0.95)/0.41*Math.PI);
      p[2]+=s*s*0.075*v;
    }
    // Navel / umbilical cavity
    if(y>1.09&&y<1.15&&s>0.92){
      const dy=(y-1.12)/0.03, dx=c/0.14, r2=dx*dx+dy*dy;
      if(r2<1.0)p[2]-=0.022*(1-r2)*(1-r2);
    }
    // Lateral abdominal flank / barrel core curvature
    if(y>0.98&&y<1.36&&s>0)p[0]*=(1+s*0.075*Math.sin((y-0.98)/0.38*Math.PI));
    // Powerful twin glute masses in the rear with intergluteal cleft
    if(y>0.95&&y<1.18&&s<0){
      const v=Math.sin((y-0.95)/0.23*Math.PI);
      p[2]-=Math.abs(s)*(0.022+0.048*Math.abs(c))*v;
      if(Math.abs(c)<0.14){
        p[2]+=0.016*(1-Math.abs(c)/0.14)*v;
      }
    }
    // Upper back / rhomboid & lat mass
    if(y>1.22&&y<1.50&&s<0)p[2]-=Math.abs(s)*0.026*Math.sin((y-1.22)/0.28*Math.PI);
    // Heavy sumo submental chin fold and forward jaw definition
    if(y>1.60&&y<1.67&&s>0.75){
      const vy=Math.sin((y-1.60)/0.07*Math.PI);
      p[2]+=s*(0.016+0.012*Math.abs(c))*vy;
    }
    // Square mandibular jaw angle
    if(y>1.63&&y<1.68&&Math.abs(c)>0.60){
      const vy=Math.sin((y-1.63)/0.05*Math.PI);
      p[0]*=(1+0.08*vy*Math.abs(c));
    }
    // Trapezius and nuchal neck fullness in posterior neck
    if(y>1.52&&y<1.66&&s<0){
      const vy=Math.sin((y-1.52)/0.14*Math.PI);
      p[2]-=Math.abs(s)*0.028*vy;
    }
  }return p;
}
function raw(position,indices){return createTopologySurface({attributes:{position},indices,forwardAxis:'+Z'});}
function joinFaces(indices,a,b){for(let i=0;i<a.length;i++){const j=(i+1)%a.length;indices.push(a[j],a[i],b[i],a[j],b[i],b[j]);}}
function cap(indices,loop,center){for(let i=0;i<loop.length;i++)indices.push(loop[(i+1)%loop.length],loop[i],center);}

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
    if(j>=45&&j<57&&((i>=58||i<6)||(i>=26&&i<38)))continue;
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
  const legCenterX=.168,legCenterZ=-.015,legRadiusX=.165,legRadiusZ=.178;
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
      angles=base.map(p=>Math.atan2(p[2]/.115,(p[1]-1.46)/.078));
      const e=landmarks['elbow.'+key].y,w=landmarks['wrist.'+key].y;
      shapeRows=[
        [w-.175, .042, .036],
        [w-.145, .054, .044],
        [w-.105, .066, .052],
        [w-.065, .064, .060],
        [w-.025, .068, .064],
        [w+.06,  .088, .082],
        [e-.10,  .115, .106],
        [e-.04,  .102, .095],
        [e,      .094, .088],
        [e+.04,  .108, .102],
        [e+.12,  .136, .130],
        [1.35,   .145, .138],
        [1.385,  .150, .142]
      ];
      begin=1.385;end=w-.175;
    }else{
      angles=base.map(p=>Math.atan2(p[2]-legCenterZ,p[0]-sign*legCenterX));
      const k=landmarks['knee.'+key].y,a=landmarks['ankle.'+key].y;
      shapeRows=[
        [0.018,  .072, .138],
        [0.035,  .076, .136],
        [0.060,  .080, .126],
        [a,      .096, .105],
        [a+.07,  .112, .118],
        [a+.15,  .142, .148],
        [a+.23,  .155, .162],
        [k-.14,  .160, .166],
        [k-.06,  .142, .146],
        [k,      .134, .138],
        [k+.05,  .156, .162],
        [k+.14,  .184, .190],
        [.74,    .192, .198],
        [.845,   .196, .202]
      ];
      begin=.827;end=0.018;
    }
    const ringAt=(y)=>{
      const [w,d]=lerpRows(shapeRows,y);
      return angles.map(t=>{
        const ct=Math.cos(t), st=Math.sin(t);
        let x, z;
        if(kind==='arm'){
          const e=landmarks['elbow.'+key].y,wr=landmarks['wrist.'+key].y;
          const elbowX=sign*.465,wristX=sign*.450,shoulderX=sign*.350;
          x=y>=e?elbowX+(shoulderX-elbowX)*clamp((y-e)/(1.385-e)):elbowX+(wristX-elbowX)*clamp((e-y)/(e-wr));
          if(y<wr){
            x=wristX+(sign*.438-wristX)*clamp((wr-y)/.175);
          }
          let dx=sign*ct*w, dz=st*d-.008;
          if(y<wr&&y>wr-.12&&ct*sign<0&&st>0){
            dx+=sign*(-.012)*st;
            dz+=.014*st;
          }
          if(y<wr){
            dz*=.85;
          }
          return [x+dx,y,dz];
        } else {
          const k=landmarks['knee.'+key].y,a=landmarks['ankle.'+key].y;
          let lx=sign*legCenterX, lz=legCenterZ;
          let dx=ct*w, dz=st*d;
          if(y>k){
            const thighT=clamp((y-k)/(.845-k));
            if(ct*sign>0) dx+=sign*.022*thighT;
            if(ct*sign<0) dx-=sign*.014*thighT;
            if(st>0) dz+=.018*thighT;
          }
          if(Math.abs(y-k)<.065){
            const kneeT=1-Math.abs(y-k)/.065;
            if(st>0){
              // Patellar plane
              dz+=.016*kneeT*(1-0.25*ct*ct);
            } else {
              // Popliteal fossa
              dz+=.008*kneeT*Math.abs(st);
            }
          }
          if(y>a&&y<k-.02){
            const calfT=Math.sin(clamp((y-a)/(k-.02-a))*Math.PI);
            if(st<0) dz-=.028*calfT*Math.abs(st);
            if(ct*sign>0) dx+=sign*.020*calfT*Math.abs(ct);
            if(ct*sign<0) dx-=sign*.012*calfT*Math.abs(ct);
          }
          if(y<a){
            const footT=clamp((a-y)/(a-.018));
            lz=legCenterZ+.048*footT;
            if(st<0) dz-=.062*footT*Math.abs(st);
            if(st>0) dz+=.085*footT*st;
            if(ct*sign<0&&y<.05) dx-=sign*.012*footT;
            if(ct*sign>0&&y<.05) dx+=sign*.015*footT;
          }
          let finalX = lx + dx;
          if (finalX * sign < 0.015) finalX = sign * 0.015;
          return [finalX,y,lz+dz];
        }
      });
    };
    const target=ringAt(begin);
    const transition=kind==='arm'?8:1;
    for(let j=1;j<=transition;j++){const t=j/transition;rows.push(base.map((p,i)=>push(p.map((v,k)=>v+(target[i][k]-v)*t))));}
    const steps=kind==='arm'?72:96;
    for(let j=1;j<=steps;j++)rows.push(ringAt(begin+(end-begin)*j/steps).map(push));
    for(let j=0;j<rows.length-1;j++)joinFaces(faces,rows[j],rows[j+1]);
    const last=rows.at(-1),center=[0,0,0];for(const id of last)for(let k=0;k<3;k++)center[k]+=out[id*3+k]/count;
    if(kind==='arm') center[1]-=.010;
    else center[1]-=.004;
    cap(faces,last,push(center));
    domains.push(...Array(out.length/3).fill(kind+'_'+side));
    const section=raw(out,faces),opening=extractBoundaryLoops(section)[0];
    // offset selects the matching first vertex; engine reverses boundary winding.
    const offset=opening.vertices.indexOf(0);
    surface=stitchTopologySurfaces(surface,section,{loopA:loop,loopB:opening.vertices,mode:'bridge',offset,normalPolicy:'preserve',partId:'join-'+kind+'-'+side}).surface;
  }
  // Relax patch corners on the fixed adjacency graph. This changes shape only.
  // Shared seam vertices receive one update, so relaxation cannot open a seam.
  const neighbors=Array.from({length:surface.attributes.position.length/3},()=>new Set());
  for(let i=0;i<surface.indices.length;i+=3){const t=surface.indices.slice(i,i+3);for(let j=0;j<3;j++){neighbors[t[j]].add(t[(j+1)%3]);neighbors[t[j]].add(t[(j+2)%3]);}}
  let source=surface.attributes.position;
  for(let pass=0;pass<16;pass++){
    const next=new Float32Array(source);
    for(let i=0;i<neighbors.length;i++){
      const y=source[i*3+1],band=(y>1.34&&y<1.61)||(y>.82&&y<1.06),amount=band?.42:pass<5?.30:0;
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
    const arm=domain.startsWith('arm_')||(domain==='axial'&&y>1.38&&y<1.54&&ax>.18),leg=domain.startsWith('leg_');
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
      const footT = y < aLandmark ? smooth((aLandmark - y) / 0.06) : 0;
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
      const y=p[i*3+1];if(!((y>1.32&&y<1.62)||(y>.81&&y<1.07)))continue;
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
