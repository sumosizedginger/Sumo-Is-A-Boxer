/**
 * SUMO IS A BOXER — Fighter state.
 *
 * Plain, inspectable state records plus the shared rules that apply to both
 * corners: stamina, the guard meter, ring constraints and fighter separation.
 *
 * POSITION IS NOT STORED HERE. The authoritative transform for each fighter
 * lives in the engine's transform manager, and this module only ever produces
 * INTENT for it (GAMEPLAY_FOUNDATION.md §3 / CONSTITUTION.md §13).
 */

import { PLAYER, OPPONENT, RING_BOUNDS } from '../config.js';

export const GUARD_HIGH = 'high';
export const GUARD_LOW = 'low';

/**
 * @returns {object} Player fight state.
 */
export function createPlayerState() {
  return {
    id: 'player',
    corner: 'blue',
    health: PLAYER.maxHealth,
    stamina: PLAYER.maxStamina,
    guardMeter: PLAYER.maxGuard,
    guard: GUARD_HIGH,
    blocking: false,
    action: 'idle',
    actionT: 0,
    actionDuration: 0,
    actionPunch: null,
    actionResolved: false,
    yaw: 0,
    pitch: 0,
    dodgeT: 0,
    dodgeCooldown: 0,
    dodgeDir: { x: 0, z: 1 },
    invulnerable: 0,
    staminaDelay: 0,
    guardDelay: 0,
    knockdowns: 0,
    /** Set when a knockdown was flush enough to be a knockout: they do not get up. */
    out: false,
    /** The count the referee is on, over a knocked-out fighter. */
    count: 0,
    countT: 0,
    downT: 0,
    getUpT: 0,
    sprinting: false,
    speed: 0,
    lastHitAt: -99
  };
}

/**
 * @returns {object} Opponent fight state.
 */
export function createOpponentState() {
  return {
    id: 'opponent',
    corner: 'red',
    health: OPPONENT.maxHealth,
    stamina: OPPONENT.maxStamina,
    guardMeter: OPPONENT.maxGuard,
    state: 'idle',
    stateT: 0,
    stateDuration: 0.6,
    attack: null,
    attackZone: GUARD_HIGH,
    blockZone: GUARD_HIGH,
    impactDone: false,
    yaw: 0,
    facing: { x: 0, z: 1 },
    circleDirection: 1,
    thinkIn: 0.5,
    attackCooldown: 1.1,
    staminaDelay: 0,
    guardDelay: 0,
    invulnerable: 0,
    knockdowns: 0,
    /** Set when a knockdown was flush enough to be a knockout: they do not get up. */
    out: false,
    /** The count the referee is on, over a knocked-out fighter. */
    count: 0,
    countT: 0,
    flash: 0,
    stagger: 0,
    speed: 0,
    lungeX: 0,
    lungeZ: 0
  };
}

/**
 * Advances the shared regeneration clocks.
 *
 * @param {object} fighter
 * @param {object} tuning - PLAYER or OPPONENT.
 * @param {number} dt
 * @param {boolean} calm - True when the fighter is not acting.
 */
export function regenerate(fighter, tuning, dt, calm) {
  fighter.staminaDelay -= dt;
  fighter.guardDelay -= dt;
  const stamina = fighter.stamina;
  if (calm && fighter.staminaDelay <= 0) {
    fighter.stamina = Math.min(tuning.maxStamina, stamina + tuning.staminaRegenPerSecond * dt);
  }
  if (fighter.guardDelay <= 0) {
    fighter.guardMeter = Math.min(tuning.maxGuard, fighter.guardMeter + tuning.guardRegenPerSecond * dt);
  }
  if (fighter.invulnerable > 0) fighter.invulnerable = Math.max(0, fighter.invulnerable - dt);
}

/**
 * Clamps a desired velocity so the committed position stays inside the ring and
 * the two fighters never occupy the same space.
 *
 * This runs BEFORE the transform manager commits, so the transform manager
 * remains the single authoritative writer for the step.
 *
 * @param {object} options
 * @param {object} options.position - Current committed position { x, y, z }.
 * @param {object} options.velocity - Desired velocity { x, z }.
 * @param {object} options.otherPosition
 * @param {number} options.dt
 * @returns {{x: number, z: number}} Constrained velocity.
 */
export function constrainVelocity({ position, velocity, otherPosition, dt }) {
  if (dt <= 0) return { x: 0, z: 0 };
  let px = position.x + velocity.x * dt;
  let pz = position.z + velocity.z * dt;

  const half = RING_BOUNDS.half;
  px = Math.max(-half, Math.min(half, px));
  pz = Math.max(-half, Math.min(half, pz));

  if (otherPosition) {
    const dx = px - otherPosition.x;
    const dz = pz - otherPosition.z;
    const distance = Math.hypot(dx, dz);
    const minimum = RING_BOUNDS.separation;
    if (distance < minimum) {
      // Push out along the separation axis. A zero distance is resolved on +X
      // so two coincident fighters still separate deterministically.
      const nx = distance > 1e-4 ? dx / distance : 1;
      const nz = distance > 1e-4 ? dz / distance : 0;
      px = otherPosition.x + nx * minimum;
      pz = otherPosition.z + nz * minimum;
      px = Math.max(-half, Math.min(half, px));
      pz = Math.max(-half, Math.min(half, pz));
    }
  }

  return { x: (px - position.x) / dt, z: (pz - position.z) / dt };
}

/**
 * Planar distance between two positions.
 *
 * @param {object} a
 * @param {object} b
 * @returns {number}
 */
export function planarDistance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

/**
 * The unit direction from `from` to `to` on the ring plane.
 *
 * @param {object} from
 * @param {object} to
 * @returns {{x: number, z: number}}
 */
export function directionTo(from, to) {
  const dx = to.x - from.x;
  const dz = to.z - from.z;
  const length = Math.hypot(dx, dz) || 1;
  return { x: dx / length, z: dz / length };
}

/**
 * True when `yaw` faces `target` within `tolerance` radians.
 *
 * The player's camera yaw follows the engine's -Z forward convention.
 *
 * @param {number} yaw
 * @param {object} from
 * @param {object} target
 * @param {number} tolerance
 * @returns {boolean}
 */
export function isFacing(yaw, from, target, tolerance) {
  const forwardX = -Math.sin(yaw);
  const forwardZ = -Math.cos(yaw);
  const to = directionTo(from, target);
  const dot = forwardX * to.x + forwardZ * to.z;
  return dot >= Math.cos(tolerance);
}
