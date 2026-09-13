/**
 * SUMO IS A BOXER — Damage resolution.
 *
 * Pure functions. They take the state of an exchange and return an OUTCOME
 * RECORD describing what happened; they never mutate fighters, spawn effects or
 * play sound. The caller applies the outcome. That split is what makes the
 * exchange rules testable without a renderer.
 *
 * THE HIGH/LOW MODEL, which is the core read of this fight:
 *
 *   guard height matches + braced    a real block: 12% through, guard meter pays
 *   guard height matches, not braced arms up but not set: 80% through
 *   braced, wrong height             beaten guard: 60% through
 *   neither                          clean
 *
 * A block that empties the guard meter BREAKS it, which is the opening both
 * fighters are actually fishing for.
 */

import { DEFENCE, PLAYER } from '../config.js';

/**
 * Resolves one incoming strike against a defender.
 *
 * @param {object} options
 * @param {number} options.damage - Base damage before defence.
 * @param {string} options.zone - 'high' (head) or 'low' (body).
 * @param {string} options.defenderGuard - The defender's guard height.
 * @param {boolean} options.defenderBlocking
 * @param {number} options.defenderGuardMeter
 * @param {boolean} [options.evaded=false] - Dodging or invulnerable.
 * @param {boolean} [options.counter=false] - Struck during the target's wind-up.
 * @returns {object} Frozen outcome.
 */
export function resolveStrike({
  damage,
  zone,
  defenderGuard,
  defenderBlocking,
  defenderGuardMeter,
  evaded = false,
  counter = false
}) {
  if (evaded) {
    return Object.freeze({
      kind: 'EVADED', damage: 0, chip: 0, guardCost: 0, staminaCost: 0,
      guardBroken: false, matched: false, counter: false
    });
  }

  const matched = defenderGuard === zone;
  const boosted = counter ? damage * DEFENCE.counterMultiplier : damage;

  if (defenderBlocking && matched) {
    const guardCost = boosted * DEFENCE.guardCostMatched;
    const guardBroken = defenderGuardMeter - guardCost <= 0;
    return Object.freeze({
      kind: guardBroken ? 'GUARD_BROKEN' : 'BLOCKED',
      damage: boosted * DEFENCE.chip,
      chip: boosted * DEFENCE.chip,
      guardCost,
      staminaCost: boosted * DEFENCE.staminaCostMatched,
      guardBroken,
      matched: true,
      counter
    });
  }

  const factor = defenderBlocking
    ? DEFENCE.blockedMismatched
    : (matched ? DEFENCE.passiveMatched : 1);
  const dealt = boosted * factor;
  const guardCost = dealt * DEFENCE.guardCostClean;

  return Object.freeze({
    kind: counter ? 'COUNTER' : 'CLEAN',
    damage: dealt,
    chip: 0,
    guardCost,
    staminaCost: 0,
    guardBroken: defenderGuardMeter - guardCost <= 0,
    matched,
    counter
  });
}

/**
 * Scales a punch by the attacker's condition. A tired fighter still throws, but
 * nothing lands the way it did in the first thirty seconds.
 *
 * @param {number} damage
 * @param {number} stamina
 * @returns {number}
 */
export function conditionScaledDamage(damage, stamina) {
  return stamina < PLAYER.tiredThreshold ? damage * PLAYER.tiredDamageFactor : damage;
}

/**
 * Whether an attack geometrically connects.
 *
 * @param {object} options
 * @param {number} options.distance
 * @param {number} options.reach
 * @param {boolean} options.facing
 * @returns {boolean}
 */
export function connects({ distance, reach, facing }) {
  return facing && distance <= reach;
}
