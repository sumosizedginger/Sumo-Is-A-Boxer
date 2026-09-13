import { SkinnedMesh, Float32BufferAttribute, Uint16BufferAttribute } from 'three';

// The waistband owns the top of each panel; the thigh owns its hanging hem.
// Bind in the attachment's actual world frame, including the rear-leg half turn.
export function skinTrunkPanel(source,character,side) {
  const geometry=source.geometry.clone(),p=geometry.attributes.position;
  const indices=new Uint16Array(p.count*4),weights=new Float32Array(p.count*4);
  const thigh=character.bones.findIndex(b=>b.name==='thigh_'+side),pelvis=character.bones.findIndex(b=>b.name==='pelvis');
  for(let i=0;i<p.count;i++) {
    const t=Math.max(0,Math.min(1,(p.getY(i)+.18)/.22)),anchor=.62*t*t*(3-2*t);
    indices[i*4]=thigh;indices[i*4+1]=pelvis;weights[i*4]=1-anchor;weights[i*4+1]=anchor;
  }
  geometry.setAttribute('skinIndex',new Uint16BufferAttribute(indices,4));geometry.setAttribute('skinWeight',new Float32BufferAttribute(weights,4));
  const mesh=new SkinnedMesh(geometry,source.material);mesh.name=source.name;mesh.frustumCulled=false;
  return {mesh,bind(){mesh.updateWorldMatrix(true,false);mesh.bind(character.mesh.skeleton,mesh.matrixWorld.clone());},dispose(){geometry.dispose();}};
}
