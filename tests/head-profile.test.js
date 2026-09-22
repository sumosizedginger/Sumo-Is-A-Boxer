import test from 'node:test';
import assert from 'node:assert/strict';
import {headSection,headTemplatePoint} from '../src/game/character/head-profile.js';

test('cranial cap meets the authored forehead without a radial step',()=>{
  const before=headSection(1.80-1e-7),after=headSection(1.80+1e-7);
  for(let axis=0;axis<3;axis++)assert.ok(Math.abs(before[axis]-after[axis])<1e-6);
  for(let j=0;j<64;j++){
    const a=headTemplatePoint(1.80-1e-7,j*Math.PI/32),b=headTemplatePoint(1.80+1e-7,j*Math.PI/32);
    assert.ok(Math.hypot(...a.map((v,k)=>v-b[k]))<1e-6);
  }
});

test('cranial cap preserves the forehead tangent at its join',()=>{
 const epsilon=1e-6,a=headSection(1.80-epsilon),b=headSection(1.80),c=headSection(1.80+epsilon);
 for(let k=0;k<3;k++)assert.ok(Math.abs((b[k]-a[k])/epsilon-(c[k]-b[k])/epsilon)<1e-3);
});
