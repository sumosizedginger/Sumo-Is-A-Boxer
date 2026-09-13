/**
 * SUMO IS A BOXER — Semantic action vocabulary.
 *
 * Gameplay code in this project never asks whether Mouse0, KeyW or
 * GamepadButton2 fired. It asks whether JAB activated. Everything physical is
 * resolved in `input-router.js`, which is the ONLY module in the game allowed
 * to know a mouse exists.
 *
 * SIGN CONVENTIONS. Both axes follow the hardware/screen convention, so that a
 * controller stick can be bound straight through the engine's
 * `bindScalarAxis` with a deadzone and no per-device sign patching:
 *
 *   MOVE_X   -1 = left        +1 = right
 *   MOVE_Y   -1 = FORWARD     +1 = backward
 *   LOOK_X   -1 = turn left   +1 = turn right
 *   LOOK_Y   -1 = look up     +1 = look down
 *
 * Analog actions carry BOTH a rate and an impulse, because a thumbstick and a
 * mouse are different physical quantities and pretending otherwise is how
 * mouse look ends up frame-rate dependent:
 *
 *   frame.value('LOOK_X')  stick deflection, applied per second
 *   frame.delta('LOOK_X')  pointer movement accumulated this step
 */

export const ACTIONS = Object.freeze([
  'MOVE_X',
  'MOVE_Y',
  'LOOK_X',
  'LOOK_Y',
  'SPRINT',
  'JAB',
  'CROSS',
  'BLOCK',
  'DODGE',
  'GUARD_HIGH',
  'GUARD_LOW',
  'PAUSE',
  'RESTART',
  'CONFIRM'
]);

/** Actions that behave as continuous axes rather than buttons. */
export const ANALOG_ACTIONS = Object.freeze(['MOVE_X', 'MOVE_Y', 'LOOK_X', 'LOOK_Y']);

/**
 * Keyboard, bound through the engine's `bindKey` (digital).
 * KeyboardEvent.code values, as the engine's input system expects.
 */
export const KEYBOARD_BINDINGS = Object.freeze({
  ShiftLeft: 'SPRINT',
  ShiftRight: 'SPRINT',
  Space: 'DODGE',
  KeyQ: 'GUARD_LOW',
  KeyE: 'GUARD_HIGH',
  Escape: 'PAUSE',
  KeyP: 'PAUSE',
  KeyR: 'RESTART',
  Enter: 'CONFIRM'
});

/**
 * Keyboard analog, bound through the engine's `bindScalarKey`.
 * Opposed keys on one action sum, so A+D correctly cancels.
 */
export const KEYBOARD_SCALAR_BINDINGS = Object.freeze([
  { code: 'KeyW', action: 'MOVE_Y', value: -1 },
  { code: 'ArrowUp', action: 'MOVE_Y', value: -1 },
  { code: 'KeyS', action: 'MOVE_Y', value: 1 },
  { code: 'ArrowDown', action: 'MOVE_Y', value: 1 },
  { code: 'KeyA', action: 'MOVE_X', value: -1 },
  { code: 'ArrowLeft', action: 'MOVE_X', value: -1 },
  { code: 'KeyD', action: 'MOVE_X', value: 1 },
  { code: 'ArrowRight', action: 'MOVE_X', value: 1 }
]);

/**
 * Standard-mapping gamepad buttons, bound through `bindGamepadButton`.
 */
export const GAMEPAD_BUTTON_BINDINGS = Object.freeze({
  0: 'DODGE',       // A / Cross
  1: 'CONFIRM',     // B / Circle
  2: 'JAB',         // X / Square
  3: 'GUARD_HIGH',  // Y / Triangle
  4: 'BLOCK',       // LB / L1
  5: 'JAB',         // RB / R1
  8: 'RESTART',     // View / Share / Back
  9: 'PAUSE',       // Menu / Options / Start
  10: 'SPRINT',     // L3
  12: 'GUARD_HIGH', // D-pad up
  13: 'GUARD_LOW'   // D-pad down
});

/**
 * Analog triggers, bound through `bindScalarButton`.
 */
export const GAMEPAD_SCALAR_BUTTONS = Object.freeze([
  { index: 6, action: 'BLOCK' }, // LT / L2
  { index: 7, action: 'CROSS' }  // RT / R2
]);

/**
 * Sticks, bound through `bindScalarAxis` with deadzones.
 */
export const GAMEPAD_AXIS_BINDINGS = Object.freeze([
  { index: 0, action: 'MOVE_X', deadzone: 0.18 },
  { index: 1, action: 'MOVE_Y', deadzone: 0.18 },
  { index: 2, action: 'LOOK_X', deadzone: 0.14 },
  { index: 3, action: 'LOOK_Y', deadzone: 0.14 }
]);

/**
 * Pointer buttons. The engine's input system has no pointer device
 * (ENGINE_GAPS.md — GAP-08); the router feeds these into the SAME semantic
 * vocabulary through the engine's `simulateAction`, which merges rather than
 * overrides, so a controller and a mouse can be used in the same session.
 */
export const POINTER_BUTTON_BINDINGS = Object.freeze({
  0: 'JAB',   // LMB
  1: 'BLOCK', // MMB
  2: 'CROSS'  // RMB, with a hold-to-block secondary handled by the router
});

/** How long RMB must be held before the cross becomes a block. */
export const CROSS_HOLD_TO_BLOCK_SECONDS = 0.2;
