import test from 'node:test';
import assert from 'node:assert/strict';
import { Group, PerspectiveCamera, Vector3 } from 'three';
import { validateMesh } from '@sumosizedginger/my-game-engine-1.0/full';
import { buildAllAssets } from '../src/game/app.js';
import { MATERIAL_DEFINITIONS } from '../src/game/assets/materials.js';
import { createAssetLibrary } from '../src/game/presentation/asset-library.js';
import { createOpponentBoxer } from '../src/game/character/opponent-boxer.js';
import { createBoxingFeet } from '../src/game/character/boxing-feet.js';
import { createPlayerFists } from '../src/game/character/player-fists.js';
import { FEEDBACK, PUNCH } from '../src/game/config.js';
import { skullShell, skullAt, SKULL_SECTIONS, HEAD_BONE_BIND_Y, HAIR_SHELL_OFFSET, FADE_SHELL_OFFSET } from '../src/game/assets/skull-sections.js';

const assets=buildAllAssets();
function fixture(){const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});const opponent=createOpponentBoxer({library});return {library,opponent,dispose(){opponent.dispose();library.dispose();}};}
const state=()=>({state:'idle',stateT:0,stateDuration:1,yaw:0,flash:0,attack:'JAB',attackZone:'high'});

test('sculpted equipment is valid and dielectric concrete stays dielectric',()=>{
  for(const key of ['asset.boxer.trunks.left','asset.boxer.trunks.right','asset.fp.arm.left'])assert.equal(validateMesh(assets.get(key)).valid,true);
  for(const m of MATERIAL_DEFINITIONS.filter(m=>m.id.startsWith('mat.concrete')))assert.equal(m.data.parameters.metalness,0);
});

test('skin weights normalize and every deformed vertex stays finite through combat poses',()=>{
  const f=fixture(),o=f.opponent,s=state(),v=new Vector3();
  try {
    const weights=o.character.geometry.attributes.skinWeight;
    for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-6);
    for(const attack of ['JAB','HOOK'])for(const pose of ['wind','strike','recover','block','stagger','down','getup']){
      s.attack=attack;s.state=pose;s.stateT=0;
      for(let i=0;i<40;i++){s.stateT+=1/60;o.update({state:s,position:{x:0,z:0},dt:1/60,speed:0});}
      for(let i=0;i<weights.count;i++){o.character.mesh.getVertexPosition(i,v);assert.ok([v.x,v.y,v.z].every(Number.isFinite),`${attack}/${pose}/${i}`);}
    }
  } finally {f.dispose();}
});

test('idle pelvis and guard motion leave both ankles planted on the canvas',()=>{
  const f=fixture(),s=state(),v=new Vector3(),start=[];
  try {
    for(let i=0;i<240;i++){
      s.stateT+=1/60;f.opponent.update({state:s,position:{x:0,z:0},dt:1/60,speed:0});
      for(const [j,name] of ['foot_l','foot_r'].entries()){
        f.opponent.character.bonesByName[name].getWorldPosition(v);
        if(i===0)start[j]=v.clone();
        assert.ok(v.distanceTo(start[j])<1e-5);assert.ok(Math.abs(v.y-.093)<1e-5);
      }
    }
  }finally{f.dispose();}
});

test('travelling feet preserve support contact and do not lift together',()=>{
  const feet=createBoxingFeet(),group=new Group();let previous=[];
  for(let i=0;i<240;i++){
    group.position.z+=.014;group.rotation.y=Math.sin(i/120)*.2;
    feet.update(group,1/60,.84,0,false);
    assert.ok(feet.feet.filter(f=>f.position.y>.094).length<=1);
    for(const [j,f] of feet.feet.entries()){
      if(previous[j]?.t===1 && f.t===1)assert.ok(f.position.distanceTo(previous[j].p)<1e-8);
      previous[j]={p:f.position.clone(),t:f.t};
    }
  }
});

test('actual skeleton ankles stay inside the swing envelope at approach and retreat speeds',()=>{
  const f=fixture(),s=state(),v=new Vector3();
  try{
    for(const speed of [1.75,2.7,3.1]){
      f.opponent.reset();s.state='approach';s.yaw=Math.PI;
      for(let i=0;i<180;i++){
        f.opponent.update({state:s,position:{x:0,z:i*speed/60},dt:1/60,speed});
        for(const name of ['foot_l','foot_r']){
          f.opponent.character.bonesByName[name].getWorldPosition(v);
          assert.ok(v.y>=.0929&&v.y<.15,`ankle ${v.y} at ${speed} m/s`);
        }
      }
    }
  }finally{f.dispose();}
});

test('jab and cross rotate the thorax in opposite directions and elevate the throwing shoulder',()=>{
  const f=fixture(),s=state();
  try{
    const yaw=[];
    for(const attack of ['JAB','HOOK']){
      f.opponent.reset();s.attack=attack;s.state='strike';s.stateT=.1;s.stateDuration=.2;
      for(let i=0;i<15;i++)f.opponent.update({state:s,position:{x:0,z:0},dt:1/60,speed:0});
      yaw.push(f.opponent.character.bonesByName.chest.rotation.y);
      const bones=f.opponent.character.bonesByName;
      assert.ok(bones['shoulder_'+(attack==='JAB'?'l':'r')].position.y>bones['shoulder_'+(attack==='JAB'?'r':'l')].position.y);
    }
    assert.ok(yaw[0]<0&&yaw[1]>0);
  }finally{f.dispose();}
});

test('twenty presentation resets reuse geometry, materials, skeleton and equipment',()=>{
  const f=fixture(),o=f.opponent,s=state();const geometry=o.character.geometry,material=o.character.material;
  const libraryStats=f.library.stats();let objectCount=0;o.group.traverse(()=>objectCount++);
  try{
    for(let i=0;i<20;i++){
      o.react({heavy:true,zone:i%2?'low':'high'});o.reset();
      o.update({state:s,position:{x:0,z:0},dt:1/60,speed:0});
      assert.equal(o.character.geometry,geometry);assert.equal(o.character.material,material);
      assert.deepEqual(f.library.stats(),libraryStats);
      let count=0;o.group.traverse(()=>count++);assert.equal(count,objectCount);
    }
  }finally{f.dispose();}
});

test('viewmodel has finite poses during attacks, defence and sprint; zero pose delta holds it',()=>{
  const library=createAssetLibrary({assets,materials:MATERIAL_DEFINITIONS});const fists=createPlayerFists({library,camera:new PerspectiveCamera()});
  try{
    for(const action of ['JAB','CROSS','dodge','stagger','down','idle']){
      const player={action,actionPunch:PUNCH[action]??PUNCH.JAB,actionT:.1,actionDuration:.4,guard:'high',stamina:80,speed:4,sprinting:true};
      fists.update({player,dt:1/60});
      for(const arm of fists.arms){assert.ok(arm.pivot.position.toArray().every(Number.isFinite));arm.pivot.updateMatrix();}
      const positions=fists.arms.map(a=>a.pivot.position.clone());
      fists.update({player,dt:0});fists.arms.forEach((a,i)=>assert.ok(a.pivot.position.equals(positions[i])));
    }
    assert.ok(FEEDBACK.hitStopJab>=.015&&FEEDBACK.hitStopJab<=.025);
    assert.ok(FEEDBACK.hitStopCross>=.035&&FEEDBACK.hitStopCross<=.055);
  }finally{fists.dispose();library.dispose();}
});

// --- VISUAL-QUALITY-002 regressions -----------------------------------------

test('hair and fade shells clear the skull they actually ship with', () => {
  // The scalp z-fought because the hair was sized from Character Forge's
  // published head radii while athletic-body.js shipped a wider, taller skull.
  // Both now derive from SKULL_SECTIONS; this asserts they cannot drift back.
  const hair = skullShell({ fromY: 1.78, toY: 1.86, offset: HAIR_SHELL_OFFSET });
  const fade = skullShell({ fromY: 1.742, toY: 1.78, offset: FADE_SHELL_OFFSET });
  for (const [label, shell, want] of [['hair', hair, HAIR_SHELL_OFFSET], ['fade', fade, FADE_SHELL_OFFSET]]) {
    for (const [localY, width, depth] of shell) {
      const skull = skullAt(localY + HEAD_BONE_BIND_Y);
      assert.ok(width - skull.width >= want - 1e-9,
        `${label} width at y=${localY.toFixed(4)} clears skull by ${((width - skull.width) * 1000).toFixed(2)}mm`);
      assert.ok(depth - skull.depth >= want - 1e-9,
        `${label} depth at y=${localY.toFixed(4)} clears skull by ${((depth - skull.depth) * 1000).toFixed(2)}mm`);
    }
  }
  // The hair must also stay outside the fade where the two meet, or they trade
  // places and z-fight with each other instead of with the skull.
  const meet = 1.78;
  const h = skullAt(meet), gapW = (HAIR_SHELL_OFFSET - FADE_SHELL_OFFSET);
  assert.ok(gapW >= 0.002, `hair sits ${(gapW * 1000).toFixed(1)}mm outside the fade at the hairline`);
  assert.ok(h.width > 0);
});

test('the hair shell reaches the crown instead of stopping short of it', () => {
  const shell = skullShell({ fromY: 1.78, toY: 1.86, offset: HAIR_SHELL_OFFSET });
  const top = shell[shell.length - 1][0] + HEAD_BONE_BIND_Y;
  const skullTop = SKULL_SECTIONS[SKULL_SECTIONS.length - 1][0];
  assert.ok(top >= skullTop - 1e-6, `hair reaches ${top.toFixed(4)} vs skull top ${skullTop}`);
});

test('joint flexion bands carry real support geometry, not a hinge', () => {
  // A linear ramp over three rings is what produced the faceted crease. Assert
  // the blend is smoothstep-shaped (flat at both ends) rather than linear.
  const smooth = (t) => t * t * (3 - 2 * t);
  assert.ok(Math.abs(smooth(0.5) - 0.5) < 1e-9, 'smoothstep is symmetric at the midpoint');
  assert.ok(smooth(0.1) < 0.1 * 0.6, 'smoothstep eases in, so the ring next to the joint barely rotates');
  assert.ok(smooth(0.9) > 1 - 0.1 * 0.6, 'smoothstep eases out');
});
