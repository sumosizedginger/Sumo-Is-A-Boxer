/**
 * SUMO IS A BOXER — combat contract.
 *
 * The exchange rules run headless, so the fight can be verified without a
 * renderer. These tests cover the high/low read, the guard meter, knockdowns,
 * the match lifecycle, transform authority and rematch hygiene.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSFORM_OWNERSHIP } from '@sumosizedginger/my-game-engine-1.0/full';

import { resolveStrike, connects, conditionScaledDamage, knockoutPower } from '../src/game/combat/resolve.js';
import { constrainVelocity, isFacing, createPlayerState, GUARD_HIGH } from '../src/game/combat/fighters.js';
import { createMatch } from '../src/game/combat/match.js';
import { ARENA_BOUNDS, MATCH, PLAYER, DEFENCE, KNOCKOUT, OPPONENT } from '../src/game/config.js';

const DT = 1 / 60;

/**
 * A stand-in for the semantic ActionFrame the input router produces.
 *
 * @returns {object}
 */
function createTestFrame() {
  const held = new Set();
  const pressed = new Set();
  const values = { MOVE_X: 0, MOVE_Y: 0, LOOK_X: 0, LOOK_Y: 0 };
  return {
    held: (a) => held.has(a),
    pressed: (a) => pressed.has(a),
    released: () => false,
    value: (a) => values[a] ?? 0,
    delta: () => 0,
    _held: held,
    _pressed: pressed,
    _values: values
  };
}

// ---------------------------------------------------------------------------
// The high/low read
// ---------------------------------------------------------------------------

test('a braced guard at the right height absorbs almost everything', () => {
  const outcome = resolveStrike({
    damage: 10, zone: 'high', defenderGuard: 'high',
    defenderBlocking: true, defenderGuardMeter: 100
  });
  assert.equal(outcome.kind, 'BLOCKED');
  assert.ok(outcome.damage < 2, `chip was ${outcome.damage}`);
  assert.ok(outcome.guardCost > 0, 'blocking cost no guard');
  assert.equal(outcome.guardBroken, false);
});

test('a braced guard at the wrong height is beaten', () => {
  const outcome = resolveStrike({
    damage: 10, zone: 'low', defenderGuard: 'high',
    defenderBlocking: true, defenderGuardMeter: 100
  });
  assert.equal(outcome.kind, 'CLEAN');
  assert.ok(outcome.damage > 4, 'a mismatched block absorbed too much');
  assert.ok(outcome.damage < 10, 'a mismatched block absorbed nothing');
});

test('hands up but not braced is better than nothing and worse than a block', () => {
  const passive = resolveStrike({ damage: 10, zone: 'high', defenderGuard: 'high', defenderBlocking: false, defenderGuardMeter: 100 });
  const clean = resolveStrike({ damage: 10, zone: 'low', defenderGuard: 'high', defenderBlocking: false, defenderGuardMeter: 100 });
  const blocked = resolveStrike({ damage: 10, zone: 'high', defenderGuard: 'high', defenderBlocking: true, defenderGuardMeter: 100 });
  assert.ok(blocked.damage < passive.damage);
  assert.ok(passive.damage < clean.damage);
});

test('an empty guard meter breaks the guard', () => {
  const outcome = resolveStrike({
    damage: 10, zone: 'high', defenderGuard: 'high',
    defenderBlocking: true, defenderGuardMeter: 8
  });
  assert.equal(outcome.kind, 'GUARD_BROKEN');
  assert.equal(outcome.guardBroken, true);
});

test('a dodge beats everything', () => {
  const outcome = resolveStrike({
    damage: 40, zone: 'low', defenderGuard: 'high',
    defenderBlocking: false, defenderGuardMeter: 100, evaded: true
  });
  assert.equal(outcome.kind, 'EVADED');
  assert.equal(outcome.damage, 0);
});

test('a counter pays more than a clean hit', () => {
  const clean = resolveStrike({ damage: 10, zone: 'low', defenderGuard: 'high', defenderBlocking: false, defenderGuardMeter: 100 });
  const counter = resolveStrike({ damage: 10, zone: 'low', defenderGuard: 'high', defenderBlocking: false, defenderGuardMeter: 100, counter: true });
  assert.ok(counter.damage > clean.damage * 1.3, 'countering is not rewarded');
  assert.equal(counter.kind, 'COUNTER');
});

test('a tired fighter hits softer', () => {
  assert.equal(conditionScaledDamage(10, 100), 10);
  assert.ok(conditionScaledDamage(10, 5) < 10);
});

test('reach and facing both gate a punch', () => {
  assert.equal(connects({ distance: 1.2, reach: 2.05, facing: true }), true);
  assert.equal(connects({ distance: 3.0, reach: 2.05, facing: true }), false);
  assert.equal(connects({ distance: 1.2, reach: 2.05, facing: false }), false);
});

// ---------------------------------------------------------------------------
// Ring constraints
// ---------------------------------------------------------------------------

test('the ring holds the fighters in', () => {
  const constrained = constrainVelocity({
    position: { x: ARENA_BOUNDS.half - 0.05, y: 0, z: 0 },
    velocity: { x: 10, z: 0 },
    otherPosition: null,
    dt: DT
  });
  const landing = ARENA_BOUNDS.half - 0.05 + constrained.x * DT;
  assert.ok(landing <= ARENA_BOUNDS.half + 1e-6, `escaped to ${landing}`);
});

test('fighters cannot occupy the same space', () => {
  const other = { x: 0, y: 0, z: 0 };
  const constrained = constrainVelocity({
    position: { x: 0.9, y: 0, z: 0 },
    velocity: { x: -20, z: 0 },
    otherPosition: other,
    dt: DT
  });
  const landing = 0.9 + constrained.x * DT;
  assert.ok(Math.abs(landing) >= ARENA_BOUNDS.separation - 1e-6, `overlapped at ${landing}`);
});

test('facing uses the engine -Z forward convention', () => {
  const from = { x: 0, y: 0, z: 0 };
  const ahead = { x: 0, y: 0, z: -2 };
  const behind = { x: 0, y: 0, z: 2 };
  assert.equal(isFacing(0, from, ahead, 0.7), true);
  assert.equal(isFacing(0, from, behind, 0.7), false);
  assert.equal(isFacing(Math.PI, from, behind, 0.7), true);
});

// ---------------------------------------------------------------------------
// The match
// ---------------------------------------------------------------------------

/**
 * @param {object} match
 * @param {object} frame
 * @param {number} seconds
 */
function run(match, frame, seconds) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i += 1) match.step(DT, frame);
}

test('the match opens on an intro and then boxes', () => {
  const match = createMatch({});
  const frame = createTestFrame();
  assert.equal(match.state.getState(), 'INTRO');
  run(match, frame, MATCH.introSeconds + 0.2);
  assert.equal(match.state.getState(), 'FIGHTING');
  match.dispose();
});

test('both fighters start squared up to each other', () => {
  const match = createMatch({ playerSpawn: [1, 0, 2], opponentSpawn: [-1, 0, -2] });
  const toward = isFacing(match.player.yaw, match.playerPosition(), match.opponentPosition(), 0.2);
  assert.ok(toward, 'the player does not start facing the opponent');
  match.dispose();
});

test('the transform manager is the only writer, and it uses kinematic ownership', () => {
  const match = createMatch({});
  const transform = match.transforms.getTransform(match.playerEntity);
  assert.equal(transform.ownership, TRANSFORM_OWNERSHIP.KINEMATIC);

  const frame = createTestFrame();
  frame._values.MOVE_Y = -1;
  run(match, frame, MATCH.introSeconds + 1.0);
  const moved = match.playerPosition();
  const previous = match.playerPreviousPosition();
  assert.notDeepEqual(moved, { x: 1, y: 0, z: 2 });
  assert.ok(Number.isFinite(previous.x), 'no previous position for interpolation');
  match.dispose();
});

test('a fight resolves: punches land, guards break, someone goes down', () => {
  const match = createMatch({ seed: 4242 });
  const frame = createTestFrame();
  const tally = {};
  run(match, frame, MATCH.introSeconds + 0.1);
  match.drainEvents();

  for (let i = 0; i < 9000 && !match.isFinished(); i += 1) {
    frame._pressed.clear();
    frame._held.clear();
    if (i % 24 === 0) frame._pressed.add('JAB');
    if (i % 77 === 0) frame._pressed.add('CROSS');
    if (i % 130 === 0) frame._pressed.add(i % 260 === 0 ? 'GUARD_LOW' : 'GUARD_HIGH');
    if (i % 55 < 20) frame._held.add('BLOCK');
    frame._values.MOVE_Y = match.distance() > 1.9 ? -1 : 0;
    match.step(DT, frame);
    for (const { event } of match.drainEvents()) tally[event] = (tally[event] ?? 0) + 1;
  }

  assert.ok(tally.PUNCH_THROWN > 20, 'no punches were thrown');
  assert.ok(tally.PUNCH_LANDED > 0, 'nothing ever landed');
  assert.ok(tally.KNOCKDOWN > 0, 'no knockdown in a full fight');
  assert.ok(match.isFinished(), 'the match never ended');
  assert.ok(['WIN', 'LOSE', 'DRAW'].includes(match.snapshot().result.result));
  match.dispose();
});

test('the round clock expires into a decision', () => {
  const match = createMatch({ seed: 7 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.1);
  match.state.setVar('roundTime', 0.05);
  run(match, frame, 0.3);
  assert.equal(match.state.getState(), 'FINISHED');
  assert.ok(match.snapshot().result.label.length > 0);
  match.dispose();
});

test('a knockdown gets the fighter back up, not deleted', () => {
  const match = createMatch({ seed: 11 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.1);
  match.player.health = 1;
  match.emit('FORCE', {});
  // Drive until the player is knocked down by the opponent.
  for (let i = 0; i < 4000 && match.player.knockdowns === 0; i += 1) match.step(DT, frame);
  assert.equal(match.player.knockdowns, 1);
  assert.equal(match.player.action, 'down');
  run(match, frame, PLAYER.knockdownDuration + PLAYER.getUpDuration + 0.2);
  assert.equal(match.player.action, 'idle');
  assert.ok(match.player.health > 0, 'the player got up with no health');
  match.dispose();
});

test('a dodge fully clears itself: the player can act again afterwards', () => {
  // REGRESSION. `dodgeT` and `actionT` count the same duration from opposite
  // ends, and a floating-point residue of ~5e-17 left `dodgeT > 0` forever,
  // which made `canAct` false and silently disabled every punch and every
  // later dodge for the rest of the match. Found by dodging in the browser.
  const match = createMatch({ seed: 31337 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.1);

  frame._pressed.add('DODGE');
  match.step(DT, frame);
  frame._pressed.clear();
  assert.equal(match.player.action, 'dodge', 'the dodge did not start');

  run(match, frame, PLAYER.dodgeDuration + PLAYER.dodgeCooldown + 0.2);
  assert.equal(match.player.action, 'idle', 'the dodge never ended');
  assert.equal(match.player.dodgeT, 0, `dodgeT stranded at ${match.player.dodgeT}`);
  assert.equal(match.player.dodgeCooldown, 0, 'the dodge cooldown stranded');

  // And the player can throw again.
  match.drainEvents();
  frame._pressed.add('JAB');
  match.step(DT, frame);
  frame._pressed.clear();
  assert.equal(match.player.action, 'JAB', 'the player could not punch after dodging');
  assert.ok(
    match.drainEvents().some((e) => e.event === 'PUNCH_THROWN'),
    'no punch was published after a dodge'
  );
  match.dispose();
});

test('repeated dodges stay available', () => {
  const match = createMatch({ seed: 5150 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.1);
  for (let i = 0; i < 5; i += 1) {
    match.player.stamina = 100;
    frame._pressed.add('DODGE');
    match.step(DT, frame);
    frame._pressed.clear();
    assert.equal(match.player.action, 'dodge', `dodge ${i + 1} did not start`);
    run(match, frame, PLAYER.dodgeDuration + PLAYER.dodgeCooldown + 0.2);
  }
  match.dispose();
});

test('pause stops the clock and resume restarts it', () => {
  const match = createMatch({});
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.1);
  const before = match.state.getVar('roundTime');
  match.togglePause();
  run(match, frame, 1.0);
  assert.equal(match.state.getVar('roundTime'), before, 'the clock ran while paused');
  match.togglePause();
  run(match, frame, 0.5);
  assert.ok(match.state.getVar('roundTime') < before, 'the clock did not resume');
  match.dispose();
});

test('a rematch restores the fight without reallocating entities', () => {
  const match = createMatch({ seed: 99 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 4);
  const entityBefore = match.playerEntity;
  const transformsBefore = match.transforms.getTransform(match.playerEntity);

  match.reset(1234);
  assert.equal(match.state.getState(), 'INTRO');
  assert.equal(match.player.health, createPlayerState().health);
  assert.equal(match.player.knockdowns, 0);
  assert.deepEqual(match.playerPosition(), { x: 0.9, y: 0, z: 2.1 });
  assert.equal(match.playerEntity, entityBefore, 'the rematch reallocated the player entity');
  assert.equal(match.transforms.getTransform(match.playerEntity), transformsBefore, 'the rematch reallocated the transform');
  assert.ok(isFacing(match.player.yaw, match.playerPosition(), match.opponentPosition(), 0.2), 'the rematch lost the starting stance');

  // And it still plays.
  run(match, frame, MATCH.introSeconds + 0.2);
  assert.equal(match.state.getState(), 'FIGHTING');
  match.dispose();
});

test('twenty rematches do not grow the entity pool', () => {
  const match = createMatch({});
  const frame = createTestFrame();
  const size = match.entities.count();
  for (let i = 0; i < 20; i += 1) {
    run(match, frame, 1.2);
    match.reset(i);
  }
  assert.equal(match.entities.count(), size, 'rematching leaks entities');
  match.dispose();
});

// --- guard-break recovery ----------------------------------------------------

test('a guard break fires on the collapse, not on every hit afterwards', () => {
  const args = { damage: 12, zone: GUARD_HIGH, defenderGuard: GUARD_HIGH, defenderBlocking: true };
  // Meter up, hit big enough to empty it: this is the break.
  const breaking = resolveStrike({ ...args, defenderGuardMeter: 4 });
  assert.equal(breaking.guardBroken, true, 'the collapsing hit should break the guard');
  // Meter already empty: further hits still hurt, but they are NOT fresh breaks.
  const after = resolveStrike({ ...args, defenderGuardMeter: 0 });
  assert.equal(after.guardBroken, false,
    'a hit on an already-empty meter re-broke the guard, which restarts the stagger timer forever');
});

test('a fighter under continuous pressure still leaves the stagger', () => {
  // The regression: every landed hit re-broke the empty guard and re-entered
  // stagger, so the opponent could be locked out of the fight indefinitely.
  const match = createMatch({ seed: 99 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.2);

  let longestStagger = 0;
  let current = 0;
  let sawStagger = false;
  for (let i = 0; i < 60 * 45; i += 1) {
    const p = match.playerPosition();
    const o = match.opponentPosition();
    match.player.yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z));
    frame._values.MOVE_Y = Math.hypot(o.x - p.x, o.z - p.z) > 1.3 ? -1 : 0;
    frame._pressed.clear();
    if (i % 14 === 0) frame._pressed.add(i % 28 === 0 ? 'CROSS' : 'JAB');
    match.step(DT, frame);
    match.drainEvents();
    if (match.snapshot().opponent.state === 'stagger') {
      sawStagger = true;
      current += DT;
      if (current > longestStagger) longestStagger = current;
    } else {
      current = 0;
    }
  }
  assert.ok(sawStagger, 'the pressure test never staggered the opponent at all');
  assert.ok(longestStagger < DEFENCE.guardBreakStagger + 0.75,
    `opponent stayed staggered for ${longestStagger.toFixed(2)}s (stagger is ${DEFENCE.guardBreakStagger}s)`);
  match.dispose();
});

test('a broken guard comes back once the stagger ends', () => {
  const match = createMatch({ seed: 99 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.2);
  match.opponent.guardMeter = 0;
  match.opponent.state = 'stagger';
  match.opponent.stateT = 0;
  match.opponent.stateDuration = DEFENCE.guardBreakStagger;
  run(match, frame, DEFENCE.guardBreakStagger + 0.3);
  assert.notEqual(match.snapshot().opponent.state, 'stagger', 'still staggered after the timer expired');
  assert.ok(match.snapshot().opponent.guardMeter >= DEFENCE.guardAfterBreak * 0.9,
    `guard came back as ${match.snapshot().opponent.guardMeter.toFixed(1)}, expected about ${DEFENCE.guardAfterBreak}`);
  match.dispose();
});

// --- true knockout -----------------------------------------------------------

test('only a flush heavy head shot carries knockout power', () => {
  const base = { heavy: true, head: true, kind: 'CLEAN', counter: false,
    defenderStamina: 100, maxStamina: 100, defenderKnockdowns: 0, damage: 15, healthBefore: 40 };
  assert.equal(knockoutPower({ ...base, heavy: false }), 0, 'a jab must never knock anyone out');
  assert.equal(knockoutPower({ ...base, head: false }), 0, 'a body shot must never knock anyone out');
  assert.equal(knockoutPower({ ...base, kind: 'BLOCKED' }), 0, 'a blocked punch must never knock anyone out');
});

test('a fresh fighter is dropped, not knocked out, by one clean cross', () => {
  const power = knockoutPower({ heavy: true, head: true, kind: 'CLEAN', counter: false,
    defenderStamina: 100, maxStamina: 100, defenderKnockdowns: 0, damage: 15, healthBefore: 40 });
  assert.ok(power > 0, 'a clean heavy head shot should carry some power');
  assert.ok(power < KNOCKOUT.threshold,
    `a single cross on a fresh fighter scored ${power.toFixed(2)}, which would knock them out cold`);
});

test('the fight wears a fighter down into knockout range', () => {
  const tiredCounter = knockoutPower({ heavy: true, head: true, kind: 'COUNTER', counter: true,
    defenderStamina: 45, maxStamina: 100, defenderKnockdowns: 0, damage: 15, healthBefore: 40 });
  assert.ok(tiredCounter >= KNOCKOUT.threshold,
    `a counter cross on a half-drained fighter only scored ${tiredCounter.toFixed(2)}`);

  const accumulated = knockoutPower({ heavy: true, head: true, kind: 'CLEAN', counter: false,
    defenderStamina: 30, maxStamina: 100, defenderKnockdowns: 2, damage: 15, healthBefore: 40 });
  assert.ok(accumulated >= KNOCKOUT.threshold,
    `a cross on a tired fighter already down twice only scored ${accumulated.toFixed(2)}`);
});

test('a knocked-out fighter does not get up and is counted out', () => {
  const match = createMatch({ seed: 99 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.2);

  match.opponent.out = true;
  match.opponent.count = 0;
  match.opponent.countT = 0;
  match.opponent.health = 0;
  match.opponent.state = 'down';
  match.opponent.stateT = 0;
  match.opponent.stateDuration = OPPONENT.knockdownDuration;

  // Well past the point a merely-dropped fighter would have risen.
  run(match, frame, OPPONENT.knockdownDuration + OPPONENT.getUpDuration + 0.5);
  assert.equal(match.snapshot().opponent.state, 'down', 'a knocked-out fighter got back up');

  run(match, frame, KNOCKOUT.countInterval * KNOCKOUT.countTo + 0.5);
  const result = match.snapshot().result;
  assert.ok(result, 'the count never ended the bout');
  assert.equal(result.label, 'KNOCKOUT');
  assert.equal(result.result, 'WIN');
  match.dispose();
});

test('three knockdowns without a knockout blow is a TKO, not a KO', () => {
  const match = createMatch({ seed: 99 });
  const frame = createTestFrame();
  run(match, frame, MATCH.introSeconds + 0.2);
  // Jabs only: they carry no knockout power, so this can only end on the
  // three-knockdown rule.
  for (let i = 0; i < 60 * 120; i += 1) {
    const p = match.playerPosition();
    const o = match.opponentPosition();
    match.player.yaw = Math.atan2(-(o.x - p.x), -(o.z - p.z));
    frame._values.MOVE_Y = Math.hypot(o.x - p.x, o.z - p.z) > 1.3 ? -1 : 0;
    frame._pressed.clear();
    if (i % 14 === 0) frame._pressed.add('JAB');
    match.step(DT, frame);
    match.drainEvents();
    if (match.snapshot().result) break;
  }
  const result = match.snapshot().result;
  assert.ok(result, 'the jab-only fight never finished');
  assert.equal(result.label, 'TKO', `finished as ${result.label}`);
  assert.equal(match.snapshot().opponent.out, false, 'jabs knocked the opponent unconscious');
  match.dispose();
});
