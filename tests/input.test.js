/**
 * SUMO IS A BOXER — semantic input contract.
 *
 * The point of this layer is that combat never learns what a mouse is. These
 * tests assert the vocabulary, that the engine accepted every binding, and that
 * one action frame per fixed step behaves as gameplay expects — including the
 * edge detection and the pointer/stick split that combat relies on.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { createInputRouter } from '../src/game/input/input-router.js';
import {
  ACTIONS, ANALOG_ACTIONS, KEYBOARD_BINDINGS, KEYBOARD_SCALAR_BINDINGS,
  GAMEPAD_BUTTON_BINDINGS, GAMEPAD_AXIS_BINDINGS, GAMEPAD_SCALAR_BUTTONS,
  POINTER_BUTTON_BINDINGS
} from '../src/game/input/actions.js';

const DT = 1 / 60;

test('the vocabulary the brief asks for is declared', () => {
  for (const action of [
    'MOVE_X', 'MOVE_Y', 'LOOK_X', 'LOOK_Y', 'SPRINT', 'JAB', 'CROSS',
    'BLOCK', 'DODGE', 'GUARD_HIGH', 'GUARD_LOW', 'PAUSE', 'RESTART'
  ]) {
    assert.ok(ACTIONS.includes(action), `missing semantic action ${action}`);
  }
});

test('the desktop mapping the brief specifies is present', () => {
  assert.equal(KEYBOARD_BINDINGS.ShiftLeft, 'SPRINT');
  assert.equal(KEYBOARD_BINDINGS.Space, 'DODGE');
  assert.equal(KEYBOARD_BINDINGS.KeyQ, 'GUARD_LOW');
  assert.equal(KEYBOARD_BINDINGS.KeyE, 'GUARD_HIGH');
  assert.equal(KEYBOARD_BINDINGS.Escape, 'PAUSE');
  assert.equal(KEYBOARD_BINDINGS.KeyR, 'RESTART');
  assert.equal(POINTER_BUTTON_BINDINGS[0], 'JAB');
  assert.equal(POINTER_BUTTON_BINDINGS[1], 'BLOCK');
  assert.equal(POINTER_BUTTON_BINDINGS[2], 'CROSS');

  const wasd = Object.fromEntries(KEYBOARD_SCALAR_BINDINGS.map((b) => [b.code, b]));
  assert.equal(wasd.KeyW.action, 'MOVE_Y');
  assert.ok(wasd.KeyW.value < 0, 'W must be forward');
  assert.ok(wasd.KeyS.value > 0);
  assert.ok(wasd.KeyA.value < 0);
  assert.ok(wasd.KeyD.value > 0);
});

test('the default controller mapping the brief specifies is present', () => {
  assert.equal(GAMEPAD_BUTTON_BINDINGS[2], 'JAB');     // X / Square
  assert.equal(GAMEPAD_BUTTON_BINDINGS[0], 'DODGE');   // A / Cross
  assert.equal(GAMEPAD_BUTTON_BINDINGS[12], 'GUARD_HIGH');
  assert.equal(GAMEPAD_BUTTON_BINDINGS[13], 'GUARD_LOW');
  assert.equal(GAMEPAD_BUTTON_BINDINGS[9], 'PAUSE');
  assert.equal(GAMEPAD_BUTTON_BINDINGS[8], 'RESTART');
  assert.equal(GAMEPAD_BUTTON_BINDINGS[10], 'SPRINT'); // L3

  const triggers = Object.fromEntries(GAMEPAD_SCALAR_BUTTONS.map((b) => [b.index, b.action]));
  assert.equal(triggers[6], 'BLOCK'); // LT / L2
  assert.equal(triggers[7], 'CROSS'); // RT / R2

  const axes = Object.fromEntries(GAMEPAD_AXIS_BINDINGS.map((b) => [b.index, b]));
  assert.equal(axes[0].action, 'MOVE_X');
  assert.equal(axes[1].action, 'MOVE_Y');
  assert.equal(axes[2].action, 'LOOK_X');
  assert.equal(axes[3].action, 'LOOK_Y');
  for (const binding of GAMEPAD_AXIS_BINDINGS) {
    assert.ok(binding.deadzone > 0 && binding.deadzone < 0.5, `axis ${binding.index} has no usable deadzone`);
  }
});

test('every binding is accepted by the engine input system', () => {
  // createInputRouter performs every bind through the engine; an undeclared
  // action or a bad index throws there, so construction succeeding IS the
  // assertion. Constructing twice proves it is not order-dependent.
  assert.doesNotThrow(() => createInputRouter({ target: null, surface: null }));
  assert.doesNotThrow(() => createInputRouter({ target: null, surface: null }));
});

test('an action frame is immutable and reports level, edge and release', () => {
  const router = createInputRouter({ target: null, surface: null });
  const idle = router.capture(DT);
  assert.equal(idle.held('JAB'), false);
  assert.equal(idle.pressed('JAB'), false);
  assert.ok(Object.isFrozen(idle), 'the action frame is mutable');

  router.engineInput.simulateAction('JAB', true);
  const first = router.capture(DT);
  assert.equal(first.held('JAB'), true);
  assert.equal(first.pressed('JAB'), true, 'no rising edge on the first step');

  const second = router.capture(DT);
  assert.equal(second.held('JAB'), true);
  assert.equal(second.pressed('JAB'), false, 'the edge repeated');

  router.engineInput.simulateAction('JAB', false);
  const third = router.capture(DT);
  assert.equal(third.held('JAB'), false);
  assert.equal(third.released('JAB'), true);
});

test('a pulse asserts an action for exactly one step', () => {
  const router = createInputRouter({ target: null, surface: null });
  router.pulse('GUARD_LOW');
  const a = router.capture(DT);
  assert.equal(a.pressed('GUARD_LOW'), true);
  const b = router.capture(DT);
  assert.equal(b.held('GUARD_LOW'), false, 'a pulse stayed asserted');
});

test('touch and pointer reach the same vocabulary as the keyboard', () => {
  const router = createInputRouter({ target: null, surface: null });
  router.pushAction('BLOCK', true);
  assert.equal(router.capture(DT).held('BLOCK'), true);
  router.pushAction('BLOCK', false);
  assert.equal(router.capture(DT).held('BLOCK'), false);
});

test('look carries pointer impulse and stick rate as different quantities', () => {
  const router = createInputRouter({ target: null, surface: null });
  router.pushLook(42, -17);
  const frame = router.capture(DT);
  assert.equal(frame.delta('LOOK_X'), 42);
  assert.equal(frame.delta('LOOK_Y'), -17);
  // The stick rate is independent and untouched by the pointer impulse.
  assert.equal(frame.value('LOOK_X'), 0);

  const drained = router.capture(DT);
  assert.equal(drained.delta('LOOK_X'), 0, 'pointer impulse was not drained');
});

test('analog actions report a continuous value, buttons report a level', () => {
  const router = createInputRouter({ target: null, surface: null });
  router.engineInput.simulateActionValue('MOVE_X', -0.62);
  const frame = router.capture(DT);
  assert.ok(Math.abs(frame.value('MOVE_X') + 0.62) < 1e-6);
  assert.equal(frame.held('MOVE_X'), true, 'a deflected axis should read as active');
  for (const action of ANALOG_ACTIONS) assert.equal(typeof frame.value(action), 'number');
});

test('the router reports hardware only as diagnostics, never to gameplay', () => {
  const router = createInputRouter({ target: null, surface: null });
  const diagnostics = router.diagnostics();
  assert.equal(typeof diagnostics.pointerLocked, 'boolean');
  assert.ok('gamepad' in diagnostics);
  // The frame itself exposes no device concepts at all.
  const frame = router.capture(DT);
  assert.deepEqual(
    Object.keys(frame).sort(),
    ['delta', 'held', 'pressed', 'released', 'value']
  );
});
