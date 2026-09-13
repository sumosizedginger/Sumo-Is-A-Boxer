/**
 * SUMO IS A BOXER — The player's hands.
 *
 * Two procedurally generated arms parented to the camera: forearm, wrist wrap
 * banding, glove, thumb, knuckle roll, laces and cuff strap, authored in
 * `assets/fighter-kit.js`.
 *
 * They are posed as ARMS BELONGING TO A BODY JUST OUTSIDE THE FRAME, not as HUD
 * icons: the elbows sit low and outboard, the guard is asymmetric (the lead
 * hand is further forward and lower than the rear hand, as a boxer's is), they
 * settle with the player's footwork, they drop when stamina is gone, and the
 * punch that throws them starts from behind the guard rather than from the
 * screen edge.
 *
 * AUTHORING FRAME: the asset runs along +Y from the elbow to the glove nose.
 * A pose entry aims that limb into the camera's -Z; the roll node below spins
 * the hand about the limb so the knuckles face out. Pose values are game-authored. VISUAL-QUALITY-001 changes await browser review.
 */

import { createEquipmentCorrection } from './equipment-corrections.js';
import { Group, Vector3, Euler, Quaternion } from 'three';

const LEFT = -1;
const RIGHT = 1;

/**
 * View-model scale. A real glove at arm's length fills a third of the frame;
 * a view model that literal buries the opponent, so the arms are drawn at a
 * deliberate fraction of true size — the oldest trick in first-person art, and
 * the one that lets the fight stay readable behind the guard.
 */
const ARM_SCALE = 0.82;

/**
 * Roll of each hand about its own limb axis, so the laced back of the glove and
 * the knuckle roll face the camera instead of the plain outboard side.
 */
const HAND_ROLL = 2.4;

/**
 * A pose entry is an elbow position and an aim, per hand.
 * x is camera-right, y is camera-up, z is into the screen (negative = forward).
 */
const POSES = {
  guardHigh: {
    left: { p: [-0.205, -0.145, -0.07], r: [-1.42, 0.2, 0.09] },
    right: { p: [0.215, -0.175, -0.05], r: [-1.36, -0.22, -0.11] }
  },
  guardLow: {
    left: { p: [-0.215, -0.235, -0.05], r: [-1.55, 0.22, 0.11] },
    right: { p: [0.225, -0.265, -0.03], r: [-1.49, -0.24, -0.13] }
  },
  block: {
    left: { p: [-0.132, -0.105, -0.06], r: [-1.16, 0.34, 0.24] },
    right: { p: [0.14, -0.105, -0.06], r: [-1.16, -0.34, -0.24] }
  },
  blockLow: {
    left: { p: [-0.145, -0.195, -0.06], r: [-1.34, 0.34, 0.26] },
    right: { p: [0.152, -0.195, -0.06], r: [-1.34, -0.34, -0.26] }
  },
  jab: {
    left: { p: [-0.095, -0.105, -0.13], r: [-1.64, 0.06, 0.02] },
    right: { p: [0.215, -0.175, -0.05], r: [-1.36, -0.22, -0.11] }
  },
  cross: {
    left: { p: [-0.195, -0.14, -0.06], r: [-1.38, 0.22, 0.12] },
    right: { p: [0.072, -0.09, -0.15], r: [-1.7, -0.03, -0.02] }
  },
  stagger: {
    left: { p: [-0.3, -0.32, 0.08], r: [-1.02, 0.46, 0.3] },
    right: { p: [0.31, -0.34, 0.09], r: [-0.98, -0.48, -0.32] }
  },
  down: {
    left: { p: [-0.34, -0.52, 0.18], r: [-0.62, 0.66, 0.46] },
    right: { p: [0.35, -0.54, 0.2], r: [-0.58, -0.68, -0.48] }
  },
  exhausted: {
    left: { p: [-0.222, -0.255, -0.04], r: [-1.58, 0.26, 0.15] },
    right: { p: [0.232, -0.285, -0.02], r: [-1.52, -0.28, -0.17] }
  }
};

/**
 * Builds the first-person arms.
 *
 * @param {object} options
 * @param {object} options.library - Asset library.
 * @param {object} options.camera - Three.js camera the arms hang from.
 * @returns {object} Handle with update() and dispose().
 */
export function createPlayerFists({ library, camera }) {
  const root = new Group();
  root.name = 'player-fists';
  // The arms live in camera space and must never be culled against the world.
  root.frustumCulled = false;
  camera.add(root);

  /**
   * @param {number} side
   * @param {string} key
   * @returns {object}
   */
  function makeArm(side, key, roll, scale) {
    const pivot = new Group();
    pivot.name = side === LEFT ? 'player-arm-left' : 'player-arm-right';
    pivot.scale.setScalar(scale);
    // ROLL NODE. The arm asset is authored along +Y with the laces on its -Z
    // face. Rolling the hand about the LIMB AXIS is a separate rotation from
    // aiming the limb, and doing both on one Euler triple makes the two fight
    // each other. This node owns the roll, so the pose table below only ever
    // has to say where the arm points.
    const rollNode = new Group();
    rollNode.name = `${pivot.name}-roll`;
    rollNode.rotation.y = roll;
    pivot.add(rollNode);
    const mesh = library.object(key, pivot.name);
    if (mesh) {
      mesh.frustumCulled = false;
      // The arms are lit by the ring lamps like everything else, but casting
      // shadows from geometry 40 cm off the lens buys nothing and costs a pass.
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      // Rendered after the world so a fighter pressed into the player's chest
      // cannot poke through the guard.
      mesh.renderOrder = 12;
      if (Array.isArray(mesh.material)) {
        for (const material of mesh.material) material.depthTest = true;
      }
      rollNode.add(mesh);
    }
    root.add(pivot);
    return {
      side,
      correction: mesh ? createEquipmentCorrection(mesh,true) : null,
      pivot,
      rollNode,
      baseRoll:roll,
      position: new Vector3(),
      rotation: new Euler(),
      targetPosition: new Vector3(),
      targetRotation: new Euler()
    };
  }

  // The roll angles put the laced back of each hand toward the camera and the
  // thumbs inboard, which is what a guard looks like from behind your own eyes.
  const left = makeArm(LEFT, 'asset.fp.arm.left', -HAND_ROLL, ARM_SCALE);
  const right = makeArm(RIGHT, 'asset.fp.arm.right', HAND_ROLL, ARM_SCALE);

  const _quatA = new Quaternion();
  const _quatB = new Quaternion();
  let bobPhase = 0;
  let hitShove = 0;
  let breatheTime=0, movementLag=0, lastSpeed=0, attackTwist=0;

  /**
   * Chooses the base pose for the player's current condition.
   *
   * @param {object} player
   * @returns {object}
   */
  function basePose(player) {
    if (player.action === 'down') return POSES.down;
    if (player.action === 'stagger') return POSES.stagger;
    if (player.blocking) return player.guard === 'low' ? POSES.blockLow : POSES.block;
    if (player.stamina < 18) return POSES.exhausted;
    return player.guard === 'low' ? POSES.guardLow : POSES.guardHigh;
  }

  /**
   * The punch curve: a short pull-back, a fast extension through the impact
   * frame, then a slower recovery. This is the shape of the whole feel.
   *
   * @param {number} t - 0..1 through the punch.
   * @param {number} impactAt - Normalised impact time.
   * @returns {number} -0.25..1.08
   */
  function punchCurve(t, impactAt) {
    if (t < impactAt * 0.55) {
      // Load.
      const k = t / (impactAt * 0.55);
      return -0.22 * Math.sin(k * Math.PI * 0.5);
    }
    if (t < impactAt * 1.08) {
      // Drive. Cubic ease-out so the glove arrives rather than drifts.
      const k = (t - impactAt * 0.55) / (impactAt * 0.53);
      return -0.22 + 1.3 * (1 - Math.pow(1 - k, 3));
    }
    // Recover.
    const k = Math.min(1, (t - impactAt * 1.08) / Math.max(0.0001, 1 - impactAt * 1.08));
    return 1.08 * (1 - k) * (1 - k);
  }

  return {
    root,
    /** The two arm pivots, exposed for visual tuning and tests. */
    arms: [left, right],

    /**
     * @param {object} options
     * @param {object} options.player - Player fight state.
     * @param {number} options.dt - Render delta.
     */
    update({ player, dt }) {
      if(dt<=0)return;
      const speed = player.speed ?? 0;
      breatheTime+=dt;
      movementLag+=(Math.max(-.025,Math.min(.025,(speed-lastSpeed)*.014))-movementLag)*(1-Math.exp(-dt*10));
      lastSpeed=speed;
      attackTwist*=Math.exp(-dt*13);
      const movement = Math.min(1, speed / 3.4);
      bobPhase += dt * (3.2 + speed * 2.1);
      hitShove *= Math.exp(-dt*11);

      const pose = basePose(player);
      const swayX = Math.sin(bobPhase) * 0.006 * movement;
      const swayY = Math.sin(bobPhase * 2) * 0.007 * movement;
      // --- IDLE LIFE -------------------------------------------------------
      // The old idle was a single 3 mm sine, and both sway terms multiply by
      // `movement`, so a standing guard was very nearly frozen. This is layered
      // instead: a breath built from two incommensurate periods so it has a
      // hold at the top rather than a metronome beat, plus a per-hand drift and
      // settle on two further periods that never line up with it or each other.
      // Everything scales by `idleAmount`, which falls away as the player picks
      // up speed and as a hit shove lands, so idle blends continuously into
      // walk, sprint, dodge, attack and block instead of switching between them.
      // Amplitudes are single millimetres on purpose: READY, not floating.
      const idleAmount = Math.max(0, 1 - movement) * Math.max(0, 1 - hitShove * 2);
      // Deliberately the SMALLER half of the idle budget. Measured left/right
      // correlation was 0.94 when the shared breath dominated, which still reads
      // as one mechanism moving both gloves; the per-hand terms below now carry
      // more of the motion than this does.
      const breathe = (Math.sin(breatheTime * 1.55) * 0.6 + Math.sin(breatheTime * 0.83 + 1.1) * 0.4)
        * 0.0019 * idleAmount;

      for (const arm of [left, right]) {
        arm.correction?.set(player.blocking ? .45 : .08);
        const key = arm.side === LEFT ? 'left' : 'right';
        const entry = pose[key];
        arm.targetPosition.set(entry.p[0]+arm.side*.016, entry.p[1]-.012, entry.p[2]+.012);
        arm.targetRotation.set(entry.r[0], entry.r[1], entry.r[2]);
      }

      // The thrown arm overrides its own target, so the other hand stays in
      // guard exactly as it should.
      if (player.action === 'JAB' || player.action === 'CROSS') {
        const spec = player.actionPunch;
        const t = Math.min(1, player.actionT / Math.max(0.0001, player.actionDuration));
        const extension = punchCurve(t, spec.impactAt / spec.duration);
        const strike = player.action === 'JAB' ? POSES.jab : POSES.cross;
        const arm = player.action === 'JAB' ? left : right;
        const key = arm.side === LEFT ? 'left' : 'right';
        const from = pose[key];
        const to = strike[key];
        const k = Math.max(-0.3, extension);
        arm.correction?.set(Math.max(0,extension));
        attackTwist=(player.action==='CROSS'?-1:1)*Math.max(0,extension)*.035;
        arm.rollNode.rotation.y=arm.baseRoll-arm.side*Math.max(0,extension)*.6;
        arm.targetPosition.set(
          from.p[0] + (to.p[0] - from.p[0]) * k,
          from.p[1] + (to.p[1] - from.p[1]) * k,
          from.p[2] + (to.p[2] - from.p[2]) * k
        );
        arm.targetRotation.set(
          from.r[0] + (to.r[0] - from.r[0]) * k,
          from.r[1] + (to.r[1] - from.r[1]) * k,
          from.r[2] + (to.r[2] - from.r[2]) * k
        );
      }

      if(player.action!=='JAB' && player.action!=='CROSS') {
        for(const arm of [left,right]) arm.rollNode.rotation.y+=(arm.baseRoll-arm.rollNode.rotation.y)*(1-Math.exp(-dt*17));
      }
      root.rotation.y=attackTwist;
      root.position.z=movementLag;
      root.position.y=player.sprinting?-movement*.018:0;
      // Dodging shoves both hands with the body.
      if (player.action === 'dodge') {
        const t = 1 - player.actionT / Math.max(0.0001, player.actionDuration);
        for (const arm of [left, right]) {
          arm.targetPosition.x -= arm.side * 0.05 * t;
          arm.targetPosition.y -= 0.05 * t;
          arm.targetRotation.z += arm.side * 0.22 * t;
        }
      }

      const rate = (player.action === 'JAB' || player.action === 'CROSS') ? 1 : Math.min(1, dt * 16);
      for (const arm of [left, right]) {
        if (rate >= 1) {
          arm.position.copy(arm.targetPosition);
          arm.rotation.copy(arm.targetRotation);
        } else {
          arm.position.lerp(arm.targetPosition, rate);
          _quatA.setFromEuler(arm.rotation);
          _quatB.setFromEuler(arm.targetRotation);
          _quatA.slerp(_quatB, rate);
          arm.rotation.setFromQuaternion(_quatA);
        }
        // Per-hand phase: the two gloves settle independently, which is most of
        // what separates a live guard from a rigid one.
        const ph = arm.side === LEFT ? 0 : 2.3;
        const driftX = (Math.sin(breatheTime * 0.61 + ph) * 0.6
          + Math.sin(breatheTime * 1.27 + ph * 1.7) * 0.4) * 0.0029 * idleAmount;
        const settleY = Math.sin(breatheTime * 0.94 + ph * 2.1) * 0.0031 * idleAmount;
        const settleZ = Math.sin(breatheTime * 0.47 + ph * 0.9) * 0.0018 * idleAmount;
        const settleR = Math.sin(breatheTime * 0.72 + ph * 1.3) * 0.009 * idleAmount;
        arm.pivot.position.set(
          arm.position.x + swayX * arm.side * -1 + driftX,
          arm.position.y + swayY + breathe + settleY - hitShove * 0.06,
          arm.position.z + settleZ + hitShove * 0.05
        );
        arm.pivot.rotation.set(
          arm.rotation.x + hitShove * 0.12 + settleR * 0.5,
          arm.rotation.y + settleR,
          arm.rotation.z + swayX * 0.6 + settleR * 0.4
        );
      }
    },

    reset() {hitShove=0;bobPhase=0;breatheTime=0;movementLag=0;lastSpeed=0;attackTwist=0;for(const arm of [left,right]){arm.correction?.set(.08);arm.rollNode.rotation.y=arm.baseRoll;const entry=POSES.guardHigh[arm.side===LEFT?'left':'right'];arm.position.set(...entry.p);arm.rotation.set(...entry.r);}},

    /** Shoves the guard on a hit taken. */
    shove() {
      hitShove = 1;
    },

    dispose() {
      for (const arm of [left, right]) {
        arm.pivot.removeFromParent();
        arm.pivot.clear();
      }
      root.removeFromParent();
      root.clear();
    }
  };
}
