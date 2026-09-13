/**
 * SUMO IS A BOXER — Fight tuning.
 *
 * One file, so combat feel can be read and revised without hunting through
 * systems. Values that carry forward from IRON PALMS — Midnight Bout are marked,
 * because that game's responsiveness is the bar this build has to clear.
 */

export const SIM = Object.freeze({
  tickRate: 60,
  maxSubSteps: 6
});

export const RING_BOUNDS = Object.freeze({
  half: 3.05,
  /** Fighters cannot overlap. */
  separation: 0.78
});

export const CAMERA = Object.freeze({
  eyeHeight: 1.62,
  baseFov: 72,
  sprintFov: 4,
  near: 0.02,
  far: 90,
  pitchLimit: 1.15,
  mouseSensitivity: 0.0022,
  stickSensitivity: 2.9
});

export const PLAYER = Object.freeze({
  maxHealth: 100,
  maxStamina: 100,
  maxGuard: 100,
  walkSpeed: 3.3,            // IRON PALMS
  sprintSpeed: 5.3,          // IRON PALMS
  tiredSpeedFactor: 0.62,
  blockSpeedFactor: 0.45,
  actionSpeedFactor: 0.35,
  acceleration: 10,
  sprintStaminaPerSecond: 11,
  staminaRegenPerSecond: 14,
  staminaRegenDelay: 0.7,
  tiredThreshold: 25,
  tiredDamageFactor: 0.72,
  dodgeStamina: 18,
  dodgeDuration: 0.3,
  dodgeSpeed: 7.6,
  dodgeInvulnerable: 0.22,
  dodgeCooldown: 0.34,
  guardRegenPerSecond: 16,
  guardRegenDelay: 1.1,
  knockdownDuration: 2.3,
  getUpDuration: 0.95,
  getUpHealth: 38,
  getUpStamina: 55,
  getUpGuard: 62,
  reachOrigin: 0.35
});

/** Player punches. Durations, reaches and costs from IRON PALMS. */
export const PUNCH = Object.freeze({
  JAB: Object.freeze({
    id: 'JAB', label: 'JAB', duration: 0.34, impactAt: 0.15, reach: 2.05,
    stamina: 6, damage: 7, fovKick: 0.7, hitStop: 0.020, shake: 0.07, arm: 'left'
  }),
  CROSS: Object.freeze({
    id: 'CROSS', label: 'CROSS', duration: 0.62, impactAt: 0.28, reach: 2.3,
    stamina: 15, damage: 15, fovKick: 1.8, hitStop: 0.045, shake: 0.16, arm: 'right'
  })
});

export const OPPONENT = Object.freeze({
  maxHealth: 100,
  maxStamina: 100,
  maxGuard: 100,
  walkSpeed: 2.35,
  circleSpeed: 1.75,
  closeSpeed: 3.1,
  retreatSpeed: 2.7,
  preferredRange: 1.85,
  staminaRegenPerSecond: 13,
  staminaRegenDelay: 0.9,
  guardRegenPerSecond: 11,
  guardRegenDelay: 1.4,
  knockdownDuration: 2.4,
  getUpDuration: 1.0,
  getUpHealth: 40,
  getUpStamina: 58,
  getUpGuard: 65,
  blockChance: 0.62,
  /** How likely the opponent guesses the player's guard height correctly. */
  readAccuracy: 0.6,
  attacks: Object.freeze({
    JAB: Object.freeze({ id: 'JAB', windUp: 0.24, strike: 0.16, recover: 0.28, range: 1.95, damage: 6, stamina: 9, lunge: 3.4 }),
    HOOK: Object.freeze({ id: 'HOOK', windUp: 0.36, strike: 0.2, recover: 0.42, range: 2.1, damage: 13, stamina: 18, lunge: 4.6 })
  })
});

/**
 * TRUE KNOCKOUT.
 *
 * A knockdown is not a knockout. A fighter who goes down and beats the count is
 * still in the fight; a fighter who is knocked out does not get up, and the
 * count runs to ten over them. Only a flush heavy head shot carries that kind of
 * power, and even then only against someone the fight has already taken
 * something out of - which is why the score below stacks exhaustion, previous
 * knockdowns, counters and overkill on top of a base that is deliberately too
 * low to KO a fresh opponent on its own.
 */
export const KNOCKOUT = Object.freeze({
  /** Score at or above which a knockdown becomes a knockout. */
  threshold: 1,
  /** A clean heavy head shot, on its own, against a fresh fighter. */
  heavyHeadBase: 0.55,
  /** Landing it on a fighter who was coming in. */
  counterBonus: 0.3,
  /** Scaled by how far the defender's stamina has been emptied. */
  exhaustionBonus: 0.3,
  /** Per previous knockdown the defender has already taken. */
  accumulationBonus: 0.22,
  /** Scaled by how far the blow exceeded what was left of their health. */
  overkillBonus: 0.5,
  /** Seconds per number of the count. Ten of these is the full count. */
  countInterval: 0.42,
  countTo: 10
});

export const DEFENCE = Object.freeze({
  /** Damage multiplier when braced AND the guard height matches. */
  blockedMatched: 0.12,
  /** Braced, wrong height. */
  blockedMismatched: 0.6,
  /** Not braced, but the guard height matches: arms are up, not set. */
  passiveMatched: 0.8,
  /** Guard meter cost of absorbing a matched block, per point of damage. */
  guardCostMatched: 2.4,
  /** Guard meter cost when the hit lands clean. */
  guardCostClean: 1.1,
  /** Chip damage that passes through a matched block. */
  chip: 0.15,
  /** Stamina cost of absorbing a matched block, per point of damage. */
  staminaCostMatched: 0.55,
  guardBreakStagger: 1.5,
  /**
   * Guard restored when a broken fighter finishes staggering. Without this they
   * leave the stagger on an empty meter, which reads as never recovering even
   * once the stagger itself ends correctly. Deliberately partial: a break should
   * still cost the rest of the exchange.
   */
  guardAfterBreak: 34,
  counterMultiplier: 1.45
});

export const MATCH = Object.freeze({
  roundSeconds: 150,
  /**
   * Knockdowns before the bout is stopped. This is a THREE-KNOCKDOWN TKO, not a
   * knockout: the fighter kept getting up, the stoppage is the rulebook's. A
   * true KO is a separate, harder finish - see KNOCKOUT below.
   */
  knockdownsToLose: 3,
  introSeconds: 2.4,
  /** Delay between the final blow and the result screen. */
  finishSeconds: 2.2
});

export const FEEDBACK = Object.freeze({
  hitStopMax: 0.055,
  hitStopJab: 0.020,
  hitStopCross: 0.045,
  shakeDecay: 7,
  fovDecay: 9,
  damageVignetteDecay: 1.8,
  /** Max transient sparks alive at once. The pool never grows past this. */
  sparkPool: 96,
  sweatPool: 64,
  dustCount: 340
});
