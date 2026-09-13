// Consumer-owned standard-material hooks. No texture allocation or renderer
// replacement. This composes with, and does not toggle, the Phase 1 detail hook.
export function applyCharacterSurface(material, asset, id) {
  const skin=/^mat\.skin(?:Player)?\./.test(id);
  const glove=/glove|fp\.arm/.test(asset)&&/^mat\.leather/.test(id);
  const cloth=/trunks/.test(asset)&&/^mat\.cloth\./.test(id);
  const boot=/boot/.test(asset)&&/^mat\.leather/.test(id);
  if(!skin&&!glove&&!cloth&&!boot)return;
  const fp=asset.startsWith('asset.fp.'),face=asset==='asset.boxer.head.detail';
  const key=[skin,glove,cloth,boot,fp,face].map(Number).join('');
  const compile=material.onBeforeCompile,baseKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.vertexShader='varying vec3 vCharacterPosition;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCharacterPosition=position;');
    shader.fragmentShader='varying vec3 vCharacterPosition;\nfloat cBell(float v,float m,float w){float t=(v-m)/w;return exp(-t*t);}\n'+shader.fragmentShader;
    let response='';
    if(skin)response=`
      vec3 cp=vCharacterPosition;
      float cy=cp.y+${face?'1.7427':'0.0'};
      float sweat=${fp?'0.55*cBell(cy,0.075,0.09)':face?'0.35*cBell(cy,1.785,0.036)':'cBell(cy,1.445,0.080)*(0.65+0.35*smoothstep(0.10,0.25,abs(cp.x)))'};
      float dry=${fp?'cBell(cy,-0.03,0.06)':face?'0.12':'max(cBell(cy,0.55,0.052),cBell(cy,1.15,0.04)*smoothstep(0.22,0.30,abs(cp.x)))'};
      roughnessFactor=clamp(roughnessFactor-sweat*0.13+dry*0.09,0.44,0.88);
      float warmth=${face?'cBell(cy,1.727,0.021)*(0.3+0.7*smoothstep(0.065,0.087,abs(cp.x)))':fp?'0.18*cBell(cy,0.17,0.06)':'0.20*cBell(cy,1.4,0.12)'};
      diffuseColor.rgb*=vec3(1.0+warmth*0.035,1.0-warmth*0.012,1.0-warmth*0.024);
    `;
    if(glove)response=`
      vec3 cp=vCharacterPosition;
      float h=(cp.y-${fp?'0.26':'0.0'})/${fp?'1.05':'1.0'};
      float contact=cBell(h,0.19,0.032)*smoothstep(-0.015,0.045,cp.z);
      float seam=cBell(h,0.025,0.03)*(0.5+0.5*sin(h*210.0+cp.x*120.0));
      roughnessFactor=clamp(roughnessFactor+contact*0.075+seam*0.025,0.32,0.8);
      diffuseColor.rgb*=1.0+contact*0.025;
    `;
    if(cloth)response=`
      float weave=sin(vCharacterPosition.y*1900.0)*sin(vCharacterPosition.x*1500.0);
      float footprint=max(fwidth(vCharacterPosition.x)*1500.0,fwidth(vCharacterPosition.y)*1900.0);
      roughnessFactor=clamp(roughnessFactor+weave*0.018*(1.0-smoothstep(0.5,2.0,footprint)),0.65,0.94);
    `;
    if(boot)response=`
      float wear=cBell(vCharacterPosition.y,-0.045,0.022)*cBell(vCharacterPosition.z,0.14,0.065);
      roughnessFactor=clamp(roughnessFactor+wear*0.09,0.35,0.9);
      diffuseColor.rgb*=1.0+wear*0.045;
    `;
    shader.fragmentShader=shader.fragmentShader.replace('#include <roughnessmap_fragment>','#include <roughnessmap_fragment>\n'+response);
  };
  material.customProgramCacheKey=()=>baseKey+'|character-ceiling-v1|'+key;
  material.needsUpdate=true;
}
