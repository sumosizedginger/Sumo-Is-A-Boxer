/**
 * SUMO IS A BOXER — The match.
 *
 * Owns the fight: both fighters, the round clock, the result, and the exchange
 * rules that connect them.
 *
 * ENGINE GAMEPLAY FOUNDATION USED HERE:
 *   createEntityManager      generational handles for the two fighters
 *   createTransformManager   the single authoritative writer for their positions
 *   createStateManager       the match finite state machine and its variables
 *   createRuleEngine         declarative WHEN / IF / DO wiring for match events
 *
 * TRANSFORM AUTHORITY. Nothing in this file writes a fighter position. Movement,
 * the AI and the ring constraint all produce INTENT; `transforms.commitAll(dt)`
 * is the only writer, once per fixed step.
 */

import {
  createEntityManager,
  createTransformManager,
  createStateManager,
  createRuleEngine,
  TRANSFORM_OWNERSHIP
} from '@sumosizedginger/my-game-engine-1.0/full';
import { PLAYER, OPPONENT, PUNCH, MATCH, RING_BOUNDS, DEFENCE, KNOCKOUT } from '../config.js';
import { createSeededRandom } from '../assets/kit.js';
import {
  createPlayerState, createOpponentState, regenerate, constrainVelocity,
  planarDistance, directionTo, isFacing, GUARD_HIGH, GUARD_LOW
} from './fighters.js';
import { resolveStrike, conditionScaledDamage, connects, knockoutPower } from './resolve.js';
import { updateOpponentBrain, transition, COUNTERABLE } from './ai.js';

export const MATCH_STATES = Object.freeze(['INTRO', 'FIGHTING', 'PAUSED', 'FINISHED']);

/** How wide a cone counts as "facing the opponent" when a punch lands. */
const FACING_TOLERANCE = 0.72;

/**
 * Creates a match.
 *
 * @param {object} [options]
 * @param {number[]} [options.playerSpawn]
 * @param {number[]} [options.opponentSpawn]
 * @param {number} [options.seed]
 * @returns {object} Match.
 */
export function createMatch({ playerSpawn = [0.9, 0, 2.1], opponentSpawn = [-0.9, 0, -2.1], seed = 1701 } = {}) {
  const entities = createEntityManager();
  const transforms = createTransformManager(entities);
  const rules = createRuleEngine();
  const state = createStateManager({
    initialState: 'INTRO',
    validStates: MATCH_STATES,
    initialVars: {
      roundTime: MATCH.roundSeconds,
      result: null,
      message: 'ROUND 1',
      messageT: 1.8,
      introT: MATCH.introSeconds,
      finishT: 0
    }
  });

  let rng = createSeededRandom(seed);
  const player = createPlayerState();
  const opponent = createOpponentState();
  const feed = [];

  // Both fighters start squared up, derived from the scene-authored spawns
  // rather than from a hardcoded angle, so moving a spawn node moves the stance.
  const spawnFacing = (from, to) => Math.atan2(-(to[0] - from[0]), -(to[2] - from[2]));
  const playerYaw = spawnFacing(playerSpawn, opponentSpawn);
  const opponentYaw = spawnFacing(opponentSpawn, playerSpawn);
  player.yaw = playerYaw;
  opponent.yaw = opponentYaw;

  const playerEntity = entities.spawn({ role: 'player' });
  const opponentEntity = entities.spawn({ role: 'opponent' });
  transforms.setTransform(playerEntity, {
    position: { x: playerSpawn[0], y: 0, z: playerSpawn[2] },
    ownership: TRANSFORM_OWNERSHIP.KINEMATIC
  });
  transforms.setTransform(opponentEntity, {
    position: { x: opponentSpawn[0], y: 0, z: opponentSpawn[2] },
    ownership: TRANSFORM_OWNERSHIP.KINEMATIC
  });

  /**
   * Publishes a match event to both the rule engine and the presentation feed.
   *
   * @param {string} event
   * @param {object} [payload]
   */
  function emit(event, payload = {}) {
    feed.push({ event, payload });
    rules.trigger(event, payload);
  }

  /**
   * Sets the transient banner line.
   *
   * @param {string} text
   * @param {number} [seconds]
   */
  function say(text, seconds = 1.1) {
    state.setVar('message', text);
    state.setVar('messageT', seconds);
  }

  // ---- MATCH RULES (declarative WHEN / IF / DO) ---------------------------
  rules.addRule({
    name: 'opponent-down-ends-match',
    event: 'KNOCKDOWN',
    // Three knockdowns is the rulebook stopping it, not a knockout. A fighter
    // who is actually knocked out never reaches here - advanceCount() ends it.
    condition: (payload) => payload.who === 'opponent' && !payload.knockout
      && opponent.knockdowns >= MATCH.knockdownsToLose,
    action: () => finish('WIN', 'TKO')
  });
  rules.addRule({
    name: 'player-down-ends-match',
    event: 'KNOCKDOWN',
    condition: (payload) => payload.who === 'player' && !payload.knockout
      && player.knockdowns >= MATCH.knockdownsToLose,
    action: () => finish('LOSE', 'TKO')
  });
  rules.addRule({
    name: 'knockdown-banner',
    event: 'KNOCKDOWN',
    action: (payload) => {
      if (payload.knockout) say(payload.who === 'opponent' ? 'HE IS OUT COLD!' : 'YOU ARE OUT!', 1.6);
      else say(payload.who === 'opponent' ? 'KNOCKDOWN!' : 'YOU ARE DOWN!', 1.6);
    }
  });
  rules.addRule({
    name: 'count-banner',
    event: 'COUNT',
    action: (payload) => say(String(payload.n), KNOCKOUT.countInterval + 0.05)
  });
  rules.addRule({
    name: 'guard-break-banner',
    event: 'GUARD_BROKEN',
    action: () => say('GUARD BREAK!', 1.1)
  });
  rules.addRule({
    name: 'counter-banner',
    event: 'PUNCH_LANDED',
    condition: (payload) => payload.by === 'player' && payload.outcome.counter,
    action: () => say('COUNTER!', 0.9)
  });
  rules.addRule({
    name: 'round-expired',
    event: 'TIME_EXPIRED',
    action: () => {
      // A count already running outranks the bell: let it finish the bout.
      if (player.out || opponent.out) return;
      if (player.health > opponent.health) finish('WIN', 'DECISION');
      else if (opponent.health > player.health) finish('LOSE', 'DECISION');
      else finish('DRAW', 'DRAW');
    }
  });

  /**
   * @param {string} result - 'WIN' | 'LOSE' | 'DRAW'
   * @param {string} label
   */
  function finish(result, label) {
    if (state.getState() === 'FINISHED') return;
    state.setVar('result', { result, label });
    state.setVar('finishT', MATCH.finishSeconds);
    state.transition('FINISHED');
    say(label, 3);
    emit('MATCH_FINISHED', { result, label });
  }

  const playerTransform = () => transforms.getTransform(playerEntity);
  const opponentTransform = () => transforms.getTransform(opponentEntity);

  // ---- PLAYER -------------------------------------------------------------

  /**
   * Starts a player punch if the player is in a position to throw one.
   *
   * @param {object} spec
   */
  function startPunch(spec) {
    if (player.action !== 'idle' || player.dodgeT > 0 || player.stamina < 1) return;
    player.action = spec.id;
    player.actionPunch = spec;
    player.actionT = 0;
    player.actionDuration = spec.duration;
    player.actionResolved = false;
    player.stamina = Math.max(0, player.stamina - spec.stamina);
    player.staminaDelay = PLAYER.staminaRegenDelay;
    emit('PUNCH_THROWN', { by: 'player', punch: spec.id });
  }

  /**
   * Starts a dodge in the player's current movement direction.
   *
   * @param {object} frame
   */
  function startDodge(frame) {
    if (player.action !== 'idle' || player.dodgeT > 0 || player.dodgeCooldown > 0) return;
    if (player.stamina < PLAYER.dodgeStamina) return;
    const moveX = frame.value('MOVE_X');
    const moveY = frame.value('MOVE_Y');
    const forwardX = -Math.sin(player.yaw);
    const forwardZ = -Math.cos(player.yaw);
    const rightX = Math.cos(player.yaw);
    const rightZ = -Math.sin(player.yaw);
    // MOVE_Y is negative-forward; a dodge with no input goes backwards.
    let dx = rightX * moveX - forwardX * moveY;
    let dz = rightZ * moveX - forwardZ * moveY;
    if (Math.hypot(dx, dz) < 0.1) { dx = -forwardX; dz = -forwardZ; }
    const length = Math.hypot(dx, dz) || 1;
    player.dodgeDir = { x: dx / length, z: dz / length };
    player.dodgeT = PLAYER.dodgeDuration;
    player.dodgeCooldown = PLAYER.dodgeDuration + PLAYER.dodgeCooldown;
    player.action = 'dodge';
    player.actionT = 0;
    player.actionDuration = PLAYER.dodgeDuration;
    player.invulnerable = Math.max(player.invulnerable, PLAYER.dodgeInvulnerable);
    player.stamina = Math.max(0, player.stamina - PLAYER.dodgeStamina);
    player.staminaDelay = PLAYER.staminaRegenDelay + 0.1;
    emit('DODGE', { by: 'player' });
  }

  /**
   * Reads the semantic action frame and produces the player's desired velocity.
   *
   * @param {object} frame
   * @param {number} dt
   * @param {boolean} live
   * @returns {{x: number, z: number}}
   */
  function updatePlayer(frame, dt, live) {
    player.dodgeCooldown = Math.max(0, player.dodgeCooldown - dt);

    // --- look ------------------------------------------------------------
    // Impulse (pointer) and rate (stick) are different quantities and are
    // applied as such. See input/actions.js.
    const lookX = frame.delta('LOOK_X') + frame.value('LOOK_X') * dt * 165;
    const lookY = frame.delta('LOOK_Y') + frame.value('LOOK_Y') * dt * 165;
    if (player.action !== 'down') {
      player.yaw -= lookX * 0.0022;
      player.pitch -= lookY * 0.0022;
      player.pitch = Math.max(-1.15, Math.min(1.15, player.pitch));
    }

    if (!live) return { x: 0, z: 0 };

    // --- guard height ----------------------------------------------------
    if (frame.pressed('GUARD_HIGH') && player.guard !== GUARD_HIGH) {
      player.guard = GUARD_HIGH;
      emit('GUARD_CHANGED', { guard: GUARD_HIGH });
    }
    if (frame.pressed('GUARD_LOW') && player.guard !== GUARD_LOW) {
      player.guard = GUARD_LOW;
      emit('GUARD_CHANGED', { guard: GUARD_LOW });
    }

    // --- actions ---------------------------------------------------------
    const canAct = player.action === 'idle' && player.dodgeT <= 0 && player.health > 0;
    player.blocking = frame.held('BLOCK') && player.action !== 'down' && player.action !== 'getup' && player.dodgeT <= 0;
    if (canAct) {
      if (frame.pressed('JAB')) startPunch(PUNCH.JAB);
      else if (frame.pressed('CROSS')) startPunch(PUNCH.CROSS);
      else if (frame.pressed('DODGE')) startDodge(frame);
    }

    // --- movement --------------------------------------------------------
    let velocity = { x: 0, z: 0 };
    if (player.action === 'dodge') {
      const k = 1 - player.actionT / Math.max(0.0001, player.actionDuration);
      velocity = {
        x: player.dodgeDir.x * PLAYER.dodgeSpeed * k,
        z: player.dodgeDir.z * PLAYER.dodgeSpeed * k
      };
    } else if (player.action === 'idle' || player.action === 'JAB' || player.action === 'CROSS' || player.action === 'stagger') {
      const moveX = frame.value('MOVE_X');
      const moveY = frame.value('MOVE_Y');
      let magnitude = Math.hypot(moveX, moveY);
      const forwardX = -Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);
      const rightX = Math.cos(player.yaw);
      const rightZ = -Math.sin(player.yaw);
      let wx = rightX * moveX - forwardX * moveY;
      let wz = rightZ * moveX - forwardZ * moveY;
      if (magnitude > 1) { wx /= magnitude; wz /= magnitude; magnitude = 1; }

      let speed = PLAYER.walkSpeed
        * (player.stamina < PLAYER.tiredThreshold ? PLAYER.tiredSpeedFactor : 1)
        * (player.blocking ? PLAYER.blockSpeedFactor : 1)
        * (player.action === 'idle' ? 1 : PLAYER.actionSpeedFactor);

      const wantsSprint = frame.held('SPRINT') && magnitude > 0.1 && !player.blocking
        && player.stamina > 1 && player.action === 'idle' && moveY < -0.1;
      player.sprinting = wantsSprint;
      if (wantsSprint) {
        speed = PLAYER.sprintSpeed;
        player.stamina = Math.max(0, player.stamina - PLAYER.sprintStaminaPerSecond * dt);
        player.staminaDelay = 0.5;
      }
      velocity = { x: wx * speed * magnitude, z: wz * speed * magnitude };
    }

    player.speed = Math.hypot(velocity.x, velocity.z);
    return velocity;
  }

  /**
   * Advances the player's action timeline and resolves a punch at its impact
   * frame.
   *
   * @param {number} dt
   */
  function advancePlayerAction(dt) {
    if (player.action === 'idle') return;
    player.actionT += dt;

    if ((player.action === 'JAB' || player.action === 'CROSS') && !player.actionResolved) {
      const spec = player.actionPunch;
      if (player.actionT >= spec.impactAt) {
        player.actionResolved = true;
        resolvePlayerPunch(spec);
      }
    }

    if (player.action === 'dodge') {
      // Snapped to zero rather than merely clamped. `dodgeT` and `actionT` count
      // the same 0.3 s from opposite ends in floating point, so the action can
      // end one step before `dodgeT` finishes draining and strand a residue of
      // about 5e-17. `canAct` tests `dodgeT <= 0`, so that residue permanently
      // disabled every punch and every subsequent dodge for the rest of the
      // match. Found by dodging in the browser; regression-tested in
      // tests/combat.test.js.
      player.dodgeT = player.dodgeT - dt;
      if (player.dodgeT < 1e-6) player.dodgeT = 0;
    }
    if (player.action === 'down') {
      player.downT += dt;
      if (!player.out && player.downT >= PLAYER.knockdownDuration) {
        player.action = 'getup';
        player.actionT = 0;
        player.actionDuration = PLAYER.getUpDuration;
        player.getUpT = 0;
      }
      return;
    }
    if (player.action === 'getup') {
      player.getUpT += dt;
      if (player.getUpT >= PLAYER.getUpDuration) {
        player.action = 'idle';
        player.health = PLAYER.getUpHealth;
        player.stamina = PLAYER.getUpStamina;
        player.guardMeter = PLAYER.getUpGuard;
        player.invulnerable = 0.8;
        say('BOX ON', 0.9);
      }
      return;
    }

    if (player.actionT >= player.actionDuration) {
      if (player.action === 'stagger') {
        // Same re-set the opponent gets when its stagger ends.
        player.guardMeter = Math.max(player.guardMeter, DEFENCE.guardAfterBreak);
        player.guardDelay = 0;
      }
      player.action = 'idle';
      player.actionT = 0;
      player.actionPunch = null;
      // Whatever the action was, it is over: no timer belonging to it survives
      // into the idle state.
      player.dodgeT = 0;
    }
  }

  /**
   * @param {object} spec - PUNCH.JAB or PUNCH.CROSS
   */
  function resolvePlayerPunch(spec) {
    const from = playerTransform().position;
    const to = opponentTransform().position;
    const distance = planarDistance(from, to);
    const facing = isFacing(player.yaw, from, to, FACING_TOLERANCE);

    if (!connects({ distance, reach: spec.reach, facing })) {
      emit('PUNCH_MISSED', { by: 'player', punch: spec.id });
      return;
    }

    const evaded = opponent.invulnerable > 0 || opponent.state === 'down' || opponent.state === 'getup';
    const counter = COUNTERABLE.has(opponent.state);
    const outcome = resolveStrike({
      damage: conditionScaledDamage(spec.damage, player.stamina),
      zone: player.guard,
      defenderGuard: opponent.blockZone,
      defenderBlocking: opponent.state === 'block',
      defenderGuardMeter: opponent.guardMeter,
      evaded,
      counter
    });

    if (outcome.kind === 'EVADED') {
      emit('PUNCH_EVADED', { by: 'player', punch: spec.id });
      return;
    }

    const opponentHealthBefore = opponent.health;
    opponent.health = Math.max(0, opponent.health - outcome.damage);
    opponent.guardMeter = Math.max(0, opponent.guardMeter - outcome.guardCost);
    opponent.guardDelay = OPPONENT.guardRegenDelay;
    opponent.staminaDelay = OPPONENT.staminaRegenDelay;
    opponent.stamina = Math.max(0, opponent.stamina - outcome.staminaCost);
    opponent.flash = 1;

    const impactPoint = impactBetween(from, to, player.guard);

    if (outcome.guardBroken) {
      transition(opponent, 'stagger', DEFENCE.guardBreakStagger);
      opponent.guardMeter = 0;
      emit('GUARD_BROKEN', { who: 'opponent', at: impactPoint });
    } else if (outcome.kind === 'BLOCKED') {
      transition(opponent, 'block', Math.max(0.25, opponent.stateDuration - opponent.stateT));
      emit('PUNCH_BLOCKED', { by: 'player', punch: spec.id, outcome, at: impactPoint });
    } else {
      transition(opponent, 'stagger', Math.min(0.85, 0.3 + outcome.damage * 0.018) + (counter ? 0.25 : 0));
      emit('PUNCH_LANDED', { by: 'player', punch: spec.id, zone: player.guard, outcome, at: impactPoint, heavy: spec.id === 'CROSS' });
    }

    if (opponent.health <= 0) {
      // Flush enough to be a knockout, or just a knockdown they can rise from?
      const power = knockoutPower({
        heavy: spec.id === 'CROSS',
        head: player.guard === GUARD_HIGH,
        kind: outcome.kind,
        counter,
        defenderStamina: opponent.stamina,
        maxStamina: OPPONENT.maxStamina,
        defenderKnockdowns: opponent.knockdowns,
        damage: outcome.damage,
        healthBefore: opponentHealthBefore
      });
      knockdown('opponent', power >= KNOCKOUT.threshold);
    }
  }

  /**
   * Resolves a strike the opponent's brain requested this tick.
   *
   * @param {object} strike
   */
  function resolveOpponentStrike(strike) {
    const from = opponentTransform().position;
    const to = playerTransform().position;
    const distance = planarDistance(from, to);

    if (distance > strike.range) {
      emit('PUNCH_MISSED', { by: 'opponent', punch: strike.attack });
      return;
    }

    const evaded = player.dodgeT > 0 || player.invulnerable > 0 || player.action === 'down' || player.action === 'getup';
    const outcome = resolveStrike({
      damage: strike.damage,
      zone: strike.zone,
      defenderGuard: player.guard,
      defenderBlocking: player.blocking,
      defenderGuardMeter: player.guardMeter,
      evaded,
      counter: player.action === 'JAB' || player.action === 'CROSS'
    });

    if (outcome.kind === 'EVADED') {
      emit('PUNCH_EVADED', { by: 'opponent', punch: strike.attack });
      return;
    }

    const playerHealthBefore = player.health;
    player.health = Math.max(0, player.health - outcome.damage);
    player.guardMeter = Math.max(0, player.guardMeter - outcome.guardCost);
    player.stamina = Math.max(0, player.stamina - outcome.staminaCost);
    player.guardDelay = PLAYER.guardRegenDelay;
    player.staminaDelay = PLAYER.staminaRegenDelay + 0.1;
    player.lastHitAt = 0;

    const impactPoint = impactBetween(to, from, strike.zone);

    if (outcome.guardBroken) {
      player.action = 'stagger';
      player.actionT = 0;
      player.actionDuration = DEFENCE.guardBreakStagger * 0.6;
      player.guardMeter = 0;
      emit('GUARD_BROKEN', { who: 'player', at: impactPoint });
    } else if (outcome.kind === 'BLOCKED') {
      emit('PUNCH_BLOCKED', { by: 'opponent', punch: strike.attack, outcome, at: impactPoint });
    } else {
      emit('PUNCH_LANDED', {
        by: 'opponent', punch: strike.attack, zone: strike.zone, outcome, at: impactPoint, heavy: strike.attack === 'HOOK'
      });
    }

    if (player.health <= 0) {
      const power = knockoutPower({
        heavy: strike.attack === 'HOOK',
        head: strike.zone === GUARD_HIGH,
        kind: outcome.kind,
        counter: Boolean(outcome.counter),
        defenderStamina: player.stamina,
        maxStamina: PLAYER.maxStamina,
        defenderKnockdowns: player.knockdowns,
        damage: outcome.damage,
        healthBefore: playerHealthBefore
      });
      knockdown('player', power >= KNOCKOUT.threshold);
    }
  }

  /**
   * A point between the two fighters at the struck height, used to place
   * impact effects.
   *
   * @param {object} attacker
   * @param {object} defender
   * @param {string} zone
   * @returns {number[]}
   */
  function impactBetween(attacker, defender, zone) {
    const direction = directionTo(attacker, defender);
    const y = zone === GUARD_HIGH ? 1.52 : 1.06;
    return [
      defender.x - direction.x * 0.26,
      y,
      defender.z - direction.z * 0.26
    ];
  }

  /**
   * @param {string} who - 'player' | 'opponent'
   */
  /**
   * Puts a fighter on the canvas.
   *
   * @param {string} who
   * @param {boolean} [knockout] - True when the blow was flush enough that they
   *   do not get up. The count is then run by advanceCount().
   */
  function knockdown(who, knockout = false) {
    const fighter = who === 'opponent' ? opponent : player;
    fighter.knockdowns += 1;
    fighter.health = 0;
    fighter.out = knockout;
    fighter.count = 0;
    fighter.countT = 0;
    if (who === 'opponent') {
      transition(opponent, 'down', OPPONENT.knockdownDuration);
    } else {
      player.action = 'down';
      player.actionT = 0;
      player.downT = 0;
      player.blocking = false;
    }
    emit('KNOCKDOWN', { who, count: fighter.knockdowns, knockout });
  }

  /**
   * Runs the referee's count over a knocked-out fighter. Reaching ten ends the
   * bout as a knockout; a fighter who was merely dropped never enters here.
   *
   * @param {number} dt
   */
  function advanceCount(dt) {
    for (const [who, fighter] of [['opponent', opponent], ['player', player]]) {
      if (!fighter.out || fighter.count >= KNOCKOUT.countTo) continue;
      fighter.countT += dt;
      while (fighter.countT >= KNOCKOUT.countInterval && fighter.count < KNOCKOUT.countTo) {
        fighter.countT -= KNOCKOUT.countInterval;
        fighter.count += 1;
        if (fighter.count >= KNOCKOUT.countTo) {
          if (who === 'opponent') finish('WIN', 'KNOCKOUT');
          else finish('LOSE', 'KNOCKED OUT');
        } else {
          emit('COUNT', { who, n: fighter.count });
        }
      }
    }
  }

  // ---- STEP ---------------------------------------------------------------

  /**
   * Advances the match by one fixed simulation step.
   *
   * @param {number} dt
   * @param {object} frame - Semantic ActionFrame.
   */
  function step(dt, frame) {
    const current = state.getState();

    if (current === 'INTRO') {
      const remaining = state.getVar('introT') - dt;
      state.setVar('introT', remaining);
      if (remaining <= 0) {
        state.transition('FIGHTING');
        say('BOX!', 1.0);
        emit('ROUND_START', {});
      }
    }

    const live = state.getState() === 'FIGHTING';

    // Banner countdown runs in every state so a result message still fades.
    const messageT = state.getVar('messageT');
    if (messageT > 0) state.setVar('messageT', Math.max(0, messageT - dt));

    if (current === 'PAUSED') return;

    // 1. INTENT --------------------------------------------------------------
    const playerVelocity = updatePlayer(frame, dt, live);
    const brain = updateOpponentBrain({
      opponent,
      player,
      opponentPos: opponentTransform().position,
      playerPos: playerTransform().position,
      dt,
      rng,
      live
    });

    // 2. CONSTRAINTS (still intent: the transform manager has not written yet)
    const playerPos = playerTransform().position;
    const opponentPos = opponentTransform().position;
    transforms.setIntent(playerEntity, {
      ...constrainVelocity({ position: playerPos, velocity: playerVelocity, otherPosition: opponentPos, dt }),
      y: 0
    });
    transforms.setIntent(opponentEntity, {
      ...constrainVelocity({ position: opponentPos, velocity: brain.velocity, otherPosition: playerPos, dt }),
      y: 0
    });

    // 3. COMMIT — the one authoritative write of the step --------------------
    transforms.commitAll(dt);

    // 4. RESOLUTION ----------------------------------------------------------
    advancePlayerAction(dt);
    if (brain.strike && live) resolveOpponentStrike(brain.strike);

    regenerate(player, PLAYER, dt, player.action === 'idle' && !player.blocking && !player.sprinting);
    regenerate(opponent, OPPONENT, dt, opponent.state === 'idle' || opponent.state === 'circle');
    if (player.lastHitAt >= 0) player.lastHitAt += dt;
    advanceCount(dt);

    // 5. CLOCK ---------------------------------------------------------------
    if (live) {
      const remaining = state.getVar('roundTime') - dt;
      state.setVar('roundTime', Math.max(0, remaining));
      if (remaining <= 0) emit('TIME_EXPIRED', {});
    }

    if (state.getState() === 'FINISHED') {
      state.setVar('finishT', Math.max(0, state.getVar('finishT') - dt));
    }
  }

  return {
    // Engine-owned subsystems, exposed for tests and diagnostics.
    entities,
    transforms,
    state,
    rules,
    player,
    opponent,
    playerEntity,
    opponentEntity,

    step,
    emit,
    say,

    /** @returns {object} The player's authoritative position. */
    playerPosition() { return playerTransform().position; },
    /** @returns {object} The opponent's authoritative position. */
    opponentPosition() { return opponentTransform().position; },
    /** @returns {object} Previous-step position, for render interpolation. */
    playerPreviousPosition() { return playerTransform().previousPosition; },
    /** @returns {object} */
    opponentPreviousPosition() { return opponentTransform().previousPosition; },

    /** @returns {number} */
    distance() { return planarDistance(playerTransform().position, opponentTransform().position); },

    /**
     * Drains queued events for presentation, audio and the HUD.
     *
     * @returns {Array<object>}
     */
    drainEvents() {
      const drained = feed.slice();
      feed.length = 0;
      return drained;
    },

    /** Toggles pause. Returns the resulting state name. */
    togglePause() {
      const current = state.getState();
      if (current === 'FIGHTING') { state.transition('PAUSED'); return 'PAUSED'; }
      if (current === 'PAUSED') { state.transition('FIGHTING'); return 'FIGHTING'; }
      return current;
    },

    /** @returns {boolean} */
    isFinished() { return state.getState() === 'FINISHED'; },
    /** @returns {boolean} True once the result screen may appear. */
    resultReady() { return state.getState() === 'FINISHED' && state.getVar('finishT') <= 0; },

    /**
     * Resets everything for a rematch WITHOUT reallocating entities, so a long
     * session of rematches cannot grow the entity pool or leak transforms.
     *
     * @param {number} [nextSeed]
     */
    reset(nextSeed = seed) {
      rng = createSeededRandom(nextSeed);
      Object.assign(player, createPlayerState(), { yaw: playerYaw });
      Object.assign(opponent, createOpponentState(), { yaw: opponentYaw });
      transforms.teleport(playerEntity, { x: playerSpawn[0], y: 0, z: playerSpawn[2] });
      transforms.teleport(opponentEntity, { x: opponentSpawn[0], y: 0, z: opponentSpawn[2] });
      transforms.setIntent(playerEntity, { x: 0, y: 0, z: 0 });
      transforms.setIntent(opponentEntity, { x: 0, y: 0, z: 0 });
      state.reset('INTRO', {
        roundTime: MATCH.roundSeconds,
        result: null,
        message: 'ROUND 1',
        messageT: 1.8,
        introT: MATCH.introSeconds,
        finishT: 0
      });
      feed.length = 0;
      emit('MATCH_RESET', {});
    },

    /** Releases the entities this match spawned. */
    dispose() {
      entities.despawn(playerEntity);
      entities.despawn(opponentEntity);
      transforms.commitAll(0);
      rules.clear();
      feed.length = 0;
    },

    /** @returns {object} Read-only snapshot for the HUD. */
    snapshot() {
      return {
        state: state.getState(),
        roundTime: state.getVar('roundTime'),
        message: state.getVar('message'),
        messageT: state.getVar('messageT'),
        result: state.getVar('result'),
        player: {
          health: player.health, stamina: player.stamina, guardMeter: player.guardMeter,
          guard: player.guard, blocking: player.blocking, knockdowns: player.knockdowns,
          action: player.action,
          out: player.out, count: player.count
        },
        opponent: {
          health: opponent.health, stamina: opponent.stamina, guardMeter: opponent.guardMeter,
          state: opponent.state, knockdowns: opponent.knockdowns,
          out: opponent.out, count: opponent.count
        },
        ringHalf: RING_BOUNDS.half
      };
    }
  };
}
