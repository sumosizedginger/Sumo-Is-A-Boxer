import {headSection,foreheadSculptField} from './head-profile.js';
import {orbitalCutMask,stitchOrbitalPockets,stitchAuricularPatches} from './orbital-pockets.js';
import {createFeatureFrame,ellipsoidMask,ellipsoidSculptField,planeSculptField,ridgeSculptField,creaseSculptField,applySculptFields,relaxSculptSurface,rebuildSculptNormals,refineSculptTopology,validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
export const FACE_STAGE=6;
export const FACE_REGIONS=Object.freeze(Object.fromEntries(['cranium','forehead','temple_l','temple_r','brow_l','brow_r','orbit_l','orbit_r','upper_lid_l','upper_lid_r','lower_lid_l','lower_lid_r','cheek_l','cheek_r','nose_root','nose_bridge','nose_tip','nose_wing_l','nose_wing_r','philtrum','upper_lip','lower_lip','mouth_corner_l','mouth_corner_r','chin','jaw_l','jaw_r','ear_l','ear_r','neck_interface'].map((n,i)=>[n,100+i])));
const clamp=t=>Math.max(0,Math.min(1,t)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const front=p=>smooth((p[2]-.008)/.035);
export function boxerFaceLandmarks({noseDeviation=.0024,eyeSpacing=.031}={}){
 const m={crown:[0,1.86,-.014],foreheadCenter:[0,1.800,.073],noseRoot:[0,1.773,.081],noseBridge:[noseDeviation*.4,1.745,.104],noseTip:[noseDeviation,1.720,.116],noseBase:[noseDeviation,1.709,.094],philtrum:[0,1.701,.084],upperLipCenter:[0,1.694,.091],lowerLipCenter:[0,1.684,.094],chin:[0,1.661,.086]};
 for(const [side,sign]of [['L',1],['R',-1]]){const y=1.758+(side==='L'?.0007:0);Object.assign(m,{['eyeCenter.'+side]:[sign*eyeSpacing,y,.052],['eyeInner.'+side]:[sign*(eyeSpacing-.014),y-.001,.081],['eyeOuter.'+side]:[sign*(eyeSpacing+.014),y+.001,.077],['browMedial.'+side]:[sign*.016,y+.015,.084],['browLateral.'+side]:[sign*.051,y+.013,.076],['cheek.'+side]:[sign*.052,1.736,.077],['nostril.'+side]:[noseDeviation+sign*.010,1.711,.101],['mouthCorner.'+side]:[sign*.023,1.688,.078],['jawAngle.'+side]:[sign*.067,1.680,-.003],['earCenter.'+side]:[sign*.086,1.742,-.014],['mastoid.'+side]:[sign*.060,1.710,-.052]});}return m;
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
 const landmarks=boxerFaceLandmarks({noseDeviation,eyeSpacing}),fields=[];
 const volume=(center,radii,strength,direction=[0,0,1],mask=front)=>ellipsoidSculptField({center,radii,strength,direction,mask});
 for(const sign of [1,-1]){
   fields.push(volume([sign*.058,1.684,.012],[.036,.033,.079],.006,[sign,0,0],()=>1));
   fields.push(planeSculptField({point:[sign*.062,1.677,.040],normal:[sign*.70,-.32,.64],strength:.65,maxDisplacement:.009,mask:ellipsoidMask({frame:createFeatureFrame({center:[sign*.056,1.671,.042]}),radii:[.037,.025,.061]})}));
   fields.push(volume([sign*.067,1.774,.005],[.027,.034,.067],-.005,[sign,0,0],()=>1));
 }
 fields.push(volume([-.0007,1.663,.068],[.037,.024,.056],.010+chinProjection));
 fields.push(planeSculptField({point:[0,1.663,.083],normal:[0,-.10,1],strength:.8,maxDisplacement:.006,mask:ellipsoidMask({frame:createFeatureFrame({center:[0,1.663,.078]}),radii:[.030,.014,.050]})}));
 fields.push(creaseSculptField({points:[[.044,1.781,.071],[.041,1.773,.074]],radius:.0018,strength:.0007,depthRadius:.035,mask:front}));
 fields.push(foreheadSculptField);
 if(FACE_STAGE>=2)for(const [side,sign]of [['L',1],['R',-1]]){
  const center=landmarks['eyeCenter.'+side],frame=createFeatureFrame({center});

  fields.push(ridgeSculptField({points:[[sign*.014,center[1]+.014,.078],[sign*.030,center[1]+.017,.08],[sign*.051,center[1]+.012,.070]],radius:.014,strength:.004,depthRadius:.06,mask:front}));

 }

 if(FACE_STAGE>=3){
  const nasal=createFeatureFrame({center:[noseDeviation,1.737,.07]});
  fields.push(ridgeSculptField({frame:nasal,points:[[-noseDeviation,.037,0],[-noseDeviation*.6,.012,.01],[0,-.012,.035]],radius:.016,strength:.032,depthRadius:.09,mask:p=>front(p)*smooth((1.787-p[1])/.045)}));
  fields.push(volume([noseDeviation,1.722,.080],[.016,.015,.065],.015));
  fields.push(volume([noseDeviation,1.709,.078],[.0045,.007,.045],.008));
  for(const sign of [1,-1]){
   fields.push(volume([noseDeviation+sign*.012,1.715,.078],[.010,.010,.060],.008));
   fields.push(creaseSculptField({points:[[noseDeviation+sign*.008,1.712,.09],[noseDeviation+sign*.014,1.710,.09]],radius:.0026,strength:.006,depthRadius:.06,mask:front}));
   fields.push(planeSculptField({point:[noseDeviation+sign*.010,1.740,.084],normal:[sign*.85,0,.53],strength:.25,maxDisplacement:.004,mask:ellipsoidMask({frame:createFeatureFrame({center:[noseDeviation+sign*.013,1.740,.083]}),radii:[.010,.022,.07]})}));
   fields.push(volume([sign*.051,1.739,.061],[.032,.026,.065],.010));
   fields.push(planeSculptField({point:[sign*.061,1.723,.055],normal:[sign*.55,-.25,.80],strength:.55,maxDisplacement:.007,mask:ellipsoidMask({frame:createFeatureFrame({center:[sign*.060,1.721,.057]}),radii:[.025,.029,.045]})}));
  }
 }

 if(FACE_STAGE>=4){
  const mouth=createFeatureFrame({center:[0,1.689,.074]});
  fields.push(volume([0,1.692,.070],[.033,.024,.055],.004));
  fields.push(ridgeSculptField({frame:mouth,points:[[-.024,-.001,0],[-.013,.003,0],[-.006,.006,0],[0,.004,0],[.006,.006,0],[.013,.003,0],[.024,-.001,0]],radius:.0045,strength:.003,depthRadius:.05,mask:front}));
  fields.push(ridgeSculptField({frame:mouth,points:[[-.022,-.002,0],[-.010,-.006,0],[0,-.0065,0],[.010,-.006,0],[.022,-.002,0]],radius:.0055,strength:.003,depthRadius:.05,mask:front}));
  fields.push(creaseSculptField({frame:mouth,points:[[-.024,-.001,0],[-.012,0,0],[0,-.001,0],[.012,0,0],[.024,-.001,0]],radius:.0015,strength:.0025,depthRadius:.055,mask:front}));
  fields.push(creaseSculptField({points:[[-.015,1.675,.077],[0,1.674,.082],[.015,1.675,.077]],radius:.004,strength:.0012,depthRadius:.04,mask:front}));
  for(const sign of [-1,1])fields.push(ridgeSculptField({points:[[sign*.003,1.700,.08],[sign*.004,1.694,.08]],radius:.0025,strength:.0013,depthRadius:.04,mask:front}));
 }

 surface=applySculptFields(surface,fields);
 surface=relaxSculptSurface(surface,{mask:p=>p[1]>1.63?1:0,iterations:4,strength:.38,tangential:false,featureMask:p=>p[1]<1.65?1:0});

 surface=stitchOrbitalPockets(surface,orbitalCuts,landmarks);
 surface=stitchAuricularPatches(surface);
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
