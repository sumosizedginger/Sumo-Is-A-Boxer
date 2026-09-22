const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>{const l=Math.hypot(...a);if(!Number.isFinite(l)||l<1e-12)throw new RangeError('Surface frame requires a finite nonzero normal');return a.map(v=>v/l);};
const frozen=a=>Object.freeze(Array.isArray(a)||ArrayBuffer.isView(a)?Array.from(a,v=>Object.is(v,-0)?0:v):a);
export function surfaceFrame(normal){
 const n=unit(normal),up=Math.abs(n[1])<.995?[0,1,0]:[0,0,1];
 const tangent=unit(cross(up,n)),bitangent=cross(n,tangent);
 // Matrix columns are a right-handed orthonormal basis. A tangent sign flip
 // is a 180 degree cube symmetry; no random triangle tangents are used.
 const m=[tangent,bitangent,n],trace=m[0][0]+m[1][1]+m[2][2];let q;
 if(trace>0){const s=Math.sqrt(trace+1)*2;q=[(m[1][2]-m[2][1])/s,(m[2][0]-m[0][2])/s,(m[0][1]-m[1][0])/s,s/4];}
 else {const i=m[0][0]>m[1][1]&&m[0][0]>m[2][2]?0:m[1][1]>m[2][2]?1:2,j=(i+1)%3,k=(i+2)%3,s=Math.sqrt(1+m[i][i]-m[j][j]-m[k][k])*2;q=[0,0,0,0];q[i]=s/4;q[j]=(m[i][j]+m[j][i])/s;q[k]=(m[i][k]+m[k][i])/s;q[3]=(m[j][k]-m[k][j])/s;}
 const l=Math.hypot(...q);q=q.map(v=>v/l);if(q[3]<0)q=q.map(v=>-v);
 return {normal:frozen(n),tangent:frozen(tangent),bindOrientation:frozen(q)};
}
