/**
 * SUMO IS A BOXER — The opponent.
 *
 * WHAT CHARACTER FORGE PROVIDES (engine, public surface):
 *   createCharacterDefinition / buildHumanoidCharacter
 *       a skinned humanoid built from anatomical parameters, with a 22-bone
 *       semantic skeleton and a landmark dictionary
 *   computeSemanticLandmarks
 *       the same landmarks derivable from parameters alone
 *
 * WHAT MOTION FORGE PROVIDES (engine, public surface):
 *   createLocomotionEvaluator   gait phase, pelvis dynamics, grounded feet
 *   commitRootMotionIntent      gait travel, committed through a transform
 *   solveTwoBoneIK              the shoulder-elbow-wrist solve every boxing
 *                               pose in this file is built on
 *
 * WHAT THE GAME OWNS, because Motion Forge cannot express it:
 *   the boxing STANCE, guard height, jab, hook, block, stagger and knockdown.
 *   Motion Forge has one clip — a forward walk — and no idle, no additive
 *   layering, no bone masking and no blend graph (ENGINE_GAPS.md — GAP-09).
 *   So the split here is explicit and honest: Motion Forge drives the LEGS and
 *   PELVIS whenever the fighter is actually travelling, and game-owned pose
 *   logic drives the upper body always, blending the legs back to a bladed
 *   boxing stance as the fighter comes to rest.
 *
 * The opponent is NOT a block-person: it is a Character Forge humanoid with
 * boxer proportions, wearing procedurally generated gloves, trunks and boots
 * attached to the Forge's own semantic bones.
 */

import { Group, Object3D, Quaternion, Vector3, Euler, Matrix4, MeshStandardMaterial } from 'three';
import {
  createCharacterDefinition,
  buildHumanoidCharacter,
  computeSemanticLandmarks,
  resolveHumanoidParameters,
  createMotionDefinition,
  createLocomotionEvaluator,
  solveTwoBoneIK,
  commitRootMotionIntent
} from '@sumosizedginger/my-game-engine-1.0/full';
import { mat, materialById } from '../assets/materials.js';

/**
 * Boxer proportions. Deliberately unlike the player's identity: this is a
 * thick-necked, heavy-armed, short-legged pressure fighter, and every value is
 * inside Character Forge's published parameter bounds.
 */
export const BOXER_PARAMETERS = Object.freeze({
  height: 1.86,
  shoulderWidth: 0.55,
  chestWidth: 0.235,
  chestDepth: 0.175,
  waistWidth: 0.183,
  waistDepth: 0.143,
  pelvisWidth: 0.196,
  pelvisDepth: 0.148,
  armLength: 0.74,
  armMass: 1.5,
  legLength: 0.93,
  legMass: 1.34,
  headScale: 0.97,
  neckLength: 0.1,
  neckThickness: 0.098,
  radialSegments: 16,
  torsoSegments: 18,
  limbSegments: 12
});

/** A boxer's gait: short, wide, low. Inside Motion Forge's parameter bounds. */
export const BOXER_MOTION = Object.freeze({
  cadence: 126,
  strideLength: 0.78,
  verticalBounce: 0.015,
  pelvisRoll: 0.045,
  pelvisYaw: 0.055,
  lateralSway: 0.03,
  armSwing: 0.12,
  elbowFlex: 0.2,
  wristLag: 0.03,
  torsoCounter: 0.45,
  stepHeight: 0.038
});

/**
 * Wrist targets in CHARACTER (body) space for each boxing pose.
 *
 * FACING. Character Forge's humanoid faces +Z — its toes, chin and Motion
 * Forge's root-motion intent all advance along +Z — even though the engine
 * declares MESH_FORWARD_AXIS / SCENE_FORWARD_AXIS as -Z. That mismatch is
 * recorded as ENGINE_GAPS.md — GAP-12. The game resolves it in ONE place: the
 * opponent's group carries an extra half turn, so everything below is authored
 * in the Forge's own frame rather than fighting it.
 *
 *   +X  the fighter's LEFT
 *   +Z  forward, toward the player
 */
function buildPoseTargets(landmarks) {
  const shoulderY = landmarks['shoulder.L'].y;
  const chin = landmarks.head.y - 0.11;
  return {
    stance: {
      left: [0.242, chin - 0.155, 0.25], right: [-0.219, chin - 0.12, 0.222],
      pelvisYaw: -0.52, chestYaw: 0.06, headPitch: 0.1, lean: 0.09
    },
    guardLow: {
      left: [0.245, shoulderY - 0.3, 0.26], right: [-0.225, shoulderY - 0.27, 0.24],
      pelvisYaw: -0.52, chestYaw: 0.04, headPitch: 0.04, lean: 0.13
    },
    blockHigh: {
      left: [0.175, chin - 0.01, 0.2], right: [-0.17, chin + 0.005, 0.19],
      pelvisYaw: -0.36, chestYaw: -0.02, headPitch: 0.26, lean: 0.17
    },
    blockLow: {
      left: [0.205, shoulderY - 0.34, 0.23], right: [-0.2, shoulderY - 0.32, 0.22],
      pelvisYaw: -0.36, chestYaw: -0.02, headPitch: 0.22, lean: 0.19
    },
    jabWind: {
      left: [0.245, chin - 0.12, 0.13], right: [-0.205, chin - 0.115, 0.215],
      pelvisYaw: -0.6, chestYaw: 0.16, headPitch: 0.08, lean: 0.05
    },
    jabStrike: {
      left: [0.125, chin - 0.09, 0.62], right: [-0.2, chin - 0.1, 0.195],
      pelvisYaw: -0.38, chestYaw: -0.16, headPitch: 0.08, lean: -0.04
    },
    hookWind: {
      left: [0.21, chin - 0.14, 0.25], right: [-0.37, chin - 0.06, -0.1],
      pelvisYaw: -0.72, chestYaw: 0.36, headPitch: 0.06, lean: 0.04
    },
    hookStrike: {
      left: [0.22, chin - 0.16, 0.21], right: [-0.155, chin - 0.1, 0.55],
      pelvisYaw: -0.14, chestYaw: -0.34, headPitch: 0.09, lean: -0.07
    },
    stagger: {
      left: [0.29, shoulderY - 0.22, -0.04], right: [-0.28, shoulderY - 0.2, -0.06],
      pelvisYaw: -0.2, chestYaw: -0.06, headPitch: -0.2, lean: -0.22
    },
    down: {
      left: [0.34, shoulderY - 0.5, -0.1], right: [-0.34, shoulderY - 0.48, -0.12],
      pelvisYaw: -0.1, chestYaw: -0, headPitch: -0.3, lean: -0.1
    }
  };
}

/** Opponent FSM state -> pose name. */
const STATE_POSE = Object.freeze({
  idle: 'stance',
  circle: 'stance',
  approach: 'stance',
  retreat: 'stance',
  block: 'blockHigh',
  wind: 'jabWind',
  strike: 'jabStrike',
  recover: 'stance',
  stagger: 'stagger',
  down: 'down',
  getup: 'stagger'
});

/**
 * Builds the opponent.
 *
 * @param {object} options
 * @param {object} options.library - Asset library for the equipment.
 * @returns {object} Opponent presentation handle.
 */
export function createOpponentBoxer({ library }) {
  // --- CHARACTER FORGE ------------------------------------------------------
  const definition = createCharacterDefinition({
    id: 'char.sumo.opponent.redcorner',
    parameters: BOXER_PARAMETERS
  });
  // Material Forge remains the authority for the surface; Character Forge
  // accepts only raw material options (ENGINE_GAPS.md — GAP-07), so the
  // authored definition's resolved parameters are handed through.
  const skinDefinition = materialById(mat('skin', 0));
  const skin = skinDefinition.data.parameters;
  const character = buildHumanoidCharacter(definition, {
    color: skin.color,
    roughness: skin.roughness,
    metalness: skin.metalness
  });

  // Landmarks recomputed from parameters alone, proving the semantic layer is
  // usable without the built character, and used for every rest direction.
  const { parameters } = resolveHumanoidParameters(BOXER_PARAMETERS);
  const landmarks = computeSemanticLandmarks(parameters);
  const poses = buildPoseTargets(landmarks);

  const group = new Group();
  group.name = 'opponent-boxer';
  const body = character.mesh;
  body.castShadow = true;
  body.receiveShadow = true;
  // A skinned mesh's bind-pose bounds do not follow the pose; culling on them
  // makes the fighter vanish at the edge of the frame.
  body.frustumCulled = false;
  group.add(body);

  // --- EQUIPMENT, attached to Character Forge's semantic bones ---------------
  const attachments = [];
  /**
   * @param {string} boneName
   * @param {string} assetKey
   * @param {object} [options]
   */
  function attach(boneName, assetKey, { position = [0, 0, 0], rotation = [0, 0, 0], scale = 1 } = {}) {
    const bone = character.bonesByName[boneName];
    const object = library.object(assetKey, `${assetKey}@${boneName}`);
    if (!bone || !object) return null;
    const holder = new Object3D();
    holder.name = `attach:${boneName}`;
    holder.position.set(position[0], position[1], position[2]);
    holder.rotation.set(rotation[0], rotation[1], rotation[2]);
    holder.scale.setScalar(scale);
    object.castShadow = true;
    object.frustumCulled = false;
    holder.add(object);
    bone.add(holder);
    attachments.push(holder);
    return holder;
  }

  // Gloves are authored cuff-at-origin pointing +Y; the rest hand points -Y.
  attach('hand_l', 'asset.boxer.glove.left', { position: [0, -0.03, 0], rotation: [Math.PI, 0, 0], scale: 1.02 });
  attach('hand_r', 'asset.boxer.glove.right', { position: [0, -0.03, 0], rotation: [Math.PI, 0, 0], scale: 1.02 });
  attach('pelvis', 'asset.boxer.trunks', { position: [0, 0.02, 0] });
  attach('foot_l', 'asset.boxer.boot.left', { position: [0, -0.015, 0] });
  attach('foot_r', 'asset.boxer.boot.right', { position: [0, -0.015, 0] });
  attach('head', 'asset.boxer.head.detail', { position: [0, 0.02, 0] });

  // --- MOTION FORGE ---------------------------------------------------------
  const motionDefinition = createMotionDefinition({ id: 'motion.boxer.shuffle', parameters: BOXER_MOTION });
  const locomotion = createLocomotionEvaluator(character, BOXER_MOTION);
  const gaitSpeed = locomotion.getSpeed();
  /**
   * A game-owned transform that Motion Forge's root motion is COMMITTED into.
   * Motion produces intent; the transform owner applies it. Here the owner is
   * a gait odometer: comparing how far the gait thinks it walked against how
   * far the fighter actually moved closes the loop on foot sliding.
   */
  const gaitTransform = { position: { x: 0, y: 0, z: 0 } };
  let gaitScale = 1;

  // --- rest directions, derived from the skeleton itself ---------------------
  const restDirections = new Map();
  for (const boneName of ['upperarm_l', 'forearm_l', 'upperarm_r', 'forearm_r', 'thigh_l', 'shin_l', 'thigh_r', 'shin_r']) {
    const bone = character.bonesByName[boneName];
    const child = bone?.children.find((c) => c.isBone);
    if (!bone || !child) continue;
    restDirections.set(boneName, new Vector3().copy(child.position).normalize());
  }

  const segment = (a, b) => Math.hypot(
    landmarks[b].x - landmarks[a].x,
    landmarks[b].y - landmarks[a].y,
    landmarks[b].z - landmarks[a].z
  );
  const upperArmLength = segment('shoulder.L', 'elbow.L');
  const forearmLength = segment('elbow.L', 'wrist.L');

  // --- pose interpolation state --------------------------------------------
  const current = {
    left: new Vector3(...poses.stance.left),
    right: new Vector3(...poses.stance.right),
    pelvisYaw: poses.stance.pelvisYaw,
    chestYaw: poses.stance.chestYaw,
    headPitch: poses.stance.headPitch,
    lean: poses.stance.lean
  };
  const target = {
    left: new Vector3(...poses.stance.left),
    right: new Vector3(...poses.stance.right),
    pelvisYaw: poses.stance.pelvisYaw,
    chestYaw: poses.stance.chestYaw,
    headPitch: poses.stance.headPitch,
    lean: poses.stance.lean
  };

  const _bodyInverseMatrix = new Matrix4();
  const _groupInverseMatrix = new Matrix4();
  const _shoulderWorld = new Vector3();
  const _footProbe = new Vector3();
  const _bodyInverse = new Quaternion();
  /** Where an un-posed ankle sits above the canvas. */
  const restAnkleY = landmarks['ankle.L'].y;
  let groundOffset = 0;
  const _parentQuat = new Quaternion();
  const _localDir = new Vector3();
  const _stanceQuat = new Quaternion();
  const _stanceEuler = new Euler();
  const _bob = new Vector3();

  // The bladed boxing stance the legs blend back to at rest, captured once from
  // explicit angles rather than from the walk cycle's current frame.
  const legStance = {
    // Lead (left) leg forward and abducted; rear (right) leg back, knee bent,
    // foot turned out. A boxer stands on a wide diagonal base, not on two
    // parallel legs, and this is the single pose change that most stops the
    // fighter reading as a mannequin.
    thigh_l: [-0.4, -0.06, 0.26],
    shin_l: [0.3, 0, -0.04],
    thigh_r: [0.26, 0.1, -0.3],
    shin_r: [0.44, 0, 0.03],
    foot_l: [0.12, -0.1, -0.05],
    foot_r: [-0.5, 0.42, 0.04]
  };

  /**
   * Points a two-bone chain at a wrist target using Motion Forge's analytical
   * solver, then converts the solved world directions into bone rotations.
   *
   * @param {string} side - 'l' or 'r'
   * @param {Vector3} wristTarget - Character-space wrist position.
   */
  function solveArm(side, wristTarget) {
    const upperName = `upperarm_${side}`;
    const lowerName = `forearm_${side}`;
    const upper = character.bonesByName[upperName];
    const lower = character.bonesByName[lowerName];
    if (!upper || !lower) return;

    // The shoulder is read from the LIVE skeleton rather than from the rest
    // landmark: the chest blade and Motion Forge's pelvis bounce both move it,
    // and solving from a stale root is how an IK arm ends up detached from the
    // body it belongs to.
    upper.updateWorldMatrix(true, false);
    _shoulderWorld.setFromMatrixPosition(upper.matrixWorld).applyMatrix4(_bodyInverseMatrix);

    const solved = solveTwoBoneIK({
      rootPos: { x: _shoulderWorld.x, y: _shoulderWorld.y, z: _shoulderWorld.z },
      targetPos: { x: wristTarget.x, y: wristTarget.y, z: wristTarget.z },
      upperLength: upperArmLength,
      lowerLength: forearmLength,
      // The elbow rides low and slightly outboard, which is what makes a guard
      // read as a guard rather than as chicken wings.
      poleDirection: { x: side === 'l' ? 0.58 : -0.58, y: -1, z: -0.3 }
    });

    applyBoneDirection(upperName, upper, solved.upperDir);
    applyBoneDirection(lowerName, lower, solved.lowerDir);
  }

  /**
   * Rotates a bone so its rest child direction points along a character-space
   * direction.
   *
   * @param {string} name
   * @param {object} bone
   * @param {object} worldDir - Character-space unit direction.
   */
  function applyBoneDirection(name, bone, worldDir) {
    const rest = restDirections.get(name);
    if (!rest) return;
    bone.parent.getWorldQuaternion(_parentQuat);
    _parentQuat.premultiply(_bodyInverse).invert();
    _localDir.set(worldDir.x, worldDir.y, worldDir.z).applyQuaternion(_parentQuat).normalize();
    bone.quaternion.setFromUnitVectors(rest, _localDir);
    bone.updateMatrixWorld(true);
  }

  /**
   * @param {object} bone
   * @param {number[]} euler
   * @param {number} weight
   */
  function blendToward(bone, euler, weight) {
    if (!bone || weight <= 0) return;
    _stanceEuler.set(euler[0], euler[1], euler[2], 'XYZ');
    _stanceQuat.setFromEuler(_stanceEuler);
    bone.quaternion.slerp(_stanceQuat, weight);
  }

  let disposed = false;
  let punchProgress = 0;

  return {
    group,
    character,
    definition,
    motionDefinition,
    landmarks,

    /** @returns {object} Diagnostics for the debug overlay. */
    diagnostics() {
      return {
        bones: character.bones.length,
        landmarks: Object.keys(landmarks).length,
        gaitPhase: Number(locomotion.getPhase().toFixed(3)),
        gaitScale: Number(gaitScale.toFixed(3)),
        gaitDistance: Number(gaitTransform.position.z.toFixed(3)),
        height: parameters.height
      };
    },

    /**
     * Places and poses the opponent for one rendered frame.
     *
     * @param {object} options
     * @param {object} options.state - Opponent fight state.
     * @param {object} options.position - Committed world position.
     * @param {number} options.dt - Render delta.
     * @param {number} options.speed - Actual planar speed, m/s.
     */
    update({ state, position, dt, speed }) {
      group.position.set(position.x, 0, position.z);
      // `state.yaw` is a gameplay heading in the engine's -Z-forward frame; the
      // Forge's humanoid faces +Z. The half turn reconciles the two once, here.
      group.rotation.set(0, state.yaw + Math.PI, 0);
      body.updateWorldMatrix(true, false);
      body.getWorldQuaternion(_bodyInverse).invert();
      _bodyInverseMatrix.copy(body.matrixWorld).invert();
      _groupInverseMatrix.copy(group.matrixWorld).invert();

      // --- MOTION FORGE: gait ------------------------------------------------
      // The gait is played at the rate the fighter is actually travelling, so
      // the feet do not skate. `gaitScale` is closed-loop: the root motion the
      // evaluator produces is committed into a game-owned transform and
      // compared against the real speed.
      const wanted = gaitSpeed > 0 ? Math.min(2.2, speed / gaitSpeed) : 0;
      gaitScale += (wanted - gaitScale) * Math.min(1, dt * 8);
      const frame = locomotion.update(dt * gaitScale);
      commitRootMotionIntent(
        { ...frame.rootMotionIntent, deltaZ: frame.rootMotionIntent.deltaZ * gaitScale },
        gaitTransform,
        'forward'
      );

      // --- game-owned pose ---------------------------------------------------
      let poseName = STATE_POSE[state.state] ?? 'stance';
      if (state.state === 'block') poseName = state.blockZone === 'low' ? 'blockLow' : 'blockHigh';
      if (state.state === 'wind') poseName = state.attack === 'HOOK' ? 'hookWind' : 'jabWind';
      if (state.state === 'strike') poseName = state.attack === 'HOOK' ? 'hookStrike' : 'jabStrike';
      const pose = poses[poseName] ?? poses.stance;

      target.left.set(pose.left[0], pose.left[1], pose.left[2]);
      target.right.set(pose.right[0], pose.right[1], pose.right[2]);
      target.pelvisYaw = pose.pelvisYaw;
      target.chestYaw = pose.chestYaw;
      target.headPitch = pose.headPitch;
      target.lean = pose.lean;

      // A strike snaps; everything else settles. That difference is most of
      // what makes a punch feel like a punch.
      const snap = state.state === 'strike' ? 34 : state.state === 'wind' ? 11 : 9;
      const k = Math.min(1, dt * snap);
      current.left.lerp(target.left, k);
      current.right.lerp(target.right, k);
      current.pelvisYaw += (target.pelvisYaw - current.pelvisYaw) * k;
      current.chestYaw += (target.chestYaw - current.chestYaw) * k;
      current.headPitch += (target.headPitch - current.headPitch) * k;
      current.lean += (target.lean - current.lean) * k;
      punchProgress = state.state === 'strike' ? Math.min(1, punchProgress + dt * 6) : Math.max(0, punchProgress - dt * 4);

      // Spine: the bladed stance and the punch's hip rotation. Applied on top
      // of Motion Forge's pelvis dynamics rather than instead of them.
      const pelvis = character.bonesByName.pelvis;
      const spine = character.bonesByName.spine;
      const chest = character.bonesByName.chest;
      const head = character.bonesByName.head;
      if (pelvis) {
        pelvis.rotation.y += current.pelvisYaw;
        pelvis.rotation.x += current.lean * 0.35;
        pelvis.updateMatrixWorld(true);
      }
      if (spine) {
        spine.rotation.set(current.lean * 0.4, current.chestYaw * 0.5, 0);
        spine.updateMatrixWorld(true);
      }
      if (chest) {
        chest.rotation.set(current.lean * 0.5, current.chestYaw, 0);
        chest.updateMatrixWorld(true);
      }
      if (head) {
        head.rotation.set(current.headPitch, -current.chestYaw * 0.6, 0);
      }

      // Legs blend from the walk cycle back to a bladed stance as speed drops.
      const stanceWeight = 1 - Math.min(1, speed / 1.15);
      if (stanceWeight > 0.01) {
        for (const [boneName, euler] of Object.entries(legStance)) {
          blendToward(character.bonesByName[boneName], euler, stanceWeight * 0.85);
        }
      }

      // Arms: always game-owned, always through Motion Forge's IK solver.
      solveArm('l', current.left);
      solveArm('r', current.right);

      // A knockdown rotates the whole fighter rather than posing 22 bones into
      // a fall, which is honest about what this tranche's motion layer can do.
      // Breathing and impact shudder: cheap, bounded, and it stops the fighter
      // reading as a statue between exchanges. The knockdown tips the BODY
      // rather than the group, so the fighter falls onto their own back
      // regardless of which way they were facing.
      const breathe = Math.sin(performance.now() * 0.0017) * 0.006;
      let tilt = 0;
      let drop = 0;
      if (state.state === 'down' || state.state === 'getup') {
        const down = state.state === 'down'
          ? Math.min(1, state.stateT * 3.2)
          : Math.max(0, 1 - state.stateT / Math.max(0.001, state.stateDuration));
        tilt = -down * 1.42;
        drop = -down * 0.16;
      }
      body.rotation.x += (tilt - body.rotation.x) * Math.min(1, dt * 9);

      // GROUNDING. A bladed stance shortens the legs, so posing alone leaves the
      // fighter hovering. The lower ankle is measured in group space after the
      // pose and the whole body is dropped until it meets the canvas — the same
      // job Motion Forge's own grounding does for the walk cycle, applied to a
      // pose Motion Forge does not know about.
      character.rootBone.updateWorldMatrix(true, true);
      let lowest = Infinity;
      for (const name of ['foot_l', 'foot_r']) {
        const bone = character.bonesByName[name];
        if (!bone) continue;
        _footProbe.setFromMatrixPosition(bone.matrixWorld).applyMatrix4(_groupInverseMatrix);
        if (_footProbe.y < lowest) lowest = _footProbe.y;
      }
      if (Number.isFinite(lowest)) {
        const wanted = restAnkleY - lowest + body.position.y;
        groundOffset += (wanted - groundOffset) * Math.min(1, dt * 14);
      }

      _bob.set(0, breathe - state.flash * 0.02 + drop + groundOffset, 0);
      body.position.copy(_bob);

      character.rootBone.updateWorldMatrix(true, true);
    },

    /**
     * Flashes the fighter on impact by lifting the shared skin material's
     * emissive. One material, mutated in place — no per-hit allocation.
     *
     * @param {number} amount - 0..1
     */
    setFlash(amount) {
      const material = character.material;
      if (!(material instanceof MeshStandardMaterial)) return;
      material.emissive.setRGB(amount * 0.34, amount * 0.05, amount * 0.03);
      material.emissiveIntensity = amount > 0 ? 1 : 0;
    },

    get disposed() {
      return disposed;
    },

    /**
     * Releases what Character Forge handed over. The equipment's geometry and
     * materials belong to the shared asset library.
     */
    dispose() {
      if (disposed) return;
      disposed = true;
      for (const holder of attachments) {
        holder.parent?.remove(holder);
        holder.clear();
      }
      attachments.length = 0;
      group.remove(body);
      body.clear();
      character.geometry.dispose();
      character.material.dispose();
      group.removeFromParent();
      group.clear();
    }
  };
}
