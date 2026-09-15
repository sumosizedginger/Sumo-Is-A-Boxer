import {Group,Mesh,SphereGeometry,MeshStandardMaterial,Float32BufferAttribute} from 'three';
export function createBoxerEyes(character){
 const root=new Group();root.name='hero-eyes';const eyes=[];const h=character.landmarks.head;
 for(const side of ['L','R']){const center=character.faceDesign.landmarks['eyeCenter.'+side],geometry=new SphereGeometry(.0128,96,64).rotateX(Math.PI/2),p=geometry.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getY(i)),f=p.getZ(i)>0;let c=f&&r<.0023?[.018,.018,.018]:f&&r<.0054?[.22,.24,.23]:[.67,.67,.64];colors.push(...c);}
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));const material=new MeshStandardMaterial({vertexColors:true,color:0xffffff,roughness:.46,metalness:0});
  const mesh=new Mesh(geometry,material);mesh.name='hero-eye-'+side;mesh.position.set(center[0]-h.x,center[1]-h.y,center[2]-h.z);mesh.userData.heroEye=true;mesh.userData.eyeMaterial=material;mesh.frustumCulled=false;root.add(mesh);eyes.push(mesh);
 }character.bonesByName.head.add(root);
 return {root,eyes,dispose(){root.removeFromParent();for(const eye of eyes){eye.geometry.dispose();eye.userData.eyeMaterial.dispose();}root.clear();}};
}
