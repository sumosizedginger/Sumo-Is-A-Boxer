/**
 * SUMO IS A BOXER — architectural guard.
 *
 * THE ENGINE IS A CONSUMER DEPENDENCY. This test is the thing that keeps it one.
 *
 * It asserts, by scanning the game's own source, that:
 *   1. every engine import goes through the published package specifier;
 *   2. nothing deep-imports `engine/src/**` or reaches across with `../engine`;
 *   3. every engine name the game imports is actually exported by engine/full;
 *   4. engine changes remain inside the explicitly authorized foundation scope.
 *
 * If someone later "fixes" a problem by reaching into the engine, this fails.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const GAME = join(ROOT, 'src');
const PACKAGE = '@sumosizedginger/my-game-engine-1.0';

/**
 * @param {string} dir
 * @returns {string[]}
 */
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (entry.endsWith('.js')) out.push(full);
  }
  return out;
}

const files = walk(GAME);

test('the game has source files to check', () => {
  assert.ok(files.length > 10, `expected a real game tree, found ${files.length} files`);
});

test('every engine import uses the published package specifier', () => {
  const offenders = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
      const specifier = match[1];
      const mentionsEngine = specifier.includes('my-game-engine')
        || specifier.includes('/engine/')
        || specifier.startsWith('../engine')
        || specifier.includes('engine/src');
      if (!mentionsEngine) continue;
      if (specifier !== PACKAGE && specifier !== `${PACKAGE}/full` && specifier !== `${PACKAGE}/runtime`) {
        offenders.push(`${relative(ROOT, file)} -> ${specifier}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `unsupported engine import route:\n${offenders.join('\n')}`);
});

test('no file reaches into engine internals by any path form', () => {
  const offenders = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    // Only actual import/require specifiers count; the words appear in prose.
    for (const match of source.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
      if (/engine[\\/]src[\\/]/.test(match[1])) offenders.push(`${relative(ROOT, file)} -> ${match[1]}`);
    }
  }
  assert.deepEqual(offenders, [], `deep import into engine internals:\n${offenders.join('\n')}`);
});

test('every engine name the game imports is on the public surface', async () => {
  const surface = await import(`${PACKAGE}/full`);
  const exported = new Set(Object.keys(surface));
  const missing = [];

  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const pattern = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${PACKAGE.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}(?:/full|/runtime)?['"]`, 'g');
    for (const match of source.matchAll(pattern)) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (!name) continue;
        if (!exported.has(name)) missing.push(`${relative(ROOT, file)} imports "${name}"`);
      }
    }
  }

  assert.deepEqual(missing, [], `not on the engine public surface:\n${missing.join('\n')}`);
});

test('the game imports only from a documented set of engine capabilities', async () => {
  const surface = await import(`${PACKAGE}/full`);
  const used = new Set();
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const pattern = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['"]${PACKAGE.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&')}(?:/full|/runtime)?['"]`, 'g');
    for (const match of source.matchAll(pattern)) {
      for (const raw of match[1].split(',')) {
        const name = raw.trim().split(/\s+as\s+/)[0].trim();
        if (name) used.add(name);
      }
    }
  }
  // Evidence, not a constraint: the handoff quotes this list, so it must be
  // derived from the code rather than typed by hand.
  assert.ok(used.size >= 25, `expected broad engine use, saw ${used.size} names`);
  for (const name of used) assert.ok(name in surface, `${name} missing from engine/full`);
});

test('the game still consumes the engine only as a package, including Voxel Forge', () => {
  // VOXEL-PIVOT-001 authorizes a reusable Voxel Forge inside the engine. The
  // durable guard is the public-package route, not a frozen engine tree.

  // Belt and braces for a checkout without git history: the imported public
  // barrel must still be the accepted one.
  const barrel = readFileSync(join(ROOT, 'engine', 'src', 'full', 'authoring.js'), 'utf8');
  assert.ok(barrel.includes('PUBLIC-SURFACE-001'), 'engine authoring barrel is not the imported snapshot');
  assert.ok(barrel.includes('VOXEL-PIVOT-001'), 'Voxel Forge is not routed through engine/full');
  assert.ok(!/SUMO IS A BOXER/i.test(barrel), 'the engine barrel names this game');
});
