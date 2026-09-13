/**
 * SUMO IS A BOXER — Opponent brain.
 *
 * A finite state machine with a telegraph. Every attack has a visible WIND-UP
 * before the strike, because the counter window is the whole point of the
 * fight: if you can read the wind-up you get paid, and if you swing at it
 * blindly you eat the hook.
 *
 * The brain produces INTENT (a desired velocity and, at most, one strike
 * request per tick). It never writes a transform and never applies damage.
 */

import { OPPONENT, RING_BOUNDS, DEFENCE } from '../config.js';
import { GUARD_HIGH, GUARD_LOW, directionTo, planarDistance } from './fighters.js';

/** States in which the opponent may be countered. */
export const COUNTERABLE = new Set(['wind']);

/**
 * Advances the opponent one fixed step.
 *
 * @param {object} options
 * @param {object} options.opponent - Opponent state (mutated).
 * @param {object} options.player - Player state (read only).
 * @param {object} options.opponentPos - Committed position.
 * @param {object} options.playerPos - Committed position.
 * @param {number} options.dt
 * @param {object} options.rng - Seeded RNG.
 * @param {boolean} options.live - False during intro / result.
 * @returns {{velocity: {x: number, z: number}, strike: object|null, facing: number}}
 */
export function updateOpponentBrain({ opponent, player, opponentPos, playerPos, dt, rng, live }) {
  const distance = planarDistance(opponentPos, playerPos);
  const toPlayer = directionTo(opponentPos, playerPos);
  // The opponent always squares up to the player: -Z is forward, so the yaw
  // that points -Z at the player is atan2(-dx, -dz).
  const desiredYaw = Math.atan2(-toPlayer.x, -toPlayer.z);
  opponent.yaw = approachAngle(opponent.yaw, desiredYaw, dt * 7.5);
  opponent.facing = { x: -Math.sin(opponent.yaw), z: -Math.cos(opponent.yaw) };

  opponent.stateT += dt;
  opponent.attackCooldown -= dt;
  opponent.thinkIn -= dt;
  opponent.flash = Math.max(0, opponent.flash - dt * 3.2);

  let velocity = { x: 0, z: 0 };
  let strike = null;

  if (!live) {
    opponent.speed = 0;
    return { velocity, strike, facing: opponent.yaw };
  }

  switch (opponent.state) {
    case 'down':
      // A knocked-out fighter stays down. The count is run by the match.
      if (!opponent.out && opponent.stateT >= OPPONENT.knockdownDuration) {
        transition(opponent, 'getup', OPPONENT.getUpDuration);
      }
      break;

    case 'getup':
      if (opponent.stateT >= opponent.stateDuration) {
        opponent.health = OPPONENT.getUpHealth;
        opponent.stamina = OPPONENT.getUpStamina;
        opponent.guardMeter = OPPONENT.getUpGuard;
        transition(opponent, 'retreat', 0.9);
      }
      break;

    case 'stagger':
      // Driven backwards, out of control.
      velocity = { x: -toPlayer.x * 1.5, z: -toPlayer.z * 1.5 };
      if (opponent.stateT >= opponent.stateDuration) {
        // Re-set the guard on the way out, so the fighter comes back able to
        // defend instead of standing there on an empty meter.
        opponent.guardMeter = Math.max(opponent.guardMeter, DEFENCE.guardAfterBreak);
        opponent.guardDelay = 0;
        transition(opponent, 'block', 0.5);
      }
      break;

    case 'block':
      velocity = holdRange(distance, toPlayer, OPPONENT.preferredRange, OPPONENT.walkSpeed * 0.5);
      if (opponent.stateT >= opponent.stateDuration) transition(opponent, 'idle', 0.28);
      break;

    case 'wind':
      // Stepping in as the punch loads: the telegraph has weight.
      velocity = { x: toPlayer.x * 0.9, z: toPlayer.z * 0.9 };
      if (opponent.stateT >= opponent.stateDuration) {
        transition(opponent, 'strike', OPPONENT.attacks[opponent.attack].strike);
        opponent.impactDone = false;
      }
      break;

    case 'strike': {
      const spec = OPPONENT.attacks[opponent.attack];
      velocity = { x: toPlayer.x * spec.lunge * 0.45, z: toPlayer.z * spec.lunge * 0.45 };
      if (!opponent.impactDone && opponent.stateT >= spec.strike * 0.45) {
        opponent.impactDone = true;
        strike = {
          attack: opponent.attack,
          zone: opponent.attackZone,
          damage: spec.damage,
          range: spec.range,
          distance
        };
      }
      if (opponent.stateT >= opponent.stateDuration) transition(opponent, 'recover', spec.recover);
      break;
    }

    case 'recover':
      velocity = holdRange(distance, toPlayer, OPPONENT.preferredRange + 0.2, OPPONENT.walkSpeed * 0.7);
      if (opponent.stateT >= opponent.stateDuration) transition(opponent, 'idle', 0.2);
      break;

    case 'retreat':
      velocity = { x: -toPlayer.x * OPPONENT.retreatSpeed, z: -toPlayer.z * OPPONENT.retreatSpeed };
      if (opponent.stateT >= opponent.stateDuration) transition(opponent, 'idle', 0.25);
      break;

    case 'approach':
      velocity = { x: toPlayer.x * OPPONENT.closeSpeed, z: toPlayer.z * OPPONENT.closeSpeed };
      if (distance <= OPPONENT.preferredRange || opponent.stateT >= opponent.stateDuration) {
        transition(opponent, 'idle', 0.18);
      }
      break;

    case 'circle': {
      const side = opponent.circleDirection;
      const tangentX = -toPlayer.z * side;
      const tangentZ = toPlayer.x * side;
      const correction = (distance - OPPONENT.preferredRange) * 0.9;
      velocity = {
        x: tangentX * OPPONENT.circleSpeed + toPlayer.x * correction,
        z: tangentZ * OPPONENT.circleSpeed + toPlayer.z * correction
      };
      // Do not circle into the ropes.
      const nextX = opponentPos.x + velocity.x * 0.5;
      const nextZ = opponentPos.z + velocity.z * 0.5;
      if (Math.abs(nextX) > RING_BOUNDS.half - 0.25 || Math.abs(nextZ) > RING_BOUNDS.half - 0.25) {
        opponent.circleDirection *= -1;
      }
      if (opponent.stateT >= opponent.stateDuration) transition(opponent, 'idle', 0.15);
      break;
    }

    case 'idle':
    default:
      velocity = holdRange(distance, toPlayer, OPPONENT.preferredRange, OPPONENT.walkSpeed * 0.55);
      if (opponent.thinkIn <= 0) decide({ opponent, player, distance, rng });
      break;
  }

  const playerThreat = player.action === 'JAB' || player.action === 'CROSS';
  // A reactive block: if the player commits inside range while the opponent is
  // idle or circling, it can get its hands up in time.
  if (live && playerThreat && distance < 2.5 && (opponent.state === 'idle' || opponent.state === 'circle') && opponent.attackCooldown < 0.4) {
    if (rng.next() < OPPONENT.blockChance) {
      opponent.blockZone = rng.next() < OPPONENT.readAccuracy
        ? player.guard
        : (player.guard === GUARD_HIGH ? GUARD_LOW : GUARD_HIGH);
      transition(opponent, 'block', 0.55);
      velocity = { x: 0, z: 0 };
    }
  }

  opponent.speed = Math.hypot(velocity.x, velocity.z);
  return { velocity, strike, facing: opponent.yaw };
}

/**
 * Chooses the next behaviour from idle.
 *
 * @param {object} options
 */
function decide({ opponent, player, distance, rng }) {
  opponent.thinkIn = rng.range(0.28, 0.6);
  const tired = opponent.stamina < 22;
  const hurt = opponent.health < 35;

  if (tired || (hurt && rng.next() < 0.35)) {
    opponent.circleDirection = rng.sign();
    transition(opponent, rng.next() < 0.5 ? 'circle' : 'retreat', rng.range(0.5, 1.0));
    return;
  }

  if (distance > OPPONENT.preferredRange + 0.55) {
    transition(opponent, 'approach', rng.range(0.4, 0.9));
    return;
  }

  if (distance < 1.25) {
    transition(opponent, 'retreat', rng.range(0.25, 0.5));
    return;
  }

  if (opponent.attackCooldown <= 0 && opponent.stamina > 20 && rng.next() < 0.5) {
    const heavy = rng.next() < (player.blocking ? 0.6 : 0.34);
    const attack = heavy ? 'HOOK' : 'JAB';
    const spec = OPPONENT.attacks[attack];
    opponent.attack = attack;
    // Aim where the player is NOT guarding, most of the time.
    const readsCorrectly = rng.next() < OPPONENT.readAccuracy;
    opponent.attackZone = readsCorrectly
      ? (player.guard === GUARD_HIGH ? GUARD_LOW : GUARD_HIGH)
      : player.guard;
    opponent.stamina = Math.max(0, opponent.stamina - spec.stamina);
    opponent.staminaDelay = OPPONENT.staminaRegenDelay;
    opponent.attackCooldown = spec.windUp + spec.strike + spec.recover + rng.range(0.5, 1.35);
    transition(opponent, 'wind', spec.windUp);
    return;
  }

  opponent.circleDirection = rng.next() < 0.5 ? -opponent.circleDirection : opponent.circleDirection;
  transition(opponent, 'circle', rng.range(0.45, 1.1));
}

/**
 * @param {object} opponent
 * @param {string} state
 * @param {number} duration
 */
export function transition(opponent, state, duration) {
  opponent.state = state;
  opponent.stateT = 0;
  opponent.stateDuration = duration;
}

/**
 * Velocity that walks the opponent toward its preferred distance.
 *
 * @param {number} distance
 * @param {object} toPlayer
 * @param {number} preferred
 * @param {number} speed
 * @returns {{x: number, z: number}}
 */
function holdRange(distance, toPlayer, preferred, speed) {
  const error = distance - preferred;
  if (Math.abs(error) < 0.12) return { x: 0, z: 0 };
  const magnitude = Math.max(-1, Math.min(1, error)) * speed;
  return { x: toPlayer.x * magnitude, z: toPlayer.z * magnitude };
}

/**
 * Shortest-arc angular approach.
 *
 * @param {number} current
 * @param {number} target
 * @param {number} maxStep
 * @returns {number}
 */
export function approachAngle(current, target, maxStep) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  const step = Math.max(-maxStep, Math.min(maxStep, delta));
  return current + step;
}
