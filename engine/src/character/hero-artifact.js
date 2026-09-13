import {BufferGeometry,Float32BufferAttribute,SkinnedMesh,MeshStandardMaterial} from 'three';
import {createTopologySurface,TOPOLOGY_ATTRIBUTE_SIZES,copyJson,fail} from '../geometry/topology-surface.js';
import {validateTopology} from '../geometry/topology-analysis.js';
import {CHARACTER_CORE_SKELETON,validateDeformationJoints} from './rig-contract.js';
import {createHumanoidSkeleton} from './skeleton.js';
import {createPoseDriverDefinition} from './pose-drivers.js';

export const HERO_CHARACTER_ARTIFACT_VERSION=1;
export const HERO_BODY_TOPOLOGY_POLICY=Object.freeze(['CLOSED_MANIFOLD','SINGLE_COMPONENT','DEFORMATION_SURFACE']);
function frozen(value){if(value&&typeof value==='object'){for(const v of Object.values(value))frozen(v);Object.freeze(value);}return value;}
export function createHeroCharacterArtifact({id,geometry,coreSkeleton=CHARACTER_CORE_SKELETON,deformationSkeleton=[],semanticRegions=[],semanticLandmarks={},materialRegions=null,attachmentAnchors=null,morphRegistry=null,poseDrivers=[],topologyPolicy=HERO_BODY_TOPOLOGY_POLICY,lod={levels:[],generated:false},provenance={}}){
  if(!id||typeof id!=='string')fail('HERO_ID','Character artifact requires an id');
  if(coreSkeleton.length!==22||coreSkeleton.some((b,i)=>b.name!==CHARACTER_CORE_SKELETON[i].name||b.parent!==CHARACTER_CORE_SKELETON[i].parent||b.index!==i))fail('CORE_SKELETON_IDENTITY','Canonical 22 core names, parents and indices must be preserved');
  for(const bone of coreSkeleton){
    if(bone.restLocalPosition){const p=bone.restLocalPosition,v=Array.isArray(p)?p:[p.x,p.y,p.z];if(v.length!==3||!v.every(Number.isFinite))fail('CORE_REST','Invalid core rest position');}
    if(bone.restOrientation){const q=bone.restOrientation;if(!Array.isArray(q)||q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-6)fail('CORE_REST','Invalid core rest quaternion');}
  }
  const helpers=validateDeformationJoints(deformationSkeleton),s=createTopologySurface(geometry),bones=new Set([...coreSkeleton,...helpers].map(b=>b.name));
  if(s.attributes.skinIndex)for(let i=0;i<s.attributes.skinIndex.length;i++)if(s.attributes.skinWeight[i]>0&&s.attributes.skinIndex[i]>=bones.size)fail('SKIN_JOINT_RANGE','Skin references a missing core/helper joint');
  const drivers=poseDrivers.map(createPoseDriverDefinition),driverIds=new Set();
  for(const driver of drivers){if(driverIds.has(driver.id))fail('DRIVER_IDENTITY','Duplicate pose driver id');driverIds.add(driver.id);for(const j of [driver,...driver.neighbors])if(!bones.has(j.bone))fail('DRIVER_JOINT','Driver refers to a missing semantic joint');}
  const registry=morphRegistry??s.morphTargets.map((m,index)=>({name:m.name,index,relative:m.relative}));
  if(registry.length!==s.morphTargets.length||registry.some((m,i)=>m.index!==i||m.name!==s.morphTargets[i].name||m.relative!==s.morphTargets[i].relative))fail('MORPH_REGISTRY','Morph registry must exactly describe geometry targets in order');
  for(const driver of drivers)for(const sample of driver.samples)if(!registry.some(m=>m.name===sample.output))fail('DRIVER_OUTPUT','Pose sample output must reference a registered morph');
  const anchors=attachmentAnchors??s.anchors;
  for(const a of anchors)if(a.bone&&!bones.has(a.bone))fail('ANCHOR_JOINT','Attachment refers to an unknown joint');
  const availability=Object.fromEntries(['uv','normal','tangent','skinIndex','skinWeight'].map(k=>[k,!!s.attributes[k]]));
  const report=validateTopology(s,{policy:topologyPolicy}),closedReport=validateTopology(s,{policy:HERO_BODY_TOPOLOGY_POLICY});
  // Owned, serializable, deeply immutable snapshot. A caller cannot mutate
  // geometry behind a cached certificate. Runtime buffers are made separately.
  return frozen(copyJson({type:'HeroCharacterArtifact',version:HERO_CHARACTER_ARTIFACT_VERSION,id,geometry:s,coreSkeleton,deformationSkeleton:helpers,
    semanticRegions,semanticLandmarks,materialRegions:materialRegions??s.parts.map(p=>({partId:p.id,materialId:p.materialId})),attachmentAnchors:anchors,
    attributes:availability,morphRegistry:registry,poseDriverRegistry:drivers,topologyReport:report,topologyPolicy:report.policy,
    closedBodyTopology:closedReport,certifiedClosedBody:closedReport.valid&&availability.normal&&availability.uv&&availability.skinIndex&&availability.skinWeight,
    lod,provenance}));
}
export function certifyHeroBody(artifact){
  if(artifact?.type!=='HeroCharacterArtifact'||artifact.version!==1)fail('HERO_VERSION','Unsupported hero artifact');
  createHeroCharacterArtifact({...artifact,poseDrivers:artifact.poseDriverRegistry});
  const report=validateTopology(artifact.geometry,{policy:HERO_BODY_TOPOLOGY_POLICY});
  if(!report.valid)fail('HERO_BODY_NOT_CONTINUOUS','Body failed mandatory closed, single-component deformation topology',{report});
  const s=createTopologySurface(artifact.geometry);
  for(const name of ['uv','normal','skinIndex','skinWeight'])if(!s.attributes[name])fail('HERO_ATTRIBUTE_REQUIRED',`Certification requires ${name}`);
  return frozen(copyJson(report));
}

// Standard Three skinning/semantic shaders declare float attributes. Uint32 GPU
// bindings use integer vertex pointers and cannot feed those declarations.
export function createHeroRuntimeGeometry(input){
  const s=createTopologySurface(input);
  const modes=new Set(s.morphTargets.map(m=>m.relative)),schemas=new Set(s.morphTargets.map(m=>Object.keys(m.attributes).sort().join(',')));
  if(modes.size>1||schemas.size>1||s.morphTargets.some(m=>m.attributes.tangent))fail('MORPH_RUNTIME_ATTRIBUTE','Unsupported runtime morph schema');
  for(const name of ['skinIndex','regionId','region','surfaceId'])if(s.attributes[name]?.some(v=>v>16777216))fail('GPU_ATTRIBUTE_PRECISION','Integer attribute exceeds exact Float32 runtime range',{name});
  const geometry=new BufferGeometry();
  for(const [name,a]of Object.entries(s.attributes))geometry.setAttribute(name,new Float32BufferAttribute(a,TOPOLOGY_ATTRIBUTE_SIZES[name]));
  for(const part of s.parts)geometry.addGroup(part.indexStart,part.indexCount,0);
  geometry.setIndex(Array.from(s.indices));geometry.morphTargetsRelative=s.morphTargets[0]?.relative??true;
  for(const m of s.morphTargets)for(const [name,a]of Object.entries(m.attributes)){
    geometry.morphAttributes[name]??=[];const attr=new Float32BufferAttribute(a,TOPOLOGY_ATTRIBUTE_SIZES[name]);attr.name=m.name;geometry.morphAttributes[name].push(attr);
  }
  return geometry;
}

export function instantiateHeroCharacterArtifact(artifact,{materialOptions={}}={}){
  // Revalidate definitions even when loaded from JSON rather than our factory.
  const checked=createHeroCharacterArtifact({...artifact,poseDrivers:artifact.poseDriverRegistry}),s=checked.geometry;
  if(artifact.type!=='HeroCharacterArtifact'||artifact.version!==1)fail('HERO_VERSION','Unsupported hero artifact');
  const modes=new Set(s.morphTargets.map(m=>m.relative)),schemas=new Set(s.morphTargets.map(m=>Object.keys(m.attributes).sort().join(',')));
  if(modes.size>1||schemas.size>1)fail('MORPH_SCHEMA','Runtime morph targets must share attributes and relative mode');
  if(s.morphTargets.some(m=>m.attributes.tangent))fail('MORPH_RUNTIME_ATTRIBUTE','Tangent morph evaluation is not supported by the runtime adapter');
  if(new Set(checked.materialRegions.map(p=>p.materialId)).size>1)fail('MATERIAL_BINDINGS_REQUIRED','Multiple material identities require a future explicit runtime binding map');
  const rig=createHumanoidSkeleton(checked.semanticLandmarks,{helpers:checked.deformationSkeleton});
  for(const def of checked.coreSkeleton){
    const bone=rig.coreBonesByName[def.name];
    if(def.restLocalPosition){const p=def.restLocalPosition;const v=Array.isArray(p)?p:[p.x,p.y,p.z];if(v.length!==3||!v.every(Number.isFinite))fail('CORE_REST','Invalid core rest position');bone.position.fromArray(v);}
    if(def.restOrientation){const q=def.restOrientation;if(q.length!==4||!q.every(Number.isFinite)||Math.abs(Math.hypot(...q)-1)>1e-6)fail('CORE_REST','Invalid core rest quaternion');bone.quaternion.fromArray(q);}
  }
  rig.rootBone.updateWorldMatrix(true,true);rig.skeleton.calculateInverses();
  const geometry=createHeroRuntimeGeometry(s);
  const material=new MeshStandardMaterial(materialOptions),mesh=new SkinnedMesh(geometry,material);mesh.name=checked.id;mesh.add(rig.rootBone);mesh.bind(rig.skeleton);
  let disposed=false;
  return {...rig,artifact:checked,geometry,material,mesh,dispose(){if(disposed)return;disposed=true;mesh.removeFromParent();geometry.dispose();material.dispose();rig.skeleton.dispose();mesh.clear();}};
}
