import { spawn, execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, readFile, readdir, mkdtemp } from 'node:fs/promises';
import { resolve, join, relative } from 'node:path';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const root = resolve(import.meta.dirname, '..');
const output = join(root, 'validation', 'phase1');
const url = 'http://localhost:5180/?validation=phase1';
const files = [], checkpoints = [], browserEvents = [];
let child, cdp, manifest;
const hash = data => createHash('sha256').update(data).digest('hex');
async function save(name, value) {
  const data = Buffer.isBuffer(value) ? value : Buffer.from(JSON.stringify(value, null, 2) + '\n');
  await mkdir(resolve(output, name, '..'), { recursive: true });
  await writeFile(join(output, name), data);
  files.push({ path: name, bytes: data.length, sha256: hash(data) });
}
const git = (...args) => { try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).trim(); } catch { return null; } };
async function sourceHashes(dir) {
  const found = {};
  for (const e of await readdir(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'dist'].includes(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) Object.assign(found, await sourceHashes(p));
    else found[relative(root, p).replaceAll('\\', '/')] = hash(await readFile(p));
  }
  return found;
}
class CDP {
  constructor(socket) {
    this.socket = socket; this.id = 0; this.pending = new Map();
    socket.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      if (message.method === 'Fetch.requestPaused') {
        this.call('Fetch.fulfillRequest', { requestId: message.params.requestId, responseCode: 200, responseHeaders: [{name:'Content-Type',value:'text/javascript'}], body: '' }).catch(error => console.error(error.message));
        return;
      }
      if (message.id) {
        const pending = this.pending.get(message.id); if (!pending) return;
        this.pending.delete(message.id); clearTimeout(pending.timer);
        message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result);
      } else if (['Runtime.consoleAPICalled', 'Runtime.exceptionThrown', 'Log.entryAdded'].includes(message.method)) browserEvents.push(message);
    });
  }
  call(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = ++this.id;
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 120000);
      this.pending.set(id, { resolve, reject, timer }); this.socket.send(JSON.stringify({ id, method, params }));
    });
  }
  async evaluate(expression) {
    const result = await this.call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
}
const v = expression => cdp.evaluate(`window.__SUMO_IS_A_BOXER__.validation.${expression}`);
async function checkpoint(label) { checkpoints.push({ label, ...await v('diagnostics()') }); }

try {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(4000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); }
  catch { throw new Error('localhost:5180 is unavailable. From D:\\Boxing run: npm run dev -- --host 127.0.0.1 --port 5180'); }
  console.log('Local server reachable. Preparing isolated browser.');
  await mkdir(output, { recursive: true });
  const browserPath = [process.env.CHROME_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(p => p && existsSync(p));
  if (!browserPath) throw new Error('Chrome/Edge not found. Set CHROME_PATH to a Chromium browser executable.');
  const profile = await mkdtemp(join(tmpdir(), 'boxing-phase1-'));
  console.log('Hashing engine files for unchanged-source check.');
  const engineBefore = await sourceHashes(join(root, 'engine'));
  manifest = { status: 'RUNNING', timestamp: new Date().toISOString(), gitSHA: git('rev-parse', 'HEAD'), gitStatusBefore: git('status', '--short'),
    url, browserPath, profile, sourceHashes: { ...await sourceHashes(join(root, 'src')), ...await sourceHashes(join(root, 'scripts')) },
    viewport: { width: 1280, height: 720 }, devicePixelRatio: 1,
    sampling: { settleMs: 2000, durationMs: 5000, scene: 'Frozen guard and opponent, gloves_gameplay camera', order: ['off', 'on'] },
    simulationFrozen: true, particlesFrozen: true, dustHidden: true, damageOverlaysSuppressed: true,
    motion: { secondsPerClip: 24, fps: 30, cameraPath: 'Linear X translation +/-0.25m, lookAt fixed target, frozen pose', requestedFrameCount: 720 },
    acceptance: 'Evidence integrity only. Phase 1 awaits independent review.', limitations: [
      'Foreground vsync RAF measurements are not GPU execution time or active-combat measurements.',
      'Detail OFF retains procedural allocations; this is not a pre-feature boot/VRAM baseline.',
      'Motion holds poses fixed; camera sweeps do not establish skinning stability during punches.',
      'Existing scene lights only. Geometric subject coverage does not establish visible microdetail.',
      'GPU memory value is a procedural texture storage estimate, excluding driver overhead.',
      'MediaRecorder may drop/duplicate frames; requested camera frames and actual request times are saved.',
      'Fresh browser profile is retained in the OS temporary directory for diagnostics.',
      'Files from earlier runs may remain; only files listed with hashes belong to this run.'
    ] };
  console.log('Launching Chromium.');
  child = spawn(browserPath, [`--user-data-dir=${profile}`, '--remote-debugging-port=0', '--no-first-run', '--no-default-browser-check', '--window-size=1400,900', '--disable-backgrounding-occluded-windows', '--disable-renderer-backgrounding', '--disable-background-timer-throttling', 'about:blank'], { stdio: 'ignore' });
  child.on('error', error => console.error('Browser launch error:', error.message));
  let port;
  for (let i = 0; i < 100; i++) {
    try { port = Number((await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); break; } catch { await delay(100); }
  }
  if (!port) throw new Error('Browser did not open its debugging endpoint.');
  console.log('Connecting to browser debugging endpoint.');
  const tabs = await (await fetch(`http://127.0.0.1:${port}/json/list`, { signal: AbortSignal.timeout(10000) })).json();
  const socket = new WebSocket(tabs.find(t => t.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { const timer=setTimeout(()=>reject(new Error('Browser WebSocket connection timeout')),10000); socket.addEventListener('open', ()=>{clearTimeout(timer);resolve();}, { once: true }); socket.addEventListener('error', ()=>{clearTimeout(timer);reject(new Error('Browser WebSocket failed'));}, { once: true }); });
  cdp = new CDP(socket);
  console.log('Loading validation page.');
  await cdp.call('Runtime.enable'); await cdp.call('Log.enable'); await cdp.call('Page.enable');
  await cdp.call('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
  manifest.browser = await cdp.call('Browser.getVersion');
  manifest.backgroundThrottlingDisabled = true;
  const windowInfo = await cdp.call('Browser.getWindowForTarget');
  await cdp.call('Browser.setWindowBounds', { windowId: windowInfo.windowId, bounds: { windowState: 'normal' } });
  // Suppress only Vite's HMR client in this isolated evidence browser.
  await cdp.call('Fetch.enable', { patterns: [{ urlPattern: '*://localhost:5180/@vite/client*', requestStage: 'Request' }] });
  manifest.hmrClientSuppressed = true;
  const navigation = await cdp.call('Page.navigate', { url });
  if (navigation.errorText) throw new Error('Navigation failed: '+navigation.errorText);
  await cdp.call('Page.bringToFront');
  let ready = false;
  for (let i = 0; i < 120; i++) {
    ready = await cdp.evaluate('Boolean(window.__SUMO_IS_A_BOXER__?.validation && window.__SUMO_IS_A_BOXER__.report().timing.markers.firstRenderedFrameEnd)');
    if (ready) break; await delay(250);
  }
  if (!ready) {
    await save('boot_failure.json', await cdp.evaluate('({url:location.href,ready:document.readyState,body:document.body?.innerText,visibility:document.visibilityState,focused:document.hasFocus(),game:!!window.__SUMO_IS_A_BOXER__,report:window.__SUMO_IS_A_BOXER__?.report(),resources:performance.getEntriesByType("resource").map(r=>({name:r.name,duration:r.duration}))})'));
    throw new Error('Validation boot failed. See boot_failure.json; requires Vite development server and ?validation=phase1.');
  }
  manifest.environment = await cdp.evaluate('({userAgent:navigator.userAgent,devicePixelRatio,viewport:[innerWidth,innerHeight],visibility:document.visibilityState,focused:document.hasFocus()})');
  manifest.presets = await v('presets');
  const timings = await cdp.evaluate('window.__SUMO_IS_A_BOXER__.report().timing');
  await save('timing_markers.json', timings);
  if (Object.values(timings.checks).some(value => !value)) throw new Error('Timing containment invariant failed.');
  await checkpoint('boot');
  // Compile/warm all named views before measurements or resource comparisons.
  for (const name of Object.keys(manifest.presets)) { await v(`applyPreset(${JSON.stringify(name)})`); await v('setDetail(true)'); }
  console.log('Boot markers valid. Capturing ten frozen A/B pairs.');
  manifest.pairs = [];
  for (const name of Object.keys(manifest.presets)) {
    await v(`applyPreset(${JSON.stringify(name)})`); await v('settle(100)');
    const states = {};
    for (const enabled of [false, true]) {
      const label = enabled ? 'on' : 'off';
      await v(`setDetail(${enabled})`);
      states[label] = await v('state()');
      const image = await v('capture()');
      await save(`${name}_${label}.png`, Buffer.from(image.split(',')[1], 'base64'));
      const after = await v('state()');
      if (JSON.stringify(states[label]) !== JSON.stringify(after)) throw new Error(`Scene changed during capture: ${name}_${label}`);
    }
    if (JSON.stringify(states.off) !== JSON.stringify(states.on)) throw new Error(`A/B state mismatch: ${name}`);
    await save(`${name}_state.json`, states.off);
    const coverage = await v('coverage()');
    await save(`${name}_coverage.json`, coverage);
    manifest.pairs.push({ name, stateSHA256: hash(JSON.stringify(states.off)), stateEquality: true, targetCoverage: coverage.targetFraction });
    await checkpoint(name);
  }
  console.log('Sampling OFF then ON: 2-second settle, 5-second foreground RAF window each.');
  const samples = {};
  for (const enabled of [false, true]) {
    const label = enabled ? 'on' : 'off';
    await cdp.call('Page.bringToFront');
    samples[label] = await v(`sample(${enabled},2000,5000)`);
    // This object is returned directly by game.report(), never re-keyed or transcribed.
    await save(`raw_report_${label}.json`, samples[label].report);
    await save(`sample_${label}.json`, samples[label]);
  }
  await save('observed_frame_delta.json', { description: 'OBSERVED FRAME-TIME DELTA IN THIS SAMPLE',
    deltaOnMinusOffMs: Object.fromEntries(['p50','p95','p99'].map(k => [k, samples.on.frameTimeMs[k] - samples.off.frameTimeMs[k]])),
    interpretation: 'Identical values, if present, mean identical at recorded telemetry resolution; they do not establish zero overhead.' });
  await v('setDetail(true)');
  const cycles = [];
  for (let cycle = 0; cycle <= 3; cycle++) {
    if (cycle) await v(`reset(${cycle * 1111})`);
    await v('settle(1200)');
    const counts = await v('resources()');
    cycles.push({ cycle, seed: cycle ? cycle * 1111 : null, ...counts,
      deltaFromBaseline: cycle ? Object.fromEntries(['geometries','textures','programs'].map(k => [k, counts[k] - cycles[0][k]])) : { geometries:0,textures:0,programs:0 } });
  }
  const stable = cycles.every(c => Object.values(c.deltaFromBaseline).every(n => n === 0));
  await save('rematch_resources.json', { cycles, status: stable ? 'TRACKED GPU RESOURCE COUNTS STABLE' : 'TRACKED GPU RESOURCE COUNTS CHANGED',
    scope: 'Deterministic match.reset plus presentation resets, frozen renderer settling. Not a heap/VRAM leak proof or full played bouts.' });
  manifest.motionResults = [];
  for (const family of ['canvas','gloves','skin','concrete','steel']) {
    for (const enabled of [false,true]) {
      const label = enabled ? 'on' : 'off', name = `${family}_close`;
      console.log(`Recording ${family} ${label}: 24 seconds.`);
      await cdp.call('Page.bringToFront');
      const result = await v(`recordMotion(${JSON.stringify(name)},${enabled},24,30)`);
      if (result.fallback) {
        console.log(`Using deterministic frame sequence: ${result.reason}`);
        await v(`applyPreset(${JSON.stringify(name)})`); await v(`setDetail(${enabled})`);
        const sequence = [];
        for (let i = 0; i < 49; i++) {
          const camera = await v(`motionFrame(${JSON.stringify(name)},${i/48})`);
          const file = `${family}_motion_${label}/${String(i).padStart(3,'0')}.png`;
          await save(file, Buffer.from((await v('capture()')).split(',')[1], 'base64'));
          sequence.push({ index:i, nominalTimeSeconds:i/2, camera, file });
        }
        await save(`${family}_motion_${label}.json`, { ...result, method:'Frame-sequence evidence, not full motion recording', sequence });
      } else {
        await save(`${family}_motion_${label}.webm`, Buffer.from(result.dataUrl.split(',')[1], 'base64'));
        delete result.dataUrl;
        await save(`${family}_motion_${label}.json`, result);
      }
      manifest.motionResults.push({ family, enabled, fallback: Boolean(result.fallback) });
    }
  }
  await checkpoint('final');
  await save('webgl_diagnostics.json', { checkpoints, browserEvents,
    warningScope:'All observable browser console/log entries retained, including WebGL/texture warnings; absence is limited to this session.' });
  manifest.proceduralMaterials = await cdp.evaluate('window.__SUMO_IS_A_BOXER__.surfaceDetail.stats()');
  manifest.engineUnchanged = JSON.stringify(engineBefore) === JSON.stringify(await sourceHashes(join(root, 'engine')));
  manifest.sourceUnchangedDuringRun = JSON.stringify(manifest.sourceHashes) === JSON.stringify({ ...await sourceHashes(join(root,'src')), ...await sourceHashes(join(root,'scripts')) });
  if (!manifest.engineUnchanged || !manifest.sourceUnchangedDuringRun) throw new Error('Source changed during evidence run.');
  if (!stable) throw new Error('Tracked resource count stability check failed.');
  if (checkpoints.some(c => c.contextLost || c.drainedErrors.some(n => n !== 0) || c.shaderErrors.length || c.programs.some(p => !p.linked)) || browserEvents.some(e => e.method === 'Runtime.exceptionThrown')) throw new Error('Observable runtime/GL/shader diagnostics failed; inspect webgl_diagnostics.json.');
  manifest.status = 'BUILT - AWAITING INDEPENDENT REVIEW';
  manifest.completedAt = new Date().toISOString(); manifest.gitStatusAfter = git('status','--short');
  await save('manifest.json', { ...manifest, files: [...files, { path:'manifest.json', note:'Self hash excluded' }] });
  console.log(`PHASE1-EVIDENCE-HARNESS: evidence written to ${output}. AWAITING INDEPENDENT REVIEW.`);
} catch (error) {
  console.error(`PHASE1-EVIDENCE-HARNESS FAILED: ${error.message}`);
  if (manifest) {
    await save('failure.json', { error: error.stack, checkpoints, browserEvents });
    await save('manifest.json', { ...manifest, status:'FAILED - INCOMPLETE EVIDENCE', files:[...files,{path:'manifest.json'}] });
  }
  process.exitCode = 1;
} finally {
  if (cdp) { try { await cdp.call('Browser.close'); } catch {} cdp.socket.close(); }
  if (child && child.exitCode === null) child.kill();
}
