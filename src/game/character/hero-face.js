import {headSection,foreheadSculptField} from './head-profile.js';
import {orbitalCutMask,stitchOrbitalPockets,stitchAuricularPatches} from './orbital-pockets.js';
import {createFeatureFrame,ellipsoidMask,ellipsoidSculptField,planeSculptField,ridgeSculptField,creaseSculptField,applySculptFields,relaxSculptSurface,rebuildSculptNormals,refineSculptTopology,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
export const FACE_STAGE=6;
export const FACE_REGIONS=Object.freeze(Object.fromEntries(['cranium','forehead','temple_l','temple_r','brow_l','brow_r','orbit_l','orbit_r','upper_lid_l','upper_lid_r','lower_lid_l','lower_lid_r','cheek_l','cheek_r','nose_root','nose_bridge','nose_tip','nose_wing_l','nose_wing_r','philtrum','upper_lip','lower_lip','mouth_corner_l','mouth_corner_r','chin','jaw_l','jaw_r','ear_l','ear_r','neck_interface'].map((n,i)=>[n,100+i])));
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const front=p=>smooth((p[2]-.008)/.035);
export function boxerFaceLandmarks({noseDeviation=.0024,eyeSpacing=.031}={}){
 const m={crown:[0,1.86,-.014],foreheadCenter:[0,1.800,.073],noseRoot:[0,1.773,.081],noseBridge:[noseDeviation*.4,1.745,.104],noseTip:[noseDeviation,1.720,.116],noseBase:[noseDeviation,1.709,.094],philtrum:[0,1.701,.084],upperLipCenter:[0,1.694,.091],lowerLipCenter:[0,1.684,.094],chin:[0,1.661,.086]};
 for(const [side,sign]of [['L',1],['R',-1]]){const y=1.758+(side==='L'?.0007:0);Object.assign(m,{['eyeCenter.'+side]:[sign*eyeSpacing,y,.079],['eyeInner.'+side]:[sign*(eyeSpacing-.014),y-.001,.081],['eyeOuter.'+side]:[sign*(eyeSpacing+.014),y+.001,.077],['browMedial.'+side]:[sign*.016,y+.015,.084],['browLateral.'+side]:[sign*.051,y+.013,.076],['cheek.'+side]:[sign*.052,1.736,.077],['nostril.'+side]:[noseDeviation+sign*.010,1.711,.101],['mouthCorner.'+side]:[sign*.023,1.688,.078],['jawAngle.'+side]:[sign*.067,1.680,-.003],['earCenter.'+side]:[sign*.086,1.742,-.014],['mastoid.'+side]:[sign*.060,1.710,-.052]});}return m;
}
export function sculptBoxerHead(input,parameters={}){
 const {noseDeviation=.0024,eyeSpacing=.031,chinProjection=0}=parameters;if(![noseDeviation,eyeSpacing,chinProjection].every(Number.isFinite)||Math.abs(noseDeviation)>.004||eyeSpacing<.027||eyeSpacing>.036||Math.abs(chinProjection)>.005)throw new Error('Facial parameter outside certified range');
 const start=performance.now();
 const base=refineSculptTopology(input,{mask:p=>p[1]>1.625,iterations:1});
 const refined=refineSculptTopology(base.surface,{mask:p=>p[1]>1.64&&p[1]<1.80&&(p[2]>.02||(p[1]>1.69&&Math.abs(p[0])>.05&&Math.abs(p[2]+.013)<.055)),iterations:1});
 refined.sourceVertex=refined.sourceVertex.map(i=>base.sourceVertex[i]);let surface=refined.surface;
 surface.metadata={...input.metadata,domains:refined.sourceVertex.map(i=>input.metadata.domains[i])};
 const orbitalCuts=orbitalCutMask(surface);
 const p=surface.attributes.position;
 for(let i=0;i<p.length;i+=3){const y=p[i+1];if(y<1.60)continue;const t=Math.atan2((p[i+2]+.006)/.095,p[i]/.080),c=Math.cos(t),sn=Math.sin(t),[w,f,b]=headSection(y),blend=smooth((y-1.60)/.045);
   const x=w*Math.sign(c)*Math.pow(Math.abs(c),.92),z=(sn>=0?f*Math.pow(sn,.45):b*sn)-.006;
   p[i]+=(x-p[i])*blend;p[i+2]+=(z-p[i+2])*blend;
 }
 surface=rebuildSculptNormals(surface);
 const landmarks=boxerFaceLandmarks({noseDeviation,eyeSpacing});
 // Keep certified orbital and auricular edge flow, then fit one continuous
 // facial height surface. Narrow additive ridges used to fold the nose/lips.
 surface=stitchOrbitalPockets(surface,orbitalCuts,landmarks);
 surface=stitchAuricularPatches(surface);
 const q=surface.attributes.position;
 const bump=(x,y,cx,cy,rx,ry)=>Math.exp(-2*((x-cx)**2/rx**2+(y-cy)**2/ry**2));
 for(let i=0;i<q.length;i+=3){
  const x=q[i],y=q[i+1],z=q[i+2];if(y<1.625||z<.025)continue;
  const [width,depth]=headSection(y),side=smooth((z-.025)/.045);
  const sn=Math.sqrt(Math.max(.001,1-Math.pow(Math.abs(x/width),2/.92)));
  let target=depth*Math.pow(sn,.45)-.006;
  // Broad brow, orbit, malar and mandibular planes at 12 mm pitch.
  for(const sign of [-1,1]){
   target+=.028*bump(x,y,sign*.034,1.781,.039,.023);
   target-=.029*bump(x,y,sign*eyeSpacing,1.757,.024,.017);
   target+=.019*bump(x,y,sign*.064,1.729,.047,.043);
   target+=.011*bump(x,y,sign*.080,1.679,.042,.036);
   target+=.016*bump(x,y,noseDeviation+sign*.021,1.715,.016,.014);
  }
  target+=.030*bump(x,y,noseDeviation*.4,1.746,.020,.039);
  target+=.041*bump(x,y,noseDeviation,1.724,.027,.019);
  target+=.012*bump(x,y,0,1.693,.039,.023);
  target+=.013*bump(x,y,0,1.697,.029,.009);
  target+=.014*bump(x,y,0,1.682,.030,.009);
  target-=.011*bump(x,y,0,1.690,.032,.0045);
  target+=(.027+chinProjection)*bump(x,y,0,1.661,.055,.024);
  target-=.007*bump(x,y,0,1.643,.050,.008);
  q[i+2]+=(target-z)*side;
 }
 surface=rebuildSculptNormals(surface);
 const report=validateTopology(surface,{policy:HERO_BODY_TOPOLOGY_POLICY});if(!report.valid)throw new Error('Head sculpt invalid: '+JSON.stringify(report.diagnostics));
 const fitted=fitFaceLandmarks(surface,landmarks);
 const frames=Object.fromEntries(Object.entries(fitted).map(([name,center])=>{
   const lateral=name.startsWith('earCenter.'),sign=name.endsWith('.L')?1:-1;
   return [name,{center:[...center],forward:lateral?[sign,0,0]:[0,0,1],up:[0,1,0],right:lateral?[0,0,-sign]:[1,0,0]}];
 }));
 return {surface,landmarks:fitted,frames,parameters:{noseDeviation,eyeSpacing,chinProjection},stage:FACE_STAGE,generationMs:performance.now()-start};
}

function fitFaceLandmarks(surface,targets){
 const result={},p=surface.attributes.position;
 for(const [name,target] of Object.entries(targets)){
  if(name.startsWith('eyeCenter.')){result[name]=[...target];continue;}
  const lateral=/^(earCenter|mastoid|jawAngle)/.test(name);
  let nearest=-1,best=Infinity;
  for(let i=0;i<p.length;i+=3){
   if(p[i+1]<1.63||(!lateral&&name!=='crown'&&p[i+2]<.02))continue;
   const dx=p[i]-target[0],dy=p[i+1]-target[1],dz=p[i+2]-target[2];
   const distance=lateral?dx*dx+dy*dy+dz*dz:dx*dx*16+dy*dy*16+dz*dz*.1;
   if(distance<best){best=distance;nearest=i;}
  }
  if(nearest<0)throw new Error('Cannot anchor facial landmark '+name);
  result[name]=Array.from(p.slice(nearest,nearest+3));
 }
 return result;
}

// Semantic face labels supplement the core body labels. Feature frames and
// landmarks remain definition data, independent of incidental vertex indices.
export function facialRegionAt(x,y,z){
 if(y<1.60)return null;
 if(y<1.65)return 'neck_interface';
 const ax=Math.abs(x),side=x>=0?'l':'r';
 if(ax>.063&&Math.abs(z+.016)<.028&&Math.abs(y-1.740)<.034)return 'ear_'+side;
 if(z<.015)return y>1.69?'cranium':null;
 if(y>1.79)return 'forehead';
 if(ax>.063&&y>1.75)return 'temple_'+side;
 const ey=1.758+(x>=0?.0007:0),dx=ax-.031,dy=y-ey;
 if(Math.abs(dx)<.020&&Math.abs(dy)<.014){
  if(Math.abs(dx)<.015&&dy>.002&&dy<.010)return 'upper_lid_'+side;
  if(Math.abs(dx)<.015&&dy<-.001&&dy>-.009)return 'lower_lid_'+side;
  return 'orbit_'+side;
 }
 if(y>1.766&&ax>.011&&ax<.060)return 'brow_'+side;
 if(ax<.019&&y>1.704&&y<1.786){
  if(y>1.767)return 'nose_root';
  if(y>1.727)return 'nose_bridge';
  if(ax>.008&&y<1.719)return 'nose_wing_'+side;
  return 'nose_tip';
 }
 if(y>1.704)return ax<.020?'nose_root':'cheek_'+side;
 if(y>1.695&&ax<.009)return 'philtrum';
 if(ax>.018&&ax<.030&&Math.abs(y-1.689)<.007)return 'mouth_corner_'+side;
 if(ax<.024&&y>1.689&&y<1.698)return 'upper_lip';
 if(ax<.024&&y>1.678&&y<=1.689)return 'lower_lip';
 if(ax<.037&&y<1.678)return 'chin';
 return 'jaw_'+side;
}
