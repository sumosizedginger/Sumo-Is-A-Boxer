import { BufferGeometry, Float32BufferAttribute } from 'three';
import { bell } from './anatomy-fields.js';

// Relative morphs run through Three's public morph/skinning path. All vertex
// and normal buffers are built once; update changes ten preallocated scalars.
export function createAnatomicalCorrections(character) {
  const geometry = character.geometry, position = geometry.attributes.position;
  const skinIndex = geometry.attributes.skinIndex, skinWeight = geometry.attributes.skinWeight;
  const bones = character.bonesByName, L = character.landmarks;
  const channels = [];
  function belongs(vertex, names) {
    let weight = 0;
    for (let k = 0; k < 4; k++) if (names.includes(character.bones[skinIndex.array[vertex*4+k]]?.name)) weight += skinWeight.array[vertex*4+k];
    return weight;
  }
  function add(name, bone, names, field, limit) {
    const delta = new Float32Array(position.count*3), shaped = new Float32Array(position.array);
    const scratch = [0,0,0];
    for (let i=0;i<position.count;i++) {
      const w=belongs(i,names); if(w<.001)continue;
      scratch.fill(0); field(position.getX(i),position.getY(i),position.getZ(i),scratch);
      const length=Math.hypot(...scratch), scale=w*Math.min(1,limit/Math.max(length,1e-9));
      for(let k=0;k<3;k++){delta[i*3+k]=scratch[k]*scale;shaped[i*3+k]+=delta[i*3+k];}
    }
    const temp=new BufferGeometry();temp.setIndex(geometry.index);temp.setAttribute('position',new Float32BufferAttribute(shaped,3));temp.computeVertexNormals();
    const normalDelta=new Float32Array(temp.attributes.normal.array);
    for(let i=0;i<normalDelta.length;i++)normalDelta[i]-=geometry.attributes.normal.array[i];
    temp.dispose();
    const attr=new Float32BufferAttribute(delta,3);attr.name=name;
    geometry.morphAttributes.position.push(attr);
    geometry.morphAttributes.normal.push(new Float32BufferAttribute(normalDelta,3));
    channels.push({name,bone,limit,rest:bone.quaternion.clone()});
  }
  geometry.morphAttributes.position=[];geometry.morphAttributes.normal=[];geometry.morphTargetsRelative=true;
  for(const side of ['l','r']) {
    const key=side==='l'?'L':'R',sign=side==='l'?1:-1;
    const shoulder=L['shoulder.'+key],elbow=L['elbow.'+key],knee=L['knee.'+key],hip=L['hip.'+key];
    add('deltoid-'+side,bones['upperarm_'+side],['upperarm_'+side,'shoulder_'+side],(x,y,z,d)=>{
      const w=bell(y,shoulder.y-.025,.085);d[0]=sign*.010*w;d[2]=z*.12*w;
    },.012);
    add('elbow-'+side,bones['forearm_'+side],['upperarm_'+side,'forearm_'+side],(x,y,z,d)=>{
      const w=bell(y,elbow.y,.052);d[2]=Math.min(0,z)*.14*w;
      d[0]=(x-elbow.x)*.12*w;d[2]+=.009*bell(y,elbow.y+.12,.073)*Math.max(0,z/.09);
    },.011);
    add('knee-'+side,bones['shin_'+side],['thigh_'+side,'shin_'+side],(x,y,z,d)=>{
      const w=bell(y,knee.y,.052);d[2]=.009*w*Math.max(0,z/.095);d[0]=(x-hip.x)*.07*w;
    },.010);
    add('hip-'+side,bones['thigh_'+side],['thigh_'+side],(x,y,z,d)=>{
      const w=bell(y,hip.y-.075,.078);d[2]=Math.min(0,z)*.065*w;
    },.006);
  }
  add('thorax-twist',bones.chest,['spine','chest'],(x,y,z,d)=>{
    const w=bell(y,1.31,.12);d[0]=x*.022*w;d[2]=z*.035*w;
  },.006);
  add('neck-turn',bones.head,['neck'],(x,y,z,d)=>{
    const w=bell(y,1.60,.045);d[0]=x*.05*w;d[2]=z*.04*w;
  },.004);
  character.mesh.updateMorphTargets();
  const influences=character.mesh.morphTargetInfluences;
  const limits=Object.freeze(channels.map(c=>c.limit));
  return {
    names:Object.freeze(channels.map(c=>c.name)), limits, influences,
    update() {
      for(let i=0;i<channels.length;i++) {
        const c=channels[i],dot=Math.abs(c.rest.dot(c.bone.quaternion));
        const angle=2*Math.acos(Math.min(1,dot));
        const t=Math.max(0,Math.min(1,(angle-.20)/1.65));
        influences[i]=t*t*(3-2*t);
      }
    },
    reset(){influences.fill(0);},
  };
}
