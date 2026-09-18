import { createModelInspection } from './models.js';
import { createTopologyInspection } from './topology.js';
import { Raycaster, Vector2, DirectionalLight, HemisphereLight, Object3D, Color, Mesh, PlaneGeometry, MeshStandardMaterial } from 'three';
import { PRESETS, motionCamera } from './presets.js';

const copy = value => JSON.parse(JSON.stringify(value));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;

export function createValidation({ game, rig, sparks, lights, modelMode=false, topologyMode=false, voxelMode=false }) {
  const { renderer, scene, camera, match, opponent, fists, surfaceDetail, presentation } = game;
  const shaderErrors = [];
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => shaderErrors.push({
    timestamp: performance.now(), linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
    programLog: gl.getProgramInfoLog(program),
    vertex: { compiled: gl.getShaderParameter(vertex, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(vertex) },
    fragment: { compiled: gl.getShaderParameter(fragment, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(fragment) }
  });
  let activePreset = null;

  // Dedicated neutral clay presentation lighting
  const clayLightGroup = new Object3D();
  clayLightGroup.name = 'clay-light-rig';
  const clayKey = new DirectionalLight(0xffffff, 2.4);
  clayKey.position.set(2.5, 3.8, 3.2);
  clayKey.castShadow = true;
  clayKey.shadow.mapSize.set(1024, 1024);
  clayKey.shadow.bias = -0.0003;
  clayLightGroup.add(clayKey);

  const clayFill = new DirectionalLight(0xd5e3f5, 1.4);
  clayFill.position.set(-2.8, 2.2, 2.4);
  clayLightGroup.add(clayFill);

  const clayRim = new DirectionalLight(0xffecd6, 1.8);
  clayRim.position.set(0.2, 3.5, -2.8);
  clayLightGroup.add(clayRim);

  const clayAmbient = new HemisphereLight(0xf4f7fa, 0x545860, 1.0);
  clayLightGroup.add(clayAmbient);

  const clayFloor = new Mesh(new PlaneGeometry(12, 12), new MeshStandardMaterial({ color: 0x30343a, roughness: 0.95 }));
  clayFloor.name = 'clay-contact-plane';
  clayFloor.rotation.x = -Math.PI / 2;
  clayFloor.position.y = 0.001;
  clayFloor.receiveShadow = true;
  clayLightGroup.add(clayFloor);

  scene.add(clayLightGroup);
  clayLightGroup.visible = false;

  let originalSceneEnv = null;

  function setPresentation(mode) {
    if (!originalSceneEnv) {
      originalSceneEnv = {
        fog: scene.fog,
        background: scene.background ? scene.background.clone() : null
      };
    }
    const guide = opponent?.character?.material;
    const voxels = opponent?.voxel?.runtime?.object3D;
    const voxelMat = opponent?.voxel?.runtime?.material;
    const name = String(mode || 'VOXEL_CLAY').toUpperCase();

    if (guide) {
      guide.visible = (name === 'GUIDE' || name === 'WIREFRAME');
      guide.wireframe = (name === 'WIREFRAME');
    }

    if (voxels) {
      voxels.visible = (name !== 'GUIDE' && name !== 'WIREFRAME');
    }

    if (presentation?.root) {
      presentation.root.visible = (name === 'PERFORMANCE' || name === 'PRODUCTION');
    }
    opponent?.group?.traverse(o => {
      if (o.isMesh && (o.name.includes('hair') || o.name.includes('asset.hero.hair') || o.name.includes('boxer-hair'))) {
        o.visible = false;
      }
    });

    if (name === 'SILHOUETTE') {
      if (lights?.group) lights.group.visible = false;
      clayLightGroup.visible = false;
      scene.fog = null;
      scene.background = new Color(0xeef0f2);
      if (voxelMat) {
        voxelMat.color.setHex(0x000000);
        voxelMat.emissive.setHex(0x000000);
        voxelMat.vertexColors = false;
        voxelMat.roughness = 1.0;
        voxelMat.metalness = 0.0;
        voxelMat.wireframe = false;
        voxelMat.needsUpdate = true;
      }
    } else if (name === 'VOXEL_CLAY') {
      if (lights?.group) lights.group.visible = false;
      clayLightGroup.visible = true;
      scene.fog = null;
      scene.background = new Color(0x3a3f47);
      if (voxelMat) {
        voxelMat.color.setHex(0xd0b8a4);
        voxelMat.emissive.setHex(0x000000);
        voxelMat.vertexColors = false;
        voxelMat.roughness = 0.70;
        voxelMat.metalness = 0.02;
        voxelMat.wireframe = false;
        voxelMat.needsUpdate = true;
      }
    } else if (name === 'VOXEL_COLOR' || name === 'VOXEL') {
      if (lights?.group) lights.group.visible = false;
      clayLightGroup.visible = true;
      scene.fog = null;
      scene.background = new Color(0x282c34);
      if (voxelMat) {
        voxelMat.color.setHex(0xffffff);
        voxelMat.emissive.setHex(0x000000);
        voxelMat.vertexColors = false;
        voxelMat.roughness = 0.68;
        voxelMat.metalness = 0.02;
        voxelMat.wireframe = false;
        voxelMat.needsUpdate = true;
      }
    } else if (name === 'GRID' || name === 'SEMANTIC') {
      if (lights?.group) lights.group.visible = false;
      clayLightGroup.visible = true;
      scene.fog = null;
      scene.background = new Color(0x32363e);
      if (voxelMat) {
        voxelMat.color.setHex(0xffffff);
        voxelMat.emissive.setHex(0x000000);
        voxelMat.vertexColors = false;
        voxelMat.roughness = 0.60;
        voxelMat.metalness = 0.05;
        voxelMat.wireframe = (name === 'GRID');
        voxelMat.needsUpdate = true;
      }
    } else if (name === 'GUIDE' || name === 'WIREFRAME') {
      if (lights?.group) lights.group.visible = false;
      clayLightGroup.visible = true;
      scene.fog = null;
      scene.background = new Color(0x3a3f47);
    } else if (name === 'PERFORMANCE') {
      if (lights?.group) lights.group.visible = true;
      clayLightGroup.visible = false;
      scene.fog = originalSceneEnv.fog;
      scene.background = originalSceneEnv.background;
      if (voxelMat) {
        voxelMat.color.setHex(0xffffff);
        voxelMat.vertexColors = true;
        voxelMat.wireframe = false;
        voxelMat.needsUpdate = true;
      }
    } else {
      if (lights?.group) lights.group.visible = true;
      clayLightGroup.visible = false;
      scene.fog = originalSceneEnv.fog;
      scene.background = originalSceneEnv.background;
    }
  }

  function setCamera(transform) {
    camera.position.fromArray(transform.position);
    camera.quaternion.fromArray(transform.quaternion);
    camera.fov = transform.fov;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
  }
  function render() { renderer.render(scene, camera); }
  function applyPreset(name, seed = 1111, shouldRender = true) {
    const p = PRESETS[name];
    if (!p) throw new Error(`Unknown validation preset: ${name}`);
    activePreset = name;
    match.reset(seed);
    match.drainEvents();
    rig.reset(); sparks.clear(); opponent.reset(); opponent.setFlash(0); fists.reset();
    Object.assign(match.player, { yaw: p.player.yaw });
    Object.assign(match.opponent, { yaw: p.opponent.yaw, state: 'idle', speed: 0 });
    const isSumoNeutral = p.opponent.pose === 'sumo_neutral';
    for (let i = 0; i < p.posePreparation.steps; i++) {
      opponent.update({
        state: match.opponent,
        position: { x: 0, y: 0, z: 0 },
        dt: p.posePreparation.dt,
        speed: 0,
        inspection: {
          pose: p.opponent.pose ?? 'sumo_neutral',
          stanceWidth: isSumoNeutral ? 0.38 : 0.225,
          stagger: !isSumoNeutral
        }
      });
      fists.update({ player: match.player, dt: p.posePreparation.dt });
    }
    opponent.group.position.fromArray(p.opponent.position);
    opponent.group.visible = p.opponent.visible;
    fists.root.visible = p.player.viewmodelVisible;
    setCamera(p.camera);
    if (p.presentationMode) {
      setPresentation(p.presentationMode);
    } else if (voxelMode) {
      setPresentation('VOXEL_CLAY');
    }
    if (shouldRender) render();
    return state();
  }
  function state() {
    scene.updateMatrixWorld(true);
    const nodes = [];
    scene.traverse(o => nodes.push({ name: o.name, type: o.type, visible: o.visible,
      matrix: o.matrix.toArray(), ...(o.isLight ? { intensity: o.intensity, color: o.color.toArray() } : {}) }));
    return { preset: activePreset, camera: { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov },
      match: copy(match.snapshot()), nodes, conditions: PRESETS[activePreset] };
  }
  function resources() {
    return { timestamp: performance.now(), geometries: renderer.info.memory.geometries,
      textures: renderer.info.memory.textures, programs: renderer.info.programs.length };
  }
  function coverage() {
    scene.updateMatrixWorld(true);
    const ray = new Raycaster(), hits = [];
    const meshes = [];
    scene.traverseVisible(o => { if (o.isMesh) meshes.push(o); });
    for (let y = 0; y < 9; y++) for (let x = 0; x < 13; x++) {
      ray.setFromCamera(new Vector2((x + .5) / 13 * 2 - 1, 1 - (y + .5) / 9 * 2), camera);
      const h = ray.intersectObjects(meshes, false)[0];
      const material = h ? (Array.isArray(h.object.material) ? h.object.material[h.face.materialIndex] : h.object.material) : null;
      const kind = material?.customProgramCacheKey().match(/vq003-surface-v1\|(\w+)/)?.[1] ?? null;
      hits.push({ x, y, object: h?.object.name ?? null, asset: h?.object.userData.asset ?? null, material: material?.name ?? null, detailKind: kind });
    }
    return { method: '13x9 first-visible-mesh ray grid; geometric coverage, not a visual-quality score', hits,
      targetFraction: hits.filter(h => h.detailKind === PRESETS[activePreset].subject).length / hits.length };
  }
  async function settle(durationMs) {
    const start = performance.now();
    while (performance.now() - start < durationMs) {
      await nextFrame();
      if (document.visibilityState !== 'visible') throw new Error('Validation lost foreground focus');
    }
  }
  async function sample(enabled, settleMs = 2000, durationMs = 5000) {
    applyPreset('gloves_gameplay');
    // Representative static fighter scene for both timing samples.
    opponent.group.visible = true;
    surfaceDetail.setEnabled(enabled);
    await settle(settleMs);
    const sampleStartTimestamp = await nextFrame();
    let previous = sampleStartTimestamp;
    const frames = [];
    do {
      const timestamp = await nextFrame();
      if (document.visibilityState !== 'visible') throw new Error('Sample lost foreground focus');
      frames.push({ timestamp, frameTimeMs: timestamp - previous, drawCalls: renderer.info.render.calls, renderedTriangles: renderer.info.render.triangles });
      previous = timestamp;
    } while (previous - sampleStartTimestamp < durationMs);
    const sorted = frames.map(f => f.frameTimeMs).sort((a, b) => a - b);
    return { enabled, sampleStartTimestamp, sampleEndTimestamp: previous, sampleDurationMs: previous - sampleStartTimestamp,
      sampleFrameCount: frames.length, requestedDurationMs: durationMs, settleMs,
      method: 'Foreground RAF intervals, frozen scene, vsync-limited; not GPU execution time or combat benchmark',
      fps: frames.length * 1000 / (previous - sampleStartTimestamp),
      frameTimeMs: { p50: percentile(sorted, .5), p95: percentile(sorted, .95), p99: percentile(sorted, .99) },
      frames, report: game.report(), resources: resources(), visibility: document.visibilityState, focused: document.hasFocus() };
  }
  function diagnostics() {
    const gl = renderer.getContext();
    const errors = [];
    for (let i = 0; i < 32; i++) { const code = gl.getError(); errors.push(code); if (code === gl.NO_ERROR) break; }
    return { timestamp: performance.now(), glGetError: errors[0], drainedErrors: errors, contextLost: gl.isContextLost(), shaderErrors: copy(shaderErrors),
      programs: renderer.info.programs.map(p => ({ name: p.name, linked: gl.getProgramParameter(p.program, gl.LINK_STATUS), log: gl.getProgramInfoLog(p.program) })),
      interpretation: 'NO_ERROR means no pending GL error at this checkpoint. It does not prove absence of stalls or memory leaks.' };
  }
  async function recordMotion(presetName, enabled, durationSeconds = 24, fps = 30) {
    if (!HTMLCanvasElement.prototype.captureStream || !globalThis.MediaRecorder) return { fallback: true, reason: 'captureStream or MediaRecorder unavailable' };
    const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'].find(t => MediaRecorder.isTypeSupported(t));
    if (!mimeType) return { fallback: true, reason: 'WebM encoding unsupported' };
    applyPreset(presetName); surfaceDetail.setEnabled(enabled);
    const stream = renderer.domElement.captureStream(0), track = stream.getVideoTracks()[0];
    if (!track.requestFrame) { stream.getTracks().forEach(t => t.stop()); return { fallback: true, reason: 'Manual capture frame requests unavailable' }; }
    const chunks = [], recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 6000000 });
    const completed = new Promise((resolve, reject) => { recorder.onstop = resolve; recorder.onerror = e => reject(new Error(e.error?.message ?? 'Recorder failure')); });
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    const frames = [], count = Math.round(durationSeconds * fps), start = performance.now();
    recorder.start();
    try {
      for (let i = 0; i < count; i++) {
        const transform = motionCamera(presetName, i / (count - 1));
        setCamera(transform); render(); track.requestFrame();
        frames.push({ index: i, nominalTimeMs: i * 1000 / fps, timestamp: performance.now(), camera: transform });
        await new Promise(resolve => setTimeout(resolve, Math.max(0, start + (i + 1) * 1000 / fps - performance.now())));
        if (document.visibilityState !== 'visible') throw new Error('Motion capture lost foreground focus');
      }
    } finally { recorder.stop(); await completed; stream.getTracks().forEach(t => t.stop()); }
    const blob = new Blob(chunks, { type: mimeType });
    const dataUrl = await new Promise(resolve => { const r = new FileReader(); r.onload = () => resolve(r.result); r.readAsDataURL(blob); });
    return { dataUrl, mimeType, requestedDurationSeconds: durationSeconds, actualDurationMs: performance.now() - start, fps, frames,
      method: 'Canvas captureStream(0), requestFrame, MediaRecorder. Exact indexed camera path; encoder delivery/timestamps may differ. Pose held fixed, no punch/deformation claim.' };
  }
  if (!topologyMode) applyPreset(voxelMode ? 'voxel_hero' : 'gloves_gameplay', 1111, false);
  const models = modelMode ? createModelInspection(game) : null;
  const topology = topologyMode ? createTopologyInspection(game) : null;
  const voxel = voxelMode ? {
    metrics: () => opponent.diagnostics().voxel,
    setPresentation(mode) {
      setPresentation(mode);
      render();
    }
  } : null;
  return {
    models, topology, voxel,
    dispose() {
      models?.dispose();
      topology?.dispose();
      clayLightGroup.traverse(o => { if (o.dispose) o.dispose(); });
      clayLightGroup.removeFromParent();
    },
    presets: copy(PRESETS), frame: now=>{models?.frame(now); topology?.frame(now); render();}, render, applyPreset, state, coverage, resources, diagnostics, sample, settle, recordMotion,
    setDetail: enabled => { surfaceDetail.setEnabled(enabled); render(); },
    capture: () => { render(); return renderer.domElement.toDataURL('image/png'); },
    motionFrame: (name, progress) => { setCamera(motionCamera(name, progress)); render(); return state().camera; },
    reset: seed => { applyPreset(voxelMode ? 'voxel_hero' : 'gloves_gameplay', seed); opponent.group.visible = true; render(); return resources(); }
  };
}
