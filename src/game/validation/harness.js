import { Raycaster, Vector2 } from 'three';
import { PRESETS, motionCamera } from './presets.js';

const copy = value => JSON.parse(JSON.stringify(value));
const nextFrame = () => new Promise(resolve => requestAnimationFrame(resolve));
const percentile = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? null;

export function createValidation({ game, rig, sparks, lights }) {
  const { renderer, scene, camera, match, opponent, fists, surfaceDetail } = game;
  const shaderErrors = [];
  renderer.debug.checkShaderErrors = true;
  renderer.debug.onShaderError = (gl, program, vertex, fragment) => shaderErrors.push({
    timestamp: performance.now(), linkStatus: gl.getProgramParameter(program, gl.LINK_STATUS),
    programLog: gl.getProgramInfoLog(program),
    vertex: { compiled: gl.getShaderParameter(vertex, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(vertex) },
    fragment: { compiled: gl.getShaderParameter(fragment, gl.COMPILE_STATUS), log: gl.getShaderInfoLog(fragment) }
  });
  let activePreset = null;
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
    for (let i = 0; i < p.posePreparation.steps; i++) {
      opponent.update({ state: match.opponent, position: { x: 0, y: 0, z: 0 }, dt: p.posePreparation.dt, speed: 0 });
      fists.update({ player: match.player, dt: p.posePreparation.dt });
    }
    opponent.group.position.fromArray(p.opponent.position);
    opponent.group.visible = p.opponent.visible;
    fists.root.visible = p.player.viewmodelVisible;
    setCamera(p.camera);
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
  applyPreset('gloves_gameplay', 1111, false);
  return { presets: copy(PRESETS), frame: render, render, applyPreset, state, coverage, resources, diagnostics, sample, settle, recordMotion,
    setDetail: enabled => { surfaceDetail.setEnabled(enabled); render(); },
    capture: () => { render(); return renderer.domElement.toDataURL('image/png'); },
    motionFrame: (name, progress) => { setCamera(motionCamera(name, progress)); render(); return state().camera; },
    reset: seed => { applyPreset('gloves_gameplay', seed); opponent.group.visible = true; render(); return resources(); } };
}
