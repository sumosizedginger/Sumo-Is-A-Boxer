// Versioned authoring payload for topology work. MeshIR v1 remains unchanged.
// Accepts MeshIR, TopologySurface, or the documented BufferGeometry attribute
// shape without importing the renderer into geometry authoring.
export const TOPOLOGY_SURFACE_VERSION = 1;
export const TOPOLOGY_ATTRIBUTE_SIZES = Object.freeze({position:3,normal:3,uv:2,tangent:4,regionId:1,region:1,surfaceId:1,skinIndex:4,skinWeight:4});
export class TopologyError extends Error {
  constructor(code,message,data={}) { super(message);this.name='TopologyError';this.code=code;this.diagnostics=[{severity:'ERROR',subsystem:'topology',code,message,data}]; }
}
export function fail(code,message,data) { throw new TopologyError(code,message,data); }
export const values = a => a?.array ?? a;
const integer = name => ['region','regionId','surfaceId','skinIndex'].includes(name);
export function copyJson(value) {
  if(value===null||typeof value==='string'||typeof value==='boolean')return value;
  if(typeof value==='number'&&Number.isFinite(value))return value===0?0:value;
  if(Array.isArray(value)||ArrayBuffer.isView(value))return Array.from(value,copyJson);
  if(value&&Object.getPrototypeOf(value)===Object.prototype)return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,copyJson(v)]));
  fail('METADATA_NOT_SERIALIZABLE','Metadata must contain finite JSON values');
}
export function createTopologySurface(input, {id=input?.id??input?.name??'topology-surface',boundaries=input?.boundaries??{}}={}) {
  if(!input?.attributes?.position)fail('POSITION_REQUIRED','Indexed position data is required');
  const source=values(input.attributes.position),count=source.length/3;
  if(!Number.isInteger(count)||count<1)fail('ATTRIBUTE_LENGTH','Position must contain complete vertices');
  const attributes={};
  for(const [name,raw]of Object.entries(input.attributes)) {
    if(raw==null)continue;
    const size=TOPOLOGY_ATTRIBUTE_SIZES[name];
    if(!size)fail('UNSUPPORTED_ATTRIBUTE',`Explicit remapping policy required for ${name}`);
    if(raw.isInterleavedBufferAttribute||raw.normalized)fail('UNSUPPORTED_ATTRIBUTE_STORAGE',`${name} must be unpacked and unnormalized`);
    const a=values(raw);
    if(a.length!==count*size||(raw.itemSize!==undefined&&raw.itemSize!==size))fail('ATTRIBUTE_LENGTH',`Wrong ${name} item size or length`);
    for(const v of a)if(!Number.isFinite(v)||(integer(name)&&(!Number.isInteger(v)||v<0||v>0xffffffff)))fail('ATTRIBUTE_VALUE',`Invalid ${name} value`,{value:v});
    attributes[name]=integer(name)?Uint32Array.from(a):Float32Array.from(a);
    if(!Array.from(attributes[name]).every(Number.isFinite))fail('ATTRIBUTE_OVERFLOW',`${name} overflows Float32`);
  }
  if(!!attributes.skinIndex!==!!attributes.skinWeight)fail('SKIN_PAIR_REQUIRED','skinIndex and skinWeight must both be supplied');
  if(attributes.skinWeight)for(let i=0;i<count;i++) {
    let total=0;for(let k=0;k<4;k++){const w=attributes.skinWeight[i*4+k];if(w<0)fail('SKIN_WEIGHT','Negative skin weight');total+=w;}
    if(Math.abs(total-1)>1e-5)fail('SKIN_WEIGHT','Skin weights must sum to one',{vertex:i,total});
  }
  const rawIndices=values(input.indices??input.index);
  if(!rawIndices||rawIndices.length%3)fail('INDEX_SHAPE','A complete indexed triangle list is required');
  for(const i of rawIndices)if(!Number.isInteger(i)||i<0||i>=count)fail('INDEX_RANGE','Index outside vertex range or not an integer',{index:i,count});
  const indices=Uint32Array.from(rawIndices);
  let parts=input.parts;
  if(!parts)parts=input.groups?.length?input.groups.map((g,i)=>({id:`group-${i}`,semanticName:`group-${i}`,indexStart:g.start,indexCount:g.count,materialId:`material-${g.materialIndex}`})):
    [{id:'surface',semanticName:'surface',indexStart:0,indexCount:indices.length,materialId:null}];
  let end=0;const ids=new Set();
  parts=parts.filter(p=>p.indexCount!==0).map(p=>{
    if(!p.id||!p.semanticName||ids.has(p.id)||p.indexStart!==end||p.indexCount<=0||p.indexCount%3)fail('PART_PARTITION','Parts must uniquely and exactly partition triangles');
    ids.add(p.id);end+=p.indexCount;
    return {id:p.id,semanticName:p.semanticName,indexStart:p.indexStart,indexCount:p.indexCount,materialId:p.materialId??null,regionId:p.regionId??null,surfaceId:p.surfaceId??null};
  });
  if(end!==indices.length)fail('PART_PARTITION','Parts do not cover the triangle list');
  let morphs=input.morphTargets??[];
  if(input.morphAttributes&&Object.keys(input.morphAttributes).length) {
    const entries=Object.entries(input.morphAttributes),n=entries[0][1].length;
    if(entries.some(([,v])=>v.length!==n))fail('MORPH_LENGTH','Morph attribute target counts differ');
    morphs=Array.from({length:n},(_,i)=>({name:entries[0][1][i].name||`morph-${i}`,relative:!!input.morphTargetsRelative,attributes:Object.fromEntries(entries.map(([k,v])=>[k,values(v[i])]))}));
  }
  const names=new Set();
  const morphTargets=morphs.map(m=>{
    if(!m.name||names.has(m.name)||typeof m.relative!=='boolean')fail('MORPH_IDENTITY','Morph names must be unique and relative mode explicit');names.add(m.name);
    const attrs={};
    for(const [name,raw]of Object.entries(m.attributes)){
      if(!['position','normal','tangent'].includes(name))fail('MORPH_ATTRIBUTE',`Unsupported morph attribute ${name}`);
      const a=values(raw),size=TOPOLOGY_ATTRIBUTE_SIZES[name];
      if(a.length!==count*size||!Array.from(a).every(Number.isFinite))fail('MORPH_LENGTH',`Malformed morph ${m.name}/${name}`);
      attrs[name]=Float32Array.from(a);if(!Array.from(attrs[name]).every(Number.isFinite))fail('MORPH_VALUE','Morph overflow');
    }
    return {name:m.name,relative:m.relative,attributes:attrs,metadata:copyJson(m.metadata??{})};
  });
  return {type:'TopologySurface',version:TOPOLOGY_SURFACE_VERSION,id,units:input.units??'m',upAxis:input.upAxis??'+Y',forwardAxis:input.forwardAxis??'-Z',attributes,indices,parts,
    anchors:copyJson(input.anchors??input.userData?.anchors??[]),morphTargets,boundaries:copyJson(boundaries),metadata:copyJson(input.metadata??{})};
}

export function concatenateTopologySurfaces(inputs) {
  if(!Array.isArray(inputs)||inputs.length<1)fail('INPUT_REQUIRED','At least one surface is required');
  const surfaces=inputs.map(s=>createTopologySurface(s)),first=surfaces[0];
  const schema=s=>JSON.stringify([Object.keys(s.attributes).sort(),s.morphTargets.map(m=>[m.name,m.relative,Object.keys(m.attributes).sort(),m.metadata]),s.units,s.upAxis,s.forwardAxis]);
  if(surfaces.some(s=>schema(s)!==schema(first)))fail('ATTRIBUTE_SCHEMA_MISMATCH','Concatenation cannot fill missing attributes or change morph schemas');
  const attributes=Object.fromEntries(Object.keys(first.attributes).map(k=>[k,[]]));
  const morphTargets=first.morphTargets.map(m=>({...m,attributes:Object.fromEntries(Object.keys(m.attributes).map(k=>[k,[]]))}));
  const indices=[],parts=[],anchors=[],boundaries={},sourceRanges=[];let offset=0;
  surfaces.forEach((s,n)=>{
    const prefix=`source${n}:`,indexOffset=indices.length;
    for(const [k,a]of Object.entries(s.attributes))for(const v of a)attributes[k].push(v);
    s.morphTargets.forEach((m,i)=>{for(const [k,a]of Object.entries(m.attributes))for(const v of a)morphTargets[i].attributes[k].push(v);});
    for(const i of s.indices)indices.push(i+offset);
    for(const p of s.parts)parts.push({...p,id:prefix+p.id,indexStart:p.indexStart+indexOffset});
    for(const a of s.anchors)anchors.push({...a,name:prefix+a.name,...(a.partId?{partId:prefix+a.partId}:{})});
    for(const [name,loop]of Object.entries(s.boundaries))boundaries[prefix+name]=loop.map(i=>i+offset);
    sourceRanges.push({id:s.id,vertexOffset:offset,vertexCount:s.attributes.position.length/3});offset+=s.attributes.position.length/3;
  });
  return createTopologySurface({...first,id:'concatenated-surface',attributes,indices,parts,anchors,morphTargets,boundaries,metadata:{operation:'concatenate',sourceRanges}});
}
