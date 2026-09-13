/**
 * SUMO IS A BOXER — Application.
 *
 * Wires the engine-owned gameplay spine to the game-owned presentation:
 *
 *   Geometry / Material / Character / Motion Forge  ->  authored assets
 *   Scene Composition                               ->  the authored venue
 *   Previewable                                     ->  renderable objects
 *   Gameplay Foundation (clock, entities, transforms, input, state, rules)
 *                                                   ->  the fight
 *
 * SIMULATION IS FIXED-STEP AND RENDERING IS INTERPOLATED, through the engine's
 * `createSimulationClock`. Combat therefore behaves identically at 60 Hz and at
 * 144 Hz, and the input router captures exactly one immutable action frame per
 * simulation step.
 */

import { WebGLRenderer, Scene, ACESFilmicToneMapping, SRGBColorSpace, PCFSoftShadowMap, Vector3 } from 'three';
import { createSimulationClock, ENGINE_NAME, ENGINE_VERSION } from '@sumosizedginger/my-game-engine-1.0/full';

import { SIM, FEEDBACK, PUNCH } from './config.js';
import { MATERIAL_DEFINITIONS } from './assets/materials.js';
import { buildRingAssets, RING } from './assets/ring.js';
import { buildWarehouseAssets } from './assets/warehouse.js';
import { buildDressingAssets } from './assets/dressing.js';
import { buildFighterKitAssets } from './assets/fighter-kit.js';
import { composeArenaScene } from './scene/arena-scene.js';
import { createAssetLibrary } from './presentation/asset-library.js';
import { createArenaPresentation } from './presentation/presenter.js';
import { createLightRig } from './presentation/lighting.js';
import { createCameraRig } from './presentation/camera-rig.js';
import { createImpactSparks, createDustField } from './presentation/vfx.js';
import { createOpponentBoxer } from './character/opponent-boxer.js';
import { createPlayerFists } from './character/player-fists.js';
import { createInputRouter } from './input/input-router.js';
import { createMatch } from './combat/match.js';
import { createFightAudio } from './audio/audio.js';
import { createHud } from './hud/hud.js';

/**
 * Builds every authored asset.
 *
 * @returns {Map<string, object>} asset key -> MeshIR
 */
export function buildAllAssets() {
  const assets = new Map();
  for (const source of [buildRingAssets(), buildWarehouseAssets(), buildDressingAssets(), buildFighterKitAssets()]) {
    for (const [key, mesh] of source) assets.set(key, mesh);
  }
  return assets;
}

/**
 * Boots the game into a host element.
 *
 * @param {HTMLElement} host
 * @returns {object} Game handle with dispose().
 */
export function createGame(host) {
  const startedAt = performance.now();

  // --- stage ---------------------------------------------------------------
  const stage = document.createElement('div');
  stage.className = 'stage';
  host.append(stage);

  const renderer = new WebGLRenderer({ antialias: true, powerPreference: 'high-performance', stencil: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.96;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  stage.append(renderer.domElement);

  const scene = new Scene();

  // --- assets, scene, presentation -----------------------------------------
  const assetBuildStart = performance.now();
  const assets = buildAllAssets();
  const assetBuildMs = performance.now() - assetBuildStart;

  const { definition: sceneDefinition, artifact: sceneArtifact, instance: sceneInstance } = composeArenaScene();
  const library = createAssetLibrary({ assets, materials: MATERIAL_DEFINITIONS });
  const presentation = createArenaPresentation({ instance: sceneInstance, library });
  scene.add(presentation.root);

  const lights = createLightRig({ scene, presentation });
  const sparks = createImpactSparks({ scene });
  const dust = createDustField({ scene, floorY: RING.floorY });

  // --- fighters ------------------------------------------------------------
  const rig = createCameraRig({ aspect: window.innerWidth / Math.max(1, window.innerHeight) });
  scene.add(rig.camera);

  const opponent = createOpponentBoxer({ library });
  scene.add(opponent.group);

  const fists = createPlayerFists({ library, camera: rig.camera });

  const playerSpawn = presentation.positionOf('player-spawn') ?? [0.9, 0, 2.1];
  const opponentSpawn = presentation.positionOf('opponent-spawn') ?? [-0.9, 0, -2.1];
  // Both fighters' starting stances are derived inside the match from these
  // scene-authored spawn nodes.
  const match = createMatch({ playerSpawn, opponentSpawn });

  // --- input, audio, HUD ---------------------------------------------------
  const router = createInputRouter({ target: window, surface: renderer.domElement });
  router.attach();
  const audio = createFightAudio();
  const hud = createHud(host);

  const clock = createSimulationClock({ tickRate: SIM.tickRate, maxSubSteps: SIM.maxSubSteps });

  let phase = 'start';       // 'start' | 'playing' | 'paused' | 'result'
  let hitStop = 0;
  let agitation = 0;
  let running = true;
  let lastFrame = performance.now();
  let frameAccumulator = 0;
  let frameCount = 0;
  let fps = 0;
  let showDiagnostics = false;
  let freeCamera = false;
  let orbit = 0;
  const _scratch = new Vector3();

  // --- event handling ------------------------------------------------------
  /**
   * Reacts to everything the match published this frame: audio, sparks, camera
   * response. The match itself never touches presentation.
   *
   * @param {Array<object>} events
   */
  function consume(events) {
    for (const { event, payload } of events) {
      switch (event) {
        case 'PUNCH_THROWN':
          audio.whoosh(payload.punch === 'CROSS');
          rig.impact({ fov: PUNCH[payload.punch].fovKick * 0.45, lunge: payload.punch === 'CROSS' ? 0.1 : 0.05 });
          break;

        case 'PUNCH_LANDED': {
          const heavy = Boolean(payload.heavy);
          audio.impact(heavy);
          audio.grunt(heavy);
          if (payload.at) {
            sparks.burst(payload.at, {
              amount: heavy ? 26 : 14,
              speed: heavy ? 3.4 : 2.2,
              color: payload.by === 'player' ? 0xffc98a : 0xff8a6a,
              lifetime: heavy ? 0.6 : 0.42
            });
          }
          agitation = Math.min(1, agitation + (heavy ? 0.7 : 0.35));
          lights.flash(heavy ? 0.5 : 0.28);
          hitStop = Math.min(FEEDBACK.hitStopMax, Math.max(hitStop, heavy ? 0.11 : 0.065));
          if (payload.by === 'player') {
            rig.impact({ shake: heavy ? 0.55 : 0.3, fov: heavy ? 6.5 : 3.5, snap: heavy ? 0.022 : 0.012 });
          } else {
            fists.shove();
            rig.impact({
              shake: heavy ? 0.72 : 0.4,
              snap: heavy ? 0.05 : 0.026,
              roll: (Math.random() - 0.5) * (heavy ? 0.16 : 0.08),
              damage: heavy ? 0.55 : 0.3
            });
          }
          break;
        }

        case 'PUNCH_BLOCKED':
          audio.block();
          if (payload.at) sparks.burst(payload.at, { amount: 8, speed: 1.5, color: 0xcfd8e8, lifetime: 0.3 });
          hitStop = Math.min(FEEDBACK.hitStopMax, Math.max(hitStop, 0.045));
          if (payload.by === 'player') rig.impact({ shake: 0.2, snap: 0.008 });
          else { fists.shove(); rig.impact({ shake: 0.26, snap: 0.014, damage: 0.08 }); }
          break;

        case 'GUARD_BROKEN':
          audio.guardBreak();
          audio.crowdSurge(0.7);
          if (payload.at) sparks.burst(payload.at, { amount: 30, speed: 3.8, color: 0xffe6a8, lifetime: 0.7 });
          rig.impact({ shake: 0.6, snap: 0.03, damage: payload.who === 'player' ? 0.35 : 0 });
          lights.flash(0.45);
          break;

        case 'PUNCH_EVADED':
          audio.whoosh(true);
          break;

        case 'DODGE':
          audio.whoosh(false);
          break;

        case 'KNOCKDOWN':
          audio.impact(true);
          audio.crowdSurge(1);
          rig.impact({ shake: 0.9, snap: 0.06, damage: payload.who === 'player' ? 0.8 : 0 });
          agitation = 1;
          break;

        case 'ROUND_START':
          audio.bell(1);
          break;

        case 'MATCH_FINISHED':
          audio.bell(3);
          audio.crowdSurge(1);
          break;

        case 'GUARD_CHANGED':
          audio.whoosh(false);
          break;

        default:
          break;
      }
    }
  }

  // --- phases --------------------------------------------------------------
  function beginFight() {
    if (phase === 'playing') return;
    audio.unlock();
    phase = 'playing';
    hud.showOverlay(null);
    router.requestLock();
  }

  function pause() {
    if (phase !== 'playing') return;
    phase = 'paused';
    match.state.transition('PAUSED');
    hud.showOverlay('pause');
    router.releaseLock();
  }

  function resume() {
    if (phase !== 'paused') return;
    phase = 'playing';
    match.state.transition('FIGHTING');
    hud.showOverlay(null);
    router.requestLock();
  }

  function rematch() {
    match.reset(Math.floor(Math.random() * 0x7fffffff));
    rig.reset();
    sparks.clear();
    opponent.setFlash(0);
    hitStop = 0;
    agitation = 0;
    phase = 'playing';
    hud.showOverlay(null);
    router.requestLock();
  }

  hud.startButton.addEventListener('click', beginFight);
  hud.pauseButton.addEventListener('click', resume);
  hud.rematchButton.addEventListener('click', rematch);
  router.onPointerLockChange((locked) => {
    if (!locked && phase === 'playing') pause();
  });

  function onResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    renderer.setSize(width, height);
    rig.resize(width, height);
  }
  window.addEventListener('resize', onResize);

  function onKeyDown(event) {
    if (event.code === 'Backquote' || event.code === 'F1') {
      event.preventDefault();
      showDiagnostics = !showDiagnostics;
      if (!showDiagnostics) hud.setDiagnostics(null);
    }
    if (event.code === 'KeyM') audio.setMuted(!audio.muted);
  }
  window.addEventListener('keydown', onKeyDown);

  // --- the loop ------------------------------------------------------------
  let rafHandle = 0;

  /**
   * @param {number} now
   */
  function loop(now) {
    if (!running) return;
    rafHandle = requestAnimationFrame(loop);

    const rawDelta = Math.min(100, now - lastFrame);
    lastFrame = now;
    const renderDelta = rawDelta / 1000;

    frameAccumulator += renderDelta;
    frameCount += 1;
    if (frameAccumulator >= 0.5) {
      fps = frameCount / frameAccumulator;
      frameAccumulator = 0;
      frameCount = 0;
    }

    // Hit-stop freezes the SIMULATION, not the renderer: the world holds for a
    // moment while the camera keeps moving, which is what gives a cross weight.
    let simulationMs = rawDelta;
    if (hitStop > 0) {
      const consumed = Math.min(hitStop, renderDelta);
      hitStop -= consumed;
      // Snapped, not merely decremented: a stranded floating-point residue here
      // would hold the simulation a hair behind the renderer forever. The same
      // class of bug as the dodge timer in combat/match.js.
      if (hitStop < 1e-6) hitStop = 0;
      simulationMs = Math.max(0, rawDelta - consumed * 1000);
    }

    let alpha = 1;
    if (phase === 'playing' || phase === 'result') {
      const advance = clock.advance(simulationMs, (fixedDelta) => {
        const frame = router.capture(fixedDelta);

        if (frame.pressed('PAUSE')) { pause(); return; }
        if (frame.pressed('RESTART') && (phase === 'result' || match.isFinished())) { rematch(); return; }

        match.step(fixedDelta, frame);
      });
      alpha = advance.alpha;
      consume(match.drainEvents());

      if (match.resultReady() && phase !== 'result') {
        phase = 'result';
        hud.showResult(match.snapshot());
        hud.showOverlay('result');
        router.releaseLock();
      }
    } else if (phase === 'paused') {
      // Still capture, so the pause key edge is seen and stale input is drained.
      const frame = router.capture(1 / SIM.tickRate);
      if (frame.pressed('PAUSE') || frame.pressed('CONFIRM')) resume();
      if (frame.pressed('RESTART')) rematch();
    } else if (phase === 'start') {
      router.capture(1 / SIM.tickRate);
    }

    // --- presentation ------------------------------------------------------
    agitation = Math.max(0, agitation - renderDelta * 1.4);
    lights.update(renderDelta);
    dust.update(renderDelta, agitation);
    sparks.update(renderDelta);

    opponent.update({
      state: match.opponent,
      position: match.opponentPosition(),
      dt: renderDelta,
      speed: match.opponent.speed
    });
    opponent.setFlash(match.opponent.flash);

    if (freeCamera) {
      // Visual-inspection mode: the camera and the view model are driven
      // externally, so neither the orbit nor the first-person rig may touch
      // them. Development affordance only; nothing in the game turns this on.
    } else if (phase === 'start') {
      // Arena overview: a slow orbit that shows the venue before the fight.
      orbit += renderDelta * 0.075;
      const radius = 7.6;
      rig.camera.position.set(Math.sin(orbit) * radius, 2.45 + Math.sin(orbit * 0.7) * 0.5, Math.cos(orbit) * radius);
      rig.camera.rotation.set(0, 0, 0);
      rig.camera.lookAt(_scratch.set(0, 1.15, 0));
      fists.root.visible = false;
    } else {
      fists.root.visible = true;
      rig.update({
        player: match.player,
        position: match.playerPosition(),
        previousPosition: match.playerPreviousPosition(),
        alpha,
        dt: renderDelta,
        sprinting: match.player.sprinting
      });
      fists.update({ player: match.player, dt: renderDelta });
    }

    hud.update(match.snapshot(), rig.damageLevel);

    if (showDiagnostics) {
      const info = renderer.info;
      hud.setDiagnostics(
        `${ENGINE_NAME} ${ENGINE_VERSION}\n`
        + `fps            ${fps.toFixed(1)}\n`
        + `draw calls     ${info.render.calls}\n`
        + `triangles      ${info.render.triangles}\n`
        + `geometries     ${info.memory.geometries}\n`
        + `textures       ${info.memory.textures}\n`
        + `programs       ${info.programs?.length ?? 0}\n`
        + `scene nodes    ${sceneArtifact.nodeCount}\n`
        + `placements     ${presentation.stats.placements}\n`
        + `asset uploads  ${presentation.stats.uploads}\n`
        + `asset build    ${assetBuildMs.toFixed(0)} ms\n`
        + `boot           ${(startedAt ? performance.now() - startedAt : 0).toFixed(0)} ms\n`
        + `sparks alive   ${sparks.alive}\n`
        + `sim ticks      ${clock.totalTicks}\n`
        + `match state    ${match.state.getState()}\n`
        + `opponent       ${match.opponent.state}\n`
        + `distance       ${match.distance().toFixed(2)} m\n`
        + `boxer          ${JSON.stringify(opponent.diagnostics())}\n`
        + `input          ${JSON.stringify(router.diagnostics())}`
      );
    }

    renderer.render(scene, rig.camera);
  }

  rafHandle = requestAnimationFrame(loop);

  return {
    scene,
    renderer,
    match,
    router,
    presentation,
    library,
    fists,
    opponent,
    sceneDefinition,
    sceneArtifact,
    sceneInstance,
    camera: rig.camera,

    /**
     * Hands camera control to an external inspector. Development affordance for
     * visual review; the game never enables it.
     *
     * @param {boolean} on
     */
    setFreeCamera(on) {
      freeCamera = Boolean(on);
    },

    /** @returns {object} A machine-readable boot report, also used by tests. */
    report() {
      return {
        engine: `${ENGINE_NAME} ${ENGINE_VERSION}`,
        assets: assets.size,
        materials: MATERIAL_DEFINITIONS.length,
        sceneId: sceneArtifact.id,
        sceneNodes: sceneArtifact.nodeCount,
        sceneHash: sceneArtifact.sourceHash,
        placements: presentation.stats.placements,
        uploads: presentation.stats.uploads,
        triangles: presentation.stats.triangles,
        unresolvedAssets: library.missingAssets,
        assetBuildMs: Math.round(assetBuildMs),
        drawCalls: renderer.info.render.calls,
        fps: Number(fps.toFixed(1)),
        phase,
        boxer: opponent.diagnostics()
      };
    },

    /** Tears the whole game down and releases every GPU and DOM resource. */
    dispose() {
      running = false;
      cancelAnimationFrame(rafHandle);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      hud.startButton.removeEventListener('click', beginFight);
      hud.pauseButton.removeEventListener('click', resume);
      hud.rematchButton.removeEventListener('click', rematch);
      router.detach();
      audio.dispose();
      hud.dispose();
      fists.dispose();
      opponent.dispose();
      sparks.dispose();
      dust.dispose();
      lights.dispose();
      presentation.dispose();
      library.dispose();
      sceneInstance.dispose();
      match.dispose();
      scene.clear();
      renderer.dispose();
      renderer.domElement.remove();
      stage.remove();
    }
  };
}
