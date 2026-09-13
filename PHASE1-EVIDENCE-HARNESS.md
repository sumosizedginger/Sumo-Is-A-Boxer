PHASE1-EVIDENCE-HARNESS

STATUS: BUILT - AWAITING INDEPENDENT REVIEW

Run from D:\Boxing:

```powershell
npm run validate:phase1
```

The command connects to http://localhost:5180. If the server is unavailable it
exits with an explicit instruction to start it in another terminal:

```powershell
npm run dev -- --host 127.0.0.1 --port 5180
```

Requires Node 24 and installed Chrome or Edge. CHROME_PATH may specify another
Chromium executable. No browser automation package, engine change, camera
positioning, or manual capture is required. A fresh, visible browser window is
opened and closed by the runner. Keep its tab visible during the run. Allow about
five minutes, including ten 24-second video recordings. No Phase 2 work is run.

Output: D:\Boxing\validation\phase1\

Read manifest.json first. Its status identifies complete versus failed evidence;
its file inventory and SHA-256 hashes identify the artifacts belonging to that
run. Older files may remain in the directory and are not evidence for the current
run unless included in that inventory. Existing earlier manually produced
phase1_validation artifacts are not consumed or overwritten by this workflow.

Instrumentation repair

The old source used a monotonic subtraction for both boot durations. The supplied
contradictory report could not be reproduced from those formulas: its manually
reported values did not establish a source arithmetic defect. The instrumentation
gap was lack of exported raw markers, named nested scopes, and enforced timing
invariants. Presentation timing was expressed as a subtraction from asset setup;
procedural generation was a sum of disjoint lazy generation intervals.

The new game-owned timing module stores raw performance.now() markers and
performance.timeOrigin. Navigation's relative origin is zero. Entry-module body
execution is appBootstrapStart; static import evaluation precedes it. Markers
cannot be silently overwritten. Each texture has its own start/end record.

Derived durations are unrounded in timing_markers.json:

- assetBuildMs: assetBuildEnd minus assetBuildStart.
- presentationTotalMs: presentationEnd minus presentationStart, including scene,
  lazy material generation, lighting, VFX and fighter setup.
- proceduralGenerationMs: envelope from the first texture start to the last
  texture end. Interleaved presentation work is included in this envelope.
- proceduralGenerationWorkMs: sum of per-texture intervals; CPU generation and
  texture-object preparation only. The existing proceduralMaterials.generationMs
  field retains this sum for compatibility.
- firstFrameSinceGameCreateMs: firstRenderedFrameEnd minus gameCreateStart.
- firstFrameSinceNavigationMs: firstRenderedFrameEnd minus navigationOrigin.

The first-render marker records CPU return from the first RAF renderer.render,
not GPU completion or display scanout. Validation pose preparation occurs before
that first RAF and is included in validation boot latency. These are validation
page boot measurements, not a substitute for normal gameplay boot benchmarking.

The runner fails if navigation does not contain game creation or presentation
does not contain procedural generation. Tests exercise both valid and invalid
marker orderings. The ordinary game loop continues to populate compatibility
report fields; validation also maintains its normal rolling frame telemetry.

Capture automation

Only a Vite development build with ?validation=phase1 exposes game.validation.
The game loop takes a renderer-only branch. Match stepping, opponent animation,
viewmodel animation, light flicker, camera response and particle updates stop.
Input is detached, HUD hidden, damage response reset, sparks cleared, and dust
hidden. Existing lights are evaluated at time zero and held. No extra lights,
exposure changes, engine APIs, or material amplitudes are introduced.

Each named preset resets the match and presentation to a documented seed and
uses 60 deterministic presentation-only pose preparation steps. Match simulation
never advances. The saved state contains the actual match snapshot, all scene
node local matrices, visibility, light colors/intensities, camera quaternion and
FOV. OFF and ON reuse the same prepared state. The material uniform is the only
intentional difference. The runner checks exact serialized scene-state equality
before/after capture and across the pair, failing on drift.

Each preset includes a first-visible-mesh ray grid identifying material detail
bindings. Concrete views look toward warehouse concrete by the loading-door work
lamp. Steel views target the bound overhead gantry, not unbound corner padding.
Coverage indicates geometric subject presence, not visible texture quality. Dark
steel is preserved under existing lighting for independent review.

Sampling and diagnostics

OFF then ON each use a 2-second settle and at least 5 seconds of foreground-tab
RAF intervals. Raw timestamps, interval samples, frame count, actual elapsed
duration, per-frame calls/triangles and untouched game.report() objects are saved.
Raw report objects retain the game's short rolling frame window; sample files
contain the separately measured full 5-second windows used for the delta.

The browser tab is brought forward before sampling. Document visibility is
checked throughout. OS focus is recorded, not emulated or required; another
application may have keyboard focus while this tab remains visible. Chromium
occlusion/background throttling is disabled explicitly and recorded. Vite's HMR
client is suppressed only inside this isolated browser, preventing output-file
writes or development hot reload from silently changing a capture session.

Results are labeled OBSERVED FRAME-TIME DELTA IN THIS SAMPLE. Vsync-limited RAF
intervals cannot establish zero overhead, GPU execution cost, or combat frame
pacing. OFF retains the same texture allocations and shaders as ON.

WebGL checkpoints retain gl.getError results, program link states/logs, and shader
failure logs. Browser console/log events and uncaught exceptions are retained.
NO_ERROR describes only pending GL errors at the checkpoint. It does not imply
absence of stalls, visual defects, or memory leaks.

With detail enabled, cycle0 and each of three seeded reset cycles are recorded
after a 1.2-second renderer settle. All tested counts must equal baseline for the
runner's conservative TRACKED GPU RESOURCE COUNTS STABLE result. These counters
do not measure actual heap/VRAM bytes or prove zero memory leaks.

Motion evidence

Five material families each receive OFF and ON WebM recordings through browser
canvas.captureStream(0), requestFrame and MediaRecorder. Each clip requests 720
indexed camera positions over 24 seconds at 30 fps. Positions and orientations
follow the same deterministic slow sweep; the fighter poses and lighting remain
fixed. Per-frame requested transforms, nominal times and actual request times
are exported alongside every clip. Codec support determines VP9/VP8 selection.

If native manual-frame WebM capture is unavailable, the runner saves 49 PNGs on
the same path with nominal positions spanning 24 seconds. Such output is labeled
frame-sequence evidence, not full motion recording. Encoder scheduling can drop
or duplicate video frames. These sweeps support camera-motion inspection; they
do not establish animation/skinning stability during punches or recoil.

Files changed for the harness

- package.json: validate:phase1 command.
- src/main.js: entry-module bootstrap marker.
- src/game/app.js: explicit timing scopes and isolated validation loop.
- src/game/presentation/procedural-materials.js: raw generation interval callback.
- src/game/validation/timing.js: markers, durations, semantics, invariants.
- src/game/validation/presets.js: ten cameras and deterministic motion paths.
- src/game/validation/harness.js: frozen capture, sampling, diagnostics and video.
- scripts/validate-phase1.mjs: dependency-free Chromium DevTools runner/exporter.
- tests/validation-timing.test.js: timing invariants and preset reproducibility.
- PHASE1-EVIDENCE-HARNESS.md: this operating record.

The repository already contained a modified README and substantial untracked
game code, tests and evidence. This work does not commit, reset, stage or clean
those files. Each successful manifest records git SHA, before/after status,
source hashes and whether engine files remained unchanged during the run.
