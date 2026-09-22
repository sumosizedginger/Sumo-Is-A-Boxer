/** Semantic macro masses own the shape; the indexed scaffold owns connectivity. */
import {applySculptFields,relaxSculptSurface,rebuildSculptNormals} from '@sumosizedginger/my-game-engine-1.0/full';
const clamp=t=>Math.max(0,Math.min(1,t));
const smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
const gaussian=(x,y,cx,cy,rx,ry)=>Math.exp(-2*((x-cx)**2/rx**2+(y-cy)**2/ry**2));
// [name, centre, radii]. These are overlapping anatomical volumes, not rows.
export const SUMO_MASSES=[
 ['ribcage',[0,1.345,-.015],[.345,.255,.250]],
 ['abdomen',[0,1.145,.065],[.370,.235,.330]],
 ['apron',[0,1.015,.105],[.315,.155,.275]],
 ['pelvis',[0,.975,-.025],[.330,.185,.250]],
 ['neck',[0,1.555,0],[.135,.180,.130]],
 ...[-1,1].flatMap(s=>[
  ['pectoral',[s*.180,1.385,.180],[.170,.155,.165]],
  ['trapezius',[s*.140,1.475,-.040],[.195,.105,.140]],
  ['lat',[s*.228,1.325,-.125],[.147,.204,.177]],
  ['glute',[s*.158,.930,-.184],[.176,.175,.195]]
 ])
];
const union=(a,b,k=.030)=>{const h=Math.max(k-Math.abs(a-b),0)/k;return Math.max(a,b)+h*h*k*.25;};
export function anatomicalTorsoPoint(y,angle){
 const c=Math.cos(angle),s=Math.sin(angle);
 // Smooth implicit union avoids discontinuities when a ray grazes a mass.
 const field=r=>{let d=1;for(const [,o,e]of SUMO_MASSES){const q=(Math.hypot((c*r-o[0])/e[0],(y-o[1])/e[1],(s*r-o[2])/e[2])-1)*Math.min(...e);d=-union(-d,-q,.038);}return d;};
 let lo=0,hi=.62;for(let i=0;i<21;i++){const m=(lo+hi)/2;if(field(m)<0)lo=m;else hi=m;}
 return [c*(lo+hi)/2,y,s*(lo+hi)/2];
}

export function buildSumoBodySculptFields(){
 // Broad surface-space fields reach the actual skin. Signed Z is explicit.
 return [(p)=>{
  const [x,y,z]=p,ax=Math.abs(x),front=smooth(z/.10),rear=smooth(-z/.10);let dz=0;
  dz-=.045*gaussian(x,y,0,1.40,.070,.135)*front;
  dz-=.012*gaussian(x,y,0,1.12,.025,.022)*front;
  dz+=.023*gaussian(x,y,0,1.25,.22,.12)*front;
  dz+=.024*gaussian(x,y,0,1.05,.25,.12)*front;
  dz+=.050*gaussian(x,y,0,.96,.047,.14)*rear;
  dz+=.018*gaussian(x,y,0,1.15,.07,.20)*rear;
  for(const sign of [-1,1]){
   // Rounded pec body and a broad curved lower transition.
   dz+=.025*gaussian(x,y,sign*.15,1.38,.115,.100)*front;
   dz-=.009*gaussian(x,y,sign*.17,1.275+.07*ax,.15,.052)*front;
   dz-=.032*gaussian(x,y,sign*.20,1.34,.095,.15)*rear;
   dz-=.018*gaussian(x,y,sign*.095,1.46,.075,.11)*rear;
   dz+=.022*gaussian(x,y,sign*.16,.846,.145,.027)*rear;
   // Quadriceps / adductors and two hamstring bellies, not a knee ring.
   dz+=.026*gaussian(x,y,sign*.205,.675,.100,.170)*front*(y<.85?1:0);
   dz+=.023*gaussian(x,y,sign*.110,.555,.065,.090)*front;
   dz-=.024*gaussian(x,y,sign*.19,.665,.125,.16)*rear*(y<.83?1:0);
   dz+=.016*gaussian(x,y,sign*.18,.445,.060,.055)*front;
   dz+=.018*gaussian(x,y,sign*.18,.46,.080,.045)*rear;
   dz-=.022*gaussian(x,y,sign*.145,.31,.060,.11)*rear;
   dz-=.018*gaussian(x,y,sign*.235,.34,.055,.09)*rear;
  }
  // Deltoid cap wraps lateral and front/rear shoulder surfaces.
  const cap=gaussian(ax,y,.365,1.435,.105,.105), lateral=smooth((ax-.24)/.10);
  let dx=Math.sign(x)*.025*cap*lateral;
  dz+=Math.sign(z)*.027*cap*smooth(Math.abs(z)/.09);
  return [dx,0,dz*(1-smooth((ax-.48)/.10))];
 }];
}
export function sculptSumoBody(surface,landmarks){
 let s=applySculptFields(surface,buildSumoBodySculptFields(landmarks));
 s=relaxSculptSurface(s,{mask:p=>p[1]>.13&&p[1]<1.60?1:0,iterations:4,strength:.25,tangential:false});
 return rebuildSculptNormals(s);
}
