import {validateTopology,HERO_BODY_TOPOLOGY_POLICY} from '@sumosizedginger/my-game-engine-1.0/full';
import { Color, Group, HemisphereLight, DirectionalLight, Mesh, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, MeshNormalMaterial, Vector3 } from 'three';
import { MODEL_STATES, poseModels, prepareModelPose } from './model-poses.js';

export function createModelInspection(game) {
  const {scene,camera,renderer,opponent,fists,presentation}=game;
  const backdrop={background:scene.background,fog:scene.fog};
  const neutral=new Group();neutral.name='validation-model-lighting';scene.add(neutral);
  neutral.add(new HemisphereLight(0xffffff,0x454545,1.1));
  const key=new DirectionalLight(0xffffff,2.6);key.position.set(2.5,3.5,3);neutral.add(key);
  key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.camera.left=-2;key.shadow.camera.right=2;key.shadow.camera.top=3;key.shadow.camera.bottom=-2;key.shadow.normalBias=.004;
  const fill=new DirectionalLight(0xffffff,.85);fill.position.set(-2,2,-3);neutral.add(fill);
  const floor=new Mesh(new PlaneGeometry(12,12),new MeshStandardMaterial({color:0x363636,roughness:1}));
  floor.name='validation-contact-plane';floor.rotation.x=-Math.PI/2;floor.position.y=.003;floor.receiveShadow=true;scene.add(floor);
  const ringLights=scene.getObjectByName('light-rig');
  let name='front_neutral',angle=0,elevation=1.15,distance=3.6,targetY=.98,playing=false,spin=false,last=null,rehearsal=null,accumulator=0,animationMs=0;
  let targetX=0,targetZ=0;
  const look=new Vector3();
  const controls=document.createElement('div');controls.dataset.modelInspection='true';
  controls.style.cssText='position:fixed;left:12px;top:12px;z-index:200;color:#eee;background:#202020;padding:10px;font:12px monospace;display:flex;gap:8px;align-items:center;flex-wrap:wrap;max-width:85vw';
  const select=document.createElement('select');select.setAttribute('aria-label','Model inspection state');
  for(const state of Object.keys(MODEL_STATES)){const option=document.createElement('option');option.value=state;option.textContent=state;select.append(option);}
  const scrub=document.createElement('input');scrub.type='range';scrub.min='0';scrub.max='1';scrub.step='.008333';scrub.value='0';scrub.setAttribute('aria-label','Motion progress');
  const orbit=document.createElement('input');orbit.type='range';orbit.min='-180';orbit.max='180';orbit.value='0';orbit.setAttribute('aria-label','Orbit angle');
  const label=document.createElement('span');label.textContent='MODEL ONLY';
  controls.append(label,select,scrub,orbit);document.body.append(controls);
  function button(text,fn){const b=document.createElement('button');b.textContent=text;b.onclick=fn;controls.append(b);return b;}
  function cameraView(){
    if(MODEL_STATES[name].fp){
      camera.position.set(0,1.65,0);camera.rotation.set(0,Math.PI,0);camera.fov=68;
      if(MODEL_STATES[name].closeup){
        const left=fists.arms[0],right=fists.arms[1];right.pivot.visible=false;
        const glove=MODEL_STATES[name].closeup==='glove';
        left.pivot.position.set(0,glove?-.31:-.04,glove?-.44:-.38);
        left.pivot.rotation.set(-.12,0,0);left.rollNode.rotation.y=2.6;
        camera.fov=42;
      }
    }else{
      const r=angle*Math.PI/180;camera.position.set(targetX+Math.sin(r)*distance,elevation,targetZ+Math.cos(r)*distance);
      camera.lookAt(look.set(targetX,targetY,targetZ));camera.fov=38;
    }
    camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
  }
  function lighting(mode='neutral'){
    const clean=mode==='neutral';neutral.visible=clean;presentation.root.visible=false;if(ringLights)ringLights.visible=!clean;
    scene.background=clean?new Color(0x303030):backdrop.background;scene.fog=clean?null:backdrop.fog;
  }
  function show(state,progress=null){
    if(!MODEL_STATES[state])throw new Error('Unknown model state: '+state);
    playing=false;name=state;select.value=state;
    const p=poseModels(game,state,progress);angle=p.angle??0;orbit.value=String(angle);
    fists.arms.forEach(a=>a.pivot.visible=true);opponent.group.visible=!p.fp;fists.root.visible=!!p.fp;
    targetX=0;targetZ=0;distance=3.6;elevation=1.15;targetY=.98;cameraView();renderer.render(scene,camera);return state;
  }
  const view=()=>[angle,elevation,distance,targetY,targetX,targetZ];
  function restoreView(v){[angle,elevation,distance,targetY,targetX,targetZ]=v;cameraView();}
  function seek(t){const v=view();show(name,t);restoreView(v);}
  function play(state=name){const v=state===name?view():null;show(state,0);if(v)restoreView(v);rehearsal=prepareModelPose(game,state);playing=true;last=null;accumulator=0;}
  function frame(now){
    const dt=last===null?0:Math.min(.05,(now-last)/1000);last=now;
    animationMs=0;
    if(playing){
      const start=performance.now();accumulator+=dt;
      while(accumulator>=1/120){
        if(rehearsal.elapsed>=rehearsal.duration+.35)rehearsal=prepareModelPose(game,name);
        rehearsal.step();accumulator-=1/120;
      }
      animationMs=performance.now()-start;scrub.value=String(Math.min(1,rehearsal.elapsed/rehearsal.duration));
    }
    if(spin&&!MODEL_STATES[name].fp){angle=(angle+dt*22)%360;orbit.value=String(angle>180?angle-360:angle);}
    if(playing||spin)cameraView();
  }
  function inventory(root){let triangles=0;const materials=new Set(),geometries=new Set();root.traverse(o=>{if(o.isMesh){triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:[o.material])materials.add(m);}});return {triangles,materials:materials.size,geometries:geometries.size};}
  function metrics(){return {headGenerationMs:opponent.character.faceDesign?.generationMs??null,eyeballDrawCalls:opponent.character.eyeRig?.eyes.length??0,state:name,playing,animationUpdateMs:animationMs,opponentSkinTriangles:opponent.character.geometry.index.count/3,opponentEquipmentTriangles:inventory(opponent.group).triangles-opponent.character.geometry.index.count/3,firstPerson:inventory(fists.root),scene:inventory(scene),report:game.report()};}
  async function sample(durationMs=5000){
    const intervals=[],costs=[],start=performance.now();let previous=await new Promise(requestAnimationFrame);
    while(performance.now()-start<durationMs){
      const now=await new Promise(requestAnimationFrame);if(document.visibilityState!=='visible')throw new Error('Model benchmark lost foreground visibility');
      intervals.push(now-previous);costs.push(animationMs);previous=now;
    }
    const sorted=[...intervals].sort((a,b)=>a-b),cost=[...costs].sort((a,b)=>a-b),pct=(s,p)=>s[Math.floor((s.length-1)*p)]??null;
    return {method:'Foreground RAF intervals in current model presentation; includes vsync, not GPU execution time',fps:intervals.length*1000/intervals.reduce((a,b)=>a+b,0),frameMs:{p50:pct(sorted,.5),p95:pct(sorted,.95),p99:pct(sorted,.99)},animationMs:{p50:pct(cost,.5),p95:pct(cost,.95),p99:pct(cost,.99)},frames:intervals,metrics:metrics()};
  }
  select.onchange=()=>show(select.value);scrub.oninput=()=>seek(Number(scrub.value));orbit.oninput=()=>{angle=Number(orbit.value);cameraView();};
  button('Play',()=>play());button('Pause',()=>playing=false);button('Rotate',()=>spin=!spin);
  button('Face',()=>focus('face'));button('Full body',()=>focus('body'));
  button('Neutral light',()=>lighting('neutral'));button('Ring light',()=>lighting('ring'));button('Hide controls',()=>controls.style.display='none');
  function focus(region){if(MODEL_STATES[name].fp)return;targetY=region==='face'?1.665:region==='torso'?1.34:.98;elevation=targetY+.04;distance=region==='face'?.65:region==='torso'?1.4:3.6;cameraView();}
  const skin=opponent.character.mesh,originalMaterial=skin.material;
  const bodyMaterial=new MeshStandardMaterial({color:0xb2b5ba,roughness:.82,metalness:0});
  const savedVisibility=new Map();
  const diagnostic=document.createElement('pre');diagnostic.style.cssText='position:fixed;bottom:8px;left:12px;background:#151515dd;color:#abf5c8;padding:10px;font:12px monospace;pointer-events:none;display:none';document.body.append(diagnostic);
  function equipment(visible){
    opponent.group.traverse(o=>{if(o.isMesh&&o!==skin){if(!savedVisibility.has(o))savedVisibility.set(o,o.visible);o.visible=visible?savedVisibility.get(o):false;}});
  }
  function certification(){
    const g=opponent.character.geometry,report=validateTopology(g,{policy:HERO_BODY_TOPOLOGY_POLICY});let skinWeightViolationCount=0;
    for(let i=0;i<g.attributes.skinWeight.count;i++){let sum=0;for(let j=0;j<4;j++)sum+=g.attributes.skinWeight.array[i*4+j];if(!Number.isFinite(sum)||Math.abs(sum-1)>=1e-5)skinWeightViolationCount++;}
    return {...report,skinWeightViolationCount,source:'live opponent.character.geometry',template:opponent.character.bodyTemplate.id};
  }
  function bodyMode(mode='shaded'){
    if(!['shaded','wireframe','diagnostic','production'].includes(mode))throw new Error('Unknown body inspection mode');
    equipment(mode==='production');skin.material=mode==='production'?originalMaterial:bodyMaterial;bodyMaterial.wireframe=mode==='wireframe'||mode==='diagnostic';
    diagnostic.style.display=mode==='diagnostic'?'block':'none';
    if(mode==='diagnostic'){const r=certification();diagnostic.textContent='ACTUAL HERO SKIN\n'+['vertexCount','triangleCount','boundaryEdgeCount','boundaryLoopCount','nonManifoldEdgeCount','degenerateTriangleCount','connectedComponentCount','skinWeightViolationCount'].map(k=>k+': '+r[k]).join('\n');}
    renderer.render(scene,camera);
  }
  const bodyViews={front:[0],rear:[180],left_profile:[90],right_profile:[-90],front_three_quarter:[35],rear_three_quarter:[145],neck:[25,'neck'],left_shoulder:[35,'upperarm_l'],right_shoulder:[-35,'upperarm_r'],left_axilla:[60,'upperarm_l',-.09],right_axilla:[-60,'upperarm_r',-.09],pelvis_hip:[30,'pelvis',-.09],glute_hip:[160,'pelvis',-.09],elbow:[70,'forearm_l'],knee:[35,'shin_l']};
  function bodyView(name){
    const v=bodyViews[name];if(!v)throw new Error('Unknown body view');
    angle=v[0];targetX=targetZ=0;targetY=.98;elevation=1.15;distance=3.6;
    if(v[1]){opponent.group.updateMatrixWorld(true);opponent.character.bonesByName[v[1]].getWorldPosition(look);targetX=look.x;targetY=look.y+(v[2]??0);targetZ=look.z;elevation=targetY+.035;distance=v[1]==='pelvis'?1.1:.68;}
    cameraView();renderer.render(scene,camera);
  }
  button('Body skin',()=>bodyMode('shaded'));button('Wireframe',()=>bodyMode('wireframe'));button('Topology diagnostics',()=>bodyMode('diagnostic'));button('Equipment',()=>bodyMode('production'));
  const bodySelect=document.createElement('select');bodySelect.setAttribute('aria-label','Body topology view');for(const n of Object.keys(bodyViews)){const o=document.createElement('option');o.value=n;o.textContent=n;bodySelect.append(o);}bodySelect.onchange=()=>bodyView(bodySelect.value);controls.append(bodySelect);
  const silhouetteMaterial=new MeshBasicMaterial({color:0x151719}),normalMaterial=new MeshNormalMaterial();
  let headHair=false,headModeName='clay';
  const headViews={front:[0],left_profile:[90],right_profile:[-90],front_left_three_quarter:[35],front_right_three_quarter:[-35],rear:[180],rear_left_three_quarter:[145],rear_right_three_quarter:[-145],high_angle:[20,null,.30],low_angle:[20,null,-.27],eye_closeup:[0,'eyeCenter.L'],nose_closeup:[30,'noseTip'],mouth_closeup:[15,'upperLipCenter'],left_ear:[90,'earCenter.L'],right_ear:[-90,'earCenter.R'],jaw_neck:[65,'chin']};
  function headMode(mode='clay'){
    if(!['clay','production','wireframe','silhouette','normals'].includes(mode))throw new Error('Unknown head mode');headModeName=mode;
    bodyMode(mode==='production'?'production':mode==='wireframe'?'wireframe':'shaded');
    if(mode==='normals')skin.material=normalMaterial;
    if(mode==='silhouette'){skin.material=silhouetteMaterial;scene.background=new Color(0xc4c7ca);}else scene.background=new Color(0x303030);
    opponent.group.traverse(o=>{if(o.userData.heroEye){o.visible=mode!=='wireframe';o.material=mode==='silhouette'?silhouetteMaterial:o.userData.eyeMaterial;}if(o.isMesh&&o.name.includes('asset.boxer.head.detail'))o.visible=headHair;});
    renderer.render(scene,camera);
  }
  function headView(name){const v=headViews[name];if(!v)throw new Error('Unknown head camera');
    angle=v[0];targetX=0;targetZ=0;targetY=1.665;elevation=targetY+.04+(v[2]??0);distance=.65;
    const landmark=opponent.character.faceDesign?.landmarks[v[1]];
    if(landmark){const h=opponent.character.landmarks.head;look.set(landmark[0]-h.x,landmark[1]-h.y,landmark[2]-h.z).applyMatrix4(opponent.character.bonesByName.head.matrixWorld);targetX=look.x;targetY=look.y;targetZ=look.z;elevation=targetY+.01;distance=v[1]==='chin'?.42:.25;}
    cameraView();renderer.render(scene,camera);
  }
  const headSelect=document.createElement('select');headSelect.setAttribute('aria-label','Head inspection camera');for(const name of Object.keys(headViews)){const o=document.createElement('option');o.value=name;o.textContent='Head: '+name;headSelect.append(o);}headSelect.onchange=()=>headView(headSelect.value);controls.append(headSelect);
  for(const mode of ['clay','production','wireframe','silhouette','normals'])button('Head '+mode,()=>{headMode(mode);headView(headSelect.value);});button('Hair toggle',()=>{headHair=!headHair;headMode(headModeName);});
  lighting();show(new URLSearchParams(location.search).get('model')??'front_neutral');
  return {head:{mode:headMode,view:headView,views:Object.keys(headViews),hair(on){headHair=on;headMode(headModeName);}},body:{mode:bodyMode,equipment,view:bodyView,views:Object.keys(bodyViews),certification},states:Object.keys(MODEL_STATES),show,play,pause(){playing=false;},scrub:seek,
    orbit(degrees){angle=degrees;cameraView();},focus,lighting,frame,sample,metrics,
    controls(on){controls.style.display=on?'flex':'none';},rotate(on=true){spin=on;},
    capture(){controls.style.display='none';renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},
    dispose(){normalMaterial.dispose();silhouetteMaterial.dispose();skin.material=originalMaterial;bodyMaterial.dispose();diagnostic.remove();controls.remove();floor.removeFromParent();floor.geometry.dispose();floor.material.dispose();key.shadow.map?.dispose();neutral.removeFromParent();neutral.clear();},
  };
}
