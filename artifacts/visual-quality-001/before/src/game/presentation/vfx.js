/**
 * SUMO IS A BOXER — Transient effects.
 *
 * EVERYTHING HERE IS POOLED. The buffers are allocated once at boot and reused
 * for the rest of the session; a punch never creates a geometry, a material or
 * a particle object. A three-round rematch marathon costs exactly what the
 * first ten seconds cost, which is the property the performance brief asks for.
 *
 * The engine has no VFX or particle subsystem (ENGINE_GAPS.md — GAP-10), so
 * this is game-owned renderer code sitting beside the renderer, not inside it.
 */

import {
  BufferGeometry, BufferAttribute, Points, PointsMaterial, AdditiveBlending, Color,
  CanvasTexture, SRGBColorSpace
} from 'three';
import { FEEDBACK } from '../config.js';
import { createSeededRandom } from '../assets/kit.js';

/**
 * A soft round particle sprite, DRAWN IN CODE. Untextured points render as hard
 * squares, which is the single most obvious "programmer particle" tell there
 * is. This is a 64x64 radial falloff painted into a canvas at boot — one
 * texture, shared by every effect, no image file anywhere in the project.
 *
 * @param {number} [hardness] - 0 soft, 1 tight core.
 * @returns {CanvasTexture}
 */
function createSpriteTexture(hardness = 0.35) {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(hardness, 'rgba(255,255,255,0.75)');
  gradient.addColorStop(0.62, 'rgba(255,255,255,0.22)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

/**
 * Impact sparks and sweat: a single fixed-size Points cloud whose particles are
 * recycled from a free ring. Dead particles are parked below the floor rather
 * than resized out of the buffer, so the draw call never changes shape.
 *
 * @param {object} options
 * @param {object} options.scene
 * @returns {object} Handle.
 */
export function createImpactSparks({ scene, count = FEEDBACK.sparkPool }) {
  const rng = createSeededRandom(8081);
  const positions = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const velocities = new Float32Array(count * 3);
  const life = new Float32Array(count);
  const maxLife = new Float32Array(count);
  const size = new Float32Array(count);

  for (let i = 0; i < count; i += 1) positions[i * 3 + 1] = -50;

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.boundingSphere = null;

  const sprite = createSpriteTexture(0.3);
  const material = new PointsMaterial({
    size: 0.05,
    map: sprite,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true
  });

  const points = new Points(geometry, material);
  points.name = 'impact-sparks';
  points.frustumCulled = false;
  points.renderOrder = 8;
  scene.add(points);

  const tint = new Color();
  let cursor = 0;
  let alive = 0;

  return {
    points,

    /** @returns {number} Currently live particles. */
    get alive() {
      return alive;
    },

    /**
     * Emits one burst.
     *
     * @param {number[]} at - World position.
     * @param {object} [options]
     */
    burst(at, { amount = 14, speed = 2.4, spread = 0.06, color = 0xffd9a0, lifetime = 0.5, gravity = true } = {}) {
      tint.set(color);
      const emit = Math.min(amount, count);
      for (let n = 0; n < emit; n += 1) {
        const i = cursor;
        cursor = (cursor + 1) % count;
        const base = i * 3;
        positions[base] = at[0] + (rng.next() * 2 - 1) * spread;
        positions[base + 1] = at[1] + (rng.next() * 2 - 1) * spread;
        positions[base + 2] = at[2] + (rng.next() * 2 - 1) * spread;
        const theta = rng.next() * Math.PI * 2;
        const phi = Math.acos(rng.next() * 2 - 1);
        const magnitude = speed * (0.35 + rng.next() * 0.65);
        velocities[base] = Math.sin(phi) * Math.cos(theta) * magnitude;
        velocities[base + 1] = Math.abs(Math.cos(phi)) * magnitude * 0.8 + 0.4;
        velocities[base + 2] = Math.sin(phi) * Math.sin(theta) * magnitude;
        const jitter = 0.75 + rng.next() * 0.5;
        colors[base] = tint.r * jitter;
        colors[base + 1] = tint.g * jitter;
        colors[base + 2] = tint.b * jitter;
        maxLife[i] = lifetime * (0.6 + rng.next() * 0.7);
        life[i] = maxLife[i];
        size[i] = gravity ? 1 : 0;
      }
      alive = Math.min(count, alive + emit);
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },

    /**
     * @param {number} dt
     */
    update(dt) {
      if (alive === 0) return;
      let live = 0;
      for (let i = 0; i < count; i += 1) {
        if (life[i] <= 0) continue;
        life[i] -= dt;
        const base = i * 3;
        if (life[i] <= 0) {
          positions[base + 1] = -50;
          colors[base] = 0; colors[base + 1] = 0; colors[base + 2] = 0;
          continue;
        }
        live += 1;
        if (size[i] > 0) velocities[base + 1] -= 9.8 * dt * 0.55;
        const drag = Math.exp(-dt * 3.2);
        velocities[base] *= drag;
        velocities[base + 2] *= drag;
        positions[base] += velocities[base] * dt;
        positions[base + 1] += velocities[base + 1] * dt;
        positions[base + 2] += velocities[base + 2] * dt;
        const fade = Math.max(0, life[i] / maxLife[i]);
        colors[base] *= 0.92 + fade * 0.08;
        colors[base + 1] *= 0.9 + fade * 0.1;
        colors[base + 2] *= 0.88 + fade * 0.12;
      }
      alive = live;
      geometry.attributes.position.needsUpdate = true;
      geometry.attributes.color.needsUpdate = true;
    },

    /** Parks every particle, for a rematch. */
    clear() {
      for (let i = 0; i < count; i += 1) {
        life[i] = 0;
        positions[i * 3 + 1] = -50;
      }
      alive = 0;
      geometry.attributes.position.needsUpdate = true;
    },

    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      sprite.dispose();
    }
  };
}

/**
 * Slow dust hanging in the lamp cones. Fixed buffer, wrapped rather than
 * respawned, so it costs nothing after boot.
 *
 * @param {object} options
 * @returns {object} Handle.
 */
export function createDustField({ scene, count = FEEDBACK.dustCount, radius = 6.4, height = 5.4, floorY = -1.05 }) {
  const rng = createSeededRandom(20461);
  const positions = new Float32Array(count * 3);
  const drift = new Float32Array(count * 3);

  for (let i = 0; i < count; i += 1) {
    const base = i * 3;
    // Weighted toward the ring, because that is where the light is: dust you
    // cannot see is dust you should not be drawing.
    const r = Math.sqrt(rng.next()) * radius;
    const theta = rng.next() * Math.PI * 2;
    positions[base] = Math.cos(theta) * r;
    positions[base + 1] = floorY + rng.next() * height;
    positions[base + 2] = Math.sin(theta) * r;
    drift[base] = (rng.next() * 2 - 1) * 0.045;
    drift[base + 1] = 0.02 + rng.next() * 0.075;
    drift[base + 2] = (rng.next() * 2 - 1) * 0.045;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));

  const sprite = createSpriteTexture(0.12);
  const material = new PointsMaterial({
    color: 0xffd9ad,
    size: 0.034,
    map: sprite,
    transparent: true,
    opacity: 0.26,
    depthWrite: false,
    blending: AdditiveBlending,
    sizeAttenuation: true
  });

  const points = new Points(geometry, material);
  points.name = 'ring-dust';
  points.frustumCulled = false;
  points.renderOrder = 6;
  scene.add(points);

  let swirl = 0;

  return {
    points,

    /**
     * @param {number} dt
     * @param {number} [agitation] - 0..1, raised briefly by heavy impacts.
     */
    update(dt, agitation = 0) {
      swirl += dt * 0.35;
      const boost = 1 + agitation * 2.4;
      for (let i = 0; i < count; i += 1) {
        const base = i * 3;
        positions[base] += (drift[base] + Math.sin(swirl + i) * 0.012) * dt * boost;
        positions[base + 1] += drift[base + 1] * dt * boost;
        positions[base + 2] += (drift[base + 2] + Math.cos(swirl * 0.8 + i) * 0.012) * dt * boost;
        if (positions[base + 1] > floorY + height) positions[base + 1] = floorY + 0.05;
      }
      geometry.attributes.position.needsUpdate = true;
    },

    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
      sprite.dispose();
    }
  };
}
