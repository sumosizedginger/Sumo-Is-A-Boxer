import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiming } from '../src/game/validation/timing.js';
import { PRESETS, motionCamera } from '../src/game/validation/presets.js';

test('raw timing scopes contain lazy generation and navigation contains game boot', () => {
  let time = 12;
  const t = createTiming(10, () => time, 100000);
  time = 15; t.mark('assetBuildStart');
  time = 30; t.mark('assetBuildEnd'); t.mark('presentationStart');
  t.generation({ kind:'canvas', start:35, end:45 });
  t.generation({ kind:'skin', start:70, end:90 });
  time = 100; t.mark('presentationEnd');
  time = 120; t.mark('firstRAFStart');
  time = 200; t.mark('firstRenderedFrameEnd');
  const s = t.snapshot();
  assert.equal(s.durations.proceduralGenerationMs, 55);
  assert.equal(s.durations.proceduralGenerationWorkMs, 30);
  assert.equal(s.durations.presentationTotalMs, 70);
  assert.equal(s.durations.firstFrameSinceGameCreateMs, 188);
  assert.equal(s.durations.firstFrameSinceNavigationMs, 200);
  assert.ok(Object.values(s.checks).every(Boolean));
  assert.throws(() => t.mark('presentationEnd'), /reused/);
  s.markers.gameCreateStart = -1;
  assert.equal(t.snapshot().markers.gameCreateStart, 12);
});

test('timing invariant rejects a generation interval outside presentation', () => {
  let time = 10;
  const t = createTiming(0, () => time, 0);
  t.mark('presentationStart');
  t.generation({ kind:'canvas', start:5, end:25 });
  time = 20; t.mark('presentationEnd');
  assert.equal(t.snapshot().checks.presentationContainsGeneration, false);
  assert.equal(t.snapshot().durations.firstFrameSinceNavigationMs, null);
});

test('all ten presets and motion paths define finite reproducible transforms', () => {
  assert.equal(Object.keys(PRESETS).length, 10);
  for (const [name, p] of Object.entries(PRESETS)) {
    assert.ok(p.simulation.frozen && p.lighting.existingOnly && p.overlays.damageSuppressed);
    assert.ok(Math.abs(Math.hypot(...p.camera.quaternion) - 1) < 1e-12);
    for (const progress of [0,.5,1]) {
      const a = motionCamera(name, progress), b = motionCamera(name, progress);
      assert.deepEqual(a,b);
      assert.ok([...a.position,...a.quaternion,a.fov].every(Number.isFinite));
    }
  }
});
