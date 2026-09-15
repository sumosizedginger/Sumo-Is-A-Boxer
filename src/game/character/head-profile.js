import {planeSculptField,ellipsoidMask,createFeatureFrame} from '@sumosizedginger/my-game-engine-1.0/full';
const clamp=t=>Math.max(0,Math.min(1,t));
const rows=[[1.60,.064,.052,.067],[1.63,.050,.042,.065],[1.65,.053,.065,.06],[1.67,.064,.075,.064],[1.695,.070,.073,.075],[1.725,.075,.069,.088],[1.75,.081,.067,.098],[1.78,.0787,.0748,.1000],[1.80,.0732,.0696,.0931]];
export function headSection(y){if(y>=1.80){const cap=Math.sqrt(Math.max(.000001,1-((y-1.755)/.105)**2));return [.081*cap,.077*cap,.103*cap];}for(let j=0;j<rows.length-1;j++)if(y<=rows[j+1][0]){const a=rows[j],b=rows[j+1],t=clamp((y-a[0])/(b[0]-a[0])),prev=rows[Math.max(0,j-1)],next=rows[Math.min(rows.length-1,j+2)];return a.slice(1).map((v,k)=>{const m0=(b[k+1]-prev[k+1])/(b[0]-prev[0]),m1=(next[k+1]-a[k+1])/(next[0]-a[0]),h=b[0]-a[0];return (2*t*t*t-3*t*t+1)*v+(t*t*t-2*t*t+t)*h*m0+(-2*t*t*t+3*t*t)*b[k+1]+(t*t*t-t*t)*h*m1;});}const h=Math.max(.002,Math.sqrt(Math.max(0,1-((y-1.80)/.060)**2)));return [.079*h,.073*h,.102*h];}

export function headTemplatePoint(y,angle){const c=Math.cos(angle),s=Math.sin(angle),[w,f,b]=headSection(y);return [w*Math.sign(c)*Math.pow(Math.abs(c),.92),y,(s>=0?f*Math.pow(s,.45):b*s)-.006];}
export function headSideX(y,z){const [w,f,b]=headSection(y),s=z>=-.006?Math.pow(Math.max(0,(z+.006)/f),1/.45):(z+.006)/b;return w*Math.pow(Math.sqrt(Math.max(0,1-s*s)),.92);}

export const foreheadSculptField=planeSculptField({point:[0,1.799,.071],normal:[0,.15,1],strength:.55,maxDisplacement:.008,mask:ellipsoidMask({frame:createFeatureFrame({center:[0,1.797,.075]}),radii:[.065,.033,.07]})});
export function headScalpPoint(y,angle){const p=headTemplatePoint(y,angle),d=foreheadSculptField(p);return p.map((v,i)=>v+d[i]);}
