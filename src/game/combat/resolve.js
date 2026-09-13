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

import { DEFENCE, PLAYER, KNOCKOUT } from '../config.js';

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
/**
 * How close a landed blow came to putting the defender out, as a score against
 * KNOCKOUT.threshold. Pure, so the KO rule is testable without a match.
 *
 * Returns 0 for anything that cannot knock a person unconscious: jabs, body
 * shots, and anything the defender got a glove on.
 *
 * @param {object} options
 * @returns {number}
 */
export function knockoutPower({
  heavy, head, kind, counter,
  defenderStamina, maxStamina, defenderKnockdowns,
  damage, healthBefore
}) {
  if (!heavy || !head) return 0;
  if (kind !== 'CLEAN' && kind !== 'COUNTER') return 0;

  let score = KNOCKOUT.heavyHeadBase;
  if (counter) score += KNOCKOUT.counterBonus;

  const drained = 1 - Math.max(0, Math.min(1, defenderStamina / Math.max(1, maxStamina)));
  score += drained * KNOCKOUT.exhaustionBonus;
  score += Math.min(3, defenderKnockdowns) * KNOCKOUT.accumulationBonus;

  // A blow that lands with far more on it than the defender had left to give.
  const overkill = Math.max(0, damage - healthBefore) / Math.max(1, damage);
  score += overkill * KNOCKOUT.overkillBonus;
  return score;
}

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
    // A GUARD BREAK IS A TRANSITION, NOT A STATE. Testing only the result meant
    // that once a meter reached zero every later hit also "broke" it, and each
    // break restarted the stagger timer - so a fighter under pressure could
    // never leave the stagger at all. Requiring the meter to have been up first
    // makes the break fire exactly once per collapse, for both fighters.
    const guardBroken = defenderGuardMeter > 0 && defenderGuardMeter - guardCost <= 0;
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
    guardBroken: defenderGuardMeter > 0 && defenderGuardMeter - guardCost <= 0,
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
