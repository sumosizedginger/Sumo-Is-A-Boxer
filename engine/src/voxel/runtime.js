/**
 * My Game Engine 1.0 — Voxel Forge: Runtime Representation
 * Canonical repository: sumosizedginger/My-Game-Engine-1.0
 *
 * Batched renderer realization of a voxel artifact. This file may import
 * Three.js; definition/grid/surface/artifact must not.
 *
 * Two modes:
 *   instances — InstancedMesh of rigid unit cubes (hero; preserves cubic microstructure)
 *   faces     — merged hidden-face-culled quads (static environment)
 *
 * Earned by VOXEL-PIVOT-001.
 */

import {
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DynamicDrawUsage,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Quaternion,
  Vector3
} from 'three';
import { VOXEL_FACE_DIRS } from './grid.js';

const _matrix = new Matrix4();
const _position = new Vector3();
const _scale = new Vector3();
const _quat = new Quaternion();
const _quatBlend = new Quaternion();
const _boneQuat = new Quaternion();
const _bindQuat = new Quaternion();
const _rootInverseQuat = new Quaternion();
const _color = new Color();
const _bind = new Vector3();
const _world = new Vector3();
const _inv = new Matrix4();
const _boneMat = new Matrix4();
const _tmp = new Matrix4();

const FACE_QUADS = Object.freeze([
  // +X
  Object.freeze([[0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5]]),
  // -X
  Object.freeze([[-0.5, -0.5, 0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [-0.5, 0.5, 0.5]]),
  // +Y
  Object.freeze([[-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]]),
  // -Y
  Object.freeze([[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [-0.5, -0.5, -0.5]]),
  // +Z
  Object.freeze([[0.5, -0.5, 0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [0.5, 0.5, 0.5]]),
  // -Z
  Object.freeze([[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]])
]);

function defaultMaterial() {
  return new MeshStandardMaterial({
    roughness: 0.58,
    metalness: 0.04,
    vertexColors: true
  });
}

function maxBoneIndex(cells) {
  let max = -1;
  for (const cell of cells) {
    if (!cell.skinIndex) continue;
    for (let i = 0; i < 4; i++) {
      if (cell.skinWeight[i] > 1e-8 && cell.skinIndex[i] > max) max = cell.skinIndex[i];
    }
  }
  return max;
}

function captureInverseBind(bones, boneCount) {
  const inv = new Float32Array(boneCount * 16);
  for (let i = 0; i < boneCount; i++) {
    const bone = bones[i];
    if (!bone) continue;
    bone.updateWorldMatrix(true, false);
    _inv.copy(bone.matrixWorld).invert();
    _inv.toArray(inv, i * 16);
  }
  return inv;
}

function skinPoint(cell, bones, invBind, out) {
  out.set(0, 0, 0);
  _bind.fromArray(cell.bindPosition);
  let wsum = 0;
  for (let i = 0; i < 4; i++) {
    const w = cell.skinWeight[i];
    if (w <= 1e-8) continue;
    const bi = cell.skinIndex[i];
    const bone = bones[bi];
    if (!bone) continue;
    _boneMat.fromArray(invBind, bi * 16);
    _tmp.multiplyMatrices(bone.matrixWorld, _boneMat);
    _world.copy(_bind).applyMatrix4(_tmp);
    out.x += _world.x * w;
    out.y += _world.y * w;
    out.z += _world.z * w;
    wsum += w;
  }
  if (wsum <= 1e-8) out.fromArray(cell.bindPosition);
  else if (Math.abs(wsum - 1) > 1e-4) out.multiplyScalar(1 / wsum);
  return out;
}

function skinRotation(cell, bones, invBind, out) {
  out.identity();
  let first = true;
  let wsum = 0;
  for (let i = 0; i < 4; i++) {
    const w = cell.skinWeight[i];
    if (w <= 1e-8) continue;
    const bi = cell.skinIndex[i];
    const bone = bones[bi];
    if (!bone) continue;
    _boneMat.fromArray(invBind, bi * 16);
    _tmp.multiplyMatrices(bone.matrixWorld, _boneMat);
    _matrix.extractRotation(_tmp);
    _boneQuat.setFromRotationMatrix(_matrix).normalize();
    if (first) {
      out.copy(_boneQuat);
      first = false;
    } else {
      _quatBlend.copy(out);
      out.slerpQuaternions(_quatBlend, _boneQuat, w / (wsum + w));
    }
    wsum += w;
  }
  return out;
}

function buildFaceGeometry(artifact) {
  let faceCount = 0;
  for (const cell of artifact.cells) {
    const mask = cell.faceMask | 0;
    for (let d = 0; d < 6; d++) if (mask & (1 << d)) faceCount += 1;
  }
  const positions = new Float32Array(faceCount * 4 * 3);
  const normals = new Float32Array(faceCount * 4 * 3);
  const colors = new Float32Array(faceCount * 4 * 3);
  const indices = new Uint32Array(faceCount * 6);
  const size = artifact.voxelSize;
  let v = 0;
  let f = 0;
  let faceCursor = 0;
  for (const cell of artifact.cells) {
    const cx = cell.bindPosition[0];
    const cy = cell.bindPosition[1];
    const cz = cell.bindPosition[2];
    const rgb = cell.color;
    const mask = cell.faceMask | 0;
    for (let dir = 0; dir < 6; dir++) {
      if (!(mask & (1 << dir))) continue;
      const quad = FACE_QUADS[dir];
      const n = VOXEL_FACE_DIRS[dir];
      const base = v;
      for (let q = 0; q < 4; q++) {
        positions[v * 3] = cx + quad[q][0] * size;
        positions[v * 3 + 1] = cy + quad[q][1] * size;
        positions[v * 3 + 2] = cz + quad[q][2] * size;
        normals[v * 3] = n[0];
        normals[v * 3 + 1] = n[1];
        normals[v * 3 + 2] = n[2];
        colors[v * 3] = rgb[0];
        colors[v * 3 + 1] = rgb[1];
        colors[v * 3 + 2] = rgb[2];
        v += 1;
      }
      indices[f] = base; indices[f + 1] = base + 1; indices[f + 2] = base + 2;
      indices[f + 3] = base; indices[f + 4] = base + 2; indices[f + 5] = base + 3;
      f += 6;
      faceCursor += 1;
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new BufferAttribute(normals, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setIndex(new BufferAttribute(indices, 1));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return { geometry, faceCount: faceCursor };
}

/**
 * Instantiates a voxel artifact as batched Three.js geometry.
 *
 * Owns renderer resources. Call dispose() when finished.
 *
 * @param {object} artifact
 * @param {object} [options]
 * @returns {object}
 */
export function instantiateVoxelArtifact(artifact, {
  mode = 'instances',
  material = null,
  bones = null,
  name = null
} = {}) {
  if (!artifact || !artifact.cells) {
    throw new TypeError('instantiateVoxelArtifact requires a voxel artifact');
  }
  if(!['instances','surfaceInstances','faces'].includes(mode))throw new RangeError('Unknown voxel realization mode');
  if(mode==='surfaceInstances'&&!artifact.surfaceInstances)throw new TypeError('surfaceInstances mode requires compiled surface samples');
  const ownedMaterial = !material;
  const mat = material ?? defaultMaterial();
  mat.vertexColors = true;
  const cells = mode==='surfaceInstances'?artifact.surfaceInstances.samples:artifact.cells;
  const size = artifact.voxelSize;
  const overlap=mode==='surfaceInstances'?(artifact.surfaceInstances.overlap??1):1;
  if(!Number.isFinite(overlap)||overlap<1||overlap>1.06)throw new RangeError('Invalid isotropic surface overlap');
  const cubeSize=size*overlap;
  const root = new Object3D();
  root.name = name ?? artifact.id;
  root.frustumCulled = false;

  const meshes = [];
  let instanceCount = 0;
  let triangleCount = 0;
  let drawCalls = 0;
  let invBind = null;
  let boneCount = 0;
  let disposed = false;
  const ownedGeometries = [];

  if (mode === 'faces') {
    const built = buildFaceGeometry(artifact);
    ownedGeometries.push(built.geometry);
    const mesh = new Mesh(built.geometry, mat);
    mesh.name = `${root.name}:faces`;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    root.add(mesh);
    meshes.push(mesh);
    triangleCount = built.faceCount * 2;
    drawCalls = 1;
  } else {
    const box = new BoxGeometry(1, 1, 1);
    ownedGeometries.push(box);
    const mesh = new InstancedMesh(box, mat, Math.max(1, cells.length));
    mesh.name = `${root.name}:instances`;
    mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.frustumCulled = false;
    mesh.count = cells.length;
    if (typeof mesh.instanceColor === 'undefined' || mesh.instanceColor === null) {
      mesh.instanceColor = new BufferAttribute(new Float32Array(Math.max(1, cells.length) * 3), 3);
    }
    _scale.set(cubeSize, cubeSize, cubeSize);
    _quat.identity();
    for (let i = 0; i < cells.length; i++) {
      const cell = cells[i];
      _position.fromArray(cell.bindPosition);
      if(cell.bindOrientation)_quat.fromArray(cell.bindOrientation);else _quat.identity();
      _matrix.compose(_position, _quat, _scale);
      mesh.setMatrixAt(i, _matrix);
      _color.fromArray(cell.color);
      mesh.setColorAt(i, _color);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    root.add(mesh);
    meshes.push(mesh);
    instanceCount = cells.length;
    triangleCount = cells.length * 12;
    drawCalls = 1;
  }

  if (bones && cells.length && cells[0].skinIndex) {
    boneCount = maxBoneIndex(cells) + 1;
    invBind = captureInverseBind(bones, boneCount);
  }

  const stats = {
    mode,
    instances: instanceCount,
    surfaceVoxels: artifact.surfaceCount,
    occupiedVoxels: artifact.occupiedCount,
    enclosedVoxels: artifact.enclosedCount,
    visibleFaces: artifact.visibleFaceCount,
    culledFaces: artifact.culledFaces,
    naiveCubeFaces: artifact.naiveCubeFaces,
    triangles: triangleCount,
    drawCalls,
    materials: 1,
    voxelSize: size,
    cubeScale: overlap
  };

  return {
    object3D: root,
    artifact,
    material: mat,
    meshes,
    stats,
    get disposed() {
      return disposed;
    },
    /**
     * Rigid-cube deformation: voxel centres follow the guide skeleton, cubes
     * do not stretch. No-ops for static artifacts.
     *
     * @param {Array<object>} liveBones
     */
    updateDeformation(liveBones) {
      if (disposed || !invBind || mode === 'faces' || !liveBones) return;
      const mesh = meshes[0];
      root.updateWorldMatrix(true, false);
      _inv.copy(root.matrixWorld).invert();
      _matrix.extractRotation(_inv);
      _rootInverseQuat.setFromRotationMatrix(_matrix).normalize();
      _scale.set(cubeSize, cubeSize, cubeSize);
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i];
        if (!cell.skinIndex) {
          _position.fromArray(cell.bindPosition);
          _quat.identity();
        } else {
          skinPoint(cell, liveBones, invBind, _position);
          _position.applyMatrix4(_inv);
          skinRotation(cell, liveBones, invBind, _quat);
          _quat.premultiply(_rootInverseQuat);
        }
        if(cell.bindOrientation)_quat.multiply(_bindQuat.fromArray(cell.bindOrientation));
        _matrix.compose(_position, _quat, _scale);
        mesh.setMatrixAt(i, _matrix);
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    },
    setFlash(amount) {
      const a = Math.max(0, Math.min(1, amount));
      mat.emissive.setRGB(a * 0.34, a * 0.05, a * 0.03);
      mat.emissiveIntensity = a > 0 ? 1 : 0;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      root.removeFromParent();
      root.clear();
      for (const geometry of ownedGeometries) geometry.dispose();
      if (ownedMaterial) mat.dispose();
    }
  };
}
