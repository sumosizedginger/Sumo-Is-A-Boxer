import { BufferGeometry, Float32BufferAttribute } from 'three';
import { bell } from './anatomy-fields.js';

// Each asset geometry is library-owned. Morph targets are installed once, while
// every placement owns its scalar influence and may be posed independently.
export function createEquipmentCorrection(mesh, fp=false) {
  const g=mesh.geometry;
  if(!g.morphAttributes.position) {
    const p=g.attributes.position,delta=new Float32Array(p.count*3),shaped=new Float32Array(p.array);
    for(let i=0;i<p.count;i++) {
      const x=p.getX(i),y=p.getY(i),z=p.getZ(i),h=(y-(fp?.26:0))/(fp?1.05:1);
      const cuff=bell(h,-.035,.045),knuckle=bell(h,.19,.045);
      delta[i*3]=x*.018*cuff;
      delta[i*3+1]=-.0028*knuckle;
      delta[i*3+2]=z*.014*cuff-z*.018*knuckle;
      if(fp){const muscle=bell(y,.08,.07);delta[i*3]+=x*.028*muscle;delta[i*3+2]+=z*.018*muscle;}
      for(let k=0;k<3;k++)shaped[i*3+k]+=delta[i*3+k];
    }
    const temp=new BufferGeometry();temp.setIndex(g.index);temp.setAttribute('position',new Float32BufferAttribute(shaped,3));temp.computeVertexNormals();
    const nd=new Float32Array(temp.attributes.normal.array);for(let i=0;i<nd.length;i++)nd[i]-=g.attributes.normal.array[i];temp.dispose();
    g.morphTargetsRelative=true;g.morphAttributes.position=[new Float32BufferAttribute(delta,3)];g.morphAttributes.normal=[new Float32BufferAttribute(nd,3)];
  }
  mesh.updateMorphTargets();
  return {set(amount){mesh.morphTargetInfluences[0]=Math.max(0,Math.min(1,amount));}};
}
