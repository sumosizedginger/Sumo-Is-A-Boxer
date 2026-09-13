import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { MeshStandardMaterial, ShaderLib } from 'three';
import { generateSurfaceData, createProceduralMaterials } from '../src/game/presentation/procedural-materials.js';

const digest = data => createHash('sha256').update(data).digest('hex');
test('every procedural material is byte-deterministic and responds to seed changes', () => {
  for (const kind of ['canvas', 'canvasHistory', 'leather', 'skin', 'concrete', 'steel']) {
    const a = generateSurfaceData(kind, { seed: 314 });
    assert.equal(digest(a), digest(generateSurfaceData(kind, { seed: 314 })));
    assert.notEqual(digest(a), digest(generateSurfaceData(kind, { seed: 315 })));
    assert.equal(a.length, 256 * 256 * 4);
  }
});

test('maps stay restrained and skin has neither color noise nor pore displacement', () => {
  const skin = generateSurfaceData('skin');
  for (let i = 0; i < skin.length; i += 4) {
    assert.equal(skin[i], 128); assert.equal(skin[i + 2], 128); assert.equal(skin[i + 3], 255);
  }
  const canvas = generateSurfaceData('canvas');
  let min = 255, max = 0;
  for (let i = 2; i < canvas.length; i += 4) { min = Math.min(min, canvas[i]); max = Math.max(max, canvas[i]); }
  assert.ok(max - min < 20, 'canvas color should not expose the weave as high-contrast checks');
});

test('shared texture owner reuses resources, has no regeneration on comparison switches, and disposes once', () => {
  const owner = createProceduralMaterials(), materials = [], shaders = [], textures = new Set();
  for (let i = 0; i < 4; i++) {
    const material = new MeshStandardMaterial(); material.name = 'mat.canvas.0';
    owner.apply(material, 'asset.ring.platform'); materials.push(material);
    const shader = { uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader };
    material.onBeforeCompile(shader); shaders.push(shader);
    textures.add(shader.uniforms.tactileMicro.value); textures.add(shader.uniforms.tactileHistory.value);
  }
  assert.equal(textures.size, 2);
  const before = owner.stats();
  for (let i = 0; i < 20; i++) { owner.setEnabled(false); owner.setEnabled(true); owner.apply(materials[0], 'asset.ring.platform'); }
  assert.deepEqual(owner.stats(), before);
  let disposals = 0;
  for (const texture of textures) {
    texture.addEventListener('dispose', () => disposals++);
    assert.equal(texture.generateMipmaps, true); assert.ok(texture.anisotropy <= 8);
  }
  owner.setEnabled(false); assert.equal(shaders[0].uniforms.tactileEnabled.value, 0);
  owner.dispose(); owner.dispose(); assert.equal(disposals, 2); assert.equal(owner.stats().textures, 0);
  for (const material of materials) material.dispose();
  assert.throws(() => owner.apply(new MeshStandardMaterial()), /disposed/);
});

test('only nominated consumers receive detail; calibrated material values and existing compile hooks survive', () => {
  const owner = createProceduralMaterials();
  for (const [id, key, expected] of [
    ['mat.hair.0', 'asset.boxer.head.detail', false], ['mat.skin.0', 'asset.boxer.head.detail', false],
    ['mat.rope.0', 'asset.ring.ropes', false], ['mat.leatherBlack.0', 'asset.boxer.boot.left', false],
    ['mat.concrete.0', 'asset.warehouse.floor', true], ['mat.leatherBlue.0', 'asset.fp.arm.left', true],
    ['mat.skin.0', 'opponent-skin', true], ['mat.steel.0', 'asset.warehouse.gantry', true]
  ]) {
    const material = new MeshStandardMaterial({ color: 0x87684f, roughness: .7, metalness: 0 });
    let calls = 0; material.onBeforeCompile = () => calls++;
    owner.apply(material, key, id);
    assert.equal(material.customProgramCacheKey().includes('vq003-surface-v1'), expected);
    material.onBeforeCompile({ uniforms: {}, vertexShader: ShaderLib.standard.vertexShader, fragmentShader: ShaderLib.standard.fragmentShader });
    assert.equal(calls, 1); assert.equal(material.roughness, .7); assert.equal(material.metalness, 0);
    assert.equal(material.color.getHex(), 0x87684f); material.dispose();
  }
  owner.dispose();
});
