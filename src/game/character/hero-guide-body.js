import {sculptBoxerHead,FACE_REGIONS,facialRegionAt} from './hero-face.js';
// Runtime assembly of the certified canonical skin. Equipment stays separate.
import {createHeroCharacterArtifact,certifyHeroBody,createHeroRuntimeGeometry,createTopologySurface} from '@sumosizedginger/my-game-engine-1.0/full';
import {generateContinuousBody,skinContinuousBody,BODY_REGIONS} from './continuous-body.js';
import {createAnatomicalCorrections} from './corrective-deformation.js';

export function rebuildSumoGuideBody(character,skinDefinition){
  const generated=generateContinuousBody(character.landmarks);
  const face=sculptBoxerHead(generated.surface);
  const surface=skinContinuousBody(face.surface,character),geometry=createHeroRuntimeGeometry(surface);
  const neck=character.bones.findIndex(b=>b.name==='neck'),head=character.bones.findIndex(b=>b.name==='head');
  for(let i=0;i<geometry.attributes.position.count;i++){const y=geometry.attributes.position.getY(i);if(y<=1.60)continue;const t=Math.max(0,Math.min(1,(y-1.60)/.05)),blend=t*t*(3-2*t);for(let j=0;j<4;j++){geometry.attributes.skinIndex.array[i*4+j]=j===0?head:neck;geometry.attributes.skinWeight.array[i*4+j]=j===0?blend:j===1?1-blend:0;}}

  for(let i=0;i<geometry.attributes.position.count;i++){
    const p=geometry.attributes.position,name=facialRegionAt(p.getX(i),p.getY(i),p.getZ(i));
    if(name)geometry.attributes.regionId.setX(i,FACE_REGIONS[name]);
  }
  geometry.name='certified-continuous-hero-skin';
  character.geometry.dispose();character.geometry=geometry;character.mesh.geometry=geometry;
  const corrections=createAnatomicalCorrections(character);
  const semanticLandmarks={...character.landmarks,...Object.fromEntries(Object.entries(face.landmarks).map(([name,p])=>[name,{x:p[0],y:p[1],z:p[2]}])),jaw:{x:face.landmarks.chin[0],y:face.landmarks.chin[1],z:face.landmarks.chin[2]},neckBase:{x:0,y:1.55,z:-.01},sternum:{x:0,y:1.40,z:.16},waist:{x:0,y:1.17,z:0}};
  character.heroArtifact=createHeroCharacterArtifact({id:'hero.sumo.guide-body',geometry:{...createTopologySurface(geometry),forwardAxis:'+Z',metadata:{template:generated.template,vertexDomains:surface.metadata.domains,face:{version:1,parameters:face.parameters,landmarks:face.landmarks,frames:face.frames,topology:"orbital-auricular-patches-v1",eyes:{radius:.0128,forwardAxis:[0,0,1],orientation:[0,0,0,1]},stages:["skull-fit","anatomical-fields","feature-constraints","relaxation","stitched-orbital-pockets","stitched-auricles","semantic-landmark-fit"]}}},coreSkeleton:character.bonesData.slice(0,22),deformationSkeleton:character.deformationJoints??[],semanticLandmarks,
    semanticRegions:Object.entries({...BODY_REGIONS,...FACE_REGIONS}).map(([name,id])=>({name,id})),materialRegions:geometry.groups.map((_,i)=>({partId:'group-'+i,materialId:skinDefinition.id})),
    poseDrivers:corrections.poseDrivers,provenance:{status:'certified-topology',assembly:generated.template,activation:corrections.activationMode}});
  const {surface:authoredSurface,...faceDefinition}=face;
  character.faceDesign=faceDefinition;
  character.bodyCertification=certifyHeroBody(character.heroArtifact);
  character.bodyTemplate={id:character.heroArtifact.geometry.metadata.template,domains:character.heroArtifact.geometry.metadata.vertexDomains};
  return {meshIR:surface,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3,corrections};
}
