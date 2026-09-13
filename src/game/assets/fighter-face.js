import { assemble, place, roundedBox, tube, singlePart } from './kit.js';
import { sculpt } from './sculpt.js';
import { skullAt, HEAD_BONE_BIND_Y, HAIR_SHELL_OFFSET, FADE_SHELL_OFFSET } from './skull-sections.js';
import { bell, shapeFace, sampleSections } from '../character/anatomy-fields.js';
import { mat } from './materials.js';
import { BufferGeometry, Float32BufferAttribute } from 'three';

// All features use the actual sculpted skin depth, in the head bone frame.
export function facePoint(x,y,offset=0) {
  const q=skullAt(y),c=Math.max(-1,Math.min(1,(x-q.cx)/q.width)),s=Math.sqrt(1-c*c);
  const p=[x,y,q.cz+q.depth*s];shapeFace(p,{y,s,c});
  return [p[0],y-HEAD_BONE_BIND_Y,p[2]+offset];
}
function eyePatch(name,x,y,width,height,depth) {
  const positions=[],indices=[],uvs=[];
  for(let row=0;row<=8;row++)for(let col=0;col<=24;col++) {
    const u=col/24*2-1,v=row/8*2-1, arch=Math.sqrt(Math.max(0,1-u*u));
    positions.push(...facePoint(x+u*width,y+v*height*arch,depth+.0015*(1-v*v)*arch));
    uvs.push(col/24,row/8);
  }
  for(let r=0;r<8;r++)for(let c=0;c<24;c++){const a=r*25+c;indices.push(a,a+1,a+26,a,a+26,a+25);}
  const g=new BufferGeometry();g.setAttribute('position',new Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
  const mesh=singlePart({id:name,semanticName:name,positions,normals:Array.from(g.attributes.normal.array),indices,uvs});g.dispose();return mesh;
}
function scalp(name,offset,fade=false) {
  return sculpt({name,segments:72,sections:Array.from({length:22},(_,i)=>[i/21,1,1]),shape(p,{y:row,c,s}){
    const front=Math.max(0,s),hairline=1.766+front*.038+.003*c*front-.016*Math.max(0,-s);
    const low=fade?hairline-.020:hairline,high=fade?hairline+.004:1.864;
    const y=low+(high-low)*row,q=skullAt(Math.min(1.86,y));
    const clearance=offset*(1-row*.30),width=y>1.86?.001:q.width+clearance,depth=y>1.86?.001:q.depth+clearance;
    p[0]=q.cx+width*c;p[1]=y-HEAD_BONE_BIND_Y;p[2]=q.cz+depth*s;
    // Short, directional crop. Less than a millimetre, strongest at the crown.
    const grain=.00065*Math.sin(Math.atan2(s,c)*39+row*13)*Math.sin(row*Math.PI);
    p[0]+=c*grain;p[2]+=s*grain;
  }});
}
export function buildFighterFace() {
  const skin=[],recesses=[],sclera=[],irises=[],brows=[],lips=[],tape=[];
  for(const sign of [1,-1]) {
    const label=sign>0?'left':'right',x=sign*.033,y=sign>0?1.756:1.754;
    sclera.push(eyePatch('boxer-eye-'+label,x,y,.0118,.0038,.0008));
    irises.push(eyePatch('boxer-iris-'+label,x-sign*.001,y,.0031,.0032,.0029));
    for(const upper of [true,false]) {
      skin.push(tube({semanticName:'boxer-'+(upper?'upper':'lower')+'-lid-'+label,segments:8,radius:upper?.0017:.0012,
        points:Array.from({length:25},(_,i)=>{const t=i/24*Math.PI;return facePoint(x+Math.cos(t)*.0122,y+Math.sin(t)*(upper?.0044:-.0042),.0018);})}));
    }
    brows.push(tube({semanticName:'boxer-brow-'+label,segments:8,radius:sign>0?.0024:.0029,
      points:Array.from({length:16},(_,i)=>{const t=i/15;return facePoint(sign*(.016+t*.039),y+.014+Math.sin(t*Math.PI)*.003,.0019);})}));
    // Helix turns back into the skull; concha and antihelix give the ear depth.
    const earY=1.738+(sign>0?.0015:0),earX=sign*.087;
    skin.push(sculpt({name:'boxer-ear-'+label,segments:32,sections:sampleSections([
      [earY-.028,.006,.006,earX,-.003],[earY-.020,.012,.013,earX+sign*.002,-.006],
      [earY,.016,.018,earX+sign*.003,-.007],[earY+.023,.012,.016,earX,-.009],[earY+.030,.003,.005,earX,-.010]
    ],.004).map(([y,w,d,x,z])=>[y-HEAD_BONE_BIND_Y,w,d,x,z]),shape(p,{s,c}){p[0]+=sign*.002*Math.max(0,s);p[2]-=.003*Math.max(0,c*sign);}}));
    recesses.push(place(roundedBox({size:[.006,.023,.013],radius:.004,semanticName:'boxer-ear-concha-'+label}),{at:[earX+sign*.014,earY-HEAD_BONE_BIND_Y,.001]}));
    skin.push(tube({semanticName:'boxer-ear-antihelix-'+label,segments:8,radius:.0025,points:[[earX+sign*.015,earY-HEAD_BONE_BIND_Y-.014,.005],[earX+sign*.017,earY-HEAD_BONE_BIND_Y+.004,.006],[earX+sign*.013,earY-HEAD_BONE_BIND_Y+.020,-.002]]}));
    // Alar wings and dark nostril slits sit under the nose tip.
    skin.push(sculpt({name:'boxer-nose-wing-'+label,segments:24,sections:[[1.713,.002,.002],[1.716,.007,.008],[1.722,.006,.008],[1.726,.002,.003]].map(([y,w,d])=>[y-HEAD_BONE_BIND_Y,w,d,sign*.010+.001,facePoint(sign*.010,y)[2]+.005])}));
    recesses.push(place(roundedBox({size:[.006,.0024,.004],radius:.001,semanticName:'boxer-nostril-'+label}),{at:facePoint(sign*.010+.001,1.715,.009),rotate:[.25,sign*.18,sign*.15]}));
  }
  skin.push(sculpt({name:'boxer-nose-bridge-tip',segments:40,sections:sampleSections([
    [1.713,.003,.004,.002,.107],[1.719,.009,.012,.002,.117],[1.726,.011,.016,.0015,.117],
    [1.737,.008,.014,.001,.108],[1.753,.006,.009,0,.099],[1.770,.004,.006,-.001,.094]
  ],.003).map(([y,w,d,x,z])=>[y-HEAD_BONE_BIND_Y,w,d,x,z])}));
  for(const upper of [true,false]) lips.push(tube({semanticName:upper?'boxer-upper-lip':'boxer-lower-lip',radius:upper?.0022:.0028,segments:10,
    points:Array.from({length:33},(_,i)=>{const x=(i/32*2-1)*.020;return facePoint(x,1.689+(upper?.003+bell(Math.abs(x),.006,.004)*.0018:-.003)*Math.sqrt(1-(x/.020)**2),.0025);})}));
  recesses.push(tube({semanticName:'boxer-mouth-line',radius:.00085,segments:6,points:Array.from({length:25},(_,i)=>{const x=(i/24*2-1)*.022;return facePoint(x,1.689+.0008*x/.022,.0020);})}));
  tape.push(tube({semanticName:'boxer-healed-brow-scar',radius:.0011,segments:6,points:[facePoint(.049,1.773,.0025),facePoint(.046,1.779,.0025),facePoint(.044,1.784,.002)]}));
  return assemble('asset.boxer.head.detail',[
    {name:'boxer-hair',material:mat('hair',0),meshes:[scalp('boxer-hair-crop',HAIR_SHELL_OFFSET),...brows]},
    {name:'boxer-hair-fade',material:mat('hairFade',0),meshes:[scalp('boxer-shaved-fade',FADE_SHELL_OFFSET,true)]},
    {name:'boxer-face-structure',material:mat('skin',0),meshes:skin},
    {name:'boxer-face-recesses',material:mat('faceRecess',0),meshes:recesses},
    {name:'boxer-eyes-sclera',material:mat('eyeWhite',0),meshes:sclera},
    {name:'boxer-eyes-iris',material:mat('eyeIris',0),meshes:irises},
    {name:'boxer-lips',material:mat('lip',0),meshes:lips},
    {name:'boxer-face-tape',material:mat('scar',0),meshes:tape},
  ]);
}
