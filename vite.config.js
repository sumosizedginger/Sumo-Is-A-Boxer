/**
 * SUMO IS A BOXER — build configuration.
 *
 * The engine is consumed as a PACKAGE (`file:./engine` -> node_modules symlink),
 * not as a relative source tree. `dedupe` keeps a single Three.js instance so the
 * engine's renderer resources and the game's presentation layer share one runtime.
 */
export default {
  root: '.',
  server: {
    host: '127.0.0.1',
    port: 5180,
    strictPort: true,
    fs: { allow: ['.', './engine'] }
  },
  resolve: {
    dedupe: ['three'],
    preserveSymlinks: false
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true
  }
};
