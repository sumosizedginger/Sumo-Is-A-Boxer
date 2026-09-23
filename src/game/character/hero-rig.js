// The guide and its deformation pivots must share one authored centerline.
export const HERO_ARM_CENTERLINE=Object.freeze({shoulderX:.465,elbowX:.465,wristX:.450,handX:.438});

export function fitHeroArmRig(character){
 const landmarks={...character.landmarks};
 for(const [side,sign] of [['L',1],['R',-1]]){
  for(const [joint,x] of [['shoulder',HERO_ARM_CENTERLINE.shoulderX],['elbow',HERO_ARM_CENTERLINE.elbowX],['wrist',HERO_ARM_CENTERLINE.wristX],['hand',HERO_ARM_CENTERLINE.handX]]){
   const name=joint+'.'+side;
   landmarks[name]=Object.freeze({...landmarks[name],x:sign*x});
  }
 }
 const fitted=Object.freeze(landmarks),definitions=character.bonesData;
 // Preserve bone identities, hierarchy, helper joints and skin index ordering.
 character.bonesData=Object.freeze(definitions.map(def=>{
  if(!def.landmark)return def;
  const world=fitted[def.landmark];
  const parent=def.parent?fitted[definitions.find(d=>d.name===def.parent).landmark]:{x:0,y:0,z:0};
  const local=Object.freeze({x:world.x-parent.x,y:world.y-parent.y,z:world.z-parent.z});
  character.bonesByName[def.name].position.set(local.x,local.y,local.z);
  return Object.freeze({...def,restWorldPosition:world,restLocalPosition:local});
 }));
 character.landmarks=fitted;
 character.rootBone.updateWorldMatrix(true,true);
 character.skeleton.calculateInverses();
 character.mesh.bind(character.skeleton);
 return fitted;
}
