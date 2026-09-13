/**
 * SUMO IS A BOXER — First-person camera.
 *
 * Owns everything transient about the view: footwork bob, impact shake, the
 * roll and snap of taking a punch, FOV response to effort and to landing a
 * heavy cross, and the fall and rise of a knockdown.
 *
 * The camera reads the INTERPOLATED position between the last two committed
 * simulation steps, so a 60 Hz simulation renders smoothly at any refresh rate
 * without the camera ever becoming a second transform authority.
 */

import { PerspectiveCamera } from 'three';
import { CAMERA, FEEDBACK, PLAYER } from '../config.js';
import { createSeededRandom } from '../assets/kit.js';

/**
 * @param {object} [options]
 * @returns {object} Camera rig.
 */
export function createCameraRig({ aspect = 16 / 9 } = {}) {
  const camera = new PerspectiveCamera(CAMERA.baseFov, aspect, CAMERA.near, CAMERA.far);
  camera.name = 'fight-camera';
  camera.rotation.order = 'YXZ';

  const rng = createSeededRandom(31337);

  let shake = 0;
  let fovKick = 0;
  let fovVelocity=0, impactTime=0;
  let roll = 0;
  let snapX = 0;
  let snapY = 0;
  let lunge = 0;
  let damage = 0;
  let bobPhase = 0;

  return {
    camera,

    /** @returns {number} Current damage vignette strength, 0..1. */
    get damageLevel() {
      return damage;
    },

    /**
     * @param {number} width
     * @param {number} height
     */
    resize(width, height) {
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
    },

    /**
     * Applies a bounded impact response.
     *
     * @param {object} options
     */
    impact({ shake: s = 0, fov = 0, roll: r = 0, snap = 0, lunge: l = 0, damage: d = 0 }) {
      shake = Math.min(1.2, Math.max(shake, s));
      fovKick = Math.min(3,Math.max(fovKick,fov));
      impactTime=0;
      roll += r;
      snapX += (rng.next() * 2 - 1) * snap;
      snapY += (rng.next() * 2 - 1) * snap;
      lunge = Math.max(lunge, l);
      damage = Math.min(1, damage + d);
    },

    /**
     * Places the camera for one rendered frame.
     *
     * @param {object} options
     * @param {object} options.player - Player fight state.
     * @param {object} options.position - Committed position.
     * @param {object} options.previousPosition - Previous committed position.
     * @param {number} options.alpha - Interpolation factor in [0, 1].
     * @param {number} options.dt - Render delta.
     * @param {boolean} options.sprinting
     */
    update({ player, position, previousPosition, alpha, dt, sprinting }) {
      shake *= Math.exp(-dt * FEEDBACK.shakeDecay);
      snapX *= Math.exp(-dt * 5);
      snapY *= Math.exp(-dt * 5);
      roll *= Math.exp(-dt * 6);
      lunge *= Math.exp(-dt * 10);
      // Exact critically damped spring, stable across render rates.
      const omega=16, decay=Math.exp(-omega*dt), c=fovVelocity+omega*fovKick;
      fovKick=(fovKick+c*dt)*decay;
      fovVelocity=(fovVelocity-omega*c*dt)*decay;
      impactTime+=dt;
      damage = Math.max(0, damage - dt * FEEDBACK.damageVignetteDecay);

      const speed = player.speed ?? 0;
      const movement = Math.min(1, speed / 3.4);
      bobPhase += dt * (3.2 + speed * 2.1);

      const x = previousPosition.x + (position.x - previousPosition.x) * alpha;
      const z = previousPosition.z + (position.z - previousPosition.z) * alpha;

      const bobY = Math.sin(bobPhase * 2) * 0.026 * movement;
      const bobX = Math.sin(bobPhase) * 0.016 * movement;

      let eye = CAMERA.eyeHeight + bobY;
      let extraPitch = 0;
      let extraRoll = 0;

      if (player.action === 'down') {
        const k = Math.min(1, player.downT / 0.5);
        eye = CAMERA.eyeHeight + (0.46 - CAMERA.eyeHeight) * k + bobY * 0.2;
        extraRoll = 0.58 * k;
        extraPitch = 0.3 * k;
      } else if (player.action === 'getup') {
        const k = Math.min(1, player.getUpT / PLAYER.getUpDuration);
        eye = 0.46 + (CAMERA.eyeHeight - 0.46) * k;
        extraRoll = 0.58 * (1 - k);
        extraPitch = 0.3 * (1 - k);
      } else if (player.action === 'dodge') {
        const k = 1 - player.actionT / Math.max(0.0001, player.actionDuration);
        eye -= 0.1 * k;
        extraRoll = player.dodgeDir.x * 0.16 * k;
      }

      const sx = Math.sin(impactTime*38) * shake * 0.018;
      const sy = Math.sin(impactTime*29+.5) * shake * 0.012;
      const sr = Math.sin(impactTime*31) * shake * 0.009;

      const rightX = Math.cos(player.yaw);
      const rightZ = -Math.sin(player.yaw);
      const forwardX = -Math.sin(player.yaw);
      const forwardZ = -Math.cos(player.yaw);

      camera.position.set(
        x + rightX * bobX + forwardX * lunge,
        eye,
        z + rightZ * bobX + forwardZ * lunge
      );
      camera.rotation.set(
        player.pitch + snapX + sx + extraPitch,
        player.yaw + snapY + sy,
        roll + sr + extraRoll
      );

      const sprintFov = sprinting && speed > 3 ? CAMERA.sprintFov : 0;
      const nextFov = CAMERA.baseFov + sprintFov + fovKick;
      if (Math.abs(nextFov - camera.fov) > 0.01) {
        camera.fov = nextFov;
        camera.updateProjectionMatrix();
      }
    },

    /** Clears transient response, for a rematch. */
    reset() {
      fovVelocity=0;impactTime=0;bobPhase=0;
      shake = 0; fovKick = 0; roll = 0; snapX = 0; snapY = 0; lunge = 0; damage = 0;
    }
  };
}
