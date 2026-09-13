import {fail,copyJson} from '../geometry/topology-surface.js';

// Stable gameplay identity. Helper joints can append but cannot replace or
// reparent any of these core joints. Kept renderer-independent for definitions.
const names=['root','pelvis','spine','chest','neck','head','shoulder_l','upperarm_l','forearm_l','hand_l','shoulder_r','upperarm_r','forearm_r','hand_r','thigh_l','shin_l','foot_l','toe_l','thigh_r','shin_r','foot_r','toe_r'];
const parents=[null,'root','pelvis','spine','chest','neck','chest','shoulder_l','upperarm_l','forearm_l','chest','shoulder_r','upperarm_r','forearm_r','pelvis','thigh_l','shin_l','foot_l','pelvis','thigh_r','shin_r','foot_r'];
export const CHARACTER_CORE_SKELETON=Object.freeze(names.map((name,index)=>Object.freeze({name,index,parent:parents[index]})));
export function validateDeformationJoints(helpers=[]){
  const seen=new Set(names);
  return helpers.map((j,i)=>{
    if(!j?.name||seen.has(j.name)||!seen.has(j.parent))fail('HELPER_HIERARCHY','Helpers must have unique non-core names and an earlier core/helper parent',{joint:j});
    const p=j.restLocalPosition,q=j.restOrientation??[0,0,0,1];
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-6)fail('HELPER_REST_TRANSFORM','Helper rest position and unit orientation must be explicit finite data');
    seen.add(j.name);return copyJson({name:j.name,index:22+i,parent:j.parent,restLocalPosition:p,restOrientation:q,purpose:j.purpose??'deformation'});
  });
}
