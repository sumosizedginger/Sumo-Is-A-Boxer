import {fail,copyJson} from '../geometry/topology-surface.js';

const multiply=(a,b)=>[a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1],a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3],a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]];
const inverse=q=>[-q[0],-q[1],-q[2],q[3]];
function quaternion(q){if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-6)fail('POSE_QUATERNION','Orientation must be a finite unit XYZW quaternion');return q;}
function axis(v){if(!Array.isArray(v)||v.length!==3||!v.every(Number.isFinite)||Math.abs(Math.hypot(...v)-1)>1e-6)fail('POSE_AXIS','Twist axis must be a finite unit vector');return v;}
const principal=a=>Math.atan2(Math.sin(a),Math.cos(a));
function canonical(q){const first=q[3]===0?q.find(v=>v!==0):q[3];return (first<0?q.map(v=>-v):q).map(v=>v===0?0:v);}

export function decomposeSwingTwist(orientation,{restOrientation=[0,0,0,1],twistAxis=[0,1,0]}={}){
  quaternion(orientation);quaternion(restOrientation);axis(twistAxis);
  const delta=canonical(multiply(inverse(restOrientation),orientation));
  const projection=delta[0]*twistAxis[0]+delta[1]*twistAxis[1]+delta[2]*twistAxis[2],length=Math.hypot(projection,delta[3]);
  // At a 180-degree swing perpendicular to the twist axis, twist is undefined.
  // Refuse it rather than publishing a fabricated zero twist.
  if(length<1e-8)fail('SWING_TWIST_SINGULARITY','180-degree perpendicular swing has no unique twist');
  const twistQuaternion=[...twistAxis.map(v=>v*projection/length),delta[3]/length];
  const swingQuaternion=canonical(multiply(delta,inverse(twistQuaternion)));
  const sinHalf=Math.hypot(...swingQuaternion.slice(0,3)),angle=2*Math.atan2(sinHalf,swingQuaternion[3]);
  return {swing:swingQuaternion.slice(0,3).map(v=>sinHalf<1e-12?0:v*angle/sinHalf),twist:principal(2*Math.atan2(projection,delta[3])),swingQuaternion,twistQuaternion};
}
function joint(source){
  if(!source?.bone||typeof source.bone!=='string')fail('POSE_BONE','A semantic bone name is required');
  return {bone:source.bone,restOrientation:[...quaternion(source.restOrientation??[0,0,0,1])],twistAxis:[...axis(source.twistAxis??[0,1,0])],scale:source.scale??1};
}
export function createPoseDriverDefinition({id,bone,restOrientation=[0,0,0,1],twistAxis=[0,1,0],neighbors=[],samples=[]}){
  if(typeof id!=='string'||!id)fail('POSE_DRIVER_ID','Driver id is required');
  const primary=joint({bone,restOrientation,twistAxis}),near=neighbors.map(joint),names=new Set([bone]);
  for(const j of near){if(names.has(j.bone)||!Number.isFinite(j.scale)||j.scale<=0)fail('POSE_NEIGHBOR','Neighbors must be unique with positive finite scale');names.add(j.bone);}
  const sampleNames=new Set();
  for(const sample of samples){
    if(!sample.name||sampleNames.has(sample.name)||!sample.output||!Number.isFinite(sample.radius)||sample.radius<=0)fail('POSE_SAMPLE','Samples need unique names, an output and a positive radius');sampleNames.add(sample.name);
    for(const name of names)quaternion(sample.orientations?.[name]);
  }
  return Object.freeze(copyJson({version:1,id,...primary,neighbors:near,samples}));
}
export function poseDriverDistance(a,b){
  const one=(x,y)=>Math.hypot(...x.swing.map((v,i)=>v-y.swing[i]),principal(x.twist-y.twist));
  if(a.bone!==b.bone||a.neighbors.length!==b.neighbors.length)fail('POSE_SCHEMA','Driver values do not share a joint schema');
  let squared=one(a,b)**2;
  for(let i=0;i<a.neighbors.length;i++){
    const x=a.neighbors[i],y=b.neighbors[i];if(x.bone!==y.bone||x.scale!==y.scale)fail('POSE_SCHEMA','Neighbor schema mismatch');squared+=(one(x,y)*x.scale)**2;
  }
  return Math.sqrt(squared);
}
export function evaluatePoseDriver(definition,orientations){
  const read=(def,source)=>({bone:def.bone,scale:def.scale,...decomposeSwingTwist(source[def.bone],def)});
  const measure=source=>({...read(definition,source),neighbors:definition.neighbors.map(j=>read(j,source))});
  const pose=measure(orientations),driverDistances={},outputWeights={};
  // Independent compact radial kernels, not a fitted RBF solver. Outside the
  // authored radius, a sample contributes exactly zero. Output weights saturate.
  for(const sample of definition.samples){
    const distance=poseDriverDistance(pose,measure(sample.orientations));driverDistances[sample.name]=distance;
    const t=Math.max(0,1-distance/sample.radius),weight=t*t*(3-2*t);
    outputWeights[sample.output]=Math.min(1,(outputWeights[sample.output]??0)+weight);
  }
  return {...pose,driverDistances,outputWeights};
}
