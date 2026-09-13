// Runtime assembly of the certified canonical skin. Equipment stays separate.
import {createHeroCharacterArtifact,certifyHeroBody,createHeroRuntimeGeometry,createTopologySurface} from '@sumosizedginger/my-game-engine-1.0/full';
import {generateContinuousBody,skinContinuousBody,BODY_REGIONS} from './continuous-body.js';
import {createAnatomicalCorrections} from './corrective-deformation.js';

export function rebuildAthleticBody(character,skinDefinition){
  const generated=generateContinuousBody(character.landmarks);
  const surface=skinContinuousBody(generated.surface,character),geometry=createHeroRuntimeGeometry(surface);
  geometry.name='certified-continuous-hero-skin';
  character.geometry.dispose();character.geometry=geometry;character.mesh.geometry=geometry;
  const corrections=createAnatomicalCorrections(character);
  const semanticLandmarks={...character.landmarks,crown:{x:0,y:1.86,z:-.013},jaw:{x:0,y:1.67,z:.06},neckBase:{x:0,y:1.55,z:-.01},sternum:{x:0,y:1.40,z:.16},waist:{x:0,y:1.17,z:0}};
  character.heroArtifact=createHeroCharacterArtifact({id:'hero.boxer.continuous-body',geometry:{...createTopologySurface(geometry),forwardAxis:'+Z',metadata:{template:generated.template,vertexDomains:surface.metadata.domains}},coreSkeleton:character.bonesData.slice(0,22),deformationSkeleton:character.deformationJoints??[],semanticLandmarks,
    semanticRegions:Object.entries(BODY_REGIONS).map(([name,id])=>({name,id})),materialRegions:geometry.groups.map((_,i)=>({partId:'group-'+i,materialId:skinDefinition.id})),
    poseDrivers:corrections.poseDrivers,provenance:{status:'certified-topology',assembly:generated.template,activation:corrections.activationMode}});
  character.bodyCertification=certifyHeroBody(character.heroArtifact);
  character.bodyTemplate={id:character.heroArtifact.geometry.metadata.template,domains:character.heroArtifact.geometry.metadata.vertexDomains};
  return {meshIR:surface,vertices:geometry.attributes.position.count,triangles:geometry.index.count/3,corrections};
}
