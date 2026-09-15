/**
 * VOXEL-PIVOT-001 — Voxel Forge contracts.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry, Bone, Group, Matrix4 } from 'three';
import { createBoxMesh } from '../src/geometry/mesh-ops.js';
import {
  VOXEL_QUALITY,
  VOXEL_PARAMETER_BOUNDS,
  resolveVoxelParameters,
  createVoxelDefinition,
  voxelizeMesh,
  extractVoxelSurface,
  createVoxelArtifact,
  voxelHash,
  instantiateVoxelArtifact,
  isOccupied
} from '../src/voxel/index.js';

function boxMesh(size = 1) {
  return createBoxMesh({
    width: size,
    height: size,
    depth: size,
    semanticName: 'voxel-test-box',
    id: 'mesh.voxel.test.box',
    regionId: 3
  });
}

test('quality levels are named and HERO is the finest', () => {
  assert.deepEqual(Object.keys(VOXEL_QUALITY).sort(), ['COARSE', 'HERO', 'HIGH', 'MEDIUM']);
  assert.ok(VOXEL_QUALITY.HERO.voxelSize < VOXEL_QUALITY.HIGH.voxelSize);
  assert.ok(VOXEL_QUALITY.HIGH.voxelSize < VOXEL_QUALITY.MEDIUM.voxelSize);
  assert.ok(VOXEL_QUALITY.MEDIUM.voxelSize < VOXEL_QUALITY.COARSE.voxelSize);
  assert.ok(VOXEL_QUALITY.HERO.voxelSize >= VOXEL_PARAMETER_BOUNDS.voxelSize.min);
});

test('voxelizeMesh is deterministic, finite, and duplicate-free', () => {
  const mesh = boxMesh(0.4);
  const a = voxelizeMesh(mesh, { quality: 'HIGH' });
  const b = voxelizeMesh(mesh, { quality: 'HIGH' });
  assert.equal(a.occupiedCount, b.occupiedCount);
  assert.deepEqual(Array.from(a.compact), Array.from(b.compact));
  assert.deepEqual(Array.from(a.regionId), Array.from(b.regionId));
  const seen = new Set();
  for (let i = 0; i < a.compact.length; i += 3) {
    const key = `${a.compact[i]},${a.compact[i + 1]},${a.compact[i + 2]}`;
    assert.equal(seen.has(key), false, `duplicate cell ${key}`);
    seen.add(key);
    const p = a.bindPosition;
    const c = i / 3;
    assert.ok(Number.isFinite(p[c * 3]) && Number.isFinite(p[c * 3 + 1]) && Number.isFinite(p[c * 3 + 2]));
  }
});

test('finer quality produces more occupied cells on the same mesh', () => {
  const mesh = boxMesh(0.5);
  const coarse = voxelizeMesh(mesh, { quality: 'COARSE' });
  const medium = voxelizeMesh(mesh, { quality: 'MEDIUM' });
  const high = voxelizeMesh(mesh, { quality: 'HIGH' });
  assert.ok(medium.occupiedCount >= coarse.occupiedCount);
  assert.ok(high.occupiedCount >= medium.occupiedCount);
  assert.ok(high.voxelSize < medium.voxelSize);
});

test('surface extraction culls fully enclosed cells and hidden faces', () => {
  const mesh = boxMesh(0.48);
  const grid = voxelizeMesh(mesh, { quality: 'HIGH', fillInterior: true });
  const surface = extractVoxelSurface(grid);
  assert.ok(grid.occupiedCount >= surface.surfaceCount);
  assert.ok(surface.enclosedCount >= 0);
  assert.equal(surface.surfaceCount + surface.enclosedCount, grid.occupiedCount);
  assert.ok(surface.visibleFaceCount > 0);
  assert.ok(surface.visibleFaceCount <= surface.naiveCubeFaces);
  assert.equal(surface.culledFaces, surface.naiveCubeFaces - surface.visibleFaceCount);
  if (grid.interiorFilled > 0) {
    assert.ok(surface.enclosedCount > 0, 'filled interior must classify enclosed cells');
  }
});

test('six-neighbor occlusion is exact for a solid filled box', () => {
  const mesh = boxMesh(0.36);
  const grid = voxelizeMesh(mesh, { voxelSize: 0.06, fillInterior: true });
  const surface = extractVoxelSurface(grid);
  for (const face of surface.faces) {
    for (const dir of face.dirs) {
      const nx = face.x + [1, -1, 0, 0, 0, 0][dir];
      const ny = face.y + [0, 0, 1, -1, 0, 0][dir];
      const nz = face.z + [0, 0, 0, 0, 1, -1][dir];
      assert.equal(isOccupied(grid, nx, ny, nz), false);
    }
  }
});

test('artifact hash is stable and semantic regions survive voxelization', () => {
  const mesh = boxMesh(0.32);
  const definition = createVoxelDefinition({ id: 'voxel.test.box', quality: 'HIGH', fillInterior: true });
  const grid = voxelizeMesh(mesh, definition.data.parameters);
  const artifact = createVoxelArtifact({ id: 'voxel.test.box', definition, grid });
  const again = createVoxelArtifact({
    id: 'voxel.test.box',
    definition,
    grid: voxelizeMesh(mesh, definition.data.parameters)
  });
  assert.equal(artifact.hash, again.hash);
  assert.equal(voxelHash(artifact), artifact.hash);
  assert.ok(artifact.cells.length > 0);
  assert.ok(artifact.cells.every((c) => c.regionId === 3));
  assert.ok(artifact.colorBinding.pngProjection === null);
  assert.equal(artifact.surfaceCount, artifact.cells.length);
});

test('instantiateVoxelArtifact is batched: no per-voxel Mesh, one draw object', () => {
  const mesh = boxMesh(0.28);
  const definition = createVoxelDefinition({ id: 'voxel.test.runtime', quality: 'HIGH' });
  const grid = voxelizeMesh(mesh, definition.data.parameters);
  const artifact = createVoxelArtifact({ id: 'voxel.test.runtime', definition, grid });
  const runtime = instantiateVoxelArtifact(artifact, { mode: 'instances' });
  try {
    assert.equal(runtime.meshes.length, 1);
    assert.equal(runtime.meshes[0].isInstancedMesh, true);
    assert.equal(runtime.stats.drawCalls, 1);
    assert.equal(runtime.stats.instances, artifact.cells.length);
    assert.ok(runtime.stats.instances > 1);
    assert.equal(runtime.object3D.children.length, 1);
  } finally {
    runtime.dispose();
    assert.equal(runtime.disposed, true);
  }
});

test('face mode emits only visible faces', () => {
  const mesh = boxMesh(0.28);
  const definition = createVoxelDefinition({ id: 'voxel.test.faces', quality: 'HIGH', fillInterior: true });
  const grid = voxelizeMesh(mesh, definition.data.parameters);
  const artifact = createVoxelArtifact({ id: 'voxel.test.faces', definition, grid });
  const runtime = instantiateVoxelArtifact(artifact, { mode: 'faces' });
  try {
    assert.equal(runtime.meshes[0].isInstancedMesh, undefined);
    assert.equal(runtime.stats.drawCalls, 1);
    assert.equal(runtime.stats.triangles, artifact.visibleFaceCount * 2);
  } finally {
    runtime.dispose();
  }
});

test('rigid deformation moves voxel centres without stretching cube scale', () => {
  const geometry = new BoxGeometry(0.2, 0.4, 0.2);
  const position = geometry.attributes.position;
  const vertexCount = position.count;
  const regionId = new Uint16Array(vertexCount).fill(1);
  const skinIndex = new Uint16Array(vertexCount * 4);
  const skinWeight = new Float32Array(vertexCount * 4);
  for (let i = 0; i < vertexCount; i++) {
    skinIndex[i * 4] = 0;
    skinWeight[i * 4] = 1;
  }
  const indices = geometry.index.array;
  const mesh = {
    attributes: { position: position.array, regionId, skinIndex, skinWeight },
    indices
  };
  const bone = new Bone();
  bone.name = 'root';
  const group = new Group();
  group.add(bone);
  bone.updateWorldMatrix(true, true);
  const definition = createVoxelDefinition({ id: 'voxel.test.deform', voxelSize: 0.04 });
  const grid = voxelizeMesh(mesh, definition.data.parameters);
  const artifact = createVoxelArtifact({ id: 'voxel.test.deform', definition, grid });
  const runtime = instantiateVoxelArtifact(artifact, { mode: 'instances', bones: [bone] });
  try {
    const before = [];
    const instance = runtime.meshes[0];
    const m = new Matrix4();
    instance.getMatrixAt(0, m);
    const sx = Math.hypot(m.elements[0], m.elements[1], m.elements[2]);
    const x0 = m.elements[12];
    bone.position.set(0.15, 0, 0);
    bone.updateWorldMatrix(true, true);
    runtime.updateDeformation([bone]);
    instance.getMatrixAt(0, m);
    const sxAfter = Math.hypot(m.elements[0], m.elements[1], m.elements[2]);
    assert.ok(Math.abs(sxAfter - sx) < 1e-6, `cube stretched ${sx} -> ${sxAfter}`);
    assert.ok(Math.abs(m.elements[12] - x0 - 0.15) < 1e-4, `centre did not follow bone, x=${m.elements[12]} from ${x0}`);
    before.push(sx);
  } finally {
    runtime.dispose();
    geometry.dispose();
  }
});

test('unknown quality and out-of-range size fail closed with diagnostics', () => {
  const { parameters, diagnostics } = resolveVoxelParameters({ quality: 'ULTRA', voxelSize: 9 });
  assert.equal(parameters.quality, 'HIGH');
  assert.ok(diagnostics.some((d) => d.code === 'VOXEL_UNKNOWN_QUALITY'));
  assert.ok(parameters.voxelSize <= VOXEL_PARAMETER_BOUNDS.voxelSize.max);
});
