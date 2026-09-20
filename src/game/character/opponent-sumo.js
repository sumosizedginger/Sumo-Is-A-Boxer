import {createBoxerEyes} from './hero-eyes.js';
import { createHeroVoxel } from '../voxel/hero-voxel.js';
/**
 * Sumo voxel presentation on the accepted Character Forge skeleton.
 * The smooth body is HIDDEN GUIDE GEOMETRY. Visible art is Voxel Forge.
 * Motion Forge supplies locomotion and analytical IK.
 * HOOK is a retained combat identifier, not a boxing visual.
 */

import { Group, Object3D, Quaternion, Vector3, Matrix4 } from 'three';
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
import { createHeroFeet } from './hero-feet.js';
import { rebuildSumoGuideBody } from './hero-guide-body.js';
import { mat, materialById } from '../assets/materials.js';

/**
 * Sumo guide proportions. Every value is inside Character Forge's published
 * parameter bounds. Visual mass is authored on the continuous guide, then
 * voxelized; these parameters keep the skeleton in range.
 */
export const SUMO_PARAMETERS = Object.freeze({
  height: 1.78,
  shoulderWidth: 0.58,
  chestWidth: 0.28,
  chestDepth: 0.22,
  waistWidth: 0.24,
  waistDepth: 0.20,
  pelvisWidth: 0.26,
  pelvisDepth: 0.20,
  armLength: 0.70,
  armMass: 1.6,
  legLength: 0.82,
  legMass: 1.6,
  headScale: 1.08,
  neckLength: 0.08,
  neckThickness: 0.10,
  radialSegments: 16,
  torsoSegments: 18,
  limbSegments: 12
});

/** Compact, low gait. Inside Motion Forge's parameter bounds. */
export const SUMO_MOTION = Object.freeze({
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
 * Wrist targets in CHARACTER (body) space for each combat pose.
 *
 * FACING. Character Forge's humanoid faces +Z — its toes, chin and Motion
 * Forge's root-motion intent all advance along +Z — even though the engine
 * declares MESH_FORWARD_AXIS / SCENE_FORWARD_AXIS as -Z. That mismatch is
 * recorded as docs/ENGINE_GAPS.md — GAP-12. The game resolves it in ONE place: the
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
    neutral: {
      left: [.33, shoulderY-.40, .12], right: [-.33, shoulderY-.40, .12],
      pelvisYaw: 0, chestYaw: 0, headPitch: .02, lean: .025
    },
    sumo_neutral: {
      left: [0.33, 0.86, 0.03], right: [-0.33, 0.86, 0.03],
      pelvisYaw: 0, chestYaw: 0, headPitch: 0, lean: 0
    },
    extended: {
      left: [.2365,shoulderY,.627],right: [-.23,shoulderY-.12,.24],
      pelvisYaw: 0,chestYaw: 0,headPitch: 0,lean: 0
    },
    raised: {
      left: [.29,shoulderY+.56,.10],right: [-.30,shoulderY+.52,.12],
      pelvisYaw: 0,chestYaw: 0,headPitch: 0,lean: 0
    },
    deepFlex: {
      left: [.28, shoulderY+.12, .13], right: [-.28, shoulderY+.11, .13],
      pelvisYaw: -.22, chestYaw: .03, headPitch: .08, lean: .08
    },
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
      left: [0.21, chin - 0.14, 0.25], right: [-0.225, chin - 0.065, 0.13],
      pelvisYaw: -0.65, chestYaw: -0.12, headPitch: 0.06, lean: 0.04
    },
    hookStrike: {
      left: [0.22, chin - 0.16, 0.21], right: [-0.09, chin - 0.07, 0.66],
      pelvisYaw: -0.05, chestYaw: 0.2, headPitch: 0.09, lean: -0.07
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
export function createOpponentSumo({ library, voxelQuality = 'HERO', voxelRealization = 'grid' } = {}) {
  // --- CHARACTER FORGE ------------------------------------------------------
  const definition = createCharacterDefinition({
    id: 'char.sumo.opponent',
    parameters: SUMO_PARAMETERS
  });
  // Material Forge remains the authority for the surface; Character Forge
  // accepts only raw material options (docs/ENGINE_GAPS.md — GAP-07), so the
  // authored definition's resolved parameters are handed through.
  const skinDefinition = materialById(mat('skin', 0));
  const skin = skinDefinition.data.parameters;
  const character = buildHumanoidCharacter(definition, {
    color: skin.color,
    roughness: skin.roughness,
    metalness: skin.metalness
  });

  const anatomy = rebuildSumoGuideBody(character, skinDefinition);
  const eyeRig=createBoxerEyes(character);character.eyeRig=eyeRig;

  // Landmarks recomputed from parameters alone, proving the semantic layer is
  // usable without the built character, and used for every rest direction.
  const { parameters } = resolveHumanoidParameters(SUMO_PARAMETERS);
  const landmarks = computeSemanticLandmarks(parameters);
  const poses = buildPoseTargets(landmarks);

  const group = new Group();
  group.name = 'opponent-sumo';
  const body = character.mesh;
  body.castShadow = true;
  body.receiveShadow = true;
  // A skinned mesh's bind-pose bounds do not follow the pose; culling on them
  // makes the fighter vanish at the edge of the frame.
  body.frustumCulled = false;
  group.add(body);

  const attachments = [];
  const hair = library.object('asset.hero.hair', 'hero-hair');
  if (hair) {
    const holder = new Object3D();
    holder.name = 'attach:head:hair';
    hair.castShadow = true;
    hair.frustumCulled = false;
    holder.add(hair);
    character.bonesByName.head.add(holder);
    attachments.push(holder);
  }

  const voxelHero = createHeroVoxel(character, { quality: voxelQuality, realization: voxelRealization });
  group.add(voxelHero.runtime.object3D);

  // --- MOTION FORGE ---------------------------------------------------------
  const motionDefinition = createMotionDefinition({ id: 'motion.sumo.shuffle', parameters: SUMO_MOTION });
  const locomotion = createLocomotionEvaluator(character, SUMO_MOTION);
  const gaitSpeed = locomotion.getSpeed();
  /**
   * A game-owned transform that Motion Forge's root motion is COMMITTED into.
   * Motion produces intent; the transform owner applies it. Here the owner is
   * a gait odometer: comparing how far the gait thinks it walked against how
   * far the fighter actually moved closes the loop on foot sliding.
   */
  const gaitTransform = { position: { x: 0, y: 0, z: 0 } };
  let gaitScale = 0;

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
  const _shoulderWorld = new Vector3();
  const _bodyInverse = new Quaternion();
  const _parentQuat = new Quaternion();
  const _localDir = new Vector3();

  /**
   * Points a two-bone chain at a wrist target using Motion Forge's analytical
   * solver, then converts the solved world directions into bone rotations.
   *
   * @param {string} side - 'l' or 'r'
   * @param {Vector3} wristTarget - Character-space wrist position.
   */
  function solveArm(side, wristTarget, poleOverride = null) {
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

    const defaultPole = wristTarget.y < 0.95
      ? { x: side === 'l' ? 0.20 : -0.20, y: -0.15, z: -0.70 }
      : { x: side === 'l' ? 0.58 : -0.58, y: -1, z: -0.3 };

    const solved = solveTwoBoneIK({
      rootPos: { x: _shoulderWorld.x, y: _shoulderWorld.y, z: _shoulderWorld.z },
      targetPos: { x: wristTarget.x, y: wristTarget.y, z: wristTarget.z },
      upperLength: upperArmLength,
      lowerLength: forearmLength,
      // The elbow rides low and slightly outboard, which is what makes a guard
      // read as a guard rather than as chicken wings. For relaxed poses, flare outward.
      poleDirection: poleOverride ?? defaultPole
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

  const planted = createHeroFeet();
  const legTarget = new Vector3();
  const _sagL = new Vector3(), _sagR = new Vector3();
  const worldUp = new Vector3(0,1,0);
  const footOrientation = new Quaternion();
  let poseTime = 0, reactionTime = 10, reactionPower = 0, reactionSide = 1, reactionZone = 'high';
  const clavicleRest = ['l','r'].map(side=>character.bonesByName['shoulder_'+side].position.clone());
  function solveLeg(side,foot,drive,heavy) {
    const upper=character.bonesByName['thigh_'+side],lower=character.bonesByName['shin_'+side];
    upper.updateWorldMatrix(true,false);
    _shoulderWorld.setFromMatrixPosition(upper.matrixWorld).applyMatrix4(_bodyInverseMatrix);
    legTarget.copy(foot.position).applyMatrix4(_bodyInverseMatrix);
    const key=side==='l'?'L':'R';
    const solution=solveTwoBoneIK({rootPos:_shoulderWorld,targetPos:legTarget,upperLength:segment('hip.'+key,'knee.'+key),lowerLength:segment('knee.'+key,'ankle.'+key),poleDirection:{x:side==='l'?.13:-.13,y:0,z:1}});
    applyBoneDirection('thigh_'+side,upper,solution.upperDir);
    applyBoneDirection('shin_'+side,lower,solution.lowerDir);
    const bone=character.bonesByName['foot_'+side];
    bone.parent.getWorldQuaternion(_parentQuat).invert();
    footOrientation.setFromAxisAngle(worldUp,foot.yaw+(heavy&&side==='r'?drive*.24:0));
    bone.quaternion.copy(_parentQuat).multiply(footOrientation);
  }
  let disposed = false;

  return {
    group,
    character,
    voxel: voxelHero,
    corrections: anatomy.corrections,
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
        height: parameters.height,
        skinTriangles: anatomy.triangles,
        voxel: {
          occupied: voxelHero.artifact.occupiedCount,
          surface: voxelHero.artifact.surfaceCount,
          faces: voxelHero.artifact.visibleFaceCount,
          voxelSize: voxelHero.artifact.voxelSize,
          generationMs: voxelHero.generationMs,
          drawCalls: voxelHero.runtime.stats.drawCalls,
          realization: voxelRealization,
          instances: voxelHero.runtime.stats.instances,
          realizationHash: voxelHero.artifact.surfaceInstances?.hash??null,
          realizationMs: voxelHero.artifact.surfaceInstances?.generationMs??0
        }
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
    react({zone='high',heavy=false,side=1}={}) { reactionTime=0;reactionPower=heavy?1:.6;reactionSide=side;reactionZone=zone; },
    reset() { anatomy.corrections.reset();planted.reset();locomotion.reset();poseTime=0;reactionTime=10;reactionPower=0;current.left.set(...poses.stance.left);current.right.set(...poses.stance.right);for(const key of ['pelvisYaw','chestYaw','headPitch','lean'])current[key]=poses.stance[key];gaitScale=0;gaitTransform.position.z=0;body.position.set(0,0,0);body.rotation.set(0,0,0); voxelHero.runtime.updateDeformation(character.bones); },
    update({ state, position, dt, speed, inspection = null }) {
      if(dt<=0)return;
      poseTime+=dt;reactionTime+=dt;
      group.position.set(position.x, 0, position.z);
      // `state.yaw` is a gameplay heading in the engine's -Z-forward frame; the
      // Forge's humanoid faces +Z. The half turn reconciles the two once, here.
      group.rotation.set(0, state.yaw + Math.PI, 0);
      const downState=state.state==='down'||state.state==='getup';
      const down=downState?(state.state==='down'?Math.min(1,state.stateT*3.2):Math.max(0,1-state.stateT/Math.max(.001,state.stateDuration))):0;
      body.rotation.x=-down*1.42;
      body.position.set(0,-.075-down*.16-(inspection?.crouch ?? 0),0);
      body.updateWorldMatrix(true, false);
      body.getWorldQuaternion(_bodyInverse).invert();
      _bodyInverseMatrix.copy(body.matrixWorld).invert();

      // --- MOTION FORGE: gait ------------------------------------------------
      // The gait is played at the rate the fighter is actually travelling, so
      // the feet do not skate. `gaitScale` is closed-loop: the root motion the
      // evaluator produces is committed into a game-owned transform and
      // compared against the real speed.
      const wanted = gaitSpeed > 0 ? Math.min(2.2, speed / gaitSpeed) : 0;
      gaitScale += (wanted - gaitScale) * Math.min(1, dt * 8);
      const frame = locomotion.update(dt * gaitScale);
      commitRootMotionIntent(
        frame.rootMotionIntent,
        gaitTransform,
        'forward'
      );

      // --- game-owned pose ---------------------------------------------------
      let poseName = STATE_POSE[state.state] ?? 'stance';
      if (state.state === 'block') poseName = state.blockZone === 'low' ? 'blockLow' : 'blockHigh';
      if (state.state === 'wind') poseName = state.attack === 'HOOK' ? 'hookWind' : 'jabWind';
      if (state.state === 'strike') poseName = state.attack === 'HOOK' ? 'hookStrike' : 'jabStrike';
      const pose = poses[inspection?.pose ?? poseName] ?? poses.stance;

      target.left.set(pose.left[0], pose.left[1], pose.left[2]);
      target.right.set(pose.right[0], pose.right[1], pose.right[2]);
      target.pelvisYaw = pose.pelvisYaw;
      target.chestYaw = inspection?.twist ?? pose.chestYaw;
      target.headPitch = pose.headPitch;
      target.lean = inspection?.lean ?? pose.lean;
      target.left.y+=Math.sin(poseTime*1.8)*.0025;
      target.right.y+=Math.sin(poseTime*1.8+.4)*.002;
      if(state.attackZone==='low'&&(state.state==='strike'||state.state==='wind')){
        (state.attack==='HOOK'?target.right:target.left).y-=.23;
      }

      // A strike snaps; everything else settles. That difference is most of
      // what makes a punch feel like a punch.
      const snap = state.state === 'strike' ? 42 : state.state === 'wind' ? 12 : state.attack === 'HOOK' ? 10 : 19;
      const k = 1-Math.exp(-dt*snap);
      current.left.lerp(target.left, k);
      current.right.lerp(target.right, k);
      current.pelvisYaw += (target.pelvisYaw - current.pelvisYaw) * k;
      current.chestYaw += (target.chestYaw - current.chestYaw) * k;
      current.headPitch += (target.headPitch - current.headPitch) * k;
      current.lean += (target.lean - current.lean) * k;

      const heavy=state.attack==='HOOK'; // Legacy combat id, presented as a rear straight cross.
      const attackSide=heavy?'r':'l';
      const t=Math.min(1,state.stateT/Math.max(.001,state.stateDuration));
      const drive=state.state==='strike'?1-Math.pow(1-Math.min(1,t/.45),3):state.state==='recover'?Math.pow(1-t,heavy?2:3):0;
      const load=state.state==='wind'?Math.sin(t*Math.PI/2):0;
      const breath=Math.sin(poseTime*1.8)*.0025;
      const balance=Math.sin(poseTime*.7)*.007;
      const reaction=(1-Math.exp(-reactionTime*95))*Math.exp(-reactionTime*8)*reactionPower;
      const follow=(1-Math.exp(-reactionTime*38))*Math.exp(-reactionTime*5)*reactionPower;
      const bodyHit=reactionZone==='low';
      const bones=character.bonesByName;
      const pelvis=bones.pelvis,spine=bones.spine,chest=bones.chest,head=bones.head;
      // Ground pressure and pelvis start during the load. Thorax and clavicle
      // extend through impact; wrist rotation is the last link in the chain.
      pelvis.position.x+=balance+(heavy?-.025:.014)*drive;
      pelvis.position.z+=drive*(heavy?.055:.022)-load*.012;
      pelvis.position.y+=breath-drive*.013;
      pelvis.rotation.set(current.lean*.35+(bodyHit?follow*.055:0),current.pelvisYaw,follow*.025*reactionSide);
      spine.rotation.set(current.lean*.4+(bodyHit?follow*.19:-follow*.04),current.chestYaw*.5+follow*.075*reactionSide,balance*.6);
      chest.rotation.set(current.lean*.5+(bodyHit?reaction*.16:-follow*.12),current.chestYaw+reaction*.12*reactionSide,-reaction*.045*reactionSide);
      bones.neck.rotation.set(bodyHit?follow*.06:-reaction*.14,-reaction*.13*reactionSide,0);
      head.rotation.set(current.headPitch+(bodyHit?follow*.06:-reaction*.25),-current.chestYaw*.6+reaction*.2*reactionSide,-drive*.045+reaction*.09*reactionSide);
      for(const [i,side] of ['l','r'].entries()){
        const shoulder=bones['shoulder_'+side],sign=side==='l'?1:-1;
        shoulder.position.copy(clavicleRest[i]);
        const extension=side===attackSide?drive:0;
        shoulder.position.z+=extension*(heavy?.063:.042)-(side!==attackSide?drive*.016:0);
        shoulder.position.y+=extension*.035;
        shoulder.rotation.set(-extension*.12,-sign*extension*.18,sign*extension*.07);
        // THE SHOULDER IS THE MISSING LINK IN THE REACTION CHAIN. Head shots ran
        // neck -> head and skipped straight past the shoulders, so the recoil
        // stopped at the collar. The near shoulder now lifts and rolls back on a
        // head shot; on a body shot both drop and close in as the ribs fold.
        // `clavicleRest` is copied in above, so these are safe to accumulate onto.
        const near = sign === reactionSide ? 1 : 0.45;
        if (bodyHit) {
          shoulder.position.y -= follow * .022;
          shoulder.position.z += follow * .012;
          shoulder.rotation.x += follow * .09;
        } else {
          shoulder.position.z -= reaction * .026 * near;
          shoulder.position.y += reaction * .018 * near;
          shoulder.rotation.x -= reaction * .10 * near;
          shoulder.rotation.z += sign * reaction * .08 * near;
        }
      }
      body.updateWorldMatrix(true,true);
      _bodyInverseMatrix.copy(body.matrixWorld).invert();
      body.getWorldQuaternion(_bodyInverse).invert();
      if(!downState){
        const stance = inspection?.stanceWidth ?? (inspection?.pose === 'sumo_neutral' ? 0.24 : 0.225);
        const staggerScale = (inspection?.pose === 'sumo_neutral' || inspection?.stagger === false) ? 0 : 1;
        planted.update(group,dt,speed,drive,heavy,stance,staggerScale);
        solveLeg('l',planted.feet[0],drive,heavy);
        solveLeg('r',planted.feet[1],drive,heavy);
      } else {planted.reset();}
      // BODY SHOT -> THE GUARD SAGS. The hands drop and drift in as the ribcage
      // folds, then are carried back up by the slower recovery - which is why
      // this rides `follow` and not `reaction`. Applied to scratch copies so the
      // blended pose targets are never mutated.
      const isSumoNeutral = (inspection?.pose ?? poseName) === 'sumo_neutral';
      const armPoleL = isSumoNeutral ? { x: 0.05, y: -0.30, z: -0.90 } : null;
      const armPoleR = isSumoNeutral ? { x: -0.05, y: -0.30, z: -0.90 } : null;
      const guardSag = bodyHit ? follow : 0;
      if (guardSag > .0008) {
        _sagL.copy(current.left); _sagL.y -= guardSag * .055; _sagL.z -= guardSag * .018;
        _sagR.copy(current.right); _sagR.y -= guardSag * .05; _sagR.z -= guardSag * .018;
        solveArm('l', _sagL, armPoleL);
        solveArm('r', _sagR, armPoleR);
      } else {
        solveArm('l', current.left, armPoleL);
        solveArm('r', current.right, armPoleR);
      }
      for(const side of ['l','r']){
        const extension=side===attackSide?drive:0;
        bones['hand_'+side].rotation.set(-.08, (side==='l'?1:-1)*(.22+extension*1.05),0);
      }
      character.rootBone.updateWorldMatrix(true,true);
      anatomy.corrections.update();
      voxelHero.runtime.updateDeformation(character.bones);
    },

    /**
     * Flashes the fighter on impact by lifting the shared skin material's
     * emissive. One material, mutated in place — no per-hit allocation.
     *
     * @param {number} amount - 0..1
     */
    setFlash(amount) {
      voxelHero.runtime.setFlash(amount);
    },

    get disposed() {
      return disposed;
    },

    /**
     * Releases what Character Forge handed over. The equipment's geometry and
     * materials belong to the shared asset library.
     */
    dispose() {
      eyeRig.dispose();
      if (disposed) return;
      disposed = true;
      voxelHero.runtime.dispose();
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
