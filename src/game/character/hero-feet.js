import { Vector3, Quaternion } from 'three';
import { computeGaitFootPlacement } from '@sumosizedginger/my-game-engine-1.0/full';

// Platform-space contact ownership. The game supplies intent; Motion Forge supplies
// the swing clearance profile. Only one foot may leave contact at a time.
export function createHeroFeet() {
  const feet=[1,-1].map(sign=>({sign,position:new Vector3(),from:new Vector3(),to:new Vector3(),yaw:0,fromYaw:0,toYaw:0,t:1}));
  const desired=new Vector3(),previous=new Vector3(),velocity=new Vector3();
  const rotation=new Quaternion(),axis=new Vector3(0,1,0);
  let ready=false,active=-1,next=0;
  function reset(){ready=false;active=-1;next=0;}
  return {feet,reset,update(group,dt,speed,drive=0,heavy=false,stanceWidth=.225){
    rotation.setFromAxisAngle(axis,group.rotation.y);
    if(!ready){previous.copy(group.position);}
    velocity.copy(group.position).sub(previous).multiplyScalar(dt>0?1/dt:0);
    if(velocity.length()>5) velocity.setLength(5);
    previous.copy(group.position);
    const stepDuration=Math.max(.10,Math.min(.22,.32/Math.max(.1,speed)));
    for(let i=0;i<2;i++){
      const f=feet[i];
      const stagger=1-Math.min(1,speed/1.0);
      desired.set(f.sign*stanceWidth,.093,(f.sign>0?.235:-.245)*stagger).applyQuaternion(rotation).add(group.position);
      if(!ready){f.position.copy(desired);f.yaw=group.rotation.y+(i===1?-.22:.04);f.t=1;}
      if(active<0 && i===next && f.position.distanceTo(desired)>.20){
        active=i;f.t=0;f.from.copy(f.position);f.to.copy(desired).addScaledVector(velocity,stepDuration*1.5);
        f.fromYaw=f.yaw;f.toYaw=group.rotation.y+(i===1?-.22:.04);
      }
      if(active===i){
        f.t=Math.min(1,f.t+dt/stepDuration);
        const t=f.t, k=t*t*(3-2*t);
        f.position.lerpVectors(f.from,f.to,k);
        const placement=computeGaitFootPlacement({phase:.60001+.39998*t,strideLength:.38,stepHeight:.035,footH:.093,hipX:0});
        f.position.y=.093+(placement.targetPos.y-.093)*Math.sin(Math.PI*t);
        f.yaw=f.fromYaw+Math.atan2(Math.sin(f.toYaw-f.fromYaw),Math.cos(f.toYaw-f.fromYaw))*k;
        if(t===1){f.position.y=.093;active=-1;next=1-i;}
      }
    }
    // If the other foot needs to step first, choose it next frame.
    if(active<0){let largest=.20;for(let i=0;i<2;i++){const f=feet[i];desired.set(f.sign*stanceWidth,.093,(f.sign>0?.235:-.245)*(1-Math.min(1,speed))).applyQuaternion(rotation).add(group.position);const distance=f.position.distanceTo(desired);if(distance>largest){largest=distance;next=i;}}}
    ready=true;
  }};
}
