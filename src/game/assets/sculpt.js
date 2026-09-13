// Game-owned section loft. Independent width/depth, displaced centres and
// angular shaping provide planar anatomy without stacking visible primitives.
import { BufferGeometry, Float32BufferAttribute } from 'three';
import { singlePart } from './kit.js';

export function sculpt({ name, sections, segments = 24, shape = null, arc = Math.PI * 2 }) {
  const positions = [], indices = [], uvs = [];
  const closed = arc === Math.PI * 2;
  const cols = closed ? segments : segments + 1;
  sections.forEach(([y, width, depth, cx = 0, cz = 0], row) => {
    for (let col = 0; col < cols; col++) {
      const angle = col / segments * arc;
      const c = Math.cos(angle), s = Math.sin(angle);
      const p = [cx + width * c, y, cz + depth * s];
      shape?.(p, { row, angle, c, s, y });
      positions.push(...p); uvs.push(col / segments, row / (sections.length - 1));
    }
  });
  for (let row = 0; row < sections.length - 1; row++) {
    for (let col = 0; col < segments; col++) {
      const a = row * cols + col, b = row * cols + (col + 1) % cols;
      indices.push(a, a + cols, b + cols, a, b + cols, b);
    }
  }
  // Recompute from the actual shaped surface, including asymmetric stations.
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  const normals = Array.from(geometry.attributes.normal.array);
  geometry.dispose();
  return singlePart({id: `sculpt:${name}`, semanticName: name, positions, normals, uvs, indices});
}
