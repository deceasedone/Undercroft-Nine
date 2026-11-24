// Three.js goes into its own chunk so the game code can change without re-downloading the engine.
export default {
  // relative asset paths, so the build also works from a sub-folder (e.g. a portfolio's /projects/undercroft/)
  base: './',
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: { output: { manualChunks: { three: ['three'] } } },
  },
};
