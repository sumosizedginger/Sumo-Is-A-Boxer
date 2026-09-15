import { assemble } from './kit.js';
import { sculpt } from './sculpt.js';
import { HEAD_BONE_BIND_Y } from './skull-sections.js';
import { headScalpPoint } from '../character/head-profile.js';
import { mat } from './materials.js';

function scalp(name,offset,fade=false) {
  return sculpt({name,segments:72,sections:Array.from({length:22},(_,i)=>[i/21,1,1]),shape(p,{y:row,c,s}){
    const front=Math.max(0,s),hairline=1.766+front*.038+.003*c*front-.016*Math.max(0,-s);
    const low=fade?hairline-.008:hairline,high=fade?hairline+.003:1.861;
    const y=low+(high-low)*row,q=headScalpPoint(Math.min(1.8598,y),Math.atan2(s,c));
    const clearance=offset*(1-row*.30);
    p[0]=q[0]+clearance*c;p[1]=q[1]+(y>1.8598?y-1.8598:0)-HEAD_BONE_BIND_Y;p[2]=q[2]-.005+clearance*s;
    // Short, directional crop. Less than a millimetre, strongest at the crown.
    const grain=.00065*Math.sin(Math.atan2(s,c)*39+row*13)*Math.sin(row*Math.PI);
    p[0]+=c*grain;p[2]+=s*grain;
  }});
}
export function buildFighterFace(){
 return assemble('asset.hero.hair',[
  {name:'boxer-hair',material:mat('hair',0),meshes:[scalp('boxer-hair-crop',.002)]},
  {name:'boxer-hair-fade',material:mat('hairFade',0),meshes:[scalp('boxer-shaved-fade',.001,true)]}
 ]);
}
