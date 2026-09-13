/**
 * SUMO IS A BOXER — Input router.
 *
 * The single place in this game that knows hardware exists.
 *
 * ENGINE-OWNED: keyboard (digital + analog), gamepad buttons, gamepad analog
 * triggers, and both thumbsticks with deadzones — all declared and bound
 * through the Gameplay Foundation input system (`createInputSystem`,
 * `bindKey`, `bindScalarKey`, `bindGamepadButton`, `bindScalarButton`,
 * `bindScalarAxis`) and read back through its immutable `captureSnapshot()`.
 *
 * GAME-OWNED: the pointer. The engine's input system binds keyboards and
 * gamepads and has no pointer device at all (ENGINE_GAPS.md — GAP-08). Mouse
 * BUTTONS are pushed into the engine through `simulateAction`, which merges
 * with hardware rather than replacing it, so the same session accepts a mouse
 * and a controller. Mouse MOVEMENT is kept out of `simulateActionValue`
 * deliberately: simulated scalars override hardware scalars including zero, so
 * routing mouse look that way would silently kill the right stick. It is
 * instead carried on the frame as an IMPULSE alongside the stick's RATE.
 *
 * TOUCH stays compatible without any combat code changing: `pushAction` and
 * `pushLook` are the same doors the pointer uses.
 */

import { createInputSystem } from '@sumosizedginger/my-game-engine-1.0/full';
import {
  ACTIONS,
  KEYBOARD_BINDINGS,
  KEYBOARD_SCALAR_BINDINGS,
  GAMEPAD_BUTTON_BINDINGS,
  GAMEPAD_SCALAR_BUTTONS,
  GAMEPAD_AXIS_BINDINGS,
  POINTER_BUTTON_BINDINGS,
  CROSS_HOLD_TO_BLOCK_SECONDS
} from './actions.js';

/**
 * Creates the router.
 *
 * @param {object} [options]
 * @param {EventTarget} [options.target=window]
 * @param {HTMLElement} [options.surface] - Element that captures the pointer.
 * @returns {object} Router.
 */
export function createInputRouter({ target = typeof window !== 'undefined' ? window : null, surface = null } = {}) {
  const input = createInputSystem({
    actions: ACTIONS,
    keyboardBindings: {},
    gamepadButtonBindings: {},
    gamepadAxisBindings: []
  });

  for (const [code, action] of Object.entries(KEYBOARD_BINDINGS)) input.bindKey(code, action);
  for (const binding of KEYBOARD_SCALAR_BINDINGS) input.bindScalarKey(binding.code, binding.action, binding.value);
  for (const [index, action] of Object.entries(GAMEPAD_BUTTON_BINDINGS)) input.bindGamepadButton(Number(index), action);
  for (const binding of GAMEPAD_SCALAR_BUTTONS) input.bindScalarButton(binding.index, binding.action);
  for (const binding of GAMEPAD_AXIS_BINDINGS) input.bindScalarAxis(binding.index, binding.action, { deadzone: binding.deadzone });

  // --- pointer state -------------------------------------------------------
  /** Accumulated pointer movement, drained each simulation step. */
  const lookImpulse = { x: 0, y: 0 };
  /** Actions the pointer (or a touch control) is currently asserting. */
  const pushed = new Set();
  /** Actions asserted for exactly one step: wheel notches, taps. */
  const pulses = new Set();

  let pointerLocked = false;
  let crossHeldFor = 0;
  let crossDown = false;
  let sensitivity = 1;
  let invertLook = false;
  let attached = false;
  let onLockChange = null;

  // Previous frame's boolean state, for edge detection.
  let previous = Object.fromEntries(ACTIONS.map((a) => [a, false]));

  function press(action) {
    if (!ACTIONS.includes(action)) return;
    pushed.add(action);
    input.simulateAction(action, true);
  }

  function release(action) {
    if (!ACTIONS.includes(action)) return;
    pushed.delete(action);
    input.simulateAction(action, false);
  }

  // --- DOM handlers --------------------------------------------------------
  const handlers = {
    mousedown(event) {
      if (!pointerLocked) return;
      const action = POINTER_BUTTON_BINDINGS[event.button];
      if (!action) return;
      event.preventDefault();
      if (event.button === 2) {
        crossDown = true;
        crossHeldFor = 0;
        pulses.add('CROSS');
      } else {
        press(action);
      }
    },
    mouseup(event) {
      const action = POINTER_BUTTON_BINDINGS[event.button];
      if (!action) return;
      if (event.button === 2) {
        crossDown = false;
        crossHeldFor = 0;
        release('BLOCK');
      } else {
        release(action);
      }
    },
    mousemove(event) {
      if (!pointerLocked) return;
      lookImpulse.x += event.movementX * sensitivity;
      lookImpulse.y += event.movementY * sensitivity * (invertLook ? -1 : 1);
    },
    wheel(event) {
      if (!pointerLocked) return;
      event.preventDefault();
      pulses.add(event.deltaY < 0 ? 'GUARD_HIGH' : 'GUARD_LOW');
    },
    contextmenu(event) {
      event.preventDefault();
    },
    pointerlockchange() {
      const doc = surface?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
      const nowLocked = Boolean(doc && surface && doc.pointerLockElement === surface);
      if (nowLocked === pointerLocked) return;
      pointerLocked = nowLocked;
      if (!pointerLocked) {
        // Releasing the pointer must not leave a button stuck down.
        for (const action of [...pushed]) release(action);
        crossDown = false;
        lookImpulse.x = 0;
        lookImpulse.y = 0;
      }
      onLockChange?.(pointerLocked);
    },
    blur() {
      input.clear();
      for (const action of [...pushed]) pushed.delete(action);
      crossDown = false;
      lookImpulse.x = 0;
      lookImpulse.y = 0;
    }
  };

  return {
    /** The engine input system, exposed for diagnostics and tests. */
    engineInput: input,

    get pointerLocked() {
      return pointerLocked;
    },

    /**
     * Attaches keyboard/gamepad listeners through the engine, and the
     * game-owned pointer listeners.
     */
    attach() {
      if (attached || !target) return;
      attached = true;
      input.attach(target);
      const doc = surface?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
      if (surface) {
        surface.addEventListener('mousedown', handlers.mousedown);
        surface.addEventListener('contextmenu', handlers.contextmenu);
        surface.addEventListener('wheel', handlers.wheel, { passive: false });
      }
      doc?.addEventListener('mouseup', handlers.mouseup);
      doc?.addEventListener('mousemove', handlers.mousemove);
      doc?.addEventListener('pointerlockchange', handlers.pointerlockchange);
      target.addEventListener('blur', handlers.blur);
    },

    /** Removes every listener this router added. */
    detach() {
      if (!attached || !target) return;
      attached = false;
      input.detach(target);
      const doc = surface?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
      if (surface) {
        surface.removeEventListener('mousedown', handlers.mousedown);
        surface.removeEventListener('contextmenu', handlers.contextmenu);
        surface.removeEventListener('wheel', handlers.wheel);
      }
      doc?.removeEventListener('mouseup', handlers.mouseup);
      doc?.removeEventListener('mousemove', handlers.mousemove);
      doc?.removeEventListener('pointerlockchange', handlers.pointerlockchange);
      target.removeEventListener('blur', handlers.blur);
      input.clear();
    },

    /**
     * Requests pointer lock on the play surface.
     *
     * Pointer lock legitimately fails in embedded documents and when the
     * browser does not consider the call user-initiated. Modern Chrome returns
     * a promise for that failure, so it is swallowed here rather than left to
     * surface as an unhandled rejection; the game simply runs unlocked.
     */
    requestLock() {
      try {
        const result = surface?.requestPointerLock?.();
        if (result && typeof result.catch === 'function') result.catch(() => {});
      } catch {
        // Nothing to do: look input falls back to whatever the page allows.
      }
    },

    /** Releases pointer lock. */
    releaseLock() {
      try {
        const doc = surface?.ownerDocument ?? (typeof document !== 'undefined' ? document : null);
        if (doc?.pointerLockElement === surface) doc.exitPointerLock?.();
      } catch {
        // Already released, or never held.
      }
    },

    /**
     * @param {Function} fn - Called with the new lock state.
     */
    onPointerLockChange(fn) {
      onLockChange = fn;
    },

    /**
     * @param {number} value - Mouse sensitivity multiplier.
     */
    setSensitivity(value) {
      sensitivity = Number.isFinite(value) ? Math.max(0.05, value) : 1;
    },

    /**
     * @param {boolean} value
     */
    setInvertLook(value) {
      invertLook = Boolean(value);
    },

    /**
     * Touch / on-screen-control door into the same semantic vocabulary.
     *
     * @param {string} action
     * @param {boolean} active
     */
    pushAction(action, active) {
      if (active) press(action); else release(action);
    },

    /**
     * Touch / on-screen-control look input, in the same units as the pointer.
     *
     * @param {number} dx
     * @param {number} dy
     */
    pushLook(dx, dy) {
      lookImpulse.x += dx;
      lookImpulse.y += dy;
    },

    /**
     * One-step pulse, for taps and wheel notches.
     *
     * @param {string} action
     */
    pulse(action) {
      if (ACTIONS.includes(action)) pulses.add(action);
    },

    /**
     * Captures one immutable semantic action frame for a fixed simulation step.
     *
     * @param {number} dt - Fixed step, seconds.
     * @returns {object} Frozen ActionFrame.
     */
    capture(dt) {
      // A held right mouse button becomes a guard once it outlives the cross.
      if (crossDown) {
        crossHeldFor += dt;
        if (crossHeldFor >= CROSS_HOLD_TO_BLOCK_SECONDS) press('BLOCK');
      }

      for (const action of pulses) input.simulateAction(action, true);
      const snapshot = input.captureSnapshot();
      const values = { ...snapshot.getAllActionValues() };
      const active = { ...snapshot.getAllActions() };
      for (const action of pulses) {
        if (!pushed.has(action)) input.simulateAction(action, false);
      }
      pulses.clear();

      const deltas = { x: lookImpulse.x, y: lookImpulse.y };
      lookImpulse.x = 0;
      lookImpulse.y = 0;

      const edges = {};
      for (const action of ACTIONS) {
        edges[action] = active[action] && !previous[action];
      }
      const releases = {};
      for (const action of ACTIONS) {
        releases[action] = !active[action] && previous[action];
      }
      previous = active;

      return Object.freeze({
        /**
         * @param {string} action
         * @returns {boolean} True while the action is asserted.
         */
        held(action) { return Boolean(active[action]); },
        /**
         * @param {string} action
         * @returns {boolean} True on the step the action became asserted.
         */
        pressed(action) { return Boolean(edges[action]); },
        /**
         * @param {string} action
         * @returns {boolean} True on the step the action stopped being asserted.
         */
        released(action) { return Boolean(releases[action]); },
        /**
         * Continuous deflection in [-1, 1] — a stick rate, applied per second.
         *
         * @param {string} action
         * @returns {number}
         */
        value(action) { return values[action] ?? 0; },
        /**
         * Pointer impulse accumulated this step, in device pixels.
         *
         * @param {string} action - LOOK_X or LOOK_Y.
         * @returns {number}
         */
        delta(action) {
          if (action === 'LOOK_X') return deltas.x;
          if (action === 'LOOK_Y') return deltas.y;
          return 0;
        }
      });
    },

    /**
     * Hardware diagnostics for the debug overlay, straight from the engine.
     *
     * @returns {object}
     */
    diagnostics() {
      const pad = input.getGamepadStatus();
      return {
        pointerLocked,
        gamepad: pad.detected ? { id: pad.id, mapping: pad.mapping, axes: pad.axesCount, buttons: pad.buttonsCount } : null
      };
    }
  };
}
