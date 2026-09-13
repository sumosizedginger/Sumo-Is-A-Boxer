import { PUNCH, OPPONENT } from '../config.js';

export const MODEL_STATES = Object.freeze({
  front_neutral:{angle:0,pose:'neutral'}, rear_neutral:{angle:180,pose:'neutral'},
  left_profile:{angle:90,pose:'neutral'},right_profile:{angle:-90,pose:'neutral'},
  three_quarter_front:{angle:35,pose:'neutral'},three_quarter_rear:{angle:145,pose:'neutral'},
  punch_extension:{angle:35,pose:'extended'},
  arm_raised:{angle:25,pose:'raised'},
  high_guard:{angle:20,state:'block'},low_guard:{angle:20,pose:'guardLow'},
  jab_extension:{angle:30,attack:'JAB'},cross_extension:{angle:-30,attack:'HOOK'},
  deep_elbow_flex:{angle:60,pose:'deepFlex'},deep_knee_flex:{angle:50,crouch:.23,lean:.28},
  torso_twist:{angle:25,twist:.58},head_reaction:{angle:25,reaction:'high'},body_reaction:{angle:25,reaction:'low'},
  wide_stance:{angle:0,stanceWidth:.31},close_stance:{angle:0,stanceWidth:.16},
  fp_neutral:{fp:true},fp_high_guard:{fp:true,blocking:true},fp_low_guard:{fp:true,guard:'low'},
  fp_jab_extension:{fp:true,attack:'JAB'},fp_cross_extension:{fp:true,attack:'CROSS'},
  fp_block:{fp:true,blocking:true},fp_glove_closeup:{fp:true,closeup:'glove'},fp_forearm_closeup:{fp:true,closeup:'forearm'},
});
for(const p of Object.values(MODEL_STATES))Object.freeze(p);

// A fixed-step presentation rehearsal. The combat simulation is never stepped.
// Used by the browser inspector and the exact same pose/attachment tests.
export function prepareModelPose({opponent,fists,match},name) {
  const preset=MODEL_STATES[name];if(!preset)throw new Error('Unknown model state: '+name);
  match.reset(1111);match.drainEvents();opponent.reset();opponent.setFlash(0);fists.reset();
  const s=match.opponent,p=match.player;
  Object.assign(s,{state:'idle',stateT:0,stateDuration:1,yaw:Math.PI,attack:preset.attack==='HOOK'?'HOOK':'JAB',attackZone:'high',speed:0,blockZone:'high'});
  Object.assign(p,{action:'idle',actionT:0,actionDuration:1,guard:preset.guard??'high',blocking:!!preset.blocking,speed:0,stamina:100,sprinting:false});
  const args={state:s,position:{x:0,z:0},dt:1/120,speed:0,inspection:preset};
  for(let i=0;i<120;i++){opponent.update(args);fists.update({player:p,dt:1/120});}
  if(preset.reaction)opponent.react({zone:preset.reaction,heavy:true,side:1});
  const spec=preset.attack ? (preset.fp ? PUNCH[preset.attack] : OPPONENT.attacks[preset.attack]) : null;
  const duration=preset.reaction ? .7 : spec ? (preset.fp ? spec.duration+.2 : spec.windUp+spec.strike+spec.recover) : .9;
  const defaultTime=preset.reaction ? .10 : spec ? (preset.fp ? spec.impactAt*1.08 : spec.windUp+spec.strike*.70) : .3;
  let elapsed=0;
  function step() {
    const seconds=elapsed;
    if(preset.attack&&!preset.fp){
      s.state=seconds<spec.windUp?'wind':seconds<spec.windUp+spec.strike?'strike':'recover';
      s.stateT=seconds-(s.state==='wind'?0:s.state==='strike'?spec.windUp:spec.windUp+spec.strike);
      s.stateDuration=s.state==='wind'?spec.windUp:s.state==='strike'?spec.strike:spec.recover;
    } else if(preset.state)s.state=preset.state;
    if(preset.fp&&preset.attack){
      p.action=seconds<=spec.duration?preset.attack:'idle';
      p.actionPunch=spec;p.actionDuration=spec.duration;p.actionT=Math.min(seconds,spec.duration);
    }
    opponent.update(args);fists.update({player:p,dt:1/120});elapsed+=1/120;
  }
  return {preset,duration,defaultTime,step,get elapsed(){return elapsed;}};
}

export function poseModels(handles,name,progress=null) {
  const rehearsal=prepareModelPose(handles,name);
  const time=progress===null?rehearsal.defaultTime:Math.max(0,Math.min(1,progress))*rehearsal.duration;
  for(let i=0;i<=Math.round(time*120);i++)rehearsal.step();
  handles.opponent.group.updateMatrixWorld(true);handles.fists.root.updateMatrixWorld(true);
  return rehearsal.preset;
}
