// All markers use the same monotonic performance clock, milliseconds since navigation.
export function createTiming(appBootstrapStart, now = () => performance.now(), timeOrigin = performance.timeOrigin) {
  const markers = { navigationOrigin: 0, appBootstrapStart, gameCreateStart: now() };
  const generationIntervals = [];
  return {
    mark(name) {
      if (name in markers) throw new Error(`Timing marker reused: ${name}`);
      return markers[name] = now();
    },
    generation(interval) {
      generationIntervals.push({ ...interval });
      markers.proceduralGenerationStart ??= interval.start;
      markers.proceduralGenerationEnd = interval.end;
    },
    has(name) { return name in markers; },
    snapshot() {
      const duration = (a, b) => a in markers && b in markers ? markers[b] - markers[a] : null;
      const durations = {
        assetBuildMs: duration('assetBuildStart', 'assetBuildEnd'),
        presentationTotalMs: duration('presentationStart', 'presentationEnd'),
        proceduralGenerationMs: duration('proceduralGenerationStart', 'proceduralGenerationEnd'),
        proceduralGenerationWorkMs: generationIntervals.reduce((n, i) => n + i.end - i.start, 0),
        firstFrameSinceGameCreateMs: duration('gameCreateStart', 'firstRenderedFrameEnd'),
        firstFrameSinceNavigationMs: duration('navigationOrigin', 'firstRenderedFrameEnd')
      };
      const checks = {
        presentationContainsGeneration: durations.presentationTotalMs === null || durations.proceduralGenerationMs === null ||
          (markers.presentationStart <= markers.proceduralGenerationStart && markers.proceduralGenerationEnd <= markers.presentationEnd),
        navigationContainsGameCreate: markers.navigationOrigin <= markers.gameCreateStart &&
          (durations.firstFrameSinceNavigationMs === null || durations.firstFrameSinceNavigationMs >= durations.firstFrameSinceGameCreateMs)
      };
      return { clock: 'performance.now(), milliseconds relative to performance.timeOrigin', timeOrigin,
        markers: { ...markers }, generationIntervals: generationIntervals.map(i => ({ ...i })), durations, checks,
        semantics: {
          proceduralGenerationMs: 'Envelope from first lazy texture generation start to last end; includes interleaved setup.',
          proceduralGenerationWorkMs: 'Sum of disjoint per-texture CPU generation/allocation intervals; excludes GPU upload.',
          presentationTotalMs: 'Scene composition, material preparation, lights, VFX and fighter presentation.',
          firstRenderedFrameEnd: 'CPU return from first renderer.render; not GPU completion or screen presentation.',
          appBootstrapStart: 'Entry-module body start after static imports have evaluated.'
        } };
    }
  };
}
