import { Color, Group, HemisphereLight, DirectionalLight, Mesh, PlaneGeometry, MeshStandardMaterial, Vector3 } from 'three';
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
      const r=angle*Math.PI/180;camera.position.set(Math.sin(r)*distance,elevation,Math.cos(r)*distance);
      camera.lookAt(look.set(0,targetY,0));camera.fov=38;
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
    distance=3.6;elevation=1.15;targetY=.98;cameraView();renderer.render(scene,camera);return state;
  }
  const view=()=>[angle,elevation,distance,targetY];
  function restoreView(v){[angle,elevation,distance,targetY]=v;cameraView();}
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
  function metrics(){return {state:name,playing,animationUpdateMs:animationMs,opponentSkinTriangles:opponent.character.geometry.index.count/3,opponentEquipmentTriangles:inventory(opponent.group).triangles-opponent.character.geometry.index.count/3,firstPerson:inventory(fists.root),scene:inventory(scene),report:game.report()};}
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
  lighting();show(new URLSearchParams(location.search).get('model')??'front_neutral');
  return {states:Object.keys(MODEL_STATES),show,play,pause(){playing=false;},scrub:seek,
    orbit(degrees){angle=degrees;cameraView();},focus,lighting,frame,sample,metrics,
    controls(on){controls.style.display=on?'flex':'none';},rotate(on=true){spin=on;},
    capture(){controls.style.display='none';renderer.render(scene,camera);return renderer.domElement.toDataURL('image/png');},
    dispose(){controls.remove();floor.removeFromParent();floor.geometry.dispose();floor.material.dispose();key.shadow.map?.dispose();neutral.removeFromParent();neutral.clear();},
  };
}
