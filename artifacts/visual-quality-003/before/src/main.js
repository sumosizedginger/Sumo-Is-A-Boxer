/**
 * SUMO IS A BOXER — browser entry point.
 *
 * The engine is consumed through its published package specifier
 * (`@sumosizedginger/my-game-engine-1.0/full`), never through a relative path
 * into `engine/src/**`. If the game can be built this way, an external
 * developer can build one too — which is the whole question this benchmark
 * exists to answer.
 */

import { createGame } from './game/app.js';

const host = document.getElementById('app');

try {
  const game = createGame(host);
  // Exposed for headless inspection and for the human running the build.
  window.__SUMO_IS_A_BOXER__ = game;
} catch (error) {
  console.error('[SUMO IS A BOXER] boot failed', error);
  const panel = document.createElement('pre');
  panel.style.cssText = 'position:fixed;inset:24px;color:#ff9a80;font:12px/1.6 ui-monospace,monospace;'
    + 'white-space:pre-wrap;background:#0a0a0c;padding:24px;border:1px solid #612;overflow:auto;z-index:99';
  panel.textContent = `BOOT FAILED\n\n${error?.stack ?? error}`;
  host.append(panel);
}
