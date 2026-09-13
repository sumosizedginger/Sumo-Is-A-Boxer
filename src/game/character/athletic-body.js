// Game-authored skin, Character Forge skeleton. No engine geometry mutation.
import { Float32BufferAttribute, Uint16BufferAttribute } from 'three';
import { createPreviewable } from '@sumosizedginger/my-game-engine-1.0/full';
import { sculpt } from '../assets/sculpt.js';
import { fuse } from '../assets/kit.js';
import { SKULL_SECTIONS } from '../assets/skull-sections.js';

const clamp = v => Math.max(0, Math.min(1, v));
// Smoothstep. A LINEAR weight ramp across a joint is a large part of what makes
// a procedural character read as procedural: it collapses into a single hinge
// crease at full flex no matter how much geometry you throw at it.
const smooth = t => t * t * (3 - 2 * t);

export function rebuildAthleticBody(character, skinDefinition) {
  const L = character.landmarks;
  const meshes = [], weights = [], joints = [];
  const boneIndex = Object.fromEntries(character.bones.map((b, i) => [b.name, i]));
  function add(mesh, weightAt) {
    const p = mesh.attributes.position;
    for (let i = 0; i < p.length; i += 3) {
      const w = weightAt(p[i], p[i + 1], p[i + 2]);
      for (let j = 0; j < 4; j++) { joints.push(boneIndex[w[j]?.[0]] ?? 0); weights.push(w[j]?.[1] ?? 0); }
    }
    meshes.push(mesh);
  }
  const torsoWeights = (_, y) => {
    const stations = [['pelvis', 1.05], ['spine', 1.22], ['chest', 1.45], ['neck', 1.61], ['head', 1.68]];
    for (let i = 0; i < stations.length - 1; i++) {
      if (y <= stations[i + 1][1]) {
        const t = clamp((y - stations[i][1]) / (stations[i + 1][1] - stations[i][1]));
        return [[stations[i][0], 1 - t], [stations[i + 1][0], t]];
      }
    }
    return [['head', 1]];
  };
  add(sculpt({name: 'athletic-ribcage-neck', segments: 40, sections: [
    [0.92, .145, .11, 0, -.01], [1.00, .181, .135], [1.09, .166, .128],
    [1.17, .149, .114], [1.24, .173, .126], [1.30, .207, .145],
    [1.35, .225, .16], [1.39, .231, .177], [1.435, .238, .17],
    [1.48, .218, .139], [1.515, .175, .107], [1.55, .115, .093, 0, -.01],
    [1.585, .085, .077, 0, -.014], [1.63, .072, .071, 0, -.012],
    [1.68, .069, .067, 0, -.008]
  ], shape(p,{y,s,c}) {
    const front = Math.max(0,s);
    // Two pectoral planes separated by a narrow sternum valley.
    const pec = Math.exp(-1*((y-1.405)/.057)**2);
    p[2] += front * pec * (.02 * Math.abs(c) - .017 * Math.exp(-1*(p[0]/.024)**2));
    p[2] += front * .009 * Math.exp(-1*((y-(1.52-Math.abs(p[0])*.19))/.012)**2);
    const abs = Math.exp(-1*((y-1.25)/.12)**2);
    p[2] += front * abs * .006 * Math.cos((y-1.19)*63) * (1-Math.exp(-1*(p[0]/.024)**2));
    p[2] -= Math.max(0,-s) * .009 * Math.exp(-1*(p[0]/.023)**2);
  }}), torsoWeights);

  for (const [side, sign] of [['l',1],['r',-1]]) {
    const key = side === 'l' ? 'L' : 'R';
    const shoulder=L[`shoulder.${key}`], elbow=L[`elbow.${key}`], wrist=L[`wrist.${key}`];
    const centre = y => y > elbow.y ? shoulder.x+(elbow.x-shoulder.x)*clamp((shoulder.y-y)/(shoulder.y-elbow.y)) : elbow.x+(wrist.x-elbow.x)*clamp((elbow.y-y)/(elbow.y-wrist.y));
    const rows = [
      [wrist.y-.025,.033,.033], [wrist.y+.015,.038,.034], [wrist.y+.07,.045,.041],
      [elbow.y-.13,.063,.055], [elbow.y-.07,.068,.06],
      // Support loops through the flexion band. Three rings could only fold as a
      // hinge; these six give the outer elbow something to stretch over and the
      // inner elbow somewhere to compress into.
      [elbow.y-.045,.0575,.0515], [elbow.y-.024,.0525,.0485], [elbow.y-.008,.0490,.0510],
      [elbow.y+.010,.0492,.0545], [elbow.y+.034,.0555,.0558], [elbow.y+.062,.0645,.0625],
      [elbow.y+.11,.078,.075],
      [shoulder.y-.13,.082,.083], [shoulder.y-.07,.09,.083], [shoulder.y-.015,.094,.086],
      [shoulder.y+.035,.075,.07], [shoulder.y+.065,.015,.019]
    ].map(([y,w,d])=>[y,w,d,centre(y)+sign*.006*Math.sin((y-wrist.y)*6),-.004]);
    add(sculpt({name:`athletic-arm-${side}`, sections:rows, segments:28, shape(p,{y,s}) {
      // Biceps anterior, triceps posterior, hard elbow tip.
      p[2] += Math.max(0,s)*.012*Math.exp(-1*((y-elbow.y-.14)/.075)**2);
      p[2] -= Math.max(0,-s)*.013*Math.exp(-1*((y-elbow.y-.07)/.1)**2);
      // Olecranon. Authored INTO the skin rather than as a rigid shell, so it
      // cannot detach from the arm when the elbow drives through a cross.
      p[2] -= Math.max(0,-s)*.0075*Math.exp(-1*((y-elbow.y+.004)/.021)**2);
    }}),(_,y)=>{
      const bend=smooth(clamp((y-(elbow.y-.048))/.100));
      if(y>shoulder.y-.07) {const cap=clamp((y-(shoulder.y-.07))/.12)*.65;return [[`upperarm_${side}`,1-cap],[`shoulder_${side}`,cap]];}
      return [[`forearm_${side}`,1-bend],[`upperarm_${side}`,bend]];
    });
    const hip=L[`hip.${key}`],knee=L[`knee.${key}`],ankle=L[`ankle.${key}`];
    add(sculpt({name:`athletic-leg-${side}`,segments:28,sections:[
      [ankle.y,.042,.044], [ankle.y+.06,.043,.047], [ankle.y+.13,.052,.064,sign*.006],
      [knee.y-.17,.073,.083,sign*.012,-.013], [knee.y-.10,.079,.082,sign*.011,-.018],
      // Support loops through the knee, matching the elbow treatment.
      [knee.y-.062,.0665,.0665,0,-.006], [knee.y-.034,.0612,.0640,0,.006],
      [knee.y-.011,.0600,.0688,0,.013], [knee.y+.013,.0612,.0722,0,.0135],
      [knee.y+.040,.0668,.0736,0,.005],
      [knee.y+.10,.083,.085,sign*.012], [knee.y+.19,.103,.107,sign*.014],
      [hip.y-.13,.118,.119,sign*.008], [hip.y-.05,.12,.12], [hip.y+.025,.085,.084]
    ].map(([y,w,d,x=0,z=0])=>[y,w,d,hip.x+x,z]),shape(p,{y,s}) {
      // Patella, in-skin for the same reason as the olecranon.
      p[2] += Math.max(0,s)*.008*Math.exp(-1*((y-knee.y-.004)/.027)**2);
      // Hamstring fullness above the joint keeps the back of the knee from
      // reading as a flat plate when the leg straightens.
      p[2] -= Math.max(0,-s)*.006*Math.exp(-1*((y-knee.y-.085)/.055)**2);
    }}),(_,y)=>{
      const t=smooth(clamp((y-(knee.y-.052))/.108));return [[`shin_${side}`,1-t],[`thigh_${side}`,t]];
    });
  }
  // Stations live in assets/skull-sections.js because the hair shell is built
  // from the same numbers; see the note there.
  add(sculpt({name:'athletic-fighter-skull',segments:40,sections:SKULL_SECTIONS,shape(p,{y,s}) {
    if(s>0) {
      const eye=Math.exp(-1*((Math.abs(p[0])-.033)/.02)**2)*Math.exp(-1*((y-1.763)/.011)**2);
      p[2]-=.019*eye;
      p[2]+=.015*Math.exp(-1*((y-1.725)/.02)**2)*Math.exp(-1*((Math.abs(p[0])-.059)/.02)**2);
      p[2]+=.015*Math.exp(-1*((y-1.65)/.02)**2)*Math.exp(-1*(p[0]/.045)**2);
    }
  }}),()=>[['head',1]]);

  const meshIR=fuse(meshes,{id:'asset.boxer.athletic-skin',semanticName:'boxer-athletic-skin',materialId:skinDefinition.id});
  const preview=createPreviewable({mesh:meshIR,materials:[skinDefinition],type:'game-asset'});
  const geometry=preview.geometry.clone();
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(joints,4));
  geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  preview.dispose();
  character.geometry.dispose();
  character.geometry=geometry;
  character.mesh.geometry=geometry;
  return {meshIR,vertices:weights.length/4,triangles:geometry.index.count/3};
}
